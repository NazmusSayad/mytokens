import ms from 'ms'
import os from 'os'
import path from 'path'

export const CACHE_VALIDITY_DURATION = ms('1h')

export const OPENUSAGE_PATH = path.join(os.homedir(), '.openusage')
export const OPENUSAGE_CACHE_PATH = path.join(OPENUSAGE_PATH, 'cache')
export const OPENUSAGE_CACHE_REGISTRY_PATH = path.join(
  OPENUSAGE_CACHE_PATH,
  'registry.json'
)
