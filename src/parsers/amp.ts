import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  inferProviderFromModel,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'
import { basename } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AmpThread {
  id?: string
  created?: number
  messages?: AmpMessage[]
  usageLedger?: AmpUsageLedger
}

interface AmpMessage {
  role?: string
  messageId?: number
  usage?: AmpMessageUsage
}

interface AmpMessageUsage {
  model?: string
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
  credits?: number
}

interface AmpUsageLedger {
  events?: AmpUsageEvent[]
}

interface AmpUsageEvent {
  timestamp?: string
  model?: string
  credits?: number
  tokens?: AmpTokens
  toMessageId?: number
}

interface AmpTokens {
  input?: number
  output?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}

interface AmpUsageRecord {
  model: string
  timestamp: number
  hasExplicitTimestamp: boolean
  messageId?: number
  ledgerToMessageId?: number
  tokens: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    reasoning: number
  }
  cost: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseAmp(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.local/share/amp/threads')
  const files = scanDirectory(root, '*.json')

  for (const path of files) {
    if (!basename(path).startsWith('T-')) continue
    const messages = parseAmpFile(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseAmpFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  const fileMtime = fileModifiedTimestampMs(path)

  let thread: AmpThread
  try {
    thread = JSON.parse(data.toString('utf-8')) as AmpThread
  } catch {
    return []
  }

  const threadId = thread.id || basename(path, '.json') || 'unknown'
  const threadCreated = thread.created || 0

  const ledgerRecords = parseAmpLedgerRecords(
    thread.usageLedger,
    threadCreated,
    fileMtime
  )
  const messageRecords = parseAmpMessageRecords(
    thread.messages,
    threadCreated,
    fileMtime
  )

  if (ledgerRecords.length === 0) {
    return messageRecords
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((record) => recordToMessage(record, threadId))
  }

  const consumed = new Array<boolean>(ledgerRecords.length).fill(false)
  let searchStart = 0
  const unmatchedMessageRecords: AmpUsageRecord[] = []

  for (const messageRecord of messageRecords) {
    const matchIndex = findMatchingLedgerRecord(
      ledgerRecords,
      consumed,
      searchStart,
      messageRecord
    )
    if (matchIndex !== undefined) {
      consumed[matchIndex] = true
      searchStart = matchIndex + 1
      ledgerRecords[matchIndex] = mergeRecords(
        ledgerRecords[matchIndex],
        messageRecord
      )
    } else {
      unmatchedMessageRecords.push(messageRecord)
    }
  }

  const allRecords = [...ledgerRecords, ...unmatchedMessageRecords]
  allRecords.sort((a, b) => a.timestamp - b.timestamp)

  return allRecords.map((record) => recordToMessage(record, threadId))
}

function parseAmpLedgerRecords(
  usageLedger: AmpUsageLedger | undefined,
  threadCreatedMs: number,
  fileMtimeMs: number
): AmpUsageRecord[] {
  if (!usageLedger?.events) return []

  const records: AmpUsageRecord[] = []
  for (const event of usageLedger.events) {
    const model = event.model
    if (!model) continue

    const explicitTimestamp = event.timestamp
      ? Date.parse(event.timestamp)
      : undefined
    const timestamp = fallbackTimestamp(
      explicitTimestamp,
      threadCreatedMs,
      fileMtimeMs
    )

    const tokens = event.tokens || { input: 0, output: 0 }

    records.push({
      model,
      timestamp,
      hasExplicitTimestamp:
        explicitTimestamp !== undefined && !isNaN(explicitTimestamp),
      messageId: undefined,
      ledgerToMessageId:
        event.toMessageId && event.toMessageId > 0
          ? event.toMessageId
          : undefined,
      tokens: {
        input: Math.max(0, tokens.input || 0),
        output: Math.max(0, tokens.output || 0),
        cacheRead: Math.max(0, tokens.cacheReadInputTokens || 0),
        cacheWrite: Math.max(0, tokens.cacheCreationInputTokens || 0),
        reasoning: 0,
      },
      cost: Math.max(0, event.credits || 0),
    })
  }
  return records
}

function parseAmpMessageRecords(
  threadMessages: AmpMessage[] | undefined,
  threadCreatedMs: number,
  fileMtimeMs: number
): AmpUsageRecord[] {
  if (!threadMessages) return []

  const baseTimestamp = threadCreatedMs || fileMtimeMs

  const records: AmpUsageRecord[] = []
  for (const msg of threadMessages) {
    if (msg.role !== 'assistant') continue
    if (!msg.usage) continue

    const usage = msg.usage
    const model = usage.model
    if (!model) continue

    const messageId = msg.messageId || 0
    const timestamp = baseTimestamp + messageId * 1000

    records.push({
      model,
      timestamp,
      hasExplicitTimestamp: false,
      messageId: messageId > 0 ? messageId : undefined,
      ledgerToMessageId: undefined,
      tokens: {
        input: Math.max(0, usage.inputTokens || 0),
        output: Math.max(0, usage.outputTokens || 0),
        cacheRead: Math.max(0, usage.cacheReadInputTokens || 0),
        cacheWrite: Math.max(0, usage.cacheCreationInputTokens || 0),
        reasoning: 0,
      },
      cost: Math.max(0, usage.credits || 0),
    })
  }
  return records
}

function findMatchingLedgerRecord(
  ledgerRecords: AmpUsageRecord[],
  consumed: boolean[],
  searchStart: number,
  messageRecord: AmpUsageRecord
): number | undefined {
  function findMatch(
    predicate: (index: number) => boolean
  ): number | undefined {
    for (let i = searchStart; i < ledgerRecords.length; i++) {
      if (predicate(i)) return i
    }
    for (let i = 0; i < searchStart; i++) {
      if (predicate(i)) return i
    }
    return undefined
  }

  if (messageRecord.messageId !== undefined) {
    const byId = findMatch(
      (i) =>
        !consumed[i] &&
        ledgerRecords[i].ledgerToMessageId === messageRecord.messageId
    )
    if (byId !== undefined) return byId
  }

  return findMatch(
    (i) =>
      !consumed[i] &&
      ledgerRecords[i].model === messageRecord.model &&
      ledgerRecords[i].tokens.input === messageRecord.tokens.input &&
      ledgerRecords[i].tokens.output === messageRecord.tokens.output &&
      ledgerRecords[i].tokens.cacheRead === messageRecord.tokens.cacheRead &&
      ledgerRecords[i].tokens.cacheWrite === messageRecord.tokens.cacheWrite
  )
}

function mergeRecords(
  ledgerRecord: AmpUsageRecord,
  messageRecord: AmpUsageRecord
): AmpUsageRecord {
  if (ledgerRecord.hasExplicitTimestamp) {
    if (ledgerRecord.cost > 0 || messageRecord.cost <= 0) {
      return ledgerRecord
    }
    return {
      ...ledgerRecord,
      cost: messageRecord.cost,
      messageId: messageRecord.messageId,
    }
  }

  return {
    ...ledgerRecord,
    timestamp: messageRecord.timestamp,
    messageId: messageRecord.messageId,
    cost: ledgerRecord.cost > 0 ? ledgerRecord.cost : messageRecord.cost,
  }
}

function recordToMessage(
  record: AmpUsageRecord,
  _threadId: string
): UsageDataMessage {
  return {
    app: 'amp',
    mode: 'chat',
    type: 'assistant',
    date: new Date(record.timestamp),
    model: {
      id: record.model,
      provider: inferProviderFromModel(record.model),
    },
    tokens: {
      input: record.tokens.input,
      output: record.tokens.output,
      reasoning: record.tokens.reasoning,
      cacheInput: record.tokens.cacheRead,
      cacheOutput: record.tokens.cacheWrite,
    },
  }
}

function fallbackTimestamp(
  explicit: number | undefined,
  threadCreated: number,
  fileMtime: number
): number {
  if (explicit !== undefined && !isNaN(explicit) && explicit !== 0)
    return explicit
  if (threadCreated !== 0) return threadCreated
  return fileMtime
}
