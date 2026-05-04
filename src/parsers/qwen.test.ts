import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseQwen } from './qwen.js'

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

describe('parseQwen', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseQwen()
    expect(result).toEqual([])
  })

  it('parses assistant messages with usageMetadata', async () => {
    const dir = join(tempHome, '.qwen', 'projects', 'myproject', 'chats')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({
        type: 'assistant',
        model: 'qwen-max',
        timestamp: '2024-12-01T10:00:00Z',
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          thoughtsTokenCount: 2,
          cachedContentTokenCount: 20,
        },
      }),
    ]
    writeFileSync(join(dir, 'chat.jsonl'), lines.join('\n'))

    const result = await parseQwen()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('qwen')
    expect(result[0].model.id).toBe('qwen-max')
    expect(result[0].model.provider).toBe('qwen')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.reasoning).toBe(2)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].project?.path).toBe('myproject')
  })

  it('skips non-assistant lines', async () => {
    const dir = join(tempHome, '.qwen', 'projects', 'myproject', 'chats')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({
        type: 'user',
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      }),
    ]
    writeFileSync(join(dir, 'chat.jsonl'), lines.join('\n'))

    const result = await parseQwen()
    expect(result).toHaveLength(0)
  })

  it('skips zero-token messages', async () => {
    const dir = join(tempHome, '.qwen', 'projects', 'myproject', 'chats')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({
        type: 'assistant',
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
        },
      }),
    ]
    writeFileSync(join(dir, 'chat.jsonl'), lines.join('\n'))

    const result = await parseQwen()
    expect(result).toHaveLength(0)
  })
})
