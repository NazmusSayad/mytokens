export type UsageDataModel = {
  id: string
  provider: string
  providerUrl?: string
  metadata?: Record<string, unknown>
}

export type UsageDataToken = {
  input: number
  output: number
  reasoning: number
  cacheInput: number
  cacheOutput: number
}

export type UsageDataProject = {
  name?: string
  path?: string
}

export type UsageDataMessage = {
  source: string
  agent: string
  type: 'user' | 'system' | 'assistant' | 'developer' | 'tool' | 'other'

  date: Date
  model: UsageDataModel
  tokens: UsageDataToken

  project?: UsageDataProject
}
