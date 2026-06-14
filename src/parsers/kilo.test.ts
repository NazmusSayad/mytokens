import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseKilo } from './kilo.js'

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

function createKiloDb(dbPath: string): void {
  const db = new DatabaseSync(dbPath)
  db.exec(
    `CREATE TABLE message (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );`
  )
  db.close()
}

describe('parseKilo', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no db exists', async () => {
    const result = await parseKilo()
    expect(result).toEqual([])
  })

  it('parses assistant messages from JSON data', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'kilo')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'kilo.db')
    await createKiloDb(dbPath)

    const dataJson = JSON.stringify({
      role: 'assistant',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      tokens: {
        input: 100,
        output: 50,
        reasoning: 2,
        cache: { read: 20, write: 5 },
      },
      time: { created: 1700000000000 },
    })

    const db = new DatabaseSync(dbPath)
    db.exec(`INSERT INTO message (id, data) VALUES ('msg-1', '${dataJson}');`)
    db.close()

    const result = await parseKilo()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('kilo')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.reasoning).toBe(2)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
  })

  it('skips non-assistant messages', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'kilo')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'kilo.db')
    await createKiloDb(dbPath)

    const dataJson = JSON.stringify({
      role: 'user',
      modelID: 'claude-sonnet-4',
      tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
    })

    const db = new DatabaseSync(dbPath)
    db.exec(`INSERT INTO message (id, data) VALUES ('msg-1', '${dataJson}');`)
    db.close()

    const result = await parseKilo()
    expect(result).toHaveLength(0)
  })
})
