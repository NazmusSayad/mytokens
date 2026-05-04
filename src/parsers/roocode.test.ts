import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseKiloCode, parseRooCode } from './roocode.js'

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

describe('parseRooCode', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseRooCode()
    expect(result).toEqual([])
  })

  it('parses api_req_started entries', async () => {
    const tasksDir = join(
      tempHome,
      '.config',
      'Code',
      'User',
      'globalStorage',
      'rooveterinaryinc.roo-cline',
      'tasks'
    )
    mkdirSync(tasksDir, { recursive: true })

    const uiMessages = [
      {
        type: 'say',
        say: 'api_req_started',
        ts: 1700000000000,
        text: JSON.stringify({
          tokensIn: 100,
          tokensOut: 50,
          cacheReads: 20,
          cacheWrites: 5,
          cost: 0.01,
        }),
      },
    ]
    writeFileSync(
      join(tasksDir, 'ui_messages.json'),
      JSON.stringify(uiMessages)
    )

    const historyContent = `Some conversation text
<environment_details>
<model>claude-sonnet-4</model>
<slug>builder</slug>
</environment_details>`
    writeFileSync(
      join(tasksDir, 'api_conversation_history.json'),
      historyContent
    )

    const result = await parseRooCode()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('roocode')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].model.provider).toBe('anthropic')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
    expect(result[0].mode).toBe('build')
  })

  it('skips non-api_req_started entries', async () => {
    const tasksDir = join(
      tempHome,
      '.config',
      'Code',
      'User',
      'globalStorage',
      'rooveterinaryinc.roo-cline',
      'tasks'
    )
    mkdirSync(tasksDir, { recursive: true })

    const uiMessages = [
      { type: 'say', say: 'text', ts: 1700000000000, text: 'hello' },
    ]
    writeFileSync(
      join(tasksDir, 'ui_messages.json'),
      JSON.stringify(uiMessages)
    )

    const result = await parseRooCode()
    expect(result).toHaveLength(0)
  })

  it('uses apiProtocol as provider when available', async () => {
    const tasksDir = join(
      tempHome,
      '.config',
      'Code',
      'User',
      'globalStorage',
      'rooveterinaryinc.roo-cline',
      'tasks'
    )
    mkdirSync(tasksDir, { recursive: true })

    const uiMessages = [
      {
        type: 'say',
        say: 'api_req_started',
        ts: 1700000000000,
        text: JSON.stringify({
          tokensIn: 10,
          tokensOut: 5,
          cacheReads: 0,
          cacheWrites: 0,
          cost: 0.001,
          apiProtocol: 'openrouter',
        }),
      },
    ]
    writeFileSync(
      join(tasksDir, 'ui_messages.json'),
      JSON.stringify(uiMessages)
    )

    const result = await parseRooCode()
    expect(result).toHaveLength(1)
    expect(result[0].model.provider).toBe('openrouter')
  })
})

describe('parseKiloCode', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseKiloCode()
    expect(result).toEqual([])
  })

  it('parses kilocode ui_messages.json', async () => {
    const tasksDir = join(
      tempHome,
      '.config',
      'Code',
      'User',
      'globalStorage',
      'kilocode.kilo-code',
      'tasks'
    )
    mkdirSync(tasksDir, { recursive: true })

    const uiMessages = [
      {
        type: 'say',
        say: 'api_req_started',
        ts: 1700000000000,
        text: JSON.stringify({
          tokensIn: 200,
          tokensOut: 100,
          cacheReads: 10,
          cacheWrites: 5,
          cost: 0.02,
        }),
      },
    ]
    writeFileSync(
      join(tasksDir, 'ui_messages.json'),
      JSON.stringify(uiMessages)
    )

    const result = await parseKiloCode()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('kilocode')
    expect(result[0].tokens.input).toBe(200)
    expect(result[0].tokens.output).toBe(100)
  })
})
