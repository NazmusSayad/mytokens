import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseMux } from './mux.js'

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

describe('parseMux', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseMux()
    expect(result).toEqual([])
  })

  it('parses session-usage.json with byModel data', async () => {
    const dir = join(tempHome, '.mux', 'sessions')
    mkdirSync(dir, { recursive: true })
    const json = JSON.stringify({
      version: 1,
      byModel: {
        'openai:gpt-4o': {
          input: { tokens: 100 },
          cached: { tokens: 20 },
          cacheCreate: { tokens: 5 },
          output: { tokens: 50 },
          reasoning: { tokens: 2 },
        },
      },
      lastRequest: {
        model: 'gpt-4o',
        timestamp: 1700000000000,
      },
    })
    writeFileSync(join(dir, 'session-usage.json'), json)

    const result = await parseMux()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('mux')
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].model.provider).toBe('openai')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
    expect(result[0].tokens.reasoning).toBe(2)
  })

  it('skips zero-token models', async () => {
    const dir = join(tempHome, '.mux', 'sessions')
    mkdirSync(dir, { recursive: true })
    const json = JSON.stringify({
      byModel: {
        'openai:gpt-4o': {
          input: { tokens: 0 },
          output: { tokens: 0 },
        },
      },
    })
    writeFileSync(join(dir, 'session-usage.json'), json)

    const result = await parseMux()
    expect(result).toHaveLength(0)
  })

  it('handles model without provider prefix', async () => {
    const dir = join(tempHome, '.mux', 'sessions')
    mkdirSync(dir, { recursive: true })
    const json = JSON.stringify({
      byModel: {
        'gpt-4o': {
          input: { tokens: 10 },
          output: { tokens: 5 },
        },
      },
    })
    writeFileSync(join(dir, 'session-usage.json'), json)

    const result = await parseMux()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].model.provider).toBe('')
  })
})
