import { RenderScreen } from '../render/render-screen.js'
import { RenderAgentsByCostsScreen } from '../screens/agents-by-costs.js'
import { RenderAgentsByRequestsScreen } from '../screens/agents-by-requests.js'
import { RenderAgentsByTokensScreen } from '../screens/agents-by-tokens.js'
import { RenderCostsScreen } from '../screens/costs.js'
import { RenderModelsByCostsScreen } from '../screens/models-by-costs.js'
import { RenderModelsByRequestsScreen } from '../screens/models-by-requests.js'
import { RenderModelsByTokensScreen } from '../screens/models-by-tokens.js'
import { RenderProjectsByCostsScreen } from '../screens/projects-by-costs.js'
import { RenderProjectsByRequestsScreen } from '../screens/projects-by-requests.js'
import { RenderProjectsByTokensScreen } from '../screens/projects-by-tokens.js'
import { RenderProvidersByCostsScreen } from '../screens/providers-by-costs.js'
import { RenderProvidersByRequestsScreen } from '../screens/providers-by-requests.js'
import { RenderProvidersByTokensScreen } from '../screens/providers-by-tokens.js'
import { RenderRequestsScreen } from '../screens/requests.js'
import { RenderSourcesByCostsScreen } from '../screens/sources-by-costs.js'
import { RenderSourcesByRequestsScreen } from '../screens/sources-by-requests.js'
import { RenderSourcesByTokensScreen } from '../screens/sources-by-tokens.js'
import { RenderTokensScreen } from '../screens/tokens.js'

export type AppScreenType =
  `${'type' | 'sources' | 'agents' | 'models' | 'projects' | 'providers'}-by-${'costs' | 'tokens' | 'requests'}`

export type AppScreenInfo = {
  type: AppScreenType
  title: string
  description: string
}

export const APP_SCREENS_MAP: Record<AppScreenType, typeof RenderScreen> = {
  'models-by-costs': RenderModelsByCostsScreen,
  'models-by-tokens': RenderModelsByTokensScreen,
  'models-by-requests': RenderModelsByRequestsScreen,
  'sources-by-costs': RenderSourcesByCostsScreen,
  'sources-by-tokens': RenderSourcesByTokensScreen,
  'sources-by-requests': RenderSourcesByRequestsScreen,
  'projects-by-costs': RenderProjectsByCostsScreen,
  'projects-by-tokens': RenderProjectsByTokensScreen,
  'projects-by-requests': RenderProjectsByRequestsScreen,
  'providers-by-costs': RenderProvidersByCostsScreen,
  'providers-by-tokens': RenderProvidersByTokensScreen,
  'providers-by-requests': RenderProvidersByRequestsScreen,
  'agents-by-costs': RenderAgentsByCostsScreen,
  'agents-by-tokens': RenderAgentsByTokensScreen,
  'agents-by-requests': RenderAgentsByRequestsScreen,
  'type-by-costs': RenderCostsScreen,
  'type-by-tokens': RenderTokensScreen,
  'type-by-requests': RenderRequestsScreen,
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
      'Token usage grouped by the agent that produced it such as default, build, agent or plan.',
  },
  {
    type: 'agents-by-costs',
    title: 'Agents by Costs',
    description:
      'Estimated cost grouped by the agent that produced it such as default, build, agent or plan.',
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
  {
    type: 'models-by-requests',
    title: 'Models by Requests',
    description:
      'Request count grouped by the underlying AI model (e.g. gpt-5, claude-sonnet-4).',
  },
  {
    type: 'sources-by-requests',
    title: 'Sources by Requests',
    description:
      'Request count grouped by the coding CLI source that produced it (e.g. opencode, codex, claude).',
  },
  {
    type: 'projects-by-requests',
    title: 'Projects by Requests',
    description:
      'Request count grouped by the project or working directory where usage was recorded.',
  },
  {
    type: 'providers-by-requests',
    title: 'Providers by Requests',
    description:
      'Request count grouped by the provider that served the model (e.g. openai, anthropic).',
  },
  {
    type: 'agents-by-requests',
    title: 'Agents by Requests',
    description:
      'Request count grouped by the agent that produced it such as default, build, agent or plan.',
  },
  {
    type: 'type-by-requests',
    title: 'Requests',
    description: 'Total request count over time.',
  },
]
