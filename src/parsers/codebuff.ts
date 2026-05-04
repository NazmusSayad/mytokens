import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  inferProviderFromModel,
  parseTimestampValue,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'
import { basename } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CodebuffMessage {
  variant?: string
  role?: string
  timestamp?: unknown
  createdAt?: unknown
  metadata?: CodebuffMetadata
  credits?: number
  id?: string
}

interface CodebuffMetadata {
  model?: string
  timestamp?: unknown
  usage?: CodebuffUsage
  codebuff?: { usage?: CodebuffUsage; model?: string }
  runState?: {
    sessionState?: {
      mainAgentState?: { messageHistory?: CodebuffRunStateMessage[] }
    }
  }
}

interface CodebuffUsage {
  inputTokens?: number
  input_tokens?: number
  promptTokens?: number
  prompt_tokens?: number
  outputTokens?: number
  output_tokens?: number
  completionTokens?: number
  completion_tokens?: number
  cacheReadInputTokens?: number
  cache_read_input_tokens?: number
  cachedTokensCreated?: number
  cached_tokens_created?: number
  cacheCreationInputTokens?: number
  cache_creation_input_tokens?: number
  cacheCreationTokens?: number
  cache_creation_tokens?: number
  credits?: number
  model?: string
  promptTokensDetails?: {
    cachedTokens?: number
    cached_tokens?: number
  }
  prompt_tokens_details?: {
    cached_tokens?: number
  }
}

