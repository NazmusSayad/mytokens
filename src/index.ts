#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import { runApp } from './app.js'
import { parseScreenArg } from './helpers/args.js'
import { RenderValueShowBy } from './render/types.js'

const program = new Command('openusage')
  .description('CLI tool to see detailed opencode usage')
  .argument('[screen]', 'file to process')
  .option('--by <by>', 'grouping for costs and tokens screens', 'day')
  .option('--from <from>', 'start date for the period')
  .option('--to <to>', 'end date for the period')
  .option('--apps <apps>', 'list of apps to include', (val) => val.split(','))
  .option('--skip-apps <apps>', 'list of apps to exclude', (val) =>
    val.split(',')
  )
  .option('--modes <modes>', 'list of modes to include', (val) =>
    val.split(',')
  )
  .option('--skip-modes <modes>', 'list of modes to exclude', (val) =>
    val.split(',')
  )
  .option('--models <models>', 'list of models to include', (val) =>
    val.split(',')
  )
  .option('--skip-models <models>', 'list of models to exclude', (val) =>
    val.split(',')
  )
  .option('--projects <projects>', 'list of projects to include', (val) =>
    val.split(',')
  )
  .option('--skip-projects <projects>', 'list of projects to exclude', (val) =>
    val.split(',')
  )
  .option('--providers <providers>', 'list of providers to include', (val) =>
    val.split(',')
  )
  .option(
    '--skip-providers <providers>',
    'list of providers to exclude',
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
