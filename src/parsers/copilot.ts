import { UsageDataMessage } from '@/core/types.js'
import {
  extractI64,
  fileModifiedTimestampMs,
  inferProviderFromModel,
  normalizeTokens,
  readJsonlSync,
  resolveHome,
} from '@/helpers/parser.js'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseCopilot(): Promise<UsageDataMessage[]> {
  const path = resolveHome('~/.copilot/usage.jsonl')
  return parseCopilotFile(path)
}

// ─── File-level parser ───────────────────────────────────────────────────────

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
      app: 'copilot',
      mode: 'chat',
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
