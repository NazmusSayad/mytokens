import type { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import {
  fileModifiedTimestampMs,
  inferProviderFromModel,
  normalizeTokens,
  readJsonlSync,
  resolveHome,
  workspaceLabelFromKey,
} from '@/helpers/parser.js'
import type { DatabaseSync } from 'node:sqlite'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseCopilot(): Promise<UsageDataMessage[]> {
  const dbPath = resolveHome('~/.copilot/session-store.db')
  const db = await readSQLiteDB(dbPath)
  if (db) {
    try {
      const messages = await parseCopilotSqlite(db)
      db.close()
      return messages
    } catch {
      db.close()
    }
  }
  return parseCopilotFile(resolveHome('~/.copilot/usage.jsonl'))
}

// ─── SQLite parser (current Copilot CLI) ────────────────────────────────────

async function parseCopilotSqlite(
  db: DatabaseSync
): Promise<UsageDataMessage[]> {
  const rows = await sqliteAll(
    db,
    `
      SELECT
        e.model,
        e.input_tokens,
        e.output_tokens,
        e.cache_read_tokens,
        e.cache_write_tokens,
        e.reasoning_tokens,
        e.created_at,
        s.cwd,
        s.repository
      FROM assistant_usage_events e
      LEFT JOIN sessions s ON s.id = e.session_id
      ORDER BY e.created_at ASC
    `
  )

  const messages: UsageDataMessage[] = []
  for (const row of rows) {
    const input = rowToNumber(row.input_tokens)
    const output = rowToNumber(row.output_tokens)
    const cacheRead = rowToNumber(row.cache_read_tokens)
    const cacheWrite = rowToNumber(row.cache_write_tokens)
    const reasoning = rowToNumber(row.reasoning_tokens)

    if (
      input === 0 &&
      output === 0 &&
      cacheRead === 0 &&
      cacheWrite === 0 &&
      reasoning === 0
    ) {
      continue
    }

    const model = rowToModel(row.model)
    const inferred = inferProviderFromModel(model)
    const providerId = inferred === 'unknown' ? 'github-copilot' : inferred

    const timestampMs = timestampMsFromRow(row.created_at)
    if (timestampMs === undefined) continue

    const cwd = rowToString(row.cwd)
    const repository = rowToString(row.repository)

    messages.push({
      source: 'copilot',
      agent: 'default',
      type: 'assistant',
      date: new Date(timestampMs),
      model: {
        id: model,
        provider: providerId,
      },
      tokens: normalizeTokens(input, output, cacheRead, cacheWrite, reasoning),
      project: {
        name: repository ? workspaceLabelFromKey(repository) : undefined,
        path: cwd || undefined,
      },
    })
  }

  return messages
}

// ─── Legacy JSONL parser (older Copilot CLI) ────────────────────────────────

function parseCopilotFile(path: string): UsageDataMessage[] {
  const fallbackTimestamp = fileModifiedTimestampMs(path)
  const lines = readJsonlSync(path)
  const messages: UsageDataMessage[] = []

  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue
    const span = raw as Record<string, unknown>

    if (!isChatSpan(span)) continue

    const attributes = span.attributes
    if (!attributes || typeof attributes !== 'object') continue
    const attrs = attributes as Record<string, unknown>

    const input = attrI64(attrs, 'gen_ai.usage.input_tokens')
    const output = attrI64(attrs, 'gen_ai.usage.output_tokens')
    const cacheRead = attrI64(attrs, 'gen_ai.usage.cache_read.input_tokens')
    const cacheWrite = attrI64(attrs, 'gen_ai.usage.cache_write.input_tokens')
    const reasoning = attrI64(attrs, 'gen_ai.usage.reasoning.output_tokens')

    const model =
      firstNonEmptyAttr(attrs, [
        'gen_ai.response.model',
        'gen_ai.request.model',
      ]) || 'unknown'

    const inferred = inferProviderFromModel(model)
    const providerId = inferred === 'unknown' ? 'github-copilot' : inferred

    const timestampMs =
      timestampMsFromValue(span.endTime) ||
      timestampMsFromValue(span.startTime) ||
      fallbackTimestamp

    const cacheReadForInput = Math.min(
      Math.max(cacheRead, 0),
      Math.max(input, 0)
    )
    const tokens = normalizeTokens(
      input - cacheReadForInput,
      output,
      cacheRead,
      cacheWrite,
      reasoning
    )
    if (
      tokens.input === 0 &&
      tokens.output === 0 &&
      tokens.cacheInput === 0 &&
      tokens.cacheOutput === 0 &&
      tokens.reasoning === 0
    ) {
      continue
    }

    messages.push({
      source: 'copilot',
      agent: 'default',
      type: 'assistant',
      date: new Date(timestampMs),
      model: {
        id: model,
        provider: providerId,
      },
      tokens,
    })
  }

  return messages
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToNumber(value: unknown): number {
  if (value === undefined || value === null) return 0
  const num = typeof value === 'bigint' ? Number(value) : Number(value)
  if (isNaN(num)) return 0
  return Math.max(Math.floor(num), 0)
}

function rowToString(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value)
}

function rowToModel(value: unknown): string {
  const model = rowToString(value).trim()
  return model || 'unknown'
}

function timestampMsFromRow(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  if (!text) return undefined
  const parsed = Date.parse(text)
  if (!isNaN(parsed)) return parsed
  return undefined
}

function isChatSpan(value: Record<string, unknown>): boolean {
  if (value.type !== 'span') return false

  const opName = (value.attributes as Record<string, unknown>)?.[
    'gen_ai.operation.name'
  ]
  if (opName === 'chat') return true

  const name = String(value.name || '')
  return name.startsWith('chat ')
}

function attrI64(attributes: Record<string, unknown>, key: string): number {
  const val = attributes[key]
  if (val === undefined || val === null) return 0
  const num = extractI64(val)
  if (num !== undefined) return Math.max(num, 0)
  if (typeof val === 'string') {
    const parsed = Number(val)
    if (!isNaN(parsed)) return Math.max(Math.floor(parsed), 0)
  }
  return 0
}

function extractI64(value: unknown): number | undefined {
  if (typeof value === 'number') return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!isNaN(parsed)) return Math.floor(parsed)
  }
  if (typeof value === 'bigint') return Number(value)
  return undefined
}

function firstNonEmptyAttr(
  attributes: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const val = attributes[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return undefined
}

function timestampMsFromValue(value: unknown): number | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined
  const seconds = extractI64(value[0])
  const nanos = extractI64(value[1])
  if (seconds === undefined || nanos === undefined) return undefined
  return seconds * 1000 + nanos / 1_000_000
}
