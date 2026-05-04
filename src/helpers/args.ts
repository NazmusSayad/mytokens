import { AppScreenType } from '@/app.js'

export function parseScreenArg(input: string): AppScreenType | null {
  switch (input) {
    case 'costs':
    case 'tokens':

    case 'apps-by-costs':
    case 'apps-by-tokens':

    case 'modes-by-costs':
    case 'modes-by-tokens':

    case 'models-by-costs':
    case 'models-by-tokens':

    case 'projects-by-costs':
    case 'projects-by-tokens':

    case 'providers-by-costs':
    case 'providers-by-tokens':
      return input

    case 'app/':
    case 'apps/':
      return 'apps-by-costs'

    case 'mode/':
    case 'modes/':
      return 'modes-by-costs'

    case 'model/':
    case 'models/':
      return 'models-by-costs'

    case 'project/':
    case 'projects/':
      return 'projects-by-costs'

    case 'provider/':
    case 'providers/':
      return 'providers-by-costs'

    default:
      return null
  }
}
