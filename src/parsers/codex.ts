import { UsageDataMessage, UsageDataToken } from '@/core/types.js'
import {
  canonicalProvider,
  deriveModeFromAgent,
  extractI64,
  extractString,
  fileModifiedTimestampMs,
  inferProviderFromModel,
  normalizeAgentName,
  normalizeTokens,
  normalizeWorkspaceKey,
  parseTimestampValue,
  readJsonlSync,
  resolveHome,
  scanDirectory,
  workspaceLabelFromKey,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CodexPayload {
  type?: string
  model?: string
  model_name?: string
  model_info?: { slug?: string }
  info?: CodexInfo
  source?: string
  cwd?: string
  model_provider?: string
  agent_nickname?: string
}

interface CodexInfo {
  model?: string
  model_name?: string
  last_token_usage?: CodexTokenUsage
  total_token_usage?: CodexTokenUsage
}

interface CodexTokenUsage {
  input_tokens?: number
  output_tokens?: number
  cached_input_tokens?: number
  cache_read_input_tokens?: number
  reasoning_output_tokens?: number
}

interface CodexTotals {
  input: number
  output: number
  cached: number
  reasoning: number
}

interface CodexParseState {
  currentModel: string | undefined
  previousTotals: CodexTotals | undefined
  sessionIsHeadless: boolean
  sessionProvider: string | undefined
  sessionAgent: string | undefined
  sessionWorkspaceKey: string | undefined
  sessionWorkspaceLabel: string | undefined
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseCodex(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const fixedPath = resolveHome('~/.codex/usage.jsonl')
  results.push(...parseCodexFile(fixedPath))

  const sessionsRoot = resolveHome('~/.codex/sessions')
  const sessionFiles = scanDirectory(sessionsRoot, '*.jsonl')
  for (const path of sessionFiles) {
    results.push(...parseCodexFile(path))
  }

  return results
}

// ─── File-level parser ───────────────────────────────────────────────────────

function parseCodexFile(path: string): UsageDataMessage[] {
  const fallbackTimestamp = fileModifiedTimestampMs(path)
  const lines = readJsonlSync(path)
  const state = createCodexParseState()
  const messages: UsageDataMessage[] = []
  const pendingModelMessages: Array<{
    message: UsageDataMessage
    usedFallbackTimestamp: boolean
  }> = []

  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>
    const entryType = String(entry.type || '')

    let handled = false

    // session_meta
    if (entryType === 'session_meta') {
      const payload = parseCodexPayload(entry.payload)
      if (payload) {
        if (payload.source === 'exec') state.sessionIsHeadless = true
        if (payload.model_provider)
          state.sessionProvider = payload.model_provider
        if (payload.agent_nickname) state.sessionAgent = payload.agent_nickname
        if (payload.cwd) {
          state.sessionWorkspaceKey = normalizeWorkspaceKey(payload.cwd)
          state.sessionWorkspaceLabel = state.sessionWorkspaceKey
            ? workspaceLabelFromKey(state.sessionWorkspaceKey)
            : undefined
        }
      }
      handled = true
    }

    // turn_context
    if (entryType === 'turn_context') {
      const payload = parseCodexPayload(entry.payload)
      const model = payload ? extractModel(payload) : undefined
      if (model) {
        state.currentModel = model
        flushPendingModelMessages(pendingModelMessages, messages, model)
      }
      handled = true
    }

    // token_count event
    if (
      entryType === 'event_msg' &&
      (entry.payload as Record<string, unknown>)?.type === 'token_count'
    ) {
      const payload = parseCodexPayload(entry.payload)
      if (!payload) continue

      const modelFromPayload = extractModel(payload)
      if (modelFromPayload) {
        state.currentModel = modelFromPayload
        flushPendingModelMessages(
          pendingModelMessages,
          messages,
          modelFromPayload
        )
      }

      const info = payload.info
      if (!info) continue

      const modelFromInfo = info.model || info.model_name
      if (modelFromInfo) {
        state.currentModel = modelFromInfo
        flushPendingModelMessages(pendingModelMessages, messages, modelFromInfo)
      }

      const totalUsage = info.total_token_usage
        ? codexTotalsFromUsage(info.total_token_usage)
        : undefined
      const lastUsage = info.last_token_usage
        ? codexTotalsFromUsage(info.last_token_usage)
        : undefined

      const { tokens, nextTotals } = computeCodexTokens(
        totalUsage,
        lastUsage,
        state.previousTotals
      )

      if (!tokens) {
        handled = true
        continue
      }

      state.previousTotals = nextTotals

      const parsedTimestamp = parseTimestampValue(entry.timestamp)
      const timestamp = parsedTimestamp || fallbackTimestamp

      const agent = state.sessionIsHeadless ? 'headless' : state.sessionAgent
      const provider = state.sessionProvider || 'openai'

      const message = buildCodexMessage(
        state.currentModel || 'unknown',
        provider,
        timestamp,
        tokens,
        agent
      )
      message.project = state.sessionWorkspaceKey
        ? {
            name: state.sessionWorkspaceLabel,
            path: state.sessionWorkspaceKey,
          }
        : undefined

      if (state.currentModel) {
        messages.push(message)
      } else {
        pendingModelMessages.push({
          message,
          usedFallbackTimestamp: parsedTimestamp === undefined,
        })
      }
      handled = true
    }

    if (handled) continue

    // Headless fallback
    const headless = parseCodexHeadlessLine(JSON.stringify(entry), state)
    if (headless) {
      headless.message.project = state.sessionWorkspaceKey
        ? {
            name: state.sessionWorkspaceLabel,
            path: state.sessionWorkspaceKey,
          }
        : undefined
      messages.push(headless.message)
    }
  }

  // Flush any remaining pending messages
  if (pendingModelMessages.length > 0) {
    flushPendingModelMessages(pendingModelMessages, messages, 'unknown')
  }

  return messages
}

// ─── Codex payload parsing ───────────────────────────────────────────────────

function parseCodexPayload(val: unknown): CodexPayload | undefined {
  if (!val || typeof val !== 'object') return undefined
  const p = val as Record<string, unknown>
  return {
    type: extractString(p.type),
    model: extractString(p.model),
    model_name: extractString(p.model_name),
    model_info: p.model_info as { slug?: string } | undefined,
    info: parseCodexInfo(p.info),
    source: extractString(p.source),
    cwd: extractString(p.cwd),
    model_provider: extractString(p.model_provider),
    agent_nickname: extractString(p.agent_nickname),
  }
}

function parseCodexInfo(val: unknown): CodexInfo | undefined {
  if (!val || typeof val !== 'object') return undefined
  const i = val as Record<string, unknown>
  return {
    model: extractString(i.model),
    model_name: extractString(i.model_name),
    last_token_usage: parseCodexTokenUsage(i.last_token_usage),
    total_token_usage: parseCodexTokenUsage(i.total_token_usage),
  }
}

function parseCodexTokenUsage(val: unknown): CodexTokenUsage | undefined {
  if (!val || typeof val !== 'object') return undefined
  const u = val as Record<string, unknown>
  return {
    input_tokens: extractI64(u.input_tokens),
    output_tokens: extractI64(u.output_tokens),
    cached_input_tokens: extractI64(u.cached_input_tokens),
    cache_read_input_tokens: extractI64(u.cache_read_input_tokens),
    reasoning_output_tokens: extractI64(u.reasoning_output_tokens),
  }
}

function extractModel(payload: CodexPayload): string | undefined {
  return (
    payload.model_info?.slug?.trim() ||
    payload.model?.trim() ||
    payload.model_name?.trim() ||
    payload.info?.model?.trim() ||
    payload.info?.model_name?.trim()
  )
}

// ─── Delta arithmetic ────────────────────────────────────────────────────────

function codexTotalsFromUsage(usage: CodexTokenUsage): CodexTotals {
  return {
    input: Math.max(usage.input_tokens || 0, 0),
    output: Math.max(usage.output_tokens || 0, 0),
    cached: Math.max(
      usage.cached_input_tokens || 0,
      usage.cache_read_input_tokens || 0,
      0
    ),
    reasoning: Math.max(usage.reasoning_output_tokens || 0, 0),
  }
}

function computeCodexTokens(
  total: CodexTotals | undefined,
  last: CodexTotals | undefined,
  previous: CodexTotals | undefined
): { tokens: UsageDataToken | undefined; nextTotals: CodexTotals | undefined } {
  // Both present with previous baseline
  if (total && last && previous) {
    if (totalsEqual(total, previous)) {
      return { tokens: undefined, nextTotals: previous }
    }
    if (
      !deltaFrom(total, previous) &&
      looksLikeStaleRegression(total, previous, last)
    ) {
      return { tokens: undefined, nextTotals: previous }
    }
    return { tokens: totalsToTokens(last), nextTotals: total }
  }

  // Both present, first event
  if (total && last && !previous) {
    return { tokens: totalsToTokens(last), nextTotals: total }
  }

  // Only total, have previous
  if (total && !last && previous) {
    if (totalsEqual(total, previous)) {
      return { tokens: undefined, nextTotals: previous }
    }
    const delta = deltaFrom(total, previous)
    if (delta) {
      return { tokens: totalsToTokens(delta), nextTotals: total }
    }
    return { tokens: undefined, nextTotals: total }
  }

  // Only total, first event
  if (total && !last && !previous) {
    return { tokens: totalsToTokens(total), nextTotals: total }
  }

  // Only last, have previous
  if (!total && last && previous) {
    return {
      tokens: totalsToTokens(last),
      nextTotals: addTotals(previous, last),
    }
  }

  // Only last, no previous
  if (!total && last && !previous) {
    return { tokens: totalsToTokens(last), nextTotals: undefined }
  }

  return { tokens: undefined, nextTotals: previous }
}

function totalsEqual(a: CodexTotals, b: CodexTotals): boolean {
  return (
    a.input === b.input &&
    a.output === b.output &&
    a.cached === b.cached &&
    a.reasoning === b.reasoning
  )
}

function deltaFrom(
  current: CodexTotals,
  previous: CodexTotals
): CodexTotals | undefined {
  if (
    current.input < previous.input ||
    current.output < previous.output ||
    current.cached < previous.cached ||
    current.reasoning < previous.reasoning
  ) {
    return undefined
  }
  return {
    input: current.input - previous.input,
    output: current.output - previous.output,
    cached: current.cached - previous.cached,
    reasoning: current.reasoning - previous.reasoning,
  }
}

function looksLikeStaleRegression(
  current: CodexTotals,
  previous: CodexTotals,
  last: CodexTotals
): boolean {
  const previousTotal =
    previous.input + previous.output + previous.cached + previous.reasoning
  const currentTotal =
    current.input + current.output + current.cached + current.reasoning
  const lastTotal = last.input + last.output + last.cached + last.reasoning

  if (previousTotal <= 0 || currentTotal <= 0 || lastTotal <= 0) return false

  return (
    currentTotal * 100 >= previousTotal * 98 ||
    currentTotal + lastTotal * 2 >= previousTotal
  )
}

function addTotals(a: CodexTotals, b: CodexTotals): CodexTotals {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cached: a.cached + b.cached,
    reasoning: a.reasoning + b.reasoning,
  }
}

