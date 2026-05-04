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
