import type { UsageDataMode, UsageDataToken } from '@/core/types.js'
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

export function resolveHome(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return join(homedir(), path.slice(1))
  }
  return path
}

export function readFileOrNone(path: string): Buffer | undefined {
  try {
    return readFileSync(path)
  } catch {
    return undefined
  }
}

export function readJsonlSync(path: string): unknown[] {
  const data = readFileOrNone(path)
  if (!data) return []
  const lines = data.toString('utf-8').split(/\r?\n/)
  const result: unknown[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      result.push(JSON.parse(trimmed))
    } catch {
      // skip invalid JSON lines
    }
  }
  return result
}

export async function* readJsonlLines(
  path: string
): AsyncGenerator<unknown, void, unknown> {
  const fileStream = createReadStream(path)
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      yield JSON.parse(trimmed)
    } catch {
      // skip invalid JSON lines
    }
  }
}

export function parseTimestampValue(value: unknown): number | undefined {
  if (typeof value === 'string') {
    if (value.includes('T') || value.includes('-')) {
      const parsed = Date.parse(value)
      if (!isNaN(parsed)) return parsed
    }
    const numeric = Number(value)
    if (!isNaN(numeric) && numeric > 0) {
      if (numeric >= 1_000_000_000_000) return numeric
      return numeric * 1000
    }
    return undefined
  }
  if (typeof value === 'number') {
    if (value <= 0) return undefined
    if (value >= 1_000_000_000_000) return value
    return value * 1000
  }
  if (Array.isArray(value) && value.length >= 2) {
    // OTEL format: [seconds, nanos]
    const seconds = parseTimestampValue(value[0])
    const nanos = parseTimestampValue(value[1])
    if (seconds !== undefined && nanos !== undefined) {
      return seconds + nanos / 1_000_000
    }
  }
  return undefined
}

export function extractI64(value: unknown): number | undefined {
  if (typeof value === 'number') return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!isNaN(parsed)) return Math.floor(parsed)
  }
  if (typeof value === 'bigint') return Number(value)
  return undefined
}

export function extractString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  return undefined
}

export function inferProviderFromModel(model: string): string {
  const lower = model.toLowerCase()
  if (
    lower.includes('claude') ||
    lower.includes('anthropic') ||
    containsDelimited(lower, 'opus') ||
    containsDelimited(lower, 'sonnet') ||
    containsDelimited(lower, 'haiku')
  ) {
    return 'anthropic'
  }
  if (
    lower.includes('gpt') ||
    lower.includes('openai') ||
    containsDelimited(lower, 'o1') ||
    containsDelimited(lower, 'o3') ||
    containsDelimited(lower, 'o4')
  ) {
    return 'openai'
  }
  if (lower.includes('gemini') || lower.includes('google')) return 'google'
  if (lower.includes('grok')) return 'xai'
  if (lower.includes('deepseek')) return 'deepseek'
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistral'
  if (lower.includes('llama') || containsDelimited(lower, 'meta')) return 'meta'
  if (lower.includes('qwen')) return 'qwen'
  return 'unknown'
}

function containsDelimited(haystack: string, needle: string): boolean {
  const idx = haystack.indexOf(needle)
  if (idx === -1) return false
  const beforeOk = idx === 0 || !isAlphanumeric(haystack[idx - 1])
  const afterPos = idx + needle.length
  const afterOk =
    afterPos >= haystack.length || !isAlphanumeric(haystack[afterPos])
  return beforeOk && afterOk
}

function isAlphanumeric(char: string): boolean {
  const code = char.charCodeAt(0)
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  )
}

export function canonicalProvider(raw: string): string | undefined {
  const tags = providerTags(raw)
  return tags[0]
}

