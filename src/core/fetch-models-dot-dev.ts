import { cachedFetchJSON } from './cached-fetch.js'

type ModelsDotDevCost = {
  input: number
  output: number
  cache_read: number
  cache_write: number
}

type ModelsDotDevLimit = {
  context: number
  output: number
}

type ModelsDotDevModalities = {
  input: string[]
  output: string[]
}

type ModelsDotDevModel = {
  id: string
  name: string
  family?: string
  attachment: boolean
  reasoning: boolean
  tool_call: boolean
  temperature: boolean
  knowledge?: string
  release_date?: string
  last_updated?: string
  modalities: ModelsDotDevModalities
  open_weights: boolean
  cost?: ModelsDotDevCost
  limit?: ModelsDotDevLimit
}

type ModelsDotDevProvider = {
  id: string
  env: string[]
  npm?: string
  api: string
  name: string
  doc?: string
  models: Record<string, ModelsDotDevModel>
}

export type ModelsDotDevResponse = Record<string, ModelsDotDevProvider>

export async function fetchModelsDotDev(): Promise<ModelsDotDevResponse> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  return await cachedFetchJSON('https://models.dev/api.json', {
    headers: headers,
  })
}
