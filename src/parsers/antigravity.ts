import type { UsageDataMessage } from '@/core/types.js'
import {
  inferProviderFromModel,
  readJsonlSync,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AntigravityEntry {
  type?: string
  sessionId?: string
  timestamp?: number
  modelId?: string
  providerId?: string
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  reasoning?: number
  responseId?: string
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseAntigravity(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const paths = [
    resolveHome('~/.config/antigravity-cache/sessions'),
    resolveHome('~/Library/Application Support/antigravity-cache/sessions'),
  ]

  for (const root of paths) {
    const files = scanDirectory(root, '*.jsonl')
    for (const path of files) {
      const messages = parseAntigravityFile(path)
      results.push(...messages)
    }
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseAntigravityFile(path: string): UsageDataMessage[] {
  const lines = readJsonlSync(path)
  const messages: UsageDataMessage[] = []
  let sessionModel: string | undefined

  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as AntigravityEntry
    const rowType = entry.type || ''

    if (rowType === 'session_meta') {
      const modelId = entry.modelId?.trim()
      if (modelId) sessionModel = modelId
      continue
    }

    if (rowType === 'usage') {
      const msg = parseUsageRow(entry, sessionModel)
      if (msg) messages.push(msg)
    }
  }

  return messages
}

function parseUsageRow(
  entry: AntigravityEntry,
  fallbackModel: string | undefined
): UsageDataMessage | undefined {
  const sessionId = entry.sessionId
  if (!sessionId) return undefined

  const timestamp = entry.timestamp
  if (!timestamp || timestamp <= 0) return undefined

  const modelId = entry.modelId?.trim() || fallbackModel || 'unknown'
  const providerId = entry.providerId?.trim() || inferProviderFromModel(modelId)

  const input = Math.max(0, entry.input || 0)
  const output = Math.max(0, entry.output || 0)
  const cacheRead = Math.max(0, entry.cacheRead || 0)
  const cacheWrite = Math.max(0, entry.cacheWrite || 0)
  const reasoning = Math.max(0, entry.reasoning || 0)

  if (
    input === 0 &&
    output === 0 &&
    cacheRead === 0 &&
    cacheWrite === 0 &&
    reasoning === 0
  ) {
    return undefined
  }

  return {
    app: 'antigravity',
    mode: 'chat',
    type: 'assistant',
    date: new Date(timestamp),
    model: {
      id: modelId,
      provider: providerId,
    },
    tokens: {
      input,
      output,
      reasoning,
      cacheInput: cacheRead,
      cacheOutput: cacheWrite,
    },
  }
}
