import { UsageDataMessage, UsageDataToken } from '@/core/types.js'
import {
  deriveModeFromAgent,
  extractI64,
  extractString,
  fileModifiedTimestampMs,
  normalizeAgentName,
  normalizeTokens,
  normalizeWorkspaceKey,
  parseTimestampValue,
  readFileOrNone,
  readJsonlSync,
  resolveHome,
  scanDirectory,
  workspaceLabelFromKey,
} from '@/helpers/parser.js'
import { readFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClaudeMessage {
  model?: string
  usage?: ClaudeUsage
  id?: string
}

interface ClaudeUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

interface AgentMetaFile {
  agentType?: string
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseClaude(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []
  const parentCache = new Map<string, Map<string, string>>()

  // Fixed usage files
  const fixedPaths = [
    resolveHome('~/.claude/usage.jsonl'),
    resolveHome('~/.config/claude/usage.jsonl'),
  ]
  for (const path of fixedPaths) {
    const messages = parseClaudeFile(path, parentCache)
    results.push(...messages)
  }

  // Project session files
  const projectRoot = resolveHome('~/.claude/projects')
  const projectFiles = scanDirectory(projectRoot, '*.jsonl')
  for (const path of projectFiles) {
    const messages = parseClaudeFile(path, parentCache)
    results.push(...messages)
  }

  return results
}

// ─── File-level parser ───────────────────────────────────────────────────────

function parseClaudeFile(
  path: string,
  parentCache: Map<string, Map<string, string>>
): UsageDataMessage[] {
  const [workspaceKeyFromPath, workspaceLabelFromPath] =
    claudeWorkspaceFromPath(path)
  let sessionId = basename(path, extname(path)) || 'unknown'
  const fallbackTimestamp = fileModifiedTimestampMs(path)

  // Try headless JSON first for .json files
  if (extname(path) === '.json') {
    const jsonMessages = parseClaudeHeadlessJson(
      path,
      sessionId,
      fallbackTimestamp,
      workspaceKeyFromPath,
      workspaceLabelFromPath
    )
    if (jsonMessages.length > 0) return jsonMessages
  }

  const lines = readJsonlSync(path)

  // Try to extract real project path from cwd in file entries
  const [cwdKey, cwdLabel] = extractClaudeProjectFromLines(lines)
  const workspaceKey = cwdKey || workspaceKeyFromPath
  const workspaceLabel = cwdLabel || workspaceLabelFromPath

  const messages: UsageDataMessage[] = []
  const processedHashes = new Map<string, number>() // dedup_key -> index
  const headlessState = createHeadlessState()
  let sidechainAgent: string | undefined
  let sidechainDetected = false

  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>

    // Detect sidechain on first parseable entry
    if (!sidechainDetected) {
      sidechainDetected = true
      if (entry.isSidechain === true) {
        if (typeof entry.sessionId === 'string') {
          sessionId = entry.sessionId
        }
        sidechainAgent = resolveSubagentName(
          path,
          typeof entry.sessionId === 'string' ? entry.sessionId : undefined,
          typeof entry.agentId === 'string' ? entry.agentId : undefined,
          parentCache
        )
      }
    }

    const entryType = String(entry.type || '')

    if (entryType === 'user') {
      if (isHumanTurn(JSON.stringify(entry))) {
        // human turn detected
      }
      continue
    }

    if (entryType === 'assistant') {
      const msg = parseClaudeMessage(entry)
      if (!msg || !msg.usage || !msg.model) continue

      const usage = msg.usage
      const dedupKey =
        msg.id && entry.requestId
          ? `${msg.id}:${String(entry.requestId)}`
          : undefined

      if (dedupKey && processedHashes.has(dedupKey)) {
        const existingIdx = processedHashes.get(dedupKey)!
        const existing = messages[existingIdx]
        existing.tokens = mergeTokensMax(existing.tokens, usageToTokens(usage))
        continue
      }

      const timestamp =
        parseTimestampValue(entry.timestamp) || fallbackTimestamp

      const unified = buildMessage(
        msg.model,
        usage,
        timestamp,
        workspaceKey,
        workspaceLabel,
        sidechainAgent
      )

      if (dedupKey) {
        processedHashes.set(dedupKey, messages.length)
      }
      messages.push(unified)
      continue
    }

    // Headless fallback for unhandled lines
    const headless = processClaudeHeadlessLine(
      JSON.stringify(entry),
      sessionId,
      headlessState,
      fallbackTimestamp
    )
    if (headless) {
      headless.project = workspaceKey
        ? { name: workspaceLabel, path: workspaceKey }
        : undefined
      messages.push(headless)
    }
  }

  const finalized = finalizeHeadlessState(
    headlessState,
    sessionId,
    fallbackTimestamp
  )
  if (finalized) {
    finalized.project = workspaceKey
      ? { name: workspaceLabel, path: workspaceKey }
      : undefined
    messages.push(finalized)
  }

  return messages
}

// ─── Claude typed message parsing ────────────────────────────────────────────

function parseClaudeMessage(
  entry: Record<string, unknown>
): ClaudeMessage | undefined {
  const msg = entry.message
  if (!msg || typeof msg !== 'object') return undefined
  const m = msg as Record<string, unknown>
  return {
    model: extractString(m.model),
    usage: parseClaudeUsage(m.usage),
    id: extractString(m.id),
  }
}

function parseClaudeUsage(val: unknown): ClaudeUsage | undefined {
  if (!val || typeof val !== 'object') return undefined
  const u = val as Record<string, unknown>
  return {
    input_tokens: extractI64(u.input_tokens),
    output_tokens: extractI64(u.output_tokens),
    cache_read_input_tokens: extractI64(u.cache_read_input_tokens),
    cache_creation_input_tokens: extractI64(u.cache_creation_input_tokens),
  }
}

function usageToTokens(usage: ClaudeUsage): UsageDataToken {
  return normalizeTokens(
    usage.input_tokens || 0,
    usage.output_tokens || 0,
    usage.cache_read_input_tokens || 0,
    usage.cache_creation_input_tokens || 0,
    0
  )
}

function mergeTokensMax(a: UsageDataToken, b: UsageDataToken): UsageDataToken {
  return {
    input: Math.max(a.input, b.input),
    output: Math.max(a.output, b.output),
    cacheInput: Math.max(a.cacheInput, b.cacheInput),
    cacheOutput: Math.max(a.cacheOutput, b.cacheOutput),
    reasoning: Math.max(a.reasoning, b.reasoning),
  }
}

function buildMessage(
  model: string,
  usage: ClaudeUsage,
  timestamp: number,
  workspaceKey: string | undefined,
  workspaceLabel: string | undefined,
  sidechainAgent: string | undefined
): UsageDataMessage {
  const agent = sidechainAgent ? normalizeAgentName(sidechainAgent) : undefined
  return {
    app: 'claude',
    mode: deriveModeFromAgent(agent),
    type: 'assistant',
    date: new Date(timestamp),
    model: {
      id: model,
      provider: 'anthropic',
    },
    tokens: usageToTokens(usage),
    project: workspaceKey
      ? { name: workspaceLabel, path: workspaceKey }
      : undefined,
  }
}

// ─── Workspace extraction ────────────────────────────────────────────────────

function claudeWorkspaceFromPath(
  path: string
): [string | undefined, string | undefined] {
  const parts = path.replace(/\\/g, '/').split('/')
  for (let i = 0; i < parts.length - 2; i++) {
    if (parts[i] === '.claude' && parts[i + 1] === 'projects') {
      const key = normalizeWorkspaceKey(parts[i + 2])
      const label = key ? workspaceLabelFromKey(key) : undefined
      return [key, label]
    }
  }
  return [undefined, undefined]
}

function extractClaudeProjectFromLines(
  lines: unknown[]
): [string | undefined, string | undefined] {
  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>
    const cwd = extractString(entry.cwd)
    if (cwd) {
      const key = normalizeWorkspaceKey(cwd)
      const label = key ? workspaceLabelFromKey(key) : undefined
      return [key, label]
    }
  }
  return [undefined, undefined]
}

