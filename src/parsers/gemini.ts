import { UsageDataMessage } from '@/core/types.js'
import {
  extractI64,
  extractString,
  fileModifiedTimestampMs,
  normalizeTokens,
  parseTimestampValue,
  readFileOrNone,
  readJsonlSync,
  resolveHome,
  scanDirectory,
  subtractCachedOverlap,
} from '@/helpers/parser.js'
import { basename, extname } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeminiSession {
  sessionId: string
  projectHash: string
  startTime: string
  lastUpdated: string
  messages: GeminiMessage[]
}

interface GeminiMessage {
  id: string
  timestamp?: string
  type: string
  tokens?: GeminiTokens
  model?: string
}

interface GeminiTokens {
  input?: number
  output?: number
  cached?: number
  thoughts?: number
  tool?: number
  total?: number
}

interface GeminiHeadlessUsage {
  model: string
  input: number
  output: number
  cached: number
  reasoning: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseGemini(): Promise<UsageDataMessage[]> {
  const root = resolveHome('~/.gemini/tmp')
  const files = scanDirectory(root, '*.json|*.jsonl')
  const results: UsageDataMessage[] = []

  for (const path of files) {
    const messages = parseGeminiFile(path)
    results.push(...messages)
  }

  return results
}

// ─── File-level parser ───────────────────────────────────────────────────────

function parseGeminiFile(path: string): UsageDataMessage[] {
  const fallbackTimestamp = fileModifiedTimestampMs(path)
  const ext = extname(path)

  if (ext === '.jsonl') {
    return parseGeminiHeadlessJsonl(path, fallbackTimestamp)
  }

  // Validate path for .json files
  const fileName = basename(path)
  const isLegacy = fileName.startsWith('session-')
  if (!isLegacy && !isValidGeminiPath(path)) {
    return []
  }

  const data = readFileOrNone(path)
  if (!data) return []

  // Try structured session JSON
  try {
    const session = JSON.parse(data.toString('utf-8')) as GeminiSession
    if (session.sessionId && Array.isArray(session.messages)) {
      return parseGeminiSession(session, fallbackTimestamp)
    }
  } catch {
    // ignore
  }

  // Try headless JSON
  try {
    const value = JSON.parse(data.toString('utf-8')) as Record<string, unknown>
    const sessionId = basename(path, extname(path)) || 'unknown'
    const messages = parseGeminiHeadlessValue(
      value,
      sessionId,
      fallbackTimestamp
    )
    if (messages.length > 0) return messages
  } catch {
    // ignore
  }

  // Fallback to headless JSONL
  return parseGeminiHeadlessJsonl(path, fallbackTimestamp)
}

function isValidGeminiPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.indexOf('.gemini/tmp/')
  if (idx === -1) return false
  const afterTmp = normalized.slice(idx + '.gemini/tmp/'.length)
  const parts = afterTmp.split('/')
  // Expect: <id>/chats/<filename>
  return parts.length === 3 && parts[1] === 'chats'
}

// ─── Structured session parsing ──────────────────────────────────────────────

function parseGeminiSession(
  session: GeminiSession,
  fallbackTimestamp: number
): UsageDataMessage[] {
  const messages: UsageDataMessage[] = []
  const sessionId = session.sessionId

  for (const msg of session.messages) {
    if (msg.type !== 'gemini') continue
    if (!msg.tokens || !msg.model) continue

    const timestamp = parseTimestampValue(msg.timestamp) || fallbackTimestamp
    messages.push(
      buildGeminiTokenMessage(msg.model, sessionId, timestamp, msg.tokens)
    )
  }

  return messages
}

function buildGeminiTokenMessage(
  model: string,
  sessionId: string,
  timestamp: number,
  tokens: GeminiTokens
): UsageDataMessage {
  const input = tokens.input || 0
  const cached = tokens.cached || 0
  const output = tokens.output || 0
  const reasoning = tokens.thoughts || 0
  const tool = tokens.tool || 0
  const total = tokens.total

  const [normalizedInput, normalizedCache] =
    normalizeGeminiSessionInputAndCache(
      input,
      cached,
      output,
      reasoning,
      tool,
      total
    )

  return {
    app: 'gemini',
    mode: 'chat',
    type: 'assistant',
    date: new Date(timestamp),
    model: { id: model, provider: 'google' },
    tokens: normalizeTokens(
      normalizedInput,
      output,
      normalizedCache,
      0,
      reasoning
    ),
  }
}

function normalizeGeminiSessionInputAndCache(
  input: number,
  cached: number,
  output: number,
  reasoning: number,
  tool: number,
  total: number | undefined
): [number, number] {
  const safeInput = Math.max(input, 0)
  const safeCached = Math.max(cached, 0)

  if (total === undefined) return [safeInput, safeCached]

  const safeTotal = Math.max(total, 0)
  const inclusiveTotal =
    safeInput + Math.max(output, 0) + Math.max(reasoning, 0) + Math.max(tool, 0)
  const exclusiveTotal = inclusiveTotal + safeCached

  if (
    safeCached > 0 &&
    safeTotal === inclusiveTotal &&
    safeTotal !== exclusiveTotal
  ) {
    return subtractCachedOverlap(safeInput, safeCached)
  }

  return [safeInput, safeCached]
}

// ─── Headless JSONL parsing ──────────────────────────────────────────────────

