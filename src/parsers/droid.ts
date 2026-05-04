import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  inferProviderFromModel,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DroidSettingsJson {
  model?: string
  providerLock?: string
  providerLockTimestamp?: string
  tokenUsage?: DroidTokenUsage
}

interface DroidTokenUsage {
  inputTokens?: number
  outputTokens?: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  thinkingTokens?: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseDroid(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.factory/sessions')
  const files = scanDirectory(root, '*.json')

  for (const path of files) {
    if (!path.endsWith('.settings.json')) continue
    const messages = parseDroidFile(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseDroidFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  let settings: DroidSettingsJson
  try {
    settings = JSON.parse(data.toString('utf-8')) as DroidSettingsJson
  } catch {
    return []
  }

  const usage = settings.tokenUsage
  if (!usage) return []

  const inputTokens = Math.max(0, usage.inputTokens || 0)
  const outputTokens = Math.max(0, usage.outputTokens || 0)
  const cacheCreation = Math.max(0, usage.cacheCreationTokens || 0)
  const cacheRead = Math.max(0, usage.cacheReadTokens || 0)
  const thinking = Math.max(0, usage.thinkingTokens || 0)

  const total =
    inputTokens + outputTokens + cacheCreation + cacheRead + thinking
  if (total === 0) return []

  const provider =
    settings.providerLock || inferProviderFromModel(settings.model || '')

  let model: string
  if (settings.model) {
    model = normalizeModelName(settings.model)
  } else {
    const jsonlPath = path.replace('.settings.json', '.jsonl')
    const extracted = extractModelFromJsonl(jsonlPath)
    model = extracted || getDefaultModelFromProvider(provider)
  }

  const timestamp = settings.providerLockTimestamp
    ? Date.parse(settings.providerLockTimestamp)
    : fileModifiedTimestampMs(path)

  if (isNaN(timestamp) || timestamp <= 0) return []

  return [
    {
      app: 'droid',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: model,
        provider,
      },
      tokens: {
        input: inputTokens,
        output: outputTokens,
        reasoning: thinking,
        cacheInput: cacheRead,
        cacheOutput: cacheCreation,
      },
    },
  ]
}

function normalizeModelName(model: string): string {
  // Remove "custom:" prefix
  let normalized = model.startsWith('custom:') ? model.slice(7) : model

  // Remove [anything] patterns
  let result = ''
  let inBracket = false
  for (const ch of normalized) {
    if (ch === '[') {
      inBracket = true
    } else if (ch === ']') {
      inBracket = false
    } else if (!inBracket) {
      result += ch
    }
  }
  normalized = result

  // Remove trailing hyphens
  normalized = normalized.replace(/-+$/, '')

  // Lowercase
  normalized = normalized.toLowerCase()

  // Replace dots with hyphens
  normalized = normalized.replace(/\./g, '-')

  // Collapse multiple consecutive hyphens
  normalized = normalized.replace(/-+/g, '-')

  return normalized
}

function getDefaultModelFromProvider(provider: string): string {
  const lower = provider.toLowerCase()
  if (lower === 'anthropic') return 'claude-unknown'
  if (lower === 'openai') return 'gpt-unknown'
  if (lower === 'google') return 'gemini-unknown'
  if (lower === 'xai') return 'grok-unknown'
  return `${provider}-unknown`
}

function extractModelFromJsonl(jsonlPath: string): string | undefined {
  const data = readFileOrNone(jsonlPath)
  if (!data) return undefined

  const lines = data.toString('utf-8').split(/\r?\n/)
  for (let i = 0; i < Math.min(lines.length, 500); i++) {
    const line = lines[i]
    const pos = line.indexOf('Model:')
    if (pos === -1) continue

    const afterModel = line.slice(pos + 6)
    const modelPart = afterModel.split(/[\[\\"]/)[0].trim()
    if (modelPart) {
      return normalizeModelName(modelPart)
    }
  }

  return undefined
}
