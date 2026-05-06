import { APP_SCREENS_MAP, AppScreenType } from '@/constants/screen.js'
import chalk from 'chalk'
import Fuse from 'fuse.js'

const ScreenKeywordMap: Record<string, AppScreenType> = {
  token: 'tokens',
  usage: 'tokens',
  usages: 'tokens',

  '.': 'costs',
  cost: 'costs',
  price: 'costs',
  prices: 'costs',

  app: 'apps-by-tokens',
  apps: 'apps-by-tokens',
  'app/token': 'apps-by-tokens',
  'app/tokens': 'apps-by-tokens',
  'apps/token': 'apps-by-tokens',
  'apps/tokens': 'apps-by-tokens',
  'app/usage': 'apps-by-tokens',
  'apps/usage': 'apps-by-tokens',
  'app/usages': 'apps-by-tokens',
  'apps/usages': 'apps-by-tokens',

  'app.': 'apps-by-costs',
  'apps.': 'apps-by-costs',
  'app/cost': 'apps-by-costs',
  'apps/cost': 'apps-by-costs',
  'app/costs': 'apps-by-costs',
  'apps/costs': 'apps-by-costs',
  'app/price': 'apps-by-costs',
  'apps/price': 'apps-by-costs',
  'app/prices': 'apps-by-costs',
  'apps/prices': 'apps-by-costs',

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
  last?: number
}): { dateStart: Date | null; dateEnd: Date | null } {
  const shorthandOptions = [
    options.today ? '--today' : null,
    options.yesterday ? '--yesterday' : null,
    options.lastWeek ? '--last-week' : null,
    options.lastMonth ? '--last-month' : null,
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

  if (options.last !== undefined) {
    return {
      dateStart: new Date(now.getTime() - options.last * 24 * 60 * 60 * 1000),
      dateEnd: now,
    }
  }

  return {
    dateStart: options.from ? new Date(options.from) : null,
    dateEnd: options.to ? new Date(options.to) : null,
  }
}
