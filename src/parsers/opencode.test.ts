import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseOpenCode } from './opencode.js'

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

function createOpenCodeDb(dbPath: string): void {
  const db = new DatabaseSync(dbPath)
  db.exec(
    `CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      directory TEXT NOT NULL
    );`
  )
  db.close()
}

describe('parseOpenCode', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no opencode data exists', async () => {
    const result = await parseOpenCode()
    expect(result).toEqual([])
  })

  it('parses SQLite messages with session workspace', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'opencode')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'opencode.db')
    await createOpenCodeDb(dbPath)

    const db = new DatabaseSync(dbPath)
    db.exec(
      `INSERT INTO session (id, directory) VALUES ('ses_001', '/Users/alice/opencode-repo');
       INSERT INTO message (id, session_id, data) VALUES ('msg_001', 'ses_001', '{"role":"assistant","modelID":"claude-sonnet-4","providerID":"anthropic","cost":0.05,"tokens":{"input":1000,"output":500,"reasoning":0,"cache":{"read":200,"write":50}},"time":{"created":1700000000000.0}}');`
    )
    db.close()

    const result = await parseOpenCode()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('opencode')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].model.provider).toBe('anthropic')
    expect(result[0].tokens.input).toBe(1000)
    expect(result[0].tokens.output).toBe(500)
    expect(result[0].tokens.cacheInput).toBe(200)
    expect(result[0].tokens.cacheOutput).toBe(50)
    expect(result[0].project?.path).toBe('/Users/alice/opencode-repo')
  })

  it('returns distinct rows as separate messages', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'opencode')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'opencode.db')
    await createOpenCodeDb(dbPath)

    const dataJson = JSON.stringify({
      role: 'assistant',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      cost: 0.05,
      tokens: {
        input: 1000,
        output: 500,
        reasoning: 0,
        cache: { read: 200, write: 50 },
      },
      time: { created: 1700000000000.0, completed: 1700000000500.0 },
      mode: 'build',
    })

    const db = new DatabaseSync(dbPath)
    db.exec(
      `INSERT INTO message (id, session_id, data) VALUES ('root_row', 'root_session', '${dataJson}');
       INSERT INTO message (id, session_id, data) VALUES ('fork_copy_row', 'fork_session', '${dataJson}');`
    )
    db.close()

    const result = await parseOpenCode()
    expect(result).toHaveLength(2)
    expect(result[0].tokens.input).toBe(1000)
    expect(result[1].tokens.input).toBe(1000)
  })

  it('falls back to legacy JSON files when DB is missing', async () => {
    const legacyDir = join(
      tempHome,
      '.local',
      'share',
      'opencode',
      'storage',
      'message'
    )
    mkdirSync(legacyDir, { recursive: true })
    const json = JSON.stringify({
      id: 'msg_123',
      sessionID: 'ses_456',
      role: 'assistant',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      cost: 0.05,
      tokens: {
        input: 100,
        output: 50,
        reasoning: 0,
        cache: { read: 10, write: 5 },
      },
      time: { created: 1700000000000.0 },
      path: { root: '/Users/alice/legacy-repo' },
    })
    writeFileSync(join(legacyDir, 'msg_123.json'), json)

    const result = await parseOpenCode()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].project?.path).toBe('/Users/alice/legacy-repo')
  })

  it('skips non-assistant legacy JSON messages', async () => {
    const legacyDir = join(
      tempHome,
      '.local',
      'share',
      'opencode',
      'storage',
      'message'
    )
    mkdirSync(legacyDir, { recursive: true })
    const json = JSON.stringify({
      id: 'msg_user',
      sessionID: 'ses_001',
      role: 'user',
      modelID: 'claude-sonnet-4',
      tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
      time: { created: 1700000000000.0 },
    })
    writeFileSync(join(legacyDir, 'msg_user.json'), json)

    const result = await parseOpenCode()
    expect(result).toHaveLength(0)
  })

  it('normalizes agent names', async () => {
    const legacyDir = join(
      tempHome,
      '.local',
      'share',
      'opencode',
      'storage',
      'message'
    )
    mkdirSync(legacyDir, { recursive: true })
    const json = JSON.stringify({
      role: 'assistant',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
      time: { created: 1700000000000.0 },
      agent: 'sisyphus (ultraworker)',
    })
    writeFileSync(join(legacyDir, 'msg_agent.json'), json)

    const result = await parseOpenCode()
    expect(result).toHaveLength(1)
    expect(result[0].mode).toBe('chat')
  })
})
