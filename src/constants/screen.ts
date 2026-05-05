import { RenderScreen } from '../render/render-screen.js'
import { RenderAppsByCostsScreen } from '../screens/apps-by-costs.js'
import { RenderAppsByTokensScreen } from '../screens/apps-by-tokens.js'
import { RenderCostsScreen } from '../screens/costs.js'
import { RenderModelsByCostsScreen } from '../screens/models-by-costs.js'
import { RenderModelsByTokensScreen } from '../screens/models-by-tokens.js'
import { RenderModesByCostsScreen } from '../screens/modes-by-costs.js'
import { RenderModesByTokensScreen } from '../screens/modes-by-tokens.js'
import { RenderProjectsByCostsScreen } from '../screens/projects-by-costs.js'
import { RenderProjectsByTokensScreen } from '../screens/projects-by-tokens.js'
import { RenderProvidersByCostsScreen } from '../screens/providers-by-costs.js'
import { RenderProvidersByTokensScreen } from '../screens/providers-by-tokens.js'
import { RenderTokensScreen } from '../screens/tokens.js'

export type AppScreenType =
  | 'costs'
  | 'tokens'
  | `${'apps' | 'modes' | 'models' | 'projects' | 'providers'}-by-${'costs' | 'tokens'}`

export const APP_SCREENS_MAP: Record<AppScreenType, typeof RenderScreen> = {
  costs: RenderCostsScreen,
  tokens: RenderTokensScreen,
  'apps-by-costs': RenderAppsByCostsScreen,
  'apps-by-tokens': RenderAppsByTokensScreen,
  'modes-by-costs': RenderModesByCostsScreen,
  'modes-by-tokens': RenderModesByTokensScreen,
  'models-by-costs': RenderModelsByCostsScreen,
  'models-by-tokens': RenderModelsByTokensScreen,
  'projects-by-costs': RenderProjectsByCostsScreen,
  'projects-by-tokens': RenderProjectsByTokensScreen,
  'providers-by-costs': RenderProvidersByCostsScreen,
  'providers-by-tokens': RenderProvidersByTokensScreen,
}
