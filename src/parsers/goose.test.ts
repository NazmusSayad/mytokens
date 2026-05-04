import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as sqlite3 from 'sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseGoose } from './goose.js'

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

function createGooseDb(dbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err)
      db.exec(
        `CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          model_config_json TEXT,
          provider_name TEXT,
          created_at TEXT,
          total_tokens INTEGER,
          input_tokens INTEGER,
          output_tokens INTEGER,
          accumulated_total_tokens INTEGER,
          accumulated_input_tokens INTEGER,
          accumulated_output_tokens INTEGER
        );`,
        (err) => {
          if (err) return reject(err)
          db.close((err) => {
            if (err) return reject(err)
            resolve()
          })
        }
      )
    })
  })
}

describe('parseGoose', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no db exists', async () => {
    const result = await parseGoose()
    expect(result).toEqual([])
  })

  it('parses session with model config JSON', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'goose', 'sessions')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'sessions.db')
    await createGooseDb(dbPath)

    const db = new sqlite3.Database(dbPath)
    await new Promise<void>((resolve, reject) => {
      db.exec(
        `INSERT INTO sessions (id, model_config_json, provider_name, created_at, accumulated_input_tokens, accumulated_output_tokens, accumulated_total_tokens)
         VALUES ('ses-1', '{"model_name":"claude-sonnet-4"}', 'anthropic', '2024-12-01 10:00:00', 100, 50, 152);`,
        (err) => {
          db.close()
          if (err) reject(err)
          else resolve()
        }
      )
    })

    const result = await parseGoose()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('goose')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].model.provider).toBe('anthropic')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.reasoning).toBe(2)
  })

  it('falls back to provider inference', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'goose', 'sessions')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'sessions.db')
    await createGooseDb(dbPath)

    const db = new sqlite3.Database(dbPath)
    await new Promise<void>((resolve, reject) => {
      db.exec(
        `INSERT INTO sessions (id, model_config_json, created_at, input_tokens, output_tokens, total_tokens)
         VALUES ('ses-1', '{"model_name":"gpt-4o"}', '2024-12-01 10:00:00', 10, 5, 15);`,
        (err) => {
          db.close()
          if (err) reject(err)
          else resolve()
        }
      )
    })

    const result = await parseGoose()
    expect(result).toHaveLength(1)
    expect(result[0].model.provider).toBe('openai')
  })

  it('skips sessions with zero tokens', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'goose', 'sessions')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'sessions.db')
    await createGooseDb(dbPath)

    const db = new sqlite3.Database(dbPath)
    await new Promise<void>((resolve, reject) => {
      db.exec(
        `INSERT INTO sessions (id, model_config_json, created_at, input_tokens, output_tokens, total_tokens)
         VALUES ('ses-1', '{"model_name":"gpt-4o"}', '2024-12-01 10:00:00', 0, 0, 0);`,
        (err) => {
          db.close()
          if (err) reject(err)
          else resolve()
        }
      )
    })

    const result = await parseGoose()
    expect(result).toHaveLength(0)
  })
})
