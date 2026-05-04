import fs from 'fs'
import sqlite3, { Database } from 'sqlite3'

export async function readSQLiteDB(db: string): Promise<Database | null> {
  if (!fs.existsSync(db)) return null

  try {
    return new sqlite3.Database(db, sqlite3.OPEN_READONLY)
  } catch {
    return null
  }
}
