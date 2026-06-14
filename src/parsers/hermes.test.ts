import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseHermes } from './hermes.js'

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

function createHermesDb(dbPath: string): void {
  const db = new DatabaseSync(dbPath)
  db.exec(
    `CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      model TEXT,
      billing_provider TEXT,
      started_at INTEGER,
      message_count INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_write_tokens INTEGER,
      reasoning_tokens INTEGER,
      estimated_cost_usd REAL,
      actual_cost_usd REAL
    );`
  )
  db.close()
}

describe('parseHermes', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no db exists', async () => {
    const result = await parseHermes()
    expect(result).toEqual([])
  })

  it('parses sessions with tokens', async () => {
    const dbDir = join(tempHome, '.hermes')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'state.db')
    await createHermesDb(dbPath)

    const db = new DatabaseSync(dbPath)
    db.exec(
      `INSERT INTO sessions (id, model, billing_provider, started_at, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens)
       VALUES ('ses-1', 'claude-sonnet-4', 'anthropic', 1700000000, 100, 50, 20, 5, 2);`
    )
    db.close()

    const result = await parseHermes()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('hermes')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].model.provider).toBe('anthropic')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
    expect(result[0].tokens.reasoning).toBe(2)
  })

  it('skips zero-token sessions', async () => {
    const dbDir = join(tempHome, '.hermes')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'state.db')
    await createHermesDb(dbPath)

    const db = new DatabaseSync(dbPath)
    db.exec(
      `INSERT INTO sessions (id, model, billing_provider, started_at, input_tokens, output_tokens)
       VALUES ('ses-1', 'gpt-4o', 'openai', 1700000000, 0, 0);`
    )
    db.close()

    const result = await parseHermes()
    expect(result).toHaveLength(0)
  })

  it('infers provider from model when billing_provider is missing', async () => {
    const dbDir = join(tempHome, '.hermes')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'state.db')
    await createHermesDb(dbPath)

    const db = new DatabaseSync(dbPath)
    db.exec(
      `INSERT INTO sessions (id, model, started_at, input_tokens, output_tokens)
       VALUES ('ses-1', 'gpt-4o', 1700000000, 10, 5);`
    )
    db.close()

    const result = await parseHermes()
    expect(result).toHaveLength(1)
    expect(result[0].model.provider).toBe('openai')
  })
})
