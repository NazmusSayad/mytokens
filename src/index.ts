#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import chalk from 'chalk'
import { runApp } from './app.js'
import {
  parseScreenArg,
  resolveBy,
  resolveDateRange,
  ScreenChoices,
} from './helpers/args.js'
import { RenderValueShowBy } from './render/types.js'

const program = new Command('openusage')
  .description('CLI tool to see detailed all the coding cli usage')
  .argument(
    '[screen]',
    `Screen to display. Available screens: ${Object.keys(ScreenChoices).join(', ')}`
  )
  .option(
    '--by <by>',
    'Grouping by time. possible values: day, week, month, year. example: --by month'
  )
  .option('--day', 'shorthand for --by day')
  .option('--week', 'shorthand for --by week')
  .option('--month', 'shorthand for --by month')
  .option('--year', 'shorthand for --by year')
  .option(
    '--from <from>',
    'Start date for the period. example: --from 2024-01-01'
  )
  .option('--to <to>', 'End date for the period. example: --to 2024-12-31')
  .option('--today', 'show data for today only')
  .option('--last-week', 'show data for the last 7 days')
  .option('--last-month', 'show data for the last 30 days')
  .option('--last <days>', 'show data for the last n days', (val) => {
    const num = parseInt(val, 10)
    if (isNaN(num) || num <= 0) {
      throw new Error(
        `Invalid --last value: ${val}. Must be a positive number.`
      )
    }
    return num
  })
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
      console.error(chalk.red(`Invalid screen argument: ${chalk.bold(screen)}`))
      console.log(`Available screens: ${Object.keys(ScreenChoices).join(', ')}`)
      process.exit(1)
    }

    let dateStart: Date | null
    let dateEnd: Date | null
    let showBy: string

    try {
      const range = resolveDateRange({
        from: options.from,
        to: options.to,
        today: options.today,
        lastWeek: options.lastWeek,
        lastMonth: options.lastMonth,
        last: options.last,
      })
      dateStart = range.dateStart
      dateEnd = range.dateEnd

      showBy = resolveBy({
        by: options.by,
        day: options.day,
        week: options.week,
        month: options.month,
        year: options.year,
      })
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }

    void runApp({
      screen: parsedScreen,
      showBy: showBy as RenderValueShowBy,

      screenPadding: 1,
      screenWidth: process.stdout.columns ?? 80,

      dateStart,
      dateEnd,

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
