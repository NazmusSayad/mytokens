import { ExportFilterOptions } from '@/export/types.js'
import { RenderValueShowBy } from '@/render/types.js'
import {
  Command,
  InvalidArgumentError,
  OptionValues,
} from '@commander-js/extra-typings'
import { resolveDateRange } from './args.js'

export type UsageFilterOptionValues = {
  usageBy?: RenderValueShowBy
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

export function addUsageFilterOptions<
  Args extends unknown[],
  Opts extends OptionValues,
  GlobalOpts extends OptionValues,
>(command: Command<Args, Opts, GlobalOpts>) {
  command.option(
    '--from <from>',
    'Start date for the period. example: 2024-01-01'
  )
  command.option('--to <to>', 'End date for the period. example: 2024-12-31')
  command.option('--today', 'Show data for today only.')
  command.option('--yesterday', 'Show data for yesterday only.')
  command.option('--last-week', 'Show data for the last 7 days.')
  command.option('--last-month', 'Show data for the last 30 days.')
  command.option('--last-year', 'Show data for the last 365 days.')
  command.option('--this-week', 'Show data for the current week (from Sunday).')
  command.option('--this-month', 'Show data for the current month.')
  command.option('--this-year', 'Show data for the current year.')
  command.option('--last <days>', 'Show data for the last n days.', (val) => {
    const days = Number.parseInt(val, 10)
    if (Number.isNaN(days) || days <= 0) {
      throw new InvalidArgumentError('Must be a positive number.')
    }
    return days
  })
  command.option(
    '--apps <apps>',
    'Apps to include. example: opencode,codex',
    (val) => val.split(',')
  )
  command.option(
    '--skip-apps <apps>',
    'Apps to exclude. example: claude',
    (val) => val.split(',')
  )
  command.option(
    '--modes <modes>',
    'Modes to include. example: agent,chat',
    (val) => val.split(',')
  )
  command.option(
    '--skip-modes <modes>',
    'Modes to exclude. example: edit',
    (val) => val.split(',')
  )
  command.option(
    '--models <models>',
    'Models to include. example: gpt-4o,claude-3-5-sonnet',
    (val) => val.split(',')
  )
  command.option(
    '--skip-models <models>',
    'Models to exclude. example: gpt-3.5-turbo',
    (val) => val.split(',')
  )
  command.option(
    '--projects <projects>',
    'Projects to include. example: my-api,frontend',
    (val) => val.split(',')
  )
  command.option(
    '--skip-projects <projects>',
    'Projects to exclude. example: legacy-app',
    (val) => val.split(',')
  )
  command.option(
    '--providers <providers>',
    'Providers to include. example: openai,anthropic',
    (val) => val.split(',')
  )
  command.option(
    '--skip-providers <providers>',
    'Providers to exclude. example: groq',
    (val) => val.split(',')
  )
}

export function addUsageByOption<
  Args extends unknown[],
  Opts extends OptionValues,
  GlobalOpts extends OptionValues,
>(command: Command<Args, Opts, GlobalOpts>) {
  command.option(
    '--usage-by <period>',
    'Aggregate overview usage by: day, week, month, year. Default: day.',
    (value) => {
      if (
        value !== 'day' &&
        value !== 'week' &&
        value !== 'month' &&
        value !== 'year'
      ) {
        throw new InvalidArgumentError(
          'Supported usage periods: day, week, month, year.'
        )
      }
      return value
    }
  )
}

export function buildUsageFilterOptions(
  options: UsageFilterOptionValues
): ExportFilterOptions {
  const range = resolveDateRange(options)

  return {
    usageBy: options.usageBy ?? 'day',
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