// ─── Sidechain / Subagent resolution ─────────────────────────────────────────

function resolveSubagentName(
  path: string,
  parentSessionId: string | undefined,
  entryAgentId: string | undefined,
  parentCache: Map<string, Map<string, string>>
): string {
  const stem = basename(path, extname(path))

  // Tier 1: sibling meta.json
  const metaPath = join(dirname(path), `${stem}.meta.json`)
  try {
    const metaText = readFileSync(metaPath, 'utf-8')
    const meta = JSON.parse(metaText) as AgentMetaFile
    if (meta.agentType?.trim()) {
      return normalizeAgentName(meta.agentType.trim())
    }
  } catch {
    // ignore
  }

  // Tier 2: parent session lookup
  const lookupAgentId = entryAgentId?.trim() || sidechainAgentIdFromStem(stem)
  if (parentSessionId && lookupAgentId) {
    const parentPath = findParentSessionPath(path, parentSessionId)
    if (parentPath) {
      const subagentType = lookupSubagentTypeInParent(
        parentPath,
        lookupAgentId,
        parentCache
      )
      if (subagentType) return normalizeAgentName(subagentType)
    }
  }

  // Tier 3: fallback
  return normalizeAgentName('claude-code-subagent')
}

function sidechainAgentIdFromStem(stem: string): string | undefined {
  const agentStem = stem.startsWith('agent-') ? stem.slice(6) : undefined
  if (!agentStem) return undefined
  if (!agentStem.includes('-')) return agentStem
  const trailing = agentStem.split('-').pop()!
  if (trailing.split('').every((c) => /[0-9a-fA-F]/.test(c))) {
    return trailing
  }
  return agentStem
}

