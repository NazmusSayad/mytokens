import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as sqlite3 from 'sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCrush } from './crush.js'

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

describe('parseCrush', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no projects.json exists', async () => {
    const result = await parseCrush()
    expect(result).toEqual([])
  })

  it('parses crush.db with assistant day buckets', async () => {
    const shareDir = join(tempHome, '.local', 'share', 'crush')
    mkdirSync(shareDir, { recursive: true })
    const projectDbDir = join(tempHome, 'projects', 'myproject')
    mkdirSync(projectDbDir, { recursive: true })

    writeFileSync(
      join(shareDir, 'projects.json'),
      JSON.stringify([{ path: projectDbDir }])
    )

    const dbPath = join(projectDbDir, 'crush.db')
    const db = new sqlite3.Database(dbPath)
    await new Promise<void>((resolve, reject) => {
      db.exec(
        `CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          parent_session_id TEXT,
          cost REAL,
          created_at INTEGER,
          updated_at INTEGER,
          message_count INTEGER
        );
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          role TEXT,
          created_at INTEGER
        );
        INSERT INTO sessions (id, parent_session_id, cost, created_at, updated_at, message_count)
        VALUES ('root-1', NULL, 0.05, 1700000000, 1700003600, 3);
        INSERT INTO messages (id, session_id, role, created_at)
        VALUES ('m1', 'root-1', 'assistant', 1700000000);
        INSERT INTO messages (id, session_id, role, created_at)
        VALUES ('m2', 'root-1', 'assistant', 1700001000);`,
        (err) => {
          db.close()
          if (err) reject(err)
          else resolve()
        }
      )
    })

    const result = await parseCrush()
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].app).toBe('crush')
    expect(result[0].model.id).toBe('session-total')
    expect(result[0].model.provider).toBe('crush')
  })

  it('skips sessions with zero cost and no assistant messages', async () => {
    const shareDir = join(tempHome, '.local', 'share', 'crush')
    mkdirSync(shareDir, { recursive: true })
    const projectDbDir = join(tempHome, 'projects', 'myproject')
    mkdirSync(projectDbDir, { recursive: true })

    writeFileSync(
      join(shareDir, 'projects.json'),
      JSON.stringify([{ path: projectDbDir }])
    )

    const dbPath = join(projectDbDir, 'crush.db')
    const db = new sqlite3.Database(dbPath)
    await new Promise<void>((resolve, reject) => {
      db.exec(
        `CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          parent_session_id TEXT,
          cost REAL,
          created_at INTEGER,
          updated_at INTEGER,
          message_count INTEGER
        );
        INSERT INTO sessions (id, parent_session_id, cost, created_at, updated_at, message_count)
        VALUES ('root-1', NULL, 0, 1700000000, 1700003600, 0);`,
        (err) => {
          db.close()
          if (err) reject(err)
          else resolve()
        }
      )
    })

    const result = await parseCrush()
    expect(result).toHaveLength(0)
  })
})
