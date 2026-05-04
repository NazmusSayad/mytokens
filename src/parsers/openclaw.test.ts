import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseOpenClaw } from './openclaw.js'

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

describe('parseOpenClaw', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseOpenClaw()
    expect(result).toEqual([])
  })

  it('parses jsonl transcript with model_change and message', async () => {
    const dir = join(tempHome, '.openclaw', 'agents')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({
        type: 'model_change',
        modelId: 'gpt-4o',
        provider: 'openai',
      }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          model: 'gpt-4o',
          provider: 'openai',
          usage: { input: 100, output: 50, cacheRead: 20, cacheWrite: 5 },
          timestamp: 1700000000000,
        },
      }),
    ]
    writeFileSync(join(dir, 'session-1.jsonl'), lines.join('\n'))

    const result = await parseOpenClaw()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('openclaw')
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].model.provider).toBe('openai')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
  })

  it('parses sessions.json index', async () => {
    const dir = join(tempHome, '.openclaw', 'agents')
    mkdirSync(dir, { recursive: true })
    const sessionsIndex = {
      'session-1': { sessionId: 'session-1', sessionFile: 'session-1.jsonl' },
    }
    writeFileSync(join(dir, 'sessions.json'), JSON.stringify(sessionsIndex))

    const lines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4',
          provider: 'anthropic',
          usage: { input: 10, output: 5 },
          timestamp: 1700000000000,
        },
      }),
    ]
    writeFileSync(join(dir, 'session-1.jsonl'), lines.join('\n'))

    const result = await parseOpenClaw()
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some((m) => m.model.id === 'claude-sonnet-4')).toBe(true)
  })

  it('skips non-assistant messages', async () => {
    const dir = join(tempHome, '.openclaw', 'agents')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'user',
          usage: { input: 100, output: 50 },
        },
      }),
    ]
    writeFileSync(join(dir, 'session-1.jsonl'), lines.join('\n'))

    const result = await parseOpenClaw()
    expect(result).toHaveLength(0)
  })
})