function totalsToTokens(totals: CodexTotals): UsageDataToken {
  const clampedCached = Math.min(totals.cached, totals.input)
  return normalizeTokens(
    totals.input - clampedCached,
    totals.output,
    clampedCached,
    0,
    totals.reasoning
  )
}

// ─── Message building ────────────────────────────────────────────────────────

function buildCodexMessage(
  model: string,
  provider: string,
  timestamp: number,
  tokens: UsageDataToken,
  agent: string | undefined
): UsageDataMessage {
  const normalizedAgent = agent ? normalizeAgentName(agent) : undefined
  return {
    app: 'codex',
    mode: deriveModeFromAgent(normalizedAgent),
    type: 'assistant',
    date: new Date(timestamp),
    model: {
      id: model,
      provider:
        canonicalProvider(provider) ||
        inferProviderFromModel(model) ||
        'openai',
    },
    tokens,
  }
}

function flushPendingModelMessages(
  pending: Array<{ message: UsageDataMessage; usedFallbackTimestamp: boolean }>,
  messages: UsageDataMessage[],
  model: string
) {
  for (const { message } of pending) {
    message.model.id = model
    messages.push(message)
  }
  pending.length = 0
}

function createCodexParseState(): CodexParseState {
  return {
    currentModel: undefined,
    previousTotals: undefined,
    sessionIsHeadless: false,
    sessionProvider: undefined,
    sessionAgent: undefined,
    sessionWorkspaceKey: undefined,
    sessionWorkspaceLabel: undefined,
  }
}

