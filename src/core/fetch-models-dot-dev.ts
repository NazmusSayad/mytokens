type ModelsDotDevCost = {
  input: number
  output: number
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
  cost: ModelsDotDevCost
  limit: ModelsDotDevLimit
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

type ModelsDotDevResponse = Record<string, ModelsDotDevProvider>

export async function fetchModelsDotDev(): Promise<ModelsDotDevResponse> {
  const response = await fetch('https://models.dev/api.json')
  const data = (await response.json()) as ModelsDotDevResponse
  return data
}
