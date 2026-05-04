#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import { runApp } from './app.js'
import { parseScreenArg } from './helpers/args.js'
import { RenderValueShowBy } from './render/types.js'

const program = new Command('openusage')
  .description('CLI tool to see detailed all the coding cli usage')
  .argument(
    '[screen]',
    'Screen to display. Available screens: costs, tokens, apps-by-costs, apps-by-tokens, modes-by-costs, modes-by-tokens, models-by-costs, models-by-tokens, projects-by-costs, projects-by-tokens, providers-by-costs, providers-by-tokens.'
  )
  .option(
    '--by <by>',
    'Grouping by time. possible values: day, week, month, year. example: --by month',
    'day'
  )
  .option(
    '--from <from>',
    'Start date for the period. example: --from 2024-01-01'
  )
  .option('--to <to>', 'End date for the period. example: --to 2024-12-31')
  .option(
    '--apps <apps>',
    'Apps to include. example: --apps opencode,codex',
    (val) => val.split(',')
  )
  .option(
    '--skip-apps <apps>',
    'Apps to exclude. example: --skip-apps claude',
    (val) => val.split(',')
  )
  .option(
    '--modes <modes>',
    'Modes to include. example: --modes agent,chat',
    (val) => val.split(',')
  )
  .option(
    '--skip-modes <modes>',
    'Modes to exclude. example: --skip-modes edit',
    (val) => val.split(',')
  )
  .option(
    '--models <models>',
    'Models to include. example: --models gpt-4o,claude-3-5-sonnet',
    (val) => val.split(',')
  )
  .option(
    '--skip-models <models>',
    'Models to exclude. example: --skip-models gpt-3.5-turbo',
    (val) => val.split(',')
  )
  .option(
    '--projects <projects>',
    'Projects to include. example: --projects my-api,frontend',
    (val) => val.split(',')
  )
  .option(
    '--skip-projects <projects>',
    'Projects to exclude. example: --skip-projects legacy-app',
    (val) => val.split(',')
  )
  .option(
    '--providers <providers>',
    'Providers to include. example: --providers openai,anthropic',
    (val) => val.split(',')
  )
  .option(
    '--skip-providers <providers>',
    'Providers to exclude. example: --skip-providers groq',
    (val) => val.split(',')
  )
  .action((screen, options) => {
    const parsedScreen = parseScreenArg(screen ?? 'tokens')
    if (!parsedScreen) {
      console.error(`Invalid screen argument: ${screen}`)
      process.exit(1)
    }

    void runApp({
      screen: parsedScreen,
      showBy: options.by as RenderValueShowBy,

      screenPadding: 1,
      screenWidth: process.stdout.columns ?? 80,

      dateStart: options.from ? new Date(options.from) : null,
      dateEnd: options.to ? new Date(options.to) : null,

      enabledApps: options.apps ?? null,
      disabledApps: options.skipApps ?? null,

      enabledModes: options.modes ?? null,
      disabledModes: options.skipModes ?? null,

      enabledModels: options.models ?? null,
      disabledModels: options.skipModels ?? null,

      enabledProjects: options.projects ?? null,
      disabledProjects: options.skipProjects ?? null,

      enabledProviders: options.providers ?? null,
      disabledProviders: options.skipProviders ?? null,
    })
  })

program.parse()
