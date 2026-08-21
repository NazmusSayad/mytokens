import { MYTOKENS_PARSE_CACHE_PATH } from '@/config.js'
import type { UsageDataMessage } from '@/core/types.js'
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

const PARSE_CACHE_VERSION = 1
const PARSE_CACHE_MAX_ENTRIES = 20_000

type StoredMessage = Omit<UsageDataMessage, 'date'> & { date: string }

type ParseCacheFile = {
  version: number
  entries: Record<string, StoredMessage[]>
}

let cacheEntries: Map<string, StoredMessage[]> | undefined
let cacheDirty = false
let cacheDisabled = false

function loadCache(): Map<string, StoredMessage[]> {
  if (cacheEntries) return cacheEntries

  cacheEntries = new Map()
  try {
    const parsed = JSON.parse(
      readFileSync(MYTOKENS_PARSE_CACHE_PATH, 'utf-8')
    ) as ParseCacheFile
    if (
      parsed.version === PARSE_CACHE_VERSION &&
      parsed.entries &&
      typeof parsed.entries === 'object'
    ) {
      for (const [key, messages] of Object.entries(parsed.entries)) {
        if (Array.isArray(messages)) cacheEntries.set(key, messages)
      }
    }
  } catch {
    // missing or corrupt cache starts empty
  }
  return cacheEntries
}

function fileIdentityKey(path: string): string | undefined {
  try {
    const stat = statSync(path)
    let key = `${path}|${stat.mtimeMs}|${stat.size}`

    try {
      const wal = statSync(`${path}-wal`)
      key += `|${wal.mtimeMs}|${wal.size}`
    } catch {
      // no sqlite wal sidecar
    }

    return key
  } catch {
    return undefined
  }
}

export function disableFileMessagesCache(): void {
  cacheDisabled = true
}

export function clearFileMessagesCache(): void {
  cacheEntries = new Map()
  cacheDirty = false
  try {
    unlinkSync(MYTOKENS_PARSE_CACHE_PATH)
  } catch {
    // no cache file on disk
  }
}

export function getCachedFileMessages(
  path: string
): UsageDataMessage[] | undefined {
  if (cacheDisabled) return undefined

  const key = fileIdentityKey(path)
  if (!key) return undefined

  const stored = loadCache().get(key)
  if (!stored) return undefined

  return stored.map((message) => ({
    ...message,
    date: new Date(message.date),
  }))
}

export function storeFileMessages(
  path: string,
  messages: UsageDataMessage[]
): void {
  if (cacheDisabled) return

  const key = fileIdentityKey(path)
  if (!key) return

  const serialized: StoredMessage[] = messages.map((message) => ({
    ...message,
    date: message.date.toISOString(),
  }))
  const entries = loadCache()
  entries.delete(key)
  entries.set(key, serialized)
  cacheDirty = true
}

export function cachedFileMessages(
  path: string,
  parse: () => UsageDataMessage[]
): UsageDataMessage[] {
  const cached = getCachedFileMessages(path)
  if (cached) return cached

  const messages = parse()
  storeFileMessages(path, messages)
  return messages
}

export function flushFileMessagesCache(): void {
  if (!cacheDirty || !cacheEntries) return

  while (cacheEntries.size > PARSE_CACHE_MAX_ENTRIES) {
    const oldest = cacheEntries.keys().next()
    if (oldest.done) break
    cacheEntries.delete(oldest.value)
  }

  const payload: ParseCacheFile = {
    version: PARSE_CACHE_VERSION,
    entries: Object.fromEntries(cacheEntries),
  }

  try {
    mkdirSync(dirname(MYTOKENS_PARSE_CACHE_PATH), { recursive: true })
    const tmpPath = `${MYTOKENS_PARSE_CACHE_PATH}.tmp`
    writeFileSync(tmpPath, JSON.stringify(payload))
    renameSync(tmpPath, MYTOKENS_PARSE_CACHE_PATH)
    cacheDirty = false
  } catch {
    // cache write failures must not affect parsing results
  }
}

export type FileMessagesCacheEntry = {
  path: string
  messages: number
}

export function listFileMessagesCache(): FileMessagesCacheEntry[] {
  const result: FileMessagesCacheEntry[] = []
  for (const [key, messages] of loadCache()) {
    result.push({ path: pathFromIdentityKey(key), messages: messages.length })
  }
  return result.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

export type FileMessagesCacheInfo = {
  existsOnDisk: boolean
  fileBytes: number
  entries: number
  messages: number
}

export function getFileMessagesCacheInfo(): FileMessagesCacheInfo {
  let existsOnDisk = false
  let fileBytes = 0
  try {
    fileBytes = statSync(MYTOKENS_PARSE_CACHE_PATH).size
    existsOnDisk = true
  } catch {
    // no cache file on disk yet
  }

  let messages = 0
  for (const stored of loadCache().values()) {
    messages += stored.length
  }

  return {
    existsOnDisk,
    fileBytes,
    entries: loadCache().size,
    messages,
  }
}

function pathFromIdentityKey(key: string): string {
  const segments = key.split('|')
  while (
    segments.length > 1 &&
    /^\d+(\.\d+)?$/.test(segments[segments.length - 1])
  ) {
    segments.pop()
  }
  return segments.join('|')
}
