import type { Command, OptionValues } from '@commander-js/extra-typings'
import chalk from 'chalk'
import { MYTOKENS_PARSE_CACHE_PATH } from './config.js'
import {
  clearFileMessagesCache,
  getFileMessagesCacheInfo,
  listFileMessagesCache,
} from './helpers/parse-cache.js'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export function attachCacheCommands<
  Args extends unknown[],
  Opts extends OptionValues,
  GlobalOpts extends OptionValues,
>(program: Command<Args, Opts, GlobalOpts>) {
  const cacheCommand = program
    .command('cache')
    .description('Manage the local parse cache.')

  cacheCommand
    .command('clear')
    .description('Delete all cached parser results.')
    .action(() => {
      clearFileMessagesCache()
      console.log(chalk.green('Parse cache cleared.'))
    })

  cacheCommand
    .command('ls')
    .description('List files currently in the parse cache.')
    .action(() => {
      const entries = listFileMessagesCache()
      if (entries.length === 0) {
        console.log('Parse cache is empty.')
        return
      }

      for (const entry of entries) {
        console.log(`${String(entry.messages).padStart(7)}  ${entry.path}`)
      }
      console.log(
        chalk.dim(`\n${entries.length} files, ${MYTOKENS_PARSE_CACHE_PATH}`)
      )
    })

  cacheCommand
    .command('size')
    .description('Show parse cache size on disk.')
    .action(() => {
      const info = getFileMessagesCacheInfo()
      if (!info.existsOnDisk) {
        console.log('No parse cache on disk yet.')
        return
      }
      console.log(`File:     ${formatBytes(info.fileBytes)}`)
      console.log(`Path:     ${MYTOKENS_PARSE_CACHE_PATH}`)
      console.log(`Entries:  ${info.entries} files`)
      console.log(`Messages: ${info.messages}`)
    })
}