function parseGeminiHeadlessJsonl(
  path: string,
  fallbackTimestamp: number
): UsageDataMessage[] {
  const lines = readJsonlSync(path)
  const messages: UsageDataMessage[] = []
  let sessionId = basename(path, extname(path)) || 'unknown'
  let currentModel: string | undefined
  const directMessageIndices = new Map<string, number>()

  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue
    const value = raw as Record<string, unknown>

    const eventType = String(value.type || '')

    if (eventType === 'init') {
      const model = extractString(value.model)
      if (model) currentModel = model
      const id = extractString(value.session_id || value.sessionId)
      if (id) sessionId = id
      continue
    }

    const id = extractString(value.session_id || value.sessionId)
    if (id) sessionId = id

    if (eventType === 'gemini') {
      const model = extractString(value.model)
      if (model) currentModel = model

      const msg = parseDirectGeminiTokenMessage(
        value,
        currentModel,
        sessionId,
        fallbackTimestamp
      )
      if (msg) {
        const msgId = extractString(value.id)
        if (msgId && directMessageIndices.has(msgId)) {
          const idx = directMessageIndices.get(msgId)!
          messages[idx] = msg
        } else {
          if (msgId) directMessageIndices.set(msgId, messages.length)
          messages.push(msg)
        }
      }
      continue
    }

    const stats =
      value.stats ||
      ((value.result as Record<string, unknown>)?.stats as Record<
        string,
        unknown
      >)
    if (stats && typeof stats === 'object') {
      const timestamp =
        parseTimestampValue(value.timestamp) || fallbackTimestamp
      messages.push(
        ...buildMessagesFromStats(
          stats as Record<string, unknown>,
          currentModel,
          sessionId,
          timestamp
        )
      )
    }
  }

  return messages
}

function parseDirectGeminiTokenMessage(
  value: Record<string, unknown>,
  modelHint: string | undefined,
  sessionId: string,
  fallbackTimestamp: number
): UsageDataMessage | undefined {
  const model = extractString(value.model) || modelHint
  if (!model) return undefined
  const tokensValue = value.tokens
  if (!tokensValue || typeof tokensValue !== 'object') return undefined

  const tokens = tokensValue as Record<string, unknown>
  const input = extractI64(tokens.input) || 0
  const output = extractI64(tokens.output) || 0
  const cached = extractI64(tokens.cached) || 0
  const reasoning = extractI64(tokens.thoughts) || 0

  const timestamp = parseTimestampValue(value.timestamp) || fallbackTimestamp
  const [normInput, normCache] = subtractCachedOverlap(input, cached)

  return {
    app: 'gemini',
    mode: 'chat',
    type: 'assistant',
    date: new Date(timestamp),
    model: { id: model, provider: 'google' },
    tokens: normalizeTokens(normInput, output, normCache, 0, reasoning),
  }
}

function parseGeminiHeadlessValue(
  value: Record<string, unknown>,
  sessionId: string,
  fallbackTimestamp: number
): UsageDataMessage[] {
  if (value.type === 'gemini') {
    const msg = parseDirectGeminiTokenMessage(
      value,
      undefined,
      sessionId,
      fallbackTimestamp
    )
    if (msg) return [msg]
  }

  const stats =
    value.stats ||
    ((value.result as Record<string, unknown>)?.stats as Record<
      string,
      unknown
    >)
  if (!stats || typeof stats !== 'object') return []

  const modelHint = extractString(value.model)
  const timestamp = parseTimestampValue(value.timestamp) || fallbackTimestamp
  return buildMessagesFromStats(
    stats as Record<string, unknown>,
    modelHint,
    sessionId,
    timestamp
  )
}

function buildMessagesFromStats(
  stats: Record<string, unknown>,
  modelHint: string | undefined,
  sessionId: string,
  timestamp: number
): UsageDataMessage[] {
  const usages = extractGeminiUsages(stats, modelHint)
  return usages.map((usage) => {
    const [input, cacheRead] = subtractCachedOverlap(usage.input, usage.cached)
    return {
      app: 'gemini',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: { id: usage.model, provider: 'google' },
      tokens: normalizeTokens(
        input,
        usage.output,
        cacheRead,
        0,
        usage.reasoning
      ),
    }
  })
}

function extractGeminiUsages(
  stats: Record<string, unknown>,
  modelHint: string | undefined
): GeminiHeadlessUsage[] {
  const models = stats.models
  if (models && typeof models === 'object') {
    const usages: GeminiHeadlessUsage[] = []
    for (const [model, data] of Object.entries(models)) {
      if (!data || typeof data !== 'object') continue
      const tokens = (data as Record<string, unknown>).tokens
      if (!tokens || typeof tokens !== 'object') continue
      const t = tokens as Record<string, unknown>

      const input =
        extractI64(t.prompt) ??
        extractI64(t.input) ??
        extractI64(t.input_tokens) ??
        0
      const output =
        extractI64(t.candidates) ??
        extractI64(t.output) ??
        extractI64(t.output_tokens) ??
        0
      const cached = extractI64(t.cached) ?? extractI64(t.cached_tokens) ?? 0
      const reasoning = extractI64(t.thoughts) ?? extractI64(t.reasoning) ?? 0

      if (input === 0 && output === 0 && cached === 0 && reasoning === 0)
        continue

      usages.push({ model, input, output, cached, reasoning })
    }
    if (usages.length > 0) return usages
  }

  const input =
    extractI64(stats.input_tokens) ?? extractI64(stats.prompt_tokens) ?? 0
  const output =
    extractI64(stats.output_tokens) ?? extractI64(stats.candidates_tokens) ?? 0
  const cached = extractI64(stats.cached_tokens) ?? 0
  const reasoning =
    extractI64(stats.thoughts_tokens) ?? extractI64(stats.reasoning_tokens) ?? 0

  if (input === 0 && output === 0 && cached === 0 && reasoning === 0) return []

  return [
    {
      model: modelHint || 'unknown',
      input,
      output,
      cached,
      reasoning,
    },
  ]
}
