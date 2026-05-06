import ms from 'ms'
import os from 'os'
import path from 'path'

export const CACHE_VALIDITY_DURATION = ms('1h')

export const MYTOKENS_PATH = path.join(os.homedir(), '.mytokens')
export const MYTOKENS_CACHE_PATH = path.join(MYTOKENS_PATH, 'cache')
export const MYTOKENS_CACHE_REGISTRY_PATH = path.join(
  MYTOKENS_CACHE_PATH,
  'registry.json'
)
