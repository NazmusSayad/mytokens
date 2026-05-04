#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import { runApp } from './app.js'

const program = new Command('openusage')
  .description('CLI tool to see detailed opencode usage')
  .action(() => {
    void runApp({
      screen: 'providers-by-costs',
      showBy: 'day',
    })
  })

program.parse()
