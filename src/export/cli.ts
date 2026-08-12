import { resolveDateRange } from '@/helpers/args.js'
import { RenderScreenOptions } from '@/render/types.js'
import { Command, OptionValues } from '@commander-js/extra-typings'
import chalk from 'chalk'
import { exportReportToSvg, showReportImage } from './index.js'

type DateRangeOptions = {
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
}

export function attachExportCommands<
  Args extends unknown[],
  Opts extends OptionValues,
  GlobalOpts extends OptionValues,
>(program: Command<Args, Opts, GlobalOpts>) {
  program
    .command('export')
    .description(
      'Export the aggregated usage overview (all apps, models and providers) as a single SVG image.'
    )
    .option('--output <path>', 'Output SVG file path', 'mytokens.svg')
    .on('--help', () => {
      console.log('\nExamples:')
      console.log('  $ mytokens export')
      console.log('  $ mytokens export --last 30 --output overview.svg')
      console.log('  $ mytokens export --from 2026-01-01 --to 2026-03-01')
    })
    .action(async (options) => {
      try {
        const renderOptions = buildRenderOptions(program.opts())
        const outputPath = await exportReportToSvg(
          options.output,
          renderOptions
        )
        console.log(
          chalk.green(`Saved usage overview to ${chalk.bold(outputPath)}`)
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
      'Render the aggregated usage overview (all apps, models and providers) as an image in the terminal.'
    )
    .on('--help', () => {
      console.log('\nExamples:')
      console.log('  $ mytokens image')
      console.log('  $ mytokens image --this-month')
      console.log('  $ mytokens image --last 5')
    })
    .action(async (options) => {
      try {
        if (!process.stdout.isTTY) {
          console.warn(
            chalk.yellow(
              'stdout is not a TTY; run `mytokens export` to save the SVG file instead.'
            )
          )
          return
        }

        const renderOptions = buildRenderOptions(program.opts())
        await showReportImage(renderOptions, {
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

function buildRenderOptions(options: DateRangeOptions): RenderScreenOptions {
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

  return {
    showBy: 'day',
    screenWidth: 80,
    screenPadding: 1,
    dateStart: range.dateStart,
    dateEnd: range.dateEnd,
    enabledApps: null,
    disabledApps: null,
    enabledModes: null,
    disabledModes: null,
    enabledModels: null,
    disabledModels: null,
    enabledProjects: null,
    disabledProjects: null,
    enabledProviders: null,
    disabledProviders: null,
  }
}
