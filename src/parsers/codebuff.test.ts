import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCodebuff } from './codebuff.js'

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

describe('parseCodebuff', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseCodebuff()
    expect(result).toEqual([])
  })

  it('parses chat-messages.json with assistant usage', async () => {
    const dir = join(
      tempHome,
      '.config',
      'manicode',
      'projects',
      'myproject',
      '2024-01-01T10-00-00'
    )
    mkdirSync(dir, { recursive: true })
    const messages = [
      {
        variant: 'ai',
        timestamp: 1700000000000,
        metadata: {
          model: 'claude-sonnet-4',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            cacheReadInputTokens: 20,
            cacheCreationInputTokens: 5,
          },
        },
      },
    ]
    writeFileSync(join(dir, 'chat-messages.json'), JSON.stringify(messages))

    const result = await parseCodebuff()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('codebuff')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
  })

  it('skips non-assistant messages', async () => {
    const dir = join(
      tempHome,
      '.config',
      'manicode',
      'projects',
      'myproject',
      '2024-01-01T10-00-00'
    )
    mkdirSync(dir, { recursive: true })
    const messages = [
      {
        variant: 'user',
        timestamp: 1700000000000,
        metadata: {
          model: 'claude-sonnet-4',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      },
    ]
    writeFileSync(join(dir, 'chat-messages.json'), JSON.stringify(messages))

    const result = await parseCodebuff()
    expect(result).toHaveLength(0)
  })

  it('falls back to chatId timestamp', async () => {
    const dir = join(
      tempHome,
      '.config',
      'manicode',
      'projects',
      'myproject',
      '2024-01-01T10-00-00'
    )
    mkdirSync(dir, { recursive: true })
    const messages = [
      {
        variant: 'assistant',
        metadata: {
          model: 'gpt-4o',
          usage: { inputTokens: 10, outputTokens: 5 },
        },
      },
    ]
    writeFileSync(join(dir, 'chat-messages.json'), JSON.stringify(messages))

    const result = await parseCodebuff()
    expect(result).toHaveLength(1)
    expect(result[0].date.getTime()).toBe(1704081600000)
  })
})
