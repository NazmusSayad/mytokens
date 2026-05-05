import ms from 'ms'
import os from 'os'
import path from 'path'

export const CACHE_VALIDITY_DURATION = ms('1h')

export const MY_TOKEN_PATH = path.join(os.homedir(), '.mytoken')
export const MY_TOKEN_CACHE_PATH = path.join(MY_TOKEN_PATH, 'cache')
export const MY_TOKEN_CACHE_REGISTRY_PATH = path.join(
  MY_TOKEN_CACHE_PATH,
  'registry.json'
)
