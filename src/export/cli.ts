import { AppScreenType } from '@/constants/screen.js'
import { parseScreenArg, resolveBy, resolveDateRange } from '@/helpers/args.js'
import { RenderScreenOptions, RenderValueShowBy } from '@/render/types.js'
import { Command, OptionValues } from '@commander-js/extra-typings'
import chalk from 'chalk'
import { exportReportToSvg, showReportImage } from './index.js'

type CommonOptions = {
  by?: string
  day?: boolean
  week?: boolean
  month?: boolean
  year?: boolean
  from?: string
  to?: string
  today?: boolean
  yesterday?: boolean
  lastWeek?: boolean
  lastMonth?: boolean
  lastYear?: boolean
  thisWeek?: boolean
  thisMonth?: boolean
  thisYear?: boolean
  last?: number
  apps?: string[]
  skipApps?: string[]
  modes?: string[]
  skipModes?: string[]
  models?: string[]
  skipModels?: string[]
  projects?: string[]
  skipProjects?: string[]
  providers?: string[]
  skipProviders?: string[]
}

export function attachExportCommands<
  Args extends unknown[],
  Opts extends OptionValues,
  GlobalOpts extends OptionValues,
>(program: Command<Args, Opts, GlobalOpts>) {
  program
    .command('export')
    .description(
      'Export the usage report as an SVG image. Omit the screen to export all screens into one dashboard.'
    )
    .argument('[screen]', 'Screen to export')
    .option('--output <path>', 'Output SVG file path', 'mytokens.svg')
    .option(
      '--by <by>',
      'Grouping by time. possible values: day, week, month, year'
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
    .option('--yesterday', 'show data for yesterday only')
    .option('--last-week', 'show data for the last 7 days')
    .option('--last-month', 'show data for the last 30 days')
    .option('--last-year', 'show data for the last 365 days')
    .option('--this-week', 'show data for the current week (from Sunday)')
    .option('--this-month', 'show data for the current month')
    .option('--this-year', 'show data for the current year')
    .option('--last <days>', 'show data for the last n days', (val) => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num <= 0) {
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
    .on('--help', () => {
      console.log('\nExamples:')
      console.log('  $ mytokens export')
      console.log(
        '  $ mytokens export models-by-costs --last 30 --output report.svg'
      )
    })
    .action(async (screen, options) => {
      const parsedScreen = resolveScreenArg(screen)

      try {
        const renderOptions = buildRenderOptions(options)
        const outputPath = await exportReportToSvg(
          parsedScreen,
          options.output,
          renderOptions
        )
        console.log(
          chalk.green(
            `Saved ${parsedScreen ? chalk.bold(parsedScreen) : 'all screens'} report to ${chalk.bold(outputPath)}`
          )
        )
      } catch (err) {
        console.error(
          chalk.red(err instanceof Error ? err.message : String(err))
        )
        process.exit(1)
      }
    })

  program
    .command('image')
    .description(
      'Render the usage report image in the terminal. Omit the screen to render all screens.'
    )
    .argument('[screen]', 'Screen to render as an image')
    .option(
      '--by <by>',
      'Grouping by time. possible values: day, week, month, year'
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
    .option('--yesterday', 'show data for yesterday only')
    .option('--last-week', 'show data for the last 7 days')
    .option('--last-month', 'show data for the last 30 days')
    .option('--last-year', 'show data for the last 365 days')
    .option('--this-week', 'show data for the current week (from Sunday)')
    .option('--this-month', 'show data for the current month')
    .option('--this-year', 'show data for the current year')
    .option('--last <days>', 'show data for the last n days', (val) => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num <= 0) {
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
    .on('--help', () => {
      console.log('\nExamples:')
      console.log('  $ mytokens image')
      console.log('  $ mytokens image apps-by-tokens --this-month')
    })
    .action(async (screen, options) => {
      const parsedScreen = resolveScreenArg(screen)

      try {
        const renderOptions = buildRenderOptions(options)

        if (!process.stdout.isTTY) {
          console.warn(
            chalk.yellow(
              'stdout is not a TTY; run `mytokens export` to save the SVG file instead.'
            )
          )
          return
        }

        await showReportImage(parsedScreen, renderOptions, {
          width: process.stdout.columns ?? 120,
        })
      } catch (err) {
        console.error(
          chalk.red(err instanceof Error ? err.message : String(err))
        )
        process.exit(1)
      }
    })
}

function resolveScreenArg(screen: string | undefined): AppScreenType | null {
  if (!screen) {
    return null
  }

  const parsed = parseScreenArg(screen)
  if (!parsed) {
    console.error(chalk.red(`Invalid screen argument: ${chalk.bold(screen)}`))
    console.log(
      'Run without a screen to export all screens, or use any screen keyword listed in `mytokens export --help`.'
    )
    process.exit(1)
  }

  return parsed
}

function buildRenderOptions(options: CommonOptions): RenderScreenOptions {
  const range = resolveDateRange({
    from: options.from,
    to: options.to,
    today: options.today,
    yesterday: options.yesterday,
    lastWeek: options.lastWeek,
    lastMonth: options.lastMonth,
    lastYear: options.lastYear,
    thisWeek: options.thisWeek,
    thisMonth: options.thisMonth,
    thisYear: options.thisYear,
    last: options.last,
  })

  const showBy = resolveBy({
    by: options.by,
    day: options.day,
    week: options.week,
    month: options.month,
    year: options.year,
  })

  return {
    showBy: showBy as RenderValueShowBy,
    screenWidth: 80,
    screenPadding: 1,
    dateStart: range.dateStart,
    dateEnd: range.dateEnd,
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
  }
}
