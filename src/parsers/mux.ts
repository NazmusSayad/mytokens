import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'
import { basename } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MuxSessionUsage {
  version?: number
  byModel?: Record<string, MuxModelUsage>
  lastRequest?: MuxLastRequest
}

interface MuxModelUsage {
  input?: MuxTokenBucket
  cached?: MuxTokenBucket
  cacheCreate?: MuxTokenBucket
  output?: MuxTokenBucket
  reasoning?: MuxTokenBucket
}

interface MuxTokenBucket {
  tokens?: number
  cost_usd?: number
}

interface MuxLastRequest {
  model?: string
  timestamp?: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseMux(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.mux/sessions')
  const files = scanDirectory(root, '*.json')

  for (const path of files) {
    if (basename(path) !== 'session-usage.json') continue
    const messages = parseMuxFile(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseMuxFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  let usage: MuxSessionUsage
  try {
    usage = JSON.parse(data.toString('utf-8')) as MuxSessionUsage
  } catch {
    return []
  }

  const timestamp =
    usage.lastRequest?.timestamp || fileModifiedTimestampMs(path)
  const byModel = usage.byModel
  if (!byModel) return []

  const messages: UsageDataMessage[] = []

  for (const [modelKey, modelUsage] of Object.entries(byModel)) {
    const input = getTokens(modelUsage.input)
    const cached = getTokens(modelUsage.cached)
    const cacheCreate = getTokens(modelUsage.cacheCreate)
    const output = getTokens(modelUsage.output)
    const reasoning = getTokens(modelUsage.reasoning)

    if (
      input === 0 &&
      cached === 0 &&
      cacheCreate === 0 &&
      output === 0 &&
      reasoning === 0
    ) {
      continue
    }

    const colonIdx = modelKey.indexOf(':')
    let provider: string
    let modelId: string
    if (colonIdx !== -1) {
      provider = modelKey.slice(0, colonIdx)
      modelId = modelKey.slice(colonIdx + 1)
    } else {
      provider = ''
      modelId = modelKey
    }

    messages.push({
      app: 'mux',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: modelId,
        provider,
      },
      tokens: {
        input,
        output,
        reasoning,
        cacheInput: cached,
        cacheOutput: cacheCreate,
      },
    })
  }

  return messages
}

function getTokens(bucket: MuxTokenBucket | undefined): number {
  return Math.max(0, bucket?.tokens || 0)
}