function findParentSessionPath(
  sidechainPath: string,
  parentSessionId: string
): string | undefined {
  const parentFile = `${parentSessionId}.jsonl`
  const dir = dirname(sidechainPath)

  // Nested: .../session/subagents/agent-X.jsonl → parent at .../session.jsonl
  if (basename(dir) === 'subagents') {
    const projectDir = dirname(dir)
    const candidate = join(projectDir, parentFile)
    try {
      readFileSync(candidate)
      return candidate
    } catch {
      // ignore
    }
  }

  // Flat: .../project/agent-X.jsonl → parent at .../project/<session>.jsonl
  const candidate = join(dir, parentFile)
  try {
    readFileSync(candidate)
    return candidate
  } catch {
    // ignore
  }

  return undefined
}

function lookupSubagentTypeInParent(
  parentPath: string,
  targetAgentId: string,
  parentCache: Map<string, Map<string, string>>
): string | undefined {
  if (!parentCache.has(parentPath)) {
    const lookup = buildParentSubagentTypeLookup(parentPath)
    if (lookup) parentCache.set(parentPath, lookup)
  }
  return parentCache.get(parentPath)?.get(targetAgentId)
}

function buildParentSubagentTypeLookup(
  parentPath: string
): Map<string, string> | undefined {
  try {
    const lines = readJsonlSync(parentPath)
    const toolUseTypes = new Map<string, string>() // tool_use.id → subagent_type
    const agentIdLinks = new Map<string, string>() // tool_use_id → agentId

    for (const raw of lines) {
      if (!raw || typeof raw !== 'object') continue
      const entry = raw as Record<string, unknown>
      const msg = entry.message
      if (!msg || typeof msg !== 'object') continue
      const m = msg as Record<string, unknown>
      const content = m.content
      if (!Array.isArray(content)) continue

      for (const block of content) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>
        const blockType = String(b.type || '')

        if (blockType === 'tool_use') {
          const id = extractString(b.id)
          const subagentType = extractString(
            (b.input as Record<string, unknown>)?.subagent_type
          )
          if (id && subagentType) {
            toolUseTypes.set(id, subagentType)
          }
        } else if (blockType === 'tool_result') {
          const toolUseId = extractString(b.tool_use_id)
          if (!toolUseId) continue
          const resultContent = b.content
          if (!Array.isArray(resultContent)) continue
          for (const cb of resultContent) {
            if (!cb || typeof cb !== 'object') continue
            const text = extractString((cb as Record<string, unknown>).text)
            if (text) {
              const aid = extractAgentIdFromText(text)
              if (aid) {
                agentIdLinks.set(toolUseId, aid)
                break
              }
            }
          }
        }
      }
    }

    const result = new Map<string, string>()
    for (const [toolUseId, agentId] of agentIdLinks) {
      const subagentType = toolUseTypes.get(toolUseId)
      if (subagentType) {
        result.set(agentId, subagentType)
      }
    }
    return result
  } catch {
    return undefined
  }
}

