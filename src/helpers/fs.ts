import fs from 'fs'
import path from 'path'

export function readFileForced(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, { encoding: 'utf-8' })
}

export function readFileAsJSON<T>(filePath: string): T | null {
  const fileContent = readFileForced(filePath)
  if (!fileContent) return null

  try {
    return JSON.parse(fileContent) as T
  } catch {
    return null
  }
}

export function writeFileForced(filePath: string, content: string) {
  const dirName = path.dirname(filePath)
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true })
  }

  return fs.writeFileSync(filePath, content, { encoding: 'utf-8' })
}

export function writeFileAsJSON(
  filePath: string,
  content: Record<string, unknown>
) {
  return writeFileForced(filePath, JSON.stringify(content, null, 2))
}
