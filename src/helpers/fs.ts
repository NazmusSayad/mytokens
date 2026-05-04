import fs from 'fs/promises'
import path from 'path'

export async function existsAsync(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export async function readFileForced(filePath: string): Promise<string | null> {
  if (!(await existsAsync(filePath))) return null

  return fs.readFile(filePath, { encoding: 'utf-8' })
}

export async function readFileAsJSON<T>(filePath: string): Promise<T | null> {
  const fileContent = await readFileForced(filePath)
  if (!fileContent) return null

  try {
    return JSON.parse(fileContent) as T
  } catch {
    return null
  }
}

export async function writeFileForced(filePath: string, content: string) {
  const dirName = path.dirname(filePath)
  if (!(await existsAsync(dirName))) {
    await fs.mkdir(dirName, { recursive: true })
  }

  return fs.writeFile(filePath, content, { encoding: 'utf-8' })
}

export function writeFileAsJSON(
  filePath: string,
  content: Record<string, unknown>
) {
  return writeFileForced(filePath, JSON.stringify(content, null, 2))
}