function extractAgentIdFromText(text: string): string | undefined {
  const marker = 'agentId: '
  const pos = text.indexOf(marker)
  if (pos === -1) return undefined
  const start = pos + marker.length
  const rest = text.slice(start)
  const end = rest.search(/[^a-zA-Z0-9]/)
  const id = end === -1 ? rest : rest.slice(0, end)
  return id || undefined
}

// ─── Human turn detection ────────────────────────────────────────────────────

const INTERNAL_USER_TAGS = [
  '<local-command-stdout>',
  '<local-command-stderr>',
  '<command-name>',
  '<command-message>',
  '<system-reminder>',
  '<bash-input>',
  '<bash-stdout>',
  '<bash-stderr>',
]

function isHumanTurn(rawLine: string): boolean {
  const pos = rawLine.indexOf('"content":')
  if (pos === -1) return false
  const after = rawLine.slice(pos + 10).trimStart()
  if (after.startsWith('[')) return false
  if (after.startsWith('"')) {
    const contentStart = after.slice(1)
    for (const tag of INTERNAL_USER_TAGS) {
      if (contentStart.startsWith(tag)) return false
    }
    return true
  }
  return false
}

// ─── Headless parsing ────────────────────────────────────────────────────────

interface HeadlessState {
  model: string | undefined
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  timestampMs: number | undefined
}

function createHeadlessState(): HeadlessState {
  return {
    model: undefined,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    timestampMs: undefined,
  }
}

function parseClaudeHeadlessJson(
  path: string,
  sessionId: string,
  fallbackTimestamp: number,
  workspaceKey: string | undefined,
  workspaceLabel: string | undefined
): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []
  try {
    const value = JSON.parse(data.toString('utf-8')) as Record<string, unknown>
    const msg = extractClaudeHeadlessMessage(
      value,
      sessionId,
      fallbackTimestamp
    )
    if (!msg) return []
    msg.project = workspaceKey
      ? { name: workspaceLabel, path: workspaceKey }
      : undefined
    return [msg]
  } catch {
    return []
  }
}

function processClaudeHeadlessLine(
  line: string,
  sessionId: string,
  state: HeadlessState,
  fallbackTimestamp: number
): UsageDataMessage | undefined {
  try {
    const value = JSON.parse(line) as Record<string, unknown>
    const eventType = String(value.type || '')
    let completed: UsageDataMessage | undefined

    switch (eventType) {
      case 'message_start': {
        completed = finalizeHeadlessState(state, sessionId, fallbackTimestamp)
        const model = extractClaudeModel(value)
        if (model) state.model = model
        state.timestampMs = extractClaudeTimestamp(value) || state.timestampMs
        const usage =
          (value.message as Record<string, unknown>)?.usage || value.usage
        if (usage && typeof usage === 'object') {
          updateClaudeUsage(state, usage as Record<string, unknown>)
        }
        break
      }
      case 'message_delta': {
        const usage =
          value.usage ||
          ((value.delta as Record<string, unknown>)?.usage as Record<
            string,
            unknown
          >)
        if (usage && typeof usage === 'object') {
          updateClaudeUsage(state, usage as Record<string, unknown>)
        }
        break
      }
      case 'message_stop': {
        completed = finalizeHeadlessState(state, sessionId, fallbackTimestamp)
        break
      }
      default: {
        const msg = extractClaudeHeadlessMessage(
          value,
          sessionId,
          fallbackTimestamp
        )
        if (msg) completed = msg
      }
    }

    return completed
  } catch {
    return undefined
  }
}

