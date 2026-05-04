import type { UsageDataMessage } from '@/core/types.js'
import {
  deriveModeFromAgent,
  inferProviderFromModel,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'
import { basename, dirname, join } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UiMessageEntry {
  type?: string
  say?: string
  text?: string
  ts?: unknown
}

interface ApiReqStartedPayload {
  cost: number
  tokensIn: number
  tokensOut: number
  cacheReads: number
  cacheWrites: number
  apiProtocol?: string
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseRooCode(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const paths = [
    resolveHome(
      '~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks'
    ),
    resolveHome(
      '~/.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/tasks'
    ),
  ]

  for (const root of paths) {
    const files = scanDirectory(root, '*.json')
    for (const path of files) {
      if (basename(path) !== 'ui_messages.json') continue
      const messages = parseRooKiloFile(path, 'roocode')
      results.push(...messages)
    }
  }

  return results
}

export async function parseKiloCode(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const paths = [
    resolveHome('~/.config/Code/User/globalStorage/kilocode.kilo-code/tasks'),
    resolveHome(
      '~/.vscode-server/data/User/globalStorage/kilocode.kilo-code/tasks'
    ),
  ]

  for (const root of paths) {
    const files = scanDirectory(root, '*.json')
    for (const path of files) {
      if (basename(path) !== 'ui_messages.json') continue
      const messages = parseRooKiloFile(path, 'kilocode')
      results.push(...messages)
    }
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseRooKiloFile(path: string, source: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  let entries: UiMessageEntry[]
  try {
    entries = JSON.parse(data.toString('utf-8')) as UiMessageEntry[]
  } catch {
    return []
  }

  if (!Array.isArray(entries)) return []

  const { modelId, agent } = readTaskMetadata(path)

  const messages: UsageDataMessage[] = []

  for (const entry of entries) {
    if (entry.type !== 'say' || entry.say !== 'api_req_started') continue
    if (!entry.text) continue

    const timestamp = parseEntryTimestamp(entry.ts)
    if (timestamp === undefined) continue

    const payload = parseApiReqStartedPayload(entry.text)
    if (!payload) continue

    const provider = payload.apiProtocol || inferProviderFromModel(modelId)

    messages.push({
      app: source,
      mode: deriveModeFromAgent(agent),
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: modelId,
        provider,
      },
      tokens: {
        input: payload.tokensIn,
        output: payload.tokensOut,
        reasoning: 0,
        cacheInput: payload.cacheReads,
        cacheOutput: payload.cacheWrites,
      },
    })
  }

  return messages
}

function readTaskMetadata(path: string): { modelId: string; agent?: string } {
  const historyPath = join(dirname(path), 'api_conversation_history.json')
  const data = readFileOrNone(historyPath)
  if (!data) return { modelId: 'unknown' }

  try {
    const content = data.toString('utf-8')
    return extractModelAndAgent(content)
  } catch {
    return { modelId: 'unknown' }
  }
}

function extractModelAndAgent(content: string): {
  modelId: string
  agent?: string
} {
  const ENV_START = '<environment_details>'
  const ENV_END = '</environment_details>'

  let offset = 0
  let lastModel: string | undefined
  let lastSlug: string | undefined
  let lastName: string | undefined

  while (true) {
    const startRel = content.indexOf(ENV_START, offset)
    if (startRel === -1) break

    const startIdx = startRel + ENV_START.length
    const endRel = content.indexOf(ENV_END, startIdx)
    if (endRel === -1) break

    const block = content.slice(startIdx, endRel)

    const model = extractTagValue(block, 'model')
    if (model) lastModel = model

    const slug = extractTagValue(block, 'slug')
    if (slug) lastSlug = slug

    const name = extractTagValue(block, 'name')
    if (name) lastName = name

    offset = endRel + ENV_END.length
  }

  return {
    modelId: lastModel || 'unknown',
    agent: lastSlug || lastName,
  }
}

function extractTagValue(block: string, tag: string): string | undefined {
  const open = `<${tag}>`
  const close = `</${tag}>`

  const startIdx = block.indexOf(open)
  if (startIdx === -1) return undefined

  const valueStart = startIdx + open.length
  const endIdx = block.indexOf(close, valueStart)
  if (endIdx === -1) return undefined

  const value = block.slice(valueStart, endIdx).trim()
  return value || undefined
}

function parseEntryTimestamp(ts: unknown): number | undefined {
  if (ts === undefined || ts === null) return undefined

  if (typeof ts === 'string') {
    const parsed = Date.parse(ts)
    if (!isNaN(parsed)) return parsed
    const numeric = Number(ts)
    if (!isNaN(numeric) && numeric > 0) return numeric
    return undefined
  }

  if (typeof ts === 'number') {
    return ts > 0 ? ts : undefined
  }

  return undefined
}

function parseApiReqStartedPayload(
  text: string
): ApiReqStartedPayload | undefined {
  let value: Record<string, unknown>
  try {
    value = JSON.parse(text) as Record<string, unknown>
  } catch {
    return undefined
  }

  const cost = extractF64(value.cost) || 0
  const tokensIn = extractI64(value.tokensIn) || 0
  const tokensOut = extractI64(value.tokensOut) || 0
  const cacheReads = extractI64(value.cacheReads) || 0
  const cacheWrites = extractI64(value.cacheWrites) || 0
  const apiProtocol =
    typeof value.apiProtocol === 'string' ? value.apiProtocol : undefined

  return {
    cost,
    tokensIn,
    tokensOut,
    cacheReads,
    cacheWrites,
    apiProtocol,
  }
}

function extractI64(value: unknown): number | undefined {
  if (typeof value === 'number') return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!isNaN(parsed)) return Math.floor(parsed)
  }
  return undefined
}

function extractF64(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!isNaN(parsed)) return parsed
  }
  return undefined
}
