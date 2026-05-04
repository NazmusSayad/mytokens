#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import { runApp } from './app.js'
import { parseScreenArg } from './helpers/args.js'

const program = new Command('openusage')
  .description('CLI tool to see detailed opencode usage')
  .argument('[screen]', 'file to process')
  .action((screen) => {
    const parsedScreen = parseScreenArg(screen ?? 'tokens')
    if (!parsedScreen) {
      console.error(`Invalid screen argument: ${screen}`)
      process.exit(1)
    }

    void runApp({
      screen: parsedScreen,
      showBy: 'day',

      screenPadding: 1,
      screenWidth: process.stdout.columns ?? 80,

      enabledApps: null,
      disabledApps: null,

      enabledProviders: null,
      disabledProviders: null,

      enabledModels: null,
      disabledModels: null,

      enabledModes: null,
      disabledModes: null,

      enabledProjects: null,
      disabledProjects: null,

      dateStart: null,
      dateEnd: null,
    })
  })

program.parse()
