import { webcrypto } from 'node:crypto'

export async function colorGenerator(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await webcrypto.subtle.digest('SHA-256', encoded)
  const bytes = new Uint8Array(digest)
  const r = bytes[0].toString(16).padStart(2, '0')
  const g = bytes[1].toString(16).padStart(2, '0')
  const b = bytes[2].toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}
