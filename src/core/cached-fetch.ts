import {
  CACHE_VALIDITY_DURATION,
  MY_TOKEN_CACHE_REGISTRY_PATH,
} from '@/config.js'
import {
  readFileAsJSON,
  writeFileAsJSON,
  writeFileForced,
} from '@/helpers/fs.js'
import path from 'path'
import { ulid } from 'ulid'

async function readRegistry() {
  return (
    (await readFileAsJSON<
      Record<
        string,
        {
          timestamp: number
          filePath: string
        }
      >
    >(MY_TOKEN_CACHE_REGISTRY_PATH)) ?? {}
  )
}

async function writeCache(url: string, data: Record<string, unknown>) {
  const registry = await readRegistry()

  const previousEntry = registry[url]
  const cacheFilePath = previousEntry
    ? previousEntry.filePath
    : path.join(path.dirname(MY_TOKEN_CACHE_REGISTRY_PATH), ulid())

  registry[url] = { timestamp: Date.now(), filePath: cacheFilePath }

  await writeFileForced(cacheFilePath, JSON.stringify(data))
  await writeFileAsJSON(MY_TOKEN_CACHE_REGISTRY_PATH, registry)
}

async function readFromCache<T>(url: string): Promise<T | null> {
  const registry = await readRegistry()

  const entry = registry[url]
  if (!entry) return null

  const isCacheInvalid = Date.now() - entry.timestamp > CACHE_VALIDITY_DURATION
  if (isCacheInvalid) return null

  const cacheContent = await readFileAsJSON<Record<string, unknown>>(
    entry.filePath
  )
  if (!cacheContent) return null

  return cacheContent as T
}

export async function cachedFetchJSON<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const cachedData = await readFromCache<T>(url)
  if (cachedData) {
    return cachedData
  }

  const response = await fetch(url, init)
  const data = (await response.json()) as unknown as Record<string, unknown>
  await writeCache(url, data)

  return data as T
}
