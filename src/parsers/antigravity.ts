import { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import {
  DateRange,
  fileModifiedTimestampMs,
  filePredatesRange,
  filterMessagesByDateRange,
  inferProviderFromModel,
  resolveHome,
} from '@/helpers/parser.js'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseAntigravity(
  range?: DateRange
): Promise<UsageDataMessage[]> {
  const conversationsDir = resolveHome(
    '~/.gemini/antigravity-cli/conversations'
  )

  let files: string[]
  try {
    files = readdirSync(conversationsDir)
      .filter((name) => name.endsWith('.db'))
      .map((name) => join(conversationsDir, name))
  } catch {
    return []
  }

  const results: UsageDataMessage[] = []
  for (const path of files.sort()) {
    if (filePredatesRange(path, range)) continue
    const messages = await parseConversationDb(path)
    results.push(...messages)
  }

  return filterMessagesByDateRange(results, range)
}

// ─── Conversation parsing ────────────────────────────────────────────────────

interface SessionModels {
  byDisplay: Map<string, string>
  soleModel?: string
}

async function parseConversationDb(path: string): Promise<UsageDataMessage[]> {
  const db = await readSQLiteDB(path)
  if (!db) return []

  try {
    const trajectoryRows = await sqliteAll(
      db,
      'SELECT data FROM trajectory_metadata_blob LIMIT 1'
    )
    const sessionTimestamp =
      (trajectoryRows[0]?.data instanceof Uint8Array
        ? protoTimestampMs(trajectoryRows[0].data, 2)
        : undefined) ?? fileModifiedTimestampMs(path)

    const rows = await sqliteAll(
      db,
      'SELECT data FROM gen_metadata ORDER BY idx'
    )
    const blobs = rows
      .map((row) => row.data as Uint8Array | undefined)
      .filter((data): data is Uint8Array => data instanceof Uint8Array)

    const sessionModels = buildSessionModels(blobs)
    const seenResponseIds = new Set<string>()
    const messages: UsageDataMessage[] = []

    for (const blob of blobs) {
      const message = parseGenMetadataBlob(
        blob,
        sessionTimestamp,
        sessionModels,
        seenResponseIds
      )
      if (message) messages.push(message)
    }

    return messages
  } catch {
    return []
  } finally {
    db.close()
  }
}

function buildSessionModels(blobs: Uint8Array[]): SessionModels {
  const byDisplay = new Map<string, string | null>()
  const distinctModels = new Set<string>()
  const unresolvedLabels: string[] = []

  for (const blob of blobs) {
    const chatModel = messageField(blob, 1)
    if (!chatModel) continue

    const label = nonEmptyStringField(chatModel, 21)
    const model = nonEmptyStringField(chatModel, 19)

    if (!model || isRoutingLabel(model)) {
      if (label) unresolvedLabels.push(label)
      continue
    }

    distinctModels.add(model)
    if (!label) continue

    const existing = byDisplay.get(label)
    if (existing === undefined) {
      byDisplay.set(label, model)
    } else if (existing !== null && existing !== model) {
      byDisplay.set(label, null)
    }
  }

  const resolved = new Map<string, string>()
  for (const [label, model] of byDisplay) {
    if (model) resolved.set(label, model)
  }

  const everyLabelIdentified = unresolvedLabels.every((label) =>
    resolved.has(label)
  )
  const soleModel =
    distinctModels.size === 1 && everyLabelIdentified
      ? [...distinctModels][0]
      : undefined

  return { byDisplay: resolved, soleModel }
}

function isRoutingLabel(model: string): boolean {
  return model.trim().toLowerCase() === 'gemini-default'
}

function recoverModel(
  chatModel: Uint8Array,
  sessionModels: SessionModels
): string | undefined {
  const label = nonEmptyStringField(chatModel, 21)
  if (label) return sessionModels.byDisplay.get(label)
  return sessionModels.soleModel
}

function parseGenMetadataBlob(
  blob: Uint8Array,
  sessionTimestamp: number,
  sessionModels: SessionModels,
  seenResponseIds: Set<string>
): UsageDataMessage | undefined {
  const chatModel = messageField(blob, 1)
  if (!chatModel) return undefined

  const usage = messageField(chatModel, 4)
  if (!usage) return undefined

  const input = varintField(usage, 1) + varintField(usage, 2)
  const cacheRead = varintField(usage, 5)
  const output = varintField(usage, 9)
  const reasoning = varintField(usage, 10)

  if (input === 0 && output === 0 && cacheRead === 0 && reasoning === 0) {
    return undefined
  }

  const responseId = nonEmptyStringField(usage, 11)
  if (responseId) {
    if (seenResponseIds.has(responseId)) return undefined
    seenResponseIds.add(responseId)
  }

  const responseModel = nonEmptyStringField(chatModel, 19)
  const modelRaw =
    (responseModel && !isRoutingLabel(responseModel)
      ? responseModel
      : undefined) ??
    recoverModel(chatModel, sessionModels) ??
    responseModel ??
    'unknown'

  const genTime = messageField(chatModel, 9)
  const timestampMs =
    (genTime ? protoTimestampMs(genTime, 4) : undefined) ?? sessionTimestamp
  if (timestampMs <= 0) return undefined

  return {
    source: 'antigravity',
    agent: 'default',
    type: 'assistant',
    date: new Date(timestampMs),
    model: {
      id: modelRaw,
      provider: inferProviderFromModel(modelRaw),
    },
    tokens: {
      input,
      output,
      reasoning,
      cacheInput: cacheRead,
      cacheOutput: 0,
    },
  }
}

// ─── Protobuf wire-format reader ─────────────────────────────────────────────

function readVarint(
  buf: Uint8Array,
  pos: number
): [number, number] | undefined {
  let result = 0
  let shift = 0
  let current = pos
  while (current < buf.length) {
    const byte = buf[current]
    current += 1
    result += (byte & 0x7f) * Math.pow(2, shift)
    if ((byte & 0x80) === 0) return [result, current]
    shift += 7
    if (shift >= 64) return undefined
  }
  return undefined
}

function collectFields(
  buf: Uint8Array
): Array<{ field: number; wire: number; value?: number; bytes?: Uint8Array }> {
  const fields: Array<{
    field: number
    wire: number
    value?: number
    bytes?: Uint8Array
  }> = []
  let pos = 0
  while (pos < buf.length) {
    const tag = readVarint(buf, pos)
    if (!tag) break
    const [key, afterKey] = tag
    pos = afterKey
    const field = Math.floor(key / 8)
    const wire = key % 8
    if (wire === 0) {
      const parsed = readVarint(buf, pos)
      if (!parsed) break
      const [value, after] = parsed
      fields.push({ field, wire, value })
      pos = after
    } else if (wire === 1) {
      if (pos + 8 > buf.length) break
      fields.push({ field, wire })
      pos += 8
    } else if (wire === 2) {
      const lenParsed = readVarint(buf, pos)
      if (!lenParsed) break
      const [length, afterLen] = lenParsed
      pos = afterLen
      if (pos + length > buf.length) break
      fields.push({ field, wire, bytes: buf.subarray(pos, pos + length) })
      pos += length
    } else if (wire === 5) {
      if (pos + 4 > buf.length) break
      fields.push({ field, wire })
      pos += 4
    } else {
      break
    }
  }
  return fields
}

function messageField(buf: Uint8Array, field: number): Uint8Array | undefined {
  for (const entry of collectFields(buf)) {
    if (entry.field === field && entry.bytes) return entry.bytes
  }
  return undefined
}

function rawVarintField(buf: Uint8Array, field: number): number | undefined {
  for (const entry of collectFields(buf)) {
    if (entry.field === field && entry.wire === 0) return entry.value
  }
  return undefined
}

function varintField(buf: Uint8Array, field: number): number {
  return rawVarintField(buf, field) ?? 0
}

function stringField(buf: Uint8Array, field: number): string | undefined {
  const bytes = messageField(buf, field)
  if (!bytes) return undefined
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

function nonEmptyStringField(
  buf: Uint8Array,
  field: number
): string | undefined {
  const value = stringField(buf, field)?.trim()
  return value ? value : undefined
}

function protoTimestampMs(
  parent: Uint8Array,
  field: number
): number | undefined {
  const ts = messageField(parent, field)
  if (!ts) return undefined

  const seconds = rawVarintField(ts, 1)
  if (seconds === undefined) return undefined
  const nanos = rawVarintField(ts, 2) ?? 0
  if (nanos < 0 || nanos > 999_999_999) return undefined
  if (seconds > Number.MAX_SAFE_INTEGER / 1000) return undefined

  return seconds * 1000 + Math.floor(nanos / 1_000_000)
}
