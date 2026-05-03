export type UsageDataApp = 'opencode' | 'codex' | 'claude' | 'gemini'
export type UsageDataMode = 'chat' | 'plan' | 'build' | 'agent' | 'other'
export type UsageDataType =
  | 'user'
  | 'system'
  | 'assistant'
  | 'developer'
  | 'tool'
  | 'other'

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
  app: UsageDataApp
  mode: UsageDataMode
  type: UsageDataType

  date: Date
  model: UsageDataModel
  tokens: UsageDataToken

  project?: UsageDataProject
}