interface CodebuffRunStateMessage {
  role?: string
  providerOptions?: {
    usage?: CodebuffUsage
    codebuff?: { usage?: CodebuffUsage; model?: string }
  }
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseCodebuff(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const channels = ['manicode', 'manicode-dev', 'manicode-staging']
  for (const channel of channels) {
    const root = resolveHome(`~/.config/${channel}/projects`)
    const files = scanDirectory(root, '*.json')
    for (const path of files) {
      if (basename(path) !== 'chat-messages.json') continue
      const messages = parseCodebuffFile(path)
      results.push(...messages)
    }
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseCodebuffFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  let messages: CodebuffMessage[]
  try {
    messages = JSON.parse(data.toString('utf-8')) as CodebuffMessage[]
  } catch {
    return []
  }

  if (!Array.isArray(messages)) return []

  const { chatId } = deriveContextFromPath(path)
  const chatIdTs = parseChatIdToMillis(chatId)
  const fileMtime = fileModifiedTimestampMs(path)

  const results: UsageDataMessage[] = []

  for (let ordinal = 0; ordinal < messages.length; ordinal++) {
    const msg = messages[ordinal]
    if (!isAssistantRole(msg)) continue

    const usage = extractAssistantUsage(msg)
    if (!hasSignal(usage)) continue

    const ts =
      messageTimestamp(msg) ??
      (chatIdTs !== undefined && chatIdTs > 0 ? chatIdTs : undefined) ??
      fileMtime

    const model = usage.model || 'codebuff-unknown'
    const provider = inferProviderFromModel(model)

    results.push({
      app: 'codebuff',
      mode: 'chat',
      type: 'assistant',
      date: new Date(ts),
      model: {
        id: model,
        provider,
      },
      tokens: {
        input: Math.max(0, usage.inputTokens),
        output: Math.max(0, usage.outputTokens),
        reasoning: 0,
        cacheInput: Math.max(0, usage.cacheReadInputTokens),
        cacheOutput: Math.max(0, usage.cacheCreationInputTokens),
      },
    })
  }

  return results
}

function isAssistantRole(msg: CodebuffMessage): boolean {
  const variant = msg.variant || msg.role || ''
  return variant === 'ai' || variant === 'agent' || variant === 'assistant'
}

function messageTimestamp(msg: CodebuffMessage): number | undefined {
  for (const key of ['timestamp', 'createdAt']) {
    const value = (msg as Record<string, unknown>)[key]
    if (value !== undefined) {
      const parsed = parseTimestampValue(value)
      if (parsed !== undefined) return parsed
    }
  }
  if (msg.metadata?.timestamp !== undefined) {
    const parsed = parseTimestampValue(msg.metadata.timestamp)
    if (parsed !== undefined) return parsed
  }
  return undefined
}

interface AssistantUsage {
  model?: string
  credits: number
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

function defaultUsage(): AssistantUsage {
  return {
    credits: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  }
}

function hasSignal(usage: AssistantUsage): boolean {
  return (
    usage.inputTokens > 0 ||
    usage.outputTokens > 0 ||
    usage.cacheReadInputTokens > 0 ||
    usage.cacheCreationInputTokens > 0 ||
    usage.credits > 0
  )
}

function mergeFallback(into: AssistantUsage, from: AssistantUsage): void {
  if (into.inputTokens <= 0) into.inputTokens = from.inputTokens
  if (into.outputTokens <= 0) into.outputTokens = from.outputTokens
  if (into.cacheReadInputTokens <= 0)
    into.cacheReadInputTokens = from.cacheReadInputTokens
  if (into.cacheCreationInputTokens <= 0)
    into.cacheCreationInputTokens = from.cacheCreationInputTokens
  if (!into.model) into.model = from.model
  if (into.credits <= 0) into.credits = from.credits
}

function extractAssistantUsage(msg: CodebuffMessage): AssistantUsage {
  const usage = defaultUsage()

  if (msg.metadata) {
    const meta = msg.metadata
    if (meta.model) usage.model = meta.model
    if (meta.usage) mergeFallback(usage, parseUsageObject(meta.usage))
    if (meta.codebuff?.usage)
      mergeFallback(usage, parseUsageObject(meta.codebuff.usage))
    const runStateUsage = extractUsageFromRunState(meta)
    if (runStateUsage) mergeFallback(usage, runStateUsage)
  }

  if (msg.credits && msg.credits > 0 && usage.credits <= 0) {
    usage.credits = msg.credits
  }

  return usage
}

function extractUsageFromRunState(
  metadata: CodebuffMetadata
): AssistantUsage | undefined {
  const history =
    metadata.runState?.sessionState?.mainAgentState?.messageHistory
  if (!Array.isArray(history)) return undefined

  const accumulator = defaultUsage()
  let foundAny = false

  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]
    if (entry.role !== 'assistant') continue
    if (!entry.providerOptions) continue

    const entryUsage = defaultUsage()
    if (entry.providerOptions.usage) {
      mergeFallback(entryUsage, parseUsageObject(entry.providerOptions.usage))
    }
    const cb = entry.providerOptions.codebuff
    if (cb?.usage) {
      mergeFallback(entryUsage, parseUsageObject(cb.usage))
    }
    if (cb?.model) entryUsage.model = cb.model

    if (hasSignal(entryUsage) || entryUsage.model) {
      foundAny = true
    }
    mergeFallback(accumulator, entryUsage)
  }

  return foundAny ? accumulator : undefined
}

function parseUsageObject(value: CodebuffUsage): AssistantUsage {
  const usage = defaultUsage()

  usage.inputTokens =
    pickNumber(value, [
      'inputTokens',
      'input_tokens',
      'promptTokens',
      'prompt_tokens',
    ]) || 0
  usage.outputTokens =
    pickNumber(value, [
      'outputTokens',
      'output_tokens',
      'completionTokens',
      'completion_tokens',
    ]) || 0

  const cacheRead =
    pickNumber(value, [
      'cacheReadInputTokens',
      'cache_read_input_tokens',
      'cachedTokensCreated',
      'cached_tokens_created',
    ]) ||
    value.promptTokensDetails?.cachedTokens ||
    value.prompt_tokens_details?.cached_tokens ||
    0

  const cacheWrite =
    pickNumber(value, [
      'cacheCreationInputTokens',
      'cache_creation_input_tokens',
      'cacheCreationTokens',
      'cache_creation_tokens',
    ]) || 0

  usage.cacheReadInputTokens = cacheRead
  usage.cacheCreationInputTokens = cacheWrite

  if (value.credits) usage.credits = value.credits
  if (value.model) usage.model = value.model

  return usage
}

function pickNumber(value: CodebuffUsage, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = (value as Record<string, unknown>)[key]
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const parsed = Number(v)
      if (!isNaN(parsed)) return parsed
    }
  }
  return undefined
}

function deriveContextFromPath(path: string): {
  channel: string
  projectBasename: string
  chatId: string
} {
  const parts = path.replace(/\\/g, '/').split('/')
  const chatId = parts[parts.length - 2] || 'unknown'
  const projectBasename = parts[parts.length - 4] || 'unknown'
  const channel = parts[parts.length - 6] || 'manicode'
  return { channel, projectBasename, chatId }
}

function parseChatIdToMillis(chatId: string): number | undefined {
  const tIndex = chatId.indexOf('T')
  if (tIndex === -1) return undefined

  const date = chatId.slice(0, tIndex)
  const timeWithSeparator = chatId.slice(tIndex)
  const rebuilt = date + timeWithSeparator.replace(/-/g, ':')

  const parsed = Date.parse(rebuilt)
  if (!isNaN(parsed)) return parsed
  return undefined
}