// ─── Headless fallback ───────────────────────────────────────────────────────

function parseCodexHeadlessLine(
  line: string,
  state: CodexParseState
): { message: UsageDataMessage; usedFallbackTimestamp: boolean } | undefined {
  try {
    const value = JSON.parse(line) as Record<string, unknown>
    const modelFromValue = extractCodexModelFromValue(value)
    if (modelFromValue) state.currentModel = modelFromValue

    const usage = extractCodexHeadlessUsage(value)
    if (!usage) return undefined

    const model = usage.model || state.currentModel || 'unknown'
    const timestamp = usage.timestampMs || fileModifiedTimestampMs('')
    const provider = state.sessionProvider || 'openai'
    const agent = state.sessionIsHeadless ? 'headless' : state.sessionAgent

    if (usage.input === 0 && usage.output === 0 && usage.cached === 0) {
      return undefined
    }

    return {
      message: buildCodexMessage(
        model,
        provider,
        timestamp,
        normalizeTokens(usage.input, usage.output, usage.cached, 0, 0),
        agent
      ),
      usedFallbackTimestamp: usage.timestampMs === undefined,
    }
  } catch {
    return undefined
  }
}

function extractCodexModelFromValue(
  value: Record<string, unknown>
): string | undefined {
  return (
    extractString(value.model) ||
    extractString(value.model_name) ||
    extractString((value.data as Record<string, unknown>)?.model) ||
    extractString((value.data as Record<string, unknown>)?.model_name) ||
    extractString((value.response as Record<string, unknown>)?.model)
  )
}

