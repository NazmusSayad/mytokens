import { AppScreenType } from '@/app.js'

export const ScreenChoices: Record<AppScreenType, string[]> = {
  costs: ['cost', 'costs'],
  tokens: ['usage', 'usages', 'token', 'tokens'],

  'apps-by-costs': [
    'app/',
    'apps/',
    'app/cost',
    'apps/cost',
    'app/costs',
    'apps/costs',
  ],
  'apps-by-tokens': [
    'app',
    'apps',
    'app/usage',
    'apps/usage',
    'app/usages',
    'apps/usages',
    'app/token',
    'app/tokens',
    'apps/token',
    'apps/tokens',
  ],

  'modes-by-costs': [
    'mode/',
    'modes/',
    'mode/cost',
    'modes/cost',
    'mode/costs',
    'modes/costs',
  ],
  'modes-by-tokens': [
    'mode',
    'modes',
    'mode/usage',
    'modes/usage',
    'mode/usages',
    'modes/usages',
    'mode/token',
    'mode/tokens',
    'modes/token',
    'modes/tokens',
  ],

  'models-by-costs': [
    'model/',
    'models/',
    'model/cost',
    'models/cost',
    'model/costs',
    'models/costs',
  ],
  'models-by-tokens': [
    'model',
    'models',
    'model/usage',
    'models/usage',
    'model/usages',
    'models/usages',
    'model/token',
    'model/tokens',
    'models/token',
    'models/tokens',
  ],

  'projects-by-costs': [
    'project/',
    'projects/',
    'project/cost',
    'projects/cost',
    'project/costs',
    'projects/costs',
  ],
  'projects-by-tokens': [
    'project',
    'projects',
    'project/usage',
    'projects/usage',
    'project/usages',
    'projects/usages',
    'project/token',
    'project/tokens',
    'projects/token',
    'projects/tokens',
  ],

  'providers-by-costs': [
    'provider/',
    'providers/',
    'provider/cost',
    'providers/cost',
    'provider/costs',
    'providers/costs',
  ],
  'providers-by-tokens': [
    'provider',
    'providers',
    'provider/usage',
    'providers/usage',
    'provider/usages',
    'providers/usages',
    'provider/token',
    'provider/tokens',
    'providers/token',
    'providers/tokens',
  ],
}

export function parseScreenArg(input: string): AppScreenType | null {
  for (const item in ScreenChoices) {
    const screenType = item as AppScreenType
    if (input === screenType) {
      return screenType
    }

    const choices = ScreenChoices[screenType]
    if (choices.includes(input)) {
      return screenType
    }
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
  lastWeek?: boolean
  lastMonth?: boolean
  last?: number
}): { dateStart: Date | null; dateEnd: Date | null } {
  const shorthandOptions = [
    options.today ? '--today' : null,
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
