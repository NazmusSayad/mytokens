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
  `${'type' | 'apps' | 'modes' | 'models' | 'projects' | 'providers'}-by-${'costs' | 'tokens'}`

export type AppScreenInfo = {
  type: AppScreenType
  title: string
  description: string
}

export const APP_SCREENS_MAP: Record<AppScreenType, typeof RenderScreen> = {
  'type-by-costs': RenderCostsScreen,
  'type-by-tokens': RenderTokensScreen,
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

export const APP_SCREENS_INFO: AppScreenInfo[] = [
  {
    type: 'models-by-tokens',
    title: 'Models by Tokens',
    description:
      'Token usage grouped by the underlying AI model (e.g. gpt-5, claude-sonnet-4).',
  },
  {
    type: 'models-by-costs',
    title: 'Models by Costs',
    description:
      'Estimated cost grouped by the underlying AI model (e.g. gpt-5, claude-sonnet-4).',
  },
  {
    type: 'apps-by-tokens',
    title: 'Apps by Tokens',
    description:
      'Token usage grouped by the coding CLI app that produced it (e.g. opencode, codex, claude).',
  },
  {
    type: 'apps-by-costs',
    title: 'Apps by Costs',
    description:
      'Estimated cost grouped by the coding CLI app that produced it (e.g. opencode, codex, claude).',
  },
  {
    type: 'modes-by-tokens',
    title: 'Modes by Tokens',
    description:
      'Token usage grouped by usage mode such as chat, build, agent or plan.',
  },
  {
    type: 'modes-by-costs',
    title: 'Modes by Costs',
    description:
      'Estimated cost grouped by usage mode such as chat, build, agent or plan.',
  },
  {
    type: 'projects-by-tokens',
    title: 'Projects by Tokens',
    description:
      'Token usage grouped by the project or working directory where usage was recorded.',
  },
  {
    type: 'projects-by-costs',
    title: 'Projects by Costs',
    description:
      'Estimated cost grouped by the project or working directory where usage was recorded.',
  },
  {
    type: 'providers-by-tokens',
    title: 'Providers by Tokens',
    description:
      'Token usage grouped by the provider that served the model (e.g. openai, anthropic).',
  },
  {
    type: 'providers-by-costs',
    title: 'Providers by Costs',
    description:
      'Estimated cost grouped by the provider that served the model (e.g. openai, anthropic).',
  },
  {
    type: 'type-by-tokens',
    title: 'Types by Tokens',
    description:
      'Total token usage broken down by input, output, cache and reasoning tokens over time.',
  },
  {
    type: 'type-by-costs',
    title: 'Types by Costs',
    description:
      'Estimated dollar cost of token usage broken down by input, output, cache and reasoning tokens over time.',
  },
]