function extractCodexHeadlessUsage(value: Record<string, unknown>):
  | {
      input: number
      output: number
      cached: number
      model?: string
      timestampMs?: number
    }
  | undefined {
  const usage =
    value.usage ||
    (value.data as Record<string, unknown>)?.usage ||
    (value.result as Record<string, unknown>)?.usage ||
    (value.response as Record<string, unknown>)?.usage

  if (!usage || typeof usage !== 'object') return undefined
  const u = usage as Record<string, unknown>

  const inputTokens =
    extractI64(u.input_tokens) ??
    extractI64(u.prompt_tokens) ??
    extractI64(u.input) ??
    0
  const outputTokens =
    extractI64(u.output_tokens) ??
    extractI64(u.completion_tokens) ??
    extractI64(u.output) ??
    0
  const cachedTokens =
    extractI64(u.cached_input_tokens) ??
    extractI64(u.cache_read_input_tokens) ??
    extractI64(u.cached_tokens) ??
    0

  const model =
    extractCodexModelFromValue(value) ||
    extractCodexModelFromValue(value.data as Record<string, unknown>)
  const timestampMs = parseTimestampValue(
    value.timestamp ||
      value.time ||
      value.created_at ||
      (value.data as Record<string, unknown>)?.timestamp
  )

  return {
    input: Math.max(inputTokens - cachedTokens, 0),
    output: outputTokens,
    cached: cachedTokens,
    model,
    timestampMs,
  }
}
