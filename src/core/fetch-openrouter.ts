import { cachedFetchJSON } from './cached-fetch.js'

type OpenrouterArchitecture = {
  modality: string
  input_modalities: string[]
  output_modalities: string[]
  tokenizer: string | null
  instruct_type: string | null
}

type OpenrouterPricing = {
  prompt: string
  completion: string
  image?: string
  request?: string
  input_cache_read?: string
  input_cache_write?: string
  web_search?: string
}

type OpenrouterTopProvider = {
  context_length: number | null
  max_completion_tokens: number | null
  is_moderated: boolean
}

type OpenrouterDefaultParameters = {
  temperature: number | null
  top_p: number | null
  top_k: number | null
  frequency_penalty: number | null
  presence_penalty: number | null
  repetition_penalty: number | null
}

type OpenrouterLinks = {
  details: string
}

type OpenrouterModel = {
  id: string
  canonical_slug: string | null
  hugging_face_id: string | null
  name: string
  created: number
  description: string
  context_length: number
  architecture: OpenrouterArchitecture
  pricing: OpenrouterPricing
  top_provider: OpenrouterTopProvider
  per_request_limits: null | unknown
  supported_parameters: string[]
  default_parameters: OpenrouterDefaultParameters
  knowledge_cutoff: string | null
  expiration_date: string | null
  links: OpenrouterLinks
}

type OpenrouterResponse = {
  data: OpenrouterModel[]
}

export async function fetchOpenrouter(): Promise<OpenrouterResponse> {
  return await cachedFetchJSON('https://openrouter.ai/api/v1/models')
}
