#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import { runApp } from './app.js'

const program = new Command('openusage')
  .description('CLI tool to see detailed opencode usage')
  .argument('[screen]', 'Screen to show: all, model, provider, total')

  .action((screen) => {
    console.log(screen)
    void runApp({})
  })

program.parse()
