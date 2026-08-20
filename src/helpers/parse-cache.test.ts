import type { UsageDataMessage } from '@/core/types.js'
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let originalUserProfile: string | undefined
let originalHome: string | undefined
let tempHome: string

function setupTempHome(): string {
  tempHome = mkdtempSync(join(tmpdir(), 'pcache-home-'))
  originalUserProfile = process.env.USERPROFILE
  originalHome = process.env.HOME
  process.env.USERPROFILE = tempHome
  process.env.HOME = tempHome
  return tempHome
}

function restoreHome() {
  if (originalUserProfile !== undefined) {
    process.env.USERPROFILE = originalUserProfile
  } else {
    delete process.env.USERPROFILE
  }
  if (originalHome !== undefined) {
    process.env.HOME = originalHome
  } else {
    delete process.env.HOME
  }
}

function messageAt(date: Date): UsageDataMessage {
  return {
    source: 'test',
    agent: 'default',
    type: 'assistant',
    date,
    model: { id: 'gpt-4o', provider: 'openai' },
    tokens: {
      input: 1,
      output: 2,
      reasoning: 0,
      cacheInput: 0,
      cacheOutput: 0,
    },
  }
}

describe('parse-cache', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  async function freshModule() {
    vi.resetModules()
    return await import('./parse-cache.js')
  }

  it('parses once and serves repeat calls from cache', async () => {
    const { cachedFileMessages } = await freshModule()
    const path = join(mkdtempSync(join(tmpdir(), 'pcache-')), 's.jsonl')
    writeFileSync(path, '{}')

    let calls = 0
    function parse() {
      calls++
      return [messageAt(new Date('2024-03-01T10:00:00Z'))]
    }

    const first = cachedFileMessages(path, parse)
    const second = cachedFileMessages(path, parse)

    expect(calls).toBe(1)
    expect(second).toHaveLength(1)
    expect(second[0].date).toBeInstanceOf(Date)
    expect(second[0].date.getTime()).toBe(first[0].date.getTime())
    expect(second[0].model.id).toBe('gpt-4o')
  })

  it('re-parses when the file content changes', async () => {
    const { cachedFileMessages } = await freshModule()
    const path = join(mkdtempSync(join(tmpdir(), 'pcache-')), 's.jsonl')
    writeFileSync(path, '{"a":1}')

    let calls = 0
    function parse() {
      calls++
      return [messageAt(new Date())]
    }

    cachedFileMessages(path, parse)
    writeFileSync(path, '{"a":1234}')
    cachedFileMessages(path, parse)

    expect(calls).toBe(2)
  })

  it('re-parses when a sqlite wal sidecar changes', async () => {
    const { cachedFileMessages } = await freshModule()
    const path = join(mkdtempSync(join(tmpdir(), 'pcache-')), 'db.sqlite')
    writeFileSync(path, '{}')

    let calls = 0
    function parse() {
      calls++
      return [messageAt(new Date())]
    }

    cachedFileMessages(path, parse)

    writeFileSync(`${path}-wal`, 'wal-page-data')
    const walTime = new Date(Date.now() + 5000)
    utimesSync(`${path}-wal`, walTime, walTime)

    cachedFileMessages(path, parse)

    expect(calls).toBe(2)
  })

  it('persists to disk and serves a fresh module instance', async () => {
    const mod = await freshModule()
    const path = join(mkdtempSync(join(tmpdir(), 'pcache-')), 's.jsonl')
    writeFileSync(path, '{}')

    mod.cachedFileMessages(path, () => [
      messageAt(new Date('2024-05-01T08:30:00Z')),
    ])
    mod.flushFileMessagesCache()

    const fresh = await freshModule()
    let calls = 0
    const served = fresh.cachedFileMessages(path, () => {
      calls++
      return []
    })

    expect(calls).toBe(0)
    expect(served).toHaveLength(1)
    expect(served[0].date.getTime()).toBe(
      new Date('2024-05-01T08:30:00Z').getTime()
    )
  })

  it('falls back to parsing when the cache file is corrupt', async () => {
    const cacheDir = join(tempHome, '.mytokens', 'cache')
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, 'parse-cache-v1.json'), '{not json')

    const { cachedFileMessages } = await freshModule()
    const path = join(mkdtempSync(join(tmpdir(), 'pcache-')), 's.jsonl')
    writeFileSync(path, '{}')

    let calls = 0
    const served = cachedFileMessages(path, () => {
      calls++
      return [messageAt(new Date())]
    })

    expect(calls).toBe(1)
    expect(served).toHaveLength(1)
  })
})
