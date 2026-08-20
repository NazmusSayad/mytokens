#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import chalk from 'chalk'
import { runApp } from './app.js'
import { APP_SCREENS_MAP, AppScreenType } from './constants/screen.js'
import { attachExportCommands } from './export/cli.js'
import { parseScreenArg, resolveBy } from './helpers/args.js'
import { pickScreen } from './helpers/picker.js'
import {
  addUsageFilterOptions,
  buildUsageFilterOptions,
  UsageFilterOptionValues,
} from './helpers/usage-options.js'
import { RenderValueShowBy } from './render/types.js'

type DashboardCommandOptions = UsageFilterOptionValues & {
  by?: string
  day?: boolean
  week?: boolean
  month?: boolean
  year?: boolean
  screen?: string | boolean
  display?: string | boolean
}

const program = new Command('mytokens')
  .description('CLI tool to see detailed all the coding cli usage')
  .argument(
    '[screen]',
    `Screen to display. Available screens: ${Object.keys(APP_SCREENS_MAP).join(', ')}`
  )
  .option(
    '-s, --screen [screen]',
    `Screen to display. Available screens: ${Object.keys(APP_SCREENS_MAP).join(', ')}. example: --screen models`
  )
  .option(
    '-d, --display [display]',
    `Alias for --screen. example: --display models`
  )
  .option(
    '--by <by>',
    'Grouping by time. possible values: day, week, month, year. example: --by month'
  )
  .option('--day', 'shorthand for --by day')
  .option('--week', 'shorthand for --by week')
  .option('--month', 'shorthand for --by month')
  .option('--year', 'shorthand for --by year')

addUsageFilterOptions(program)
program.enablePositionalOptions()

program.action(async (screen, options: DashboardCommandOptions) => {
  let parsedScreen: AppScreenType | null = null

  if (
    screen &&
    (options.screen !== undefined || options.display !== undefined)
  ) {
    console.error(
      chalk.red(
        `Cannot use the ${chalk.bold('[screen]')} argument together with ${chalk.bold('--screen')}/${chalk.bold('--display')}`
      )
    )
    process.exit(1)
  }

  const screenInput =
    typeof options.screen === 'string'
      ? options.screen
      : typeof options.display === 'string'
        ? options.display
        : screen

  if (screenInput) {
    parsedScreen = parseScreenArg(screenInput)

    if (!parsedScreen) {
      console.error(
        chalk.red(`Invalid screen argument: ${chalk.bold(screenInput)}`)
      )
      console.log(
        `Available screens: ${Object.keys(APP_SCREENS_MAP).join(', ')}`
      )
      process.exit(1)
    }
  } else if (options.screen === true || options.display === true) {
    try {
      parsedScreen = await pickScreen()
    } catch (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        process.exit(0)
      }
      throw err
    }
  } else {
    parsedScreen = 'models-by-tokens'
  }

  let showBy: string
  let filterOptions

  try {
    filterOptions = buildUsageFilterOptions(options)

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

    ...filterOptions,
  })
})

attachExportCommands(program)
program.parse()
