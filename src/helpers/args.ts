import { APP_SCREENS_MAP, AppScreenType } from '@/constants/screen.js'
import chalk from 'chalk'
import Fuse from 'fuse.js'

const ScreenKeywordMap: Record<string, AppScreenType> = {
  usage: 'models-by-tokens',
  usages: 'models-by-tokens',

  cost: 'models-by-costs',
  costs: 'models-by-costs',
  price: 'models-by-costs',
  prices: 'models-by-costs',

  source: 'sources-by-tokens',
  sources: 'sources-by-tokens',
  'source/token': 'sources-by-tokens',
  'source/tokens': 'sources-by-tokens',
  'sources/token': 'sources-by-tokens',
  'sources/tokens': 'sources-by-tokens',
  'source/usage': 'sources-by-tokens',
  'sources/usage': 'sources-by-tokens',
  'source/usages': 'sources-by-tokens',
  'sources/usages': 'sources-by-tokens',

  'source.': 'sources-by-costs',
  'sources.': 'sources-by-costs',
  'source/cost': 'sources-by-costs',
  'sources/cost': 'sources-by-costs',
  'source/costs': 'sources-by-costs',
  'sources/costs': 'sources-by-costs',
  'source/price': 'sources-by-costs',
  'sources/price': 'sources-by-costs',
  'source/prices': 'sources-by-costs',
  'sources/prices': 'sources-by-costs',

  mode: 'modes-by-tokens',
  modes: 'modes-by-tokens',
  'mode/token': 'modes-by-tokens',
  'mode/tokens': 'modes-by-tokens',
  'modes/token': 'modes-by-tokens',
  'modes/tokens': 'modes-by-tokens',
  'mode/usage': 'modes-by-tokens',
  'modes/usage': 'modes-by-tokens',
  'mode/usages': 'modes-by-tokens',
  'modes/usages': 'modes-by-tokens',

  'mode.': 'modes-by-costs',
  'modes.': 'modes-by-costs',
  'mode/cost': 'modes-by-costs',
  'mode/costs': 'modes-by-costs',
  'mode/price': 'modes-by-costs',
  'mode/prices': 'modes-by-costs',
  'modes/cost': 'modes-by-costs',
  'modes/costs': 'modes-by-costs',
  'modes/price': 'modes-by-costs',
  'modes/prices': 'modes-by-costs',

  model: 'models-by-tokens',
  models: 'models-by-tokens',
  'model/token': 'models-by-tokens',
  'model/tokens': 'models-by-tokens',
  'models/token': 'models-by-tokens',
  'models/tokens': 'models-by-tokens',
  'model/usage': 'models-by-tokens',
  'models/usage': 'models-by-tokens',
  'model/usages': 'models-by-tokens',
  'models/usages': 'models-by-tokens',

  'model.': 'models-by-costs',
  'models.': 'models-by-costs',
  'model/cost': 'models-by-costs',
  'model/costs': 'models-by-costs',
  'model/price': 'models-by-costs',
  'model/prices': 'models-by-costs',
  'models/cost': 'models-by-costs',
  'models/costs': 'models-by-costs',
  'models/price': 'models-by-costs',
  'models/prices': 'models-by-costs',

  project: 'projects-by-tokens',
  projects: 'projects-by-tokens',
  'project/token': 'projects-by-tokens',
  'project/tokens': 'projects-by-tokens',
  'projects/token': 'projects-by-tokens',
  'projects/tokens': 'projects-by-tokens',
  'project/usage': 'projects-by-tokens',
  'projects/usage': 'projects-by-tokens',
  'project/usages': 'projects-by-tokens',
  'projects/usages': 'projects-by-tokens',

  'project.': 'projects-by-costs',
  'projects.': 'projects-by-costs',
  'project/cost': 'projects-by-costs',
  'project/costs': 'projects-by-costs',
  'project/price': 'projects-by-costs',
  'project/prices': 'projects-by-costs',
  'projects/cost': 'projects-by-costs',
  'projects/costs': 'projects-by-costs',
  'projects/price': 'projects-by-costs',
  'projects/prices': 'projects-by-costs',

  provider: 'providers-by-tokens',
  providers: 'providers-by-tokens',
  'provider/token': 'providers-by-tokens',
  'provider/tokens': 'providers-by-tokens',
  'providers/token': 'providers-by-tokens',
  'providers/tokens': 'providers-by-tokens',
  'provider/usage': 'providers-by-tokens',
  'providers/usage': 'providers-by-tokens',
  'provider/usages': 'providers-by-tokens',
  'providers/usages': 'providers-by-tokens',

  'provider.': 'providers-by-costs',
  'providers.': 'providers-by-costs',
  'provider/cost': 'providers-by-costs',
  'provider/costs': 'providers-by-costs',
  'provider/price': 'providers-by-costs',
  'provider/prices': 'providers-by-costs',
  'providers/cost': 'providers-by-costs',
  'providers/costs': 'providers-by-costs',
  'providers/price': 'providers-by-costs',
  'providers/prices': 'providers-by-costs',

  type: 'type-by-tokens',
  types: 'type-by-tokens',
  'type/token': 'type-by-tokens',
  'type/tokens': 'type-by-tokens',
  'types/token': 'type-by-tokens',
  'types/tokens': 'type-by-tokens',
  'type/usage': 'type-by-tokens',
  'types/usage': 'type-by-tokens',
  'type/usages': 'type-by-tokens',
  'types/usages': 'type-by-tokens',

  'type.': 'type-by-costs',
  'types.': 'type-by-costs',
  'type/cost': 'type-by-costs',
  'type/costs': 'type-by-costs',
  'types/cost': 'type-by-costs',
  'types/costs': 'type-by-costs',
  'type/price': 'type-by-costs',
  'types/price': 'type-by-costs',
  'type/prices': 'type-by-costs',
  'types/prices': 'type-by-costs',

  ...Object.fromEntries<AppScreenType>(
    Object.keys(APP_SCREENS_MAP).map((k) => [k, k as AppScreenType])
  ),
}

