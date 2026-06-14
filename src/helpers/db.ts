import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { existsAsync } from './fs.js'

export async function readSQLiteDB(db: string): Promise<DatabaseSync | null> {
  if (!(await existsAsync(db))) return null

  try {
    return new DatabaseSync(db, { readOnly: true })
  } catch {
    return null
  }
}

export async function sqliteAll(
  db: DatabaseSync,
  sql: string,
  params: SQLInputValue[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>[]> {
  return db.prepare(sql).all(...params)
}
