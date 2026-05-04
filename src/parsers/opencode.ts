import { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import {
  deriveModeFromAgent,
  extractString,
  normalizeTokens,
  normalizeWorkspaceKey,
  readFileOrNone,
  resolveHome,
  scanDirectory,
  workspaceLabelFromKey,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OpenCodeMessage {
  id?: string
  sessionID?: string
  role: string
  modelID?: string
  providerID?: string
  cost?: number
  tokens?: OpenCodeTokens
  time: OpenCodeTime
  agent?: string
  mode?: string
  path?: { root?: string }
}

interface OpenCodeTokens {
  input: number
  output: number
  reasoning?: number
  cache: { read: number; write: number }
}

interface OpenCodeTime {
  created: number
  completed?: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseOpenCode(): Promise<UsageDataMessage[]> {
  const dbPath = resolveHome('~/.local/share/opencode/opencode.db')
  const messages = await parseOpenCodeSqlite(dbPath)
  if (messages.length > 0) return messages

  // Legacy JSON fallback
  const legacyDir = resolveHome('~/.local/share/opencode/storage/message')
  const files = scanDirectory(legacyDir, '*.json')
  const results: UsageDataMessage[] = []
  for (const path of files) {
    const msg = parseOpenCodeFile(path)
    if (msg) results.push(msg)
  }
  return results
}

// ─── SQLite parser ───────────────────────────────────────────────────────────

async function parseOpenCodeSqlite(
  dbPath: string
): Promise<UsageDataMessage[]> {
  const db = await readSQLiteDB(dbPath)
  if (!db) return []

  const modernQuery = `
    SELECT m.id, m.session_id, m.data, NULLIF(s.directory, '') AS workspace_root
    FROM message m
    LEFT JOIN session s ON s.id = m.session_id
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(m.data, '$.tokens') IS NOT NULL
    ORDER BY m.id, m.session_id
  `

  const legacyQuery = `
    SELECT m.id, m.session_id, m.data, NULL AS workspace_root
    FROM message m
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(m.data, '$.tokens') IS NOT NULL
    ORDER BY m.id, m.session_id
  `

  let rows: Record<string, unknown>[]
  try {
    rows = await sqliteAll(db, modernQuery)
  } catch {
    try {
      rows = await sqliteAll(db, legacyQuery)
    } catch {
      db.close()
      return []
    }
  }

  db.close()
  return processOpenCodeRows(rows)
}

function processOpenCodeRows(
  rows: Array<Record<string, unknown>>
): UsageDataMessage[] {
  const messages: UsageDataMessage[] = []

  for (const row of rows) {
    const dataJson = String(row.data || '')
    if (!dataJson) continue

    let msg: OpenCodeMessage
    try {
      msg = JSON.parse(dataJson) as OpenCodeMessage
    } catch {
      continue
    }

    if (msg.role !== 'assistant') continue
    if (!msg.tokens) continue
    if (!msg.modelID) continue

    const tokens = msg.tokens
    const input = Math.max(tokens.input || 0, 0)
    const output = Math.max(tokens.output || 0, 0)
    const reasoning = Math.max(tokens.reasoning || 0, 0)
    const cacheRead = Math.max(tokens.cache.read || 0, 0)
    const cacheWrite = Math.max(tokens.cache.write || 0, 0)

    const agentOrMode = msg.mode || msg.agent
    const agent = agentOrMode
      ? normalizeOpenCodeAgentName(agentOrMode)
      : undefined

    const timestamp = msg.time.created || 0

    const rowWorkspace = extractString(row.workspace_root)
    const embeddedWorkspace = msg.path?.root
    const workspaceRoot = rowWorkspace || embeddedWorkspace

    const workspaceKey = workspaceRoot
      ? normalizeWorkspaceKey(workspaceRoot)
      : undefined
    const workspaceLabel = workspaceKey
      ? workspaceLabelFromKey(workspaceKey)
      : undefined

    const message: UsageDataMessage = {
      app: 'opencode',
      mode: agent
        ? deriveModeFromAgent(agent)
        : msg.mode
          ? deriveModeFromOpenCodeMode(msg.mode)
          : 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: msg.modelID,
        provider: msg.providerID || 'unknown',
      },
      tokens: normalizeTokens(input, output, cacheRead, cacheWrite, reasoning),
      project: workspaceKey
        ? { name: workspaceLabel, path: workspaceKey }
        : undefined,
    }

    messages.push(message)
  }

  return messages
}

// ─── Legacy JSON file parser ─────────────────────────────────────────────────

function parseOpenCodeFile(path: string): UsageDataMessage | undefined {
  const data = readFileOrNone(path)
  if (!data) return undefined

  let msg: OpenCodeMessage
  try {
    msg = JSON.parse(data.toString('utf-8')) as OpenCodeMessage
  } catch {
    return undefined
  }

  if (msg.role !== 'assistant') return undefined
  if (!msg.tokens) return undefined
  if (!msg.modelID) return undefined

  const tokens = msg.tokens
  const input = Math.max(tokens.input || 0, 0)
  const output = Math.max(tokens.output || 0, 0)
  const reasoning = Math.max(tokens.reasoning || 0, 0)
  const cacheRead = Math.max(tokens.cache.read || 0, 0)
  const cacheWrite = Math.max(tokens.cache.write || 0, 0)

  const agentOrMode = msg.mode || msg.agent
  const agent = agentOrMode
    ? normalizeOpenCodeAgentName(agentOrMode)
    : undefined

  const timestamp = msg.time.created || 0
  const workspaceRoot = msg.path?.root
  const workspaceKey = workspaceRoot
    ? normalizeWorkspaceKey(workspaceRoot)
    : undefined
  const workspaceLabel = workspaceKey
    ? workspaceLabelFromKey(workspaceKey)
    : undefined

  return {
    app: 'opencode',
    mode: agent
      ? deriveModeFromAgent(agent)
      : msg.mode
        ? deriveModeFromOpenCodeMode(msg.mode)
        : 'chat',
    type: 'assistant',
    date: new Date(timestamp),
    model: {
      id: msg.modelID,
      provider: msg.providerID || 'unknown',
    },
    tokens: normalizeTokens(input, output, cacheRead, cacheWrite, reasoning),
    project: workspaceKey
      ? { name: workspaceLabel, path: workspaceKey }
      : undefined,
  }
}

// ─── Agent normalization (OpenCode-specific) ─────────────────────────────────

function normalizeOpenCodeAgentName(agent: string): string {
  const cleaned = agent.trim()
  const lower = cleaned.toLowerCase()

  switch (lower) {
    case 'sisyphus (ultraworker)':
    case 'sisyphus - ultraworker':
    case 'sisyphus ultraworker':
    case 'sisyphus':
      return 'Sisyphus'
    case 'hephaestus (deep agent)':
    case 'hephaestus - deep agent':
    case 'hephaestus deep agent':
    case 'hephaestus':
      return 'Hephaestus'
    case 'prometheus (plan builder)':
    case 'prometheus - plan builder':
    case 'prometheus plan builder':
    case 'prometheus (planner)':
    case 'prometheus':
      return 'Prometheus'
    case 'atlas (plan executor)':
    case 'atlas - plan executor':
    case 'atlas plan executor':
    case 'atlas':
      return 'Atlas'
    case 'metis (plan consultant)':
    case 'metis - plan consultant':
    case 'metis plan consultant':
    case 'metis':
      return 'Metis'
    case 'momus (plan critic)':
    case 'momus - plan critic':
    case 'momus plan critic':
    case 'momus (plan reviewer)':
    case 'momus':
      return 'Momus'
    case 'orchestrator-sisyphus':
      return 'Atlas'
    case 'sisyphus-junior':
      return 'Sisyphus-Junior'
    case 'planner-sisyphus':
      return 'Planner-Sisyphus'
    default:
      return deriveModeFromAgent(cleaned)
  }
}

function deriveModeFromOpenCodeMode(
  mode: string
): 'plan' | 'build' | 'agent' | 'chat' | 'ask' | 'debug' {
  switch (mode.toLowerCase()) {
    case 'plan':
      return 'plan'
    case 'build':
      return 'build'
    case 'agent':
      return 'agent'
    case 'chat':
      return 'chat'
    case 'ask':
      return 'ask'
    case 'debug':
      return 'debug'
    default:
      return 'chat'
  }
}
