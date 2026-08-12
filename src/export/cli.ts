import { resolveDateRange } from '@/helpers/args.js'
import { Command, OptionValues } from '@commander-js/extra-typings'
import chalk from 'chalk'
import path from 'path'
import { exportReportToSvg, showReportImage } from './index.js'
import { DEFAULT_EXPORT_THEME, EXPORT_THEMES } from './themes.js'
import { ExportFilterOptions, ExportFormat, ExportThemeId } from './types.js'

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

const FORMATS: ExportFormat[] = ['svg', 'png']

export function attachExportCommands<
  Args extends unknown[],
  Opts extends OptionValues,
  GlobalOpts extends OptionValues,
>(program: Command<Args, Opts, GlobalOpts>) {
  program
    .command('export')
    .description(
      'Export the aggregated usage overview (all apps, models and providers) as a single image.'
    )
    .option(
      '--output <path>',
      'Output file path. Defaults to mytokens.svg (or the chosen format).'
    )
    .option(
      '--format <format>',
      `Output format: ${FORMATS.join(', ')}. Inferred from --output extension when omitted.`,
      (val) => {
        const format = val.toLowerCase() as ExportFormat
        if (!FORMATS.includes(format)) {
          throw new Error(
            `Invalid --format value: ${val}. Supported formats: ${FORMATS.join(', ')}`
          )
        }
        return format
      }
    )
    .option(
      '--theme <theme>',
      `Color theme: ${Object.keys(EXPORT_THEMES).join(', ')}. Default: ${DEFAULT_EXPORT_THEME}.`,
      (val) => {
        const theme = val.toLowerCase() as ExportThemeId
        if (!EXPORT_THEMES[theme]) {
          throw new Error(
            `Invalid --theme value: ${val}. Supported themes: ${Object.keys(EXPORT_THEMES).join(', ')}`
          )
        }
        return theme
      }
    )
    .option(
      '--scale <scale>',
      'Output scale multiplier (PNG only). Default: 1.',
      (val) => {
        const scale = Number.parseFloat(val)
        if (Number.isNaN(scale) || scale <= 0) {
          throw new Error(
            `Invalid --scale value: ${val}. Must be a positive number.`
          )
        }
        return scale
      }
    )
    .on('--help', () => {
      console.log('\nExamples:')
      console.log('  $ mytokens export')
      console.log('  $ mytokens export --last 30 --output overview.svg')
      console.log('  $ mytokens export --from 2026-01-01 --to 2026-03-01')
      console.log('  $ mytokens export --format png')
      console.log('  $ mytokens export --format png --output overview.png')
      console.log('  $ mytokens export --theme dark --format png --scale 2')
    })
    .action(async (options) => {
      try {
        const renderOptions = buildRenderOptions(program.opts())
        const { outputPath, format } = resolveOutput(
          options.output,
          options.format
        )
        const savedPath = await exportReportToSvg(outputPath, renderOptions, {
          format,
          theme: options.theme ?? DEFAULT_EXPORT_THEME,
          scale: options.scale ?? 1,
        })
        console.log(
          chalk.green(`Saved usage overview to ${chalk.bold(savedPath)}`)
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
    .action(async () => {
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

  program
    .command('themes')
    .description('List all available export themes.')
    .action(() => {
      console.log(chalk.bold('Available export themes:'))
      console.log()

      const ids = Object.keys(EXPORT_THEMES) as ExportThemeId[]
      const nameWidth = Math.max(
        ...ids.map((id) => id.length),
        'github-dark'.length
      )
      for (const id of ids) {
        const theme = EXPORT_THEMES[id]
        const label = `${id}${DEFAULT_EXPORT_THEME === id ? ' (default)' : ''}`
        const swatches = [
          theme.background,
          theme.cardFill,
          theme.border,
          theme.ink,
          theme.muted,
          theme.faint,
          theme.accent,
          theme.accentAlt,
        ]
          .map((hex) => chalk.bgHex(hex)('  '))
          .join('')
        console.log(`  ${label.padEnd(nameWidth + 10)}${swatches}`)
      }
    })
}

function resolveOutput(
  outputPath: string | undefined,
  format?: ExportFormat
): { outputPath: string; format: ExportFormat } {
  const extension = outputPath ? path.extname(outputPath).toLowerCase() : ''

  if (outputPath) {
    if (extension && format && extension !== `.${format}`) {
      throw new Error(
        `--format ${format} does not match output extension "${extension}".`
      )
    }
    if (extension && !FORMATS.includes(extension.slice(1) as ExportFormat)) {
      throw new Error(
        `Unsupported output extension "${extension}". Supported formats: ${FORMATS.join(', ')}`
      )
    }
    return {
      outputPath,
      format: format ?? (extension.slice(1) as ExportFormat) ?? 'svg',
    }
  }

  if (format) {
    return { outputPath: `mytokens.${format}`, format }
  }

  return { outputPath: 'mytokens.svg', format: 'svg' }
}

function buildRenderOptions(options: DateRangeOptions): ExportFilterOptions {
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