const fuse = new Fuse(Object.keys(ScreenKeywordMap))

export function parseScreenArg(input: string): AppScreenType | null {
  if (ScreenKeywordMap[input]) {
    return ScreenKeywordMap[input]
  }

  const result = fuse.search(input)
  if (result.length > 0) {
    const screen = ScreenKeywordMap[result[0].item]

    console.warn(
      chalk.yellow(
        `🤖 Unrecognized screen ${chalk.red(input)}; rendering ${chalk.green(screen)} screen.`
      )
    )

    return screen
  }

  return null
}

export function resolveBy(options: {
  by?: string
  day?: boolean
  week?: boolean
  month?: boolean
  year?: boolean
}): string {
  const shorthandOptions = [
    options.day ? '--day' : null,
    options.week ? '--week' : null,
    options.month ? '--month' : null,
    options.year ? '--year' : null,
  ].filter(Boolean) as string[]

  if (shorthandOptions.length > 1) {
    throw new Error(
      `Cannot use multiple shorthand options at once: ${shorthandOptions.join(', ')}`
    )
  }

  if (options.by && shorthandOptions.length > 0) {
    throw new Error(`Cannot use --by with ${shorthandOptions[0]}`)
  }

  if (options.day) return 'day'
  if (options.week) return 'week'
  if (options.month) return 'month'
  if (options.year) return 'year'

  return options.by ?? 'day'
}

export function resolveDateRange(options: {
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
}): { dateStart: Date | null; dateEnd: Date | null } {
  const shorthandOptions = [
    options.today ? '--today' : null,
    options.yesterday ? '--yesterday' : null,
    options.lastWeek ? '--last-week' : null,
    options.lastMonth ? '--last-month' : null,
    options.lastYear ? '--last-year' : null,
    options.thisWeek ? '--this-week' : null,
    options.thisMonth ? '--this-month' : null,
    options.thisYear ? '--this-year' : null,
    options.last !== undefined ? '--last' : null,
  ].filter(Boolean) as string[]

  if (shorthandOptions.length > 1) {
    throw new Error(
      `Cannot use multiple shorthand options at once: ${shorthandOptions.join(', ')}`
    )
  }

  if (options.from && shorthandOptions.length > 0) {
    throw new Error(`Cannot use --from with ${shorthandOptions[0]}`)
  }

  const now = new Date()

  if (options.today) {
    return {
      dateStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      dateEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    }
  }

  if (options.yesterday) {
    return {
      dateStart: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      dateEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    }
  }

  if (options.lastWeek) {
    return {
      dateStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      dateEnd: now,
    }
  }

  if (options.lastMonth) {
    return {
      dateStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      dateEnd: now,
    }
  }

  if (options.lastYear) {
    return {
      dateStart: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      dateEnd: now,
    }
  }

  if (options.thisWeek) {
    return {
      dateStart: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay()
      ),
      dateEnd: now,
    }
  }

  if (options.thisMonth) {
    return {
      dateStart: new Date(now.getFullYear(), now.getMonth(), 1),
      dateEnd: now,
    }
  }

  if (options.thisYear) {
    return {
      dateStart: new Date(now.getFullYear(), 0, 1),
      dateEnd: now,
    }
  }

  if (options.last !== undefined) {
    const daysBack = Math.max(options.last - 1, 0)
    return {
      dateStart: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysBack
      ),
      dateEnd: now,
    }
  }

  return {
    dateStart: options.from ? new Date(options.from) : null,
    dateEnd: options.to ? new Date(options.to) : null,
  }
}
