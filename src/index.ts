#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import { runApp } from './app.js'

const program = new Command('openusage')
  .description('CLI tool to see detailed opencode usage')
  .option(
    '--db <path>',
    'Path to the opencode.db file. Overrides OPENCODE_DB_PATH environment variable'
  )
  .action((_options) => {
    void runApp({})
  })

program
  .command('all')
  .description(
    'Show detailed usage and cost per day, broken down by model and provider'
  )
  .option(
    '--db <path>',
    'Path to the opencode.db file. Overrides OPENCODE_DB_PATH environment variable'
  )
  .action((_options) => {
    void runApp({})
  })

program
  .command('model')
  .description('Show usage and cost per day, broken down by model')
  .option(
    '--db <path>',
    'Path to the opencode.db file. Overrides OPENCODE_DB_PATH environment variable'
  )
  .action((_options) => {
    void runApp({})
  })

program
  .command('total')
  .description('Show total usage and cost per day')
  .option(
    '--db <path>',
    'Path to the opencode.db file. Overrides OPENCODE_DB_PATH environment variable'
  )
  .action((_options) => {
    void runApp({})
  })

program
  .command('provider')
  .description('Show usage and cost per day, broken down by provider')
  .option(
    '--db <path>',
    'Path to the opencode.db file. Overrides OPENCODE_DB_PATH environment variable'
  )
  .action((_options) => {
    void runApp({})
  })

program.parse()
