import { AppScreenType } from '@/constants/screen.js'
import chalk from 'chalk'
import Fuse from 'fuse.js'

const ScreenMap: Record<AppScreenType, string[]> = {
  'models-by-tokens': [
    'usage',
    'usages',
    'model',
    'models',
    'model/token',
    'model/tokens',
    'models/token',
    'models/tokens',
    'model/usage',
    'models/usage',
    'model/usages',
    'models/usages',
  ],
  'models-by-costs': [
    'model.',
    'models.',
    'model/cost',
    'model/costs',
    'model/price',
    'model/prices',
    'models/cost',
    'models/costs',
    'models/price',
    'models/prices',
  ],
  'sources-by-tokens': [
    'source',
    'sources',
    'source/token',
    'sources/token',
    'source/tokens',
    'sources/tokens',
    'source/usage',
    'sources/usage',
    'source/usages',
    'sources/usages',
    'app',
    'apps',
    'app/token',
    'apps/token',
    'app/tokens',
    'apps/tokens',
    'app/usage',
    'apps/usage',
    'app/usages',
    'apps/usages',
  ],
  'sources-by-costs': [
    'source.',
    'sources.',
    'source/cost',
    'sources/cost',
    'source/costs',
    'sources/costs',
    'source/price',
    'sources/price',
    'source/prices',
    'sources/prices',
    'app.',
    'apps.',
    'app/cost',
    'apps/cost',
    'app/costs',
    'apps/costs',
    'app/price',
    'apps/price',
    'app/prices',
    'apps/prices',
  ],
  'modes-by-tokens': [
    'mode',
    'modes',
    'mode/token',
    'mode/tokens',
    'modes/token',
    'modes/tokens',
    'mode/usage',
    'modes/usage',
    'mode/usages',
    'modes/usages',
  ],
  'modes-by-costs': [
    'mode.',
    'modes.',
    'mode/cost',
    'mode/costs',
    'mode/price',
    'mode/prices',
    'modes/cost',
    'modes/costs',
    'modes/price',
    'modes/prices',
  ],
  'projects-by-tokens': [
    'project',
    'projects',
    'project/token',
    'project/tokens',
    'projects/token',
    'projects/tokens',
    'project/usage',
    'projects/usage',
    'project/usages',
    'projects/usages',
  ],
  'projects-by-costs': [
    'project.',
    'projects.',
    'project/cost',
    'project/costs',
    'project/price',
    'project/prices',
    'projects/cost',
    'projects/costs',
    'projects/price',
    'projects/prices',
  ],
  'providers-by-tokens': [
    'provider',
    'providers',
    'provider/token',
    'provider/tokens',
    'providers/token',
    'providers/tokens',
    'provider/usage',
    'providers/usage',
    'provider/usages',
    'providers/usages',
  ],
  'providers-by-costs': [
    'provider.',
    'providers.',
    'provider/cost',
    'provider/costs',
    'provider/price',
    'provider/prices',
    'providers/cost',
    'providers/costs',
    'providers/price',
    'providers/prices',
  ],
  'type-by-tokens': [
    'type',
    'types',
    'type/token',
    'type/tokens',
    'types/token',
    'types/tokens',
    'type/usage',
    'types/usage',
    'type/usages',
    'types/usages',
  ],
  'type-by-costs': [
    'type.',
    'types.',
    'type/cost',
    'type/costs',
    'types/cost',
    'types/costs',
    'type/price',
    'types/price',
    'type/prices',
    'types/prices',
  ],
}

const keywordToScreen: Record<string, AppScreenType> = {}
for (const [screen, keywords] of Object.entries(ScreenMap)) {
  keywordToScreen[screen] = screen as AppScreenType
  for (const keyword of keywords) {
    keywordToScreen[keyword] = screen as AppScreenType
  }
}

const expectedCount =
  Object.values(ScreenMap).reduce((sum, keywords) => sum + keywords.length, 0) +
  Object.keys(ScreenMap).length

if (Object.keys(keywordToScreen).length !== expectedCount) {
  throw new Error('Duplicate keyword found in ScreenMap')
}

const fuse = new Fuse(Object.keys(keywordToScreen))

export function parseScreenArg(input: string): AppScreenType | null {
  if (keywordToScreen[input]) {
    return keywordToScreen[input]
  }

  const result = fuse.search(input)
  if (result.length > 0) {
    const screen = keywordToScreen[result[0].item]

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
