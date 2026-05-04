import sqlite3, { Database } from 'sqlite3'
import { existsAsync } from './fs.js'

export async function readSQLiteDB(db: string): Promise<Database | null> {
  if (!(await existsAsync(db))) return null

  return new Promise((resolve) => {
    const database = new sqlite3.Database(db, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        resolve(null)
      } else {
        resolve(database)
      }
    })
  })
}

export function sqliteAll(
  db: Database,
  sql: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows as Record<string, unknown>[])
    })
  })
}