function extractClaudeHeadlessMessage(
  value: Record<string, unknown>,
  sessionId: string,
  fallbackTimestamp: number
): UsageDataMessage | undefined {
  const usage =
    value.usage ||
    ((value.message as Record<string, unknown>)?.usage as Record<
      string,
      unknown
    >)
  if (!usage || typeof usage !== 'object') return undefined
  const model = extractClaudeModel(value)
  if (!model) return undefined
  const timestamp = extractClaudeTimestamp(value) || fallbackTimestamp

  return {
    app: 'claude',
    mode: 'chat',
    type: 'assistant',
    date: new Date(timestamp),
    model: { id: model, provider: 'anthropic' },
    tokens: normalizeTokens(
      extractI64((usage as Record<string, unknown>).input_tokens) || 0,
      extractI64((usage as Record<string, unknown>).output_tokens) || 0,
      extractI64((usage as Record<string, unknown>).cache_read_input_tokens) ||
        0,
      extractI64(
        (usage as Record<string, unknown>).cache_creation_input_tokens
      ) || 0,
      0
    ),
  }
}

function extractClaudeModel(
  value: Record<string, unknown>
): string | undefined {
  return (
    extractString(value.model) ||
    extractString((value.message as Record<string, unknown>)?.model)
  )
}

function extractClaudeTimestamp(
  value: Record<string, unknown>
): number | undefined {
  return parseTimestampValue(
    value.timestamp ||
      value.created_at ||
      (value.message as Record<string, unknown>)?.created_at
  )
}

function updateClaudeUsage(
  state: HeadlessState,
  usage: Record<string, unknown>
) {
  const input = extractI64(usage.input_tokens)
  if (input !== undefined) state.input = Math.max(state.input, input)
  const output = extractI64(usage.output_tokens)
  if (output !== undefined) state.output = Math.max(state.output, output)
  const cacheRead = extractI64(usage.cache_read_input_tokens)
  if (cacheRead !== undefined)
    state.cacheRead = Math.max(state.cacheRead, cacheRead)
  const cacheWrite = extractI64(usage.cache_creation_input_tokens)
  if (cacheWrite !== undefined)
    state.cacheWrite = Math.max(state.cacheWrite, cacheWrite)
}

function finalizeHeadlessState(
  state: HeadlessState,
  sessionId: string,
  fallbackTimestamp: number
): UsageDataMessage | undefined {
  if (!state.model) return undefined
  const timestamp = state.timestampMs || fallbackTimestamp
  if (
    state.input === 0 &&
    state.output === 0 &&
    state.cacheRead === 0 &&
    state.cacheWrite === 0
  ) {
    return undefined
  }

  const msg: UsageDataMessage = {
    app: 'claude',
    mode: 'chat',
    type: 'assistant',
    date: new Date(timestamp),
    model: { id: state.model, provider: 'anthropic' },
    tokens: normalizeTokens(
      state.input,
      state.output,
      state.cacheRead,
      state.cacheWrite,
      0
    ),
  }

  // Reset state
  state.model = undefined
  state.input = 0
  state.output = 0
  state.cacheRead = 0
  state.cacheWrite = 0
  state.timestampMs = undefined

  return msg
}
