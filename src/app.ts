import { parseAmp } from './parsers/amp.js'
import { parseAntigravity } from './parsers/antigravity.js'
import { parseClaude } from './parsers/claude.js'
import { parseCodebuff } from './parsers/codebuff.js'
import { parseCodex } from './parsers/codex.js'
import { parseCopilot } from './parsers/copilot.js'
import { parseCrush } from './parsers/crush.js'
import { parseCursor } from './parsers/cursor.js'
import { parseDroid } from './parsers/droid.js'
import { parseGemini } from './parsers/gemini.js'
import { parseGoose } from './parsers/goose.js'
import { parseHermes } from './parsers/hermes.js'
import { parseKilo } from './parsers/kilo.js'
import { parseKimi } from './parsers/kimi.js'
import { parseMux } from './parsers/mux.js'
import { parseOpenClaw } from './parsers/openclaw.js'
import { parseOpenCode } from './parsers/opencode.js'
import { parsePi } from './parsers/pi.js'
import { parseQwen } from './parsers/qwen.js'
import { parseKiloCode, parseRooCode } from './parsers/roocode.js'
import { parseSynthetic } from './parsers/synthetic.js'
import { RenderScreen } from './render/render-screen.js'
import { RenderAppsByCostsScreen } from './screens/apps-by-costs.js'
import { RenderAppsByTokensScreen } from './screens/apps-by-tokens.js'
import { RenderCostsScreen } from './screens/costs.js'
import { RenderModelsByCostsScreen } from './screens/models-by-costs.js'
import { RenderModelsByTokensScreen } from './screens/models-by-tokens.js'
import { RenderModesByCostsScreen } from './screens/modes-by-costs.js'
import { RenderModesByTokensScreen } from './screens/modes-by-tokens.js'
import { RenderProjectsByCostsScreen } from './screens/projects-by-costs.js'
import { RenderProjectsByTokensScreen } from './screens/projects-by-tokens.js'
import { RenderProvidersByCostsScreen } from './screens/providers-by-costs.js'
import { RenderProvidersByTokensScreen } from './screens/providers-by-tokens.js'
import { RenderTokensScreen } from './screens/tokens.js'

type ScreenType =
  | 'costs'
  | 'tokens'
  | `${'apps' | 'modes' | 'models' | 'projects' | 'providers'}-by-${'costs' | 'tokens'}`

const SCREENS_MAP: Record<ScreenType, typeof RenderScreen> = {
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

export type RunAppOptions = {
  screen: ScreenType
  showBy: 'day' | 'week' | 'month' | 'year'

  dateStart?: Date
  dateEnd?: Date

  enabledApps?: string[]
  disabledApps?: string[]

  screenWidth?: number
}

export async function runApp(options: RunAppOptions) {
  const data = (
    await Promise.all([
      parseAntigravity(),
      parseAmp(),
      parseClaude(),
      parseCodebuff(),
      parseCodex(),
      parseCopilot(),
      parseCrush(),
      parseCursor(),
      parseDroid(),
      parseGemini(),
      parseGoose(),
      parseHermes(),
      parseKilo(),
      parseKiloCode(),
      parseKimi(),
      parseMux(),
      parseOpenClaw(),
      parseOpenCode(),
      parsePi(),
      parseQwen(),
      parseRooCode(),
      parseSynthetic(),
    ])
  ).flat()

  const ScreenConstructor = SCREENS_MAP[options.screen]
  if (!ScreenConstructor) {
    throw new Error(`Screen "${options.screen}" not found`)
  }

  const screen = new ScreenConstructor(data, {
    showBy: options.showBy ?? 'day',

    screenPadding: 1,
    screenWidth: options.screenWidth ?? process.stdout.columns ?? 80,

    enabledApps: options.enabledApps ?? null,
    disabledApps: options.disabledApps ?? null,

    dateStart: options.dateStart ?? null,
    dateEnd: options.dateEnd ?? null,
  })

  await screen.setup()
  await screen.render()
}
