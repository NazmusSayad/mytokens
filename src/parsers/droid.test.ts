import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseDroid } from './droid.js'

let originalUserProfile: string | undefined
let originalHome: string | undefined
let tempHome: string

function setupTempHome(): string {
  tempHome = mkdtempSync(join(tmpdir(), 'home-'))
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

describe('parseDroid', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseDroid()
    expect(result).toEqual([])
  })

  it('parses settings.json with token usage', async () => {
    const dir = join(tempHome, '.factory', 'sessions')
    mkdirSync(dir, { recursive: true })
    const json = JSON.stringify({
      model: 'custom:claude-sonnet-4[beta]',
      providerLock: 'anthropic',
      providerLockTimestamp: '2024-12-01T10:00:00Z',
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 5,
        cacheReadTokens: 20,
        thinkingTokens: 2,
      },
    })
    writeFileSync(join(dir, 'uuid.settings.json'), json)

    const result = await parseDroid()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('droid')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].model.provider).toBe('anthropic')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
    expect(result[0].tokens.reasoning).toBe(2)
  })

  it('skips zero-token files', async () => {
    const dir = join(tempHome, '.factory', 'sessions')
    mkdirSync(dir, { recursive: true })
    const json = JSON.stringify({
      model: 'gpt-4o',
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    })
    writeFileSync(join(dir, 'uuid.settings.json'), json)

    const result = await parseDroid()
    expect(result).toHaveLength(0)
  })

  it('normalizes model name', async () => {
    const dir = join(tempHome, '.factory', 'sessions')
    mkdirSync(dir, { recursive: true })
    const json = JSON.stringify({
      model: 'custom:GPT-4.O[preview]--',
      providerLock: 'openai',
      providerLockTimestamp: '2024-12-01T10:00:00Z',
      tokenUsage: {
        inputTokens: 10,
        outputTokens: 5,
      },
    })
    writeFileSync(join(dir, 'uuid.settings.json'), json)

    const result = await parseDroid()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gpt-4-o')
  })
})
