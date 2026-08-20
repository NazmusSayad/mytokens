import { RenderScreen } from '../render/render-screen.js'
import { RenderAgentsByCostsScreen } from '../screens/agents-by-costs.js'
import { RenderAgentsByTokensScreen } from '../screens/agents-by-tokens.js'
import { RenderCostsScreen } from '../screens/costs.js'
import { RenderModelsByCostsScreen } from '../screens/models-by-costs.js'
import { RenderModelsByTokensScreen } from '../screens/models-by-tokens.js'
import { RenderProjectsByCostsScreen } from '../screens/projects-by-costs.js'
import { RenderProjectsByTokensScreen } from '../screens/projects-by-tokens.js'
import { RenderProvidersByCostsScreen } from '../screens/providers-by-costs.js'
import { RenderProvidersByTokensScreen } from '../screens/providers-by-tokens.js'
import { RenderSourcesByCostsScreen } from '../screens/sources-by-costs.js'
import { RenderSourcesByTokensScreen } from '../screens/sources-by-tokens.js'
import { RenderTokensScreen } from '../screens/tokens.js'

export type AppScreenType =
  `${'type' | 'sources' | 'agents' | 'models' | 'projects' | 'providers'}-by-${'costs' | 'tokens'}`

export type AppScreenInfo = {
  type: AppScreenType
  title: string
  description: string
}

export const APP_SCREENS_MAP: Record<AppScreenType, typeof RenderScreen> = {
  'models-by-costs': RenderModelsByCostsScreen,
  'models-by-tokens': RenderModelsByTokensScreen,
  'sources-by-costs': RenderSourcesByCostsScreen,
  'sources-by-tokens': RenderSourcesByTokensScreen,
  'projects-by-costs': RenderProjectsByCostsScreen,
  'projects-by-tokens': RenderProjectsByTokensScreen,
  'providers-by-costs': RenderProvidersByCostsScreen,
  'providers-by-tokens': RenderProvidersByTokensScreen,
  'agents-by-costs': RenderAgentsByCostsScreen,
  'agents-by-tokens': RenderAgentsByTokensScreen,
  'type-by-costs': RenderCostsScreen,
  'type-by-tokens': RenderTokensScreen,
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
    type: 'sources-by-tokens',
    title: 'Sources by Tokens',
    description:
      'Token usage grouped by the coding CLI source that produced it (e.g. opencode, codex, claude).',
  },
  {
    type: 'sources-by-costs',
    title: 'Sources by Costs',
    description:
      'Estimated cost grouped by the coding CLI source that produced it (e.g. opencode, codex, claude).',
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
    type: 'agents-by-tokens',
    title: 'Agents by Tokens',
    description:
      'Token usage grouped by the agent that produced it such as chat, build, agent or plan.',
  },
  {
    type: 'agents-by-costs',
    title: 'Agents by Costs',
    description:
      'Estimated cost grouped by the agent that produced it such as chat, build, agent or plan.',
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
