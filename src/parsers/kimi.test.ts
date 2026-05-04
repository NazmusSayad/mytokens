import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseKimi } from './kimi.js'

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

describe('parseKimi', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseKimi()
    expect(result).toEqual([])
  })

  it('parses StatusUpdate with token usage', async () => {
    const sessionsDir = join(tempHome, '.kimi', 'sessions', 'ses-1')
    mkdirSync(sessionsDir, { recursive: true })
    const lines = [
      JSON.stringify({
        type: 'message',
        timestamp: 1700000000,
        message: {
          type: 'StatusUpdate',
          payload: {
            token_usage: {
              input_other: 100,
              output: 50,
              input_cache_read: 20,
              input_cache_creation: 5,
            },
            message_id: 'msg-1',
          },
        },
      }),
    ]
    writeFileSync(join(sessionsDir, 'wire.jsonl'), lines.join('\n'))

    const result = await parseKimi()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('kimi')
    expect(result[0].model.provider).toBe('moonshot')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
  })

  it('skips non-StatusUpdate messages', async () => {
    const sessionsDir = join(tempHome, '.kimi', 'sessions', 'ses-1')
    mkdirSync(sessionsDir, { recursive: true })
    const lines = [
      JSON.stringify({
        type: 'message',
        message: {
          type: 'UserMessage',
          payload: {},
        },
      }),
    ]
    writeFileSync(join(sessionsDir, 'wire.jsonl'), lines.join('\n'))

    const result = await parseKimi()
    expect(result).toHaveLength(0)
  })

  it('skips metadata lines', async () => {
    const sessionsDir = join(tempHome, '.kimi', 'sessions', 'ses-1')
    mkdirSync(sessionsDir, { recursive: true })
    const lines = [
      JSON.stringify({ type: 'metadata', model: 'kimi-k2' }),
      JSON.stringify({
        type: 'message',
        timestamp: 1700000000,
        message: {
          type: 'StatusUpdate',
          payload: {
            token_usage: { input_other: 10, output: 5 },
          },
        },
      }),
    ]
    writeFileSync(join(sessionsDir, 'wire.jsonl'), lines.join('\n'))

    const result = await parseKimi()
    expect(result).toHaveLength(1)
  })
})