export function providerTags(raw: string): string[] {
  const tags: string[] = []
  function pushSegment(segment: string) {
    const tag = canonicalizeProviderSegment(segment)
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  for (const segment of raw.trim().replace(/\/$/, '').split('/')) {
    pushSegment(segment)
    if (segment.includes('.')) {
      for (const dotted of segment.split('.')) pushSegment(dotted)
    }
  }
  return tags
}

function canonicalizeProviderSegment(segment: string): string | undefined {
  const normalized = segment
    .trim()
    .replace(/\/$/, '')
    .toLowerCase()
    .replace(/-/g, '_')
  switch (normalized) {
    case '':
    case 'unknown':
      return undefined
    case 'x_ai':
    case 'xai':
      return 'xai'
    case 'z_ai':
    case 'zai':
      return 'zai'
    case 'moonshot':
    case 'moonshotai':
      return 'moonshotai'
    case 'meta':
    case 'meta_llama':
      return 'meta_llama'
    case 'azure':
    case 'azure_ai':
      return 'azure_ai'
    case 'anthropic':
    case 'vertex':
    case 'vertex_ai':
      return 'anthropic'
    case 'together':
    case 'together_ai':
      return 'together_ai'
    case 'fireworks':
    case 'fireworks_ai':
      return 'fireworks_ai'
    case 'google':
    case 'gemini':
      return 'google'
    case 'openai':
    case 'openai_codex':
      return 'openai'
    case 'mistral':
    case 'mistralai':
      return 'mistralai'
    case 'ai21':
      return 'ai21'
    default:
      if (normalized.split('').some((ch) => /\d/.test(ch))) return undefined
      return normalized
  }
}

export function normalizeAgentName(agent: string): string {
  const cleaned = stripZeroWidthChars(agent)
  const trimmed = cleaned.trim()
  const stripped = stripAgentPrefix(trimmed)
  const canonical = canonicalizeAgentName(stripped)
  const agentLower = canonical.toLowerCase()

  if (agentLower.includes('plan')) {
    if (agentLower.includes('omo') || agentLower.includes('sisyphus')) {
      return 'Planner-Sisyphus'
    }
    return titlecaseAgent(canonical)
  }

  if (agentLower === 'omo' || agentLower === 'sisyphus') return 'Sisyphus'
  if (agentLower === 'orchestrator-sisyphus') return 'Atlas'
  if (agentLower === 'sisyphus-junior') return 'Sisyphus-Junior'
  if (agentLower === 'planner-sisyphus') return 'Planner-Sisyphus'

  return titlecaseAgent(canonical)
}

function stripZeroWidthChars(s: string): string {
  if (!/[\u200B\u200C\u200D\uFEFF]/.test(s)) return s
  return s
    .split('')
    .filter((c) => !['\u200B', '\u200C', '\u200D', '\uFEFF'].includes(c))
    .join('')
}

function stripAgentPrefix(name: string): string {
  const prefixes = ['astrape:', 'oh-my-claudecode:', 'oh-my-codex:']
  for (const prefix of prefixes) {
    if (name.slice(0, prefix.length).toLowerCase() === prefix) {
      return name.slice(prefix.length)
    }
  }
  return name
}

function canonicalizeAgentName(name: string): string {
  return name.split(/\s+/).join(' ')
}

function titlecaseWord(word: string): string {
  const lower = word.toLowerCase()
  switch (lower) {
    case 'ui':
      return 'UI'
    case 'ux':
      return 'UX'
    case 'api':
      return 'API'
    default: {
      if (!word) return ''
      return word[0].toUpperCase() + word.slice(1).toLowerCase()
    }
  }
}

function titlecaseAgent(name: string): string {
  if (!name) return ''
  return name
    .split('-')
    .flatMap((part) => part.split(/\s+/))
    .map(titlecaseWord)
    .join(' ')
}

export function normalizeWorkspaceKey(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const preserveUncPrefix =
    trimmed.startsWith('\\\\') || trimmed.startsWith('//')
  let normalized = trimmed.replace(/\\/g, '/')
  if (preserveUncPrefix) {
    let body = normalized.replace(/^\/+/, '')
    while (body.includes('//')) body = body.replace(/\/\//g, '/')
    normalized = '//' + body
  } else {
    while (normalized.includes('//'))
      normalized = normalized.replace(/\/\//g, '/')
  }
  const minimumLen = preserveUncPrefix ? 2 : 1
  if (normalized.length > minimumLen) normalized = normalized.replace(/\/$/, '')
  return normalized || undefined
}

export function workspaceLabelFromKey(key: string): string | undefined {
  const segments = key.split('/').filter((s) => s)
  return segments[segments.length - 1]
}

export function fileModifiedTimestampMs(path: string): number {
  try {
    return statSync(path).mtimeMs
  } catch {
    return Date.now()
  }
}

export function scanDirectory(root: string, pattern: string): string[] {
  if (!existsSync(root)) return []
  const result: string[] = []
  function walk(dir: string) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (stat.isFile() && matchesPattern(entry, pattern)) {
        result.push(fullPath)
      }
    }
  }
  walk(root)
  result.sort()
  return result
}

function matchesPattern(fileName: string, pattern: string): boolean {
  switch (pattern) {
    case '*.json':
      return fileName.endsWith('.json')
    case '*.jsonl':
      return fileName.endsWith('.jsonl')
    case '*.json|*.jsonl':
      return fileName.endsWith('.json') || fileName.endsWith('.jsonl')
    case '*.csv':
      return fileName.endsWith('.csv')
    default:
      return false
  }
}

export function normalizeTokens(
  input: number,
  output: number,
  cacheInput: number,
  cacheOutput: number,
  reasoning: number
): UsageDataToken {
  return {
    input: Math.max(0, input),
    output: Math.max(0, output),
    cacheInput: Math.max(0, cacheInput),
    cacheOutput: Math.max(0, cacheOutput),
    reasoning: Math.max(0, reasoning),
  }
}

export function subtractCachedOverlap(
  input: number,
  cached: number
): [number, number] {
  const safeInput = Math.max(0, input)
  const safeCached = Math.max(0, cached)
  const cachedPortion = Math.min(safeCached, safeInput)
  return [safeInput - cachedPortion, safeCached]
}

export function deriveModeFromAgent(agent: string | undefined): UsageDataMode {
  if (!agent) return 'chat'
  const lower = agent.toLowerCase()
  if (lower.includes('plan')) return 'plan'
  if (lower.includes('build')) return 'build'
  if (lower.includes('agent')) return 'agent'
  if (lower === 'headless') return 'build'
  if (lower.includes('debug')) return 'debug'
  if (lower.includes('ask')) return 'ask'
  return 'chat'
}
