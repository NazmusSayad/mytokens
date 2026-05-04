import path from 'path'
import { initializePriceDetector } from './core/price-detector.js'
import { writeFileForced } from './helpers/fs.js'
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
import { renderAppsByCostsScreen } from './screens/apps-by-costs.js'
import { renderAppsByTokensScreen } from './screens/apps-by-tokens.js'
import { renderCostsScreen } from './screens/costs.js'
import { renderModelsByCostsScreen } from './screens/models-by-costs.js'
import { renderModelsByTokensScreen } from './screens/models-by-tokens.js'
import { renderModesByCostsScreen } from './screens/modes-by-costs.js'
import { renderModesByTokensScreen } from './screens/modes-by-tokens.js'
import { renderProjectsByCostsScreen } from './screens/projects-by-costs.js'
import { renderProjectsByTokensScreen } from './screens/projects-by-tokens.js'
import { renderProvidersByCostsScreen } from './screens/providers-by-costs.js'
import { renderProvidersByTokensScreen } from './screens/providers-by-tokens.js'
import { renderTokensScreen } from './screens/tokens.js'
import { RenderScreenOptions } from './screens/types.js'

type ScreenType =
  | 'costs'
  | 'tokens'
  | `${'apps' | 'modes' | 'models' | 'projects' | 'providers'}-by-${'costs' | 'tokens'}`

const SCREENS_MAP: Record<
  ScreenType,
  (options: RenderScreenOptions) => Promise<void>
> = {
  costs: renderCostsScreen,
  tokens: renderTokensScreen,
  'apps-by-costs': renderAppsByCostsScreen,
  'apps-by-tokens': renderAppsByTokensScreen,
  'modes-by-costs': renderModesByCostsScreen,
  'modes-by-tokens': renderModesByTokensScreen,
  'models-by-costs': renderModelsByCostsScreen,
  'models-by-tokens': renderModelsByTokensScreen,
  'projects-by-costs': renderProjectsByCostsScreen,
  'projects-by-tokens': renderProjectsByTokensScreen,
  'providers-by-costs': renderProvidersByCostsScreen,
  'providers-by-tokens': renderProvidersByTokensScreen,
}

export type RunAppOptions = {
  screen?: ScreenType
  showBy?: 'day' | 'week' | 'month' | 'year'

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
  await writeFileForced(
    path.resolve('.trash/output.json'),
    JSON.stringify(data, null, 2)
  )

  const priceDetector = await initializePriceDetector()
  await writeFileForced(
    path.resolve('.trash/price.json'),
    JSON.stringify(priceDetector, null, 2)
  )

  const screen = SCREENS_MAP[options.screen ?? 'tokens']
  await screen({
    data,
    showBy: options.showBy ?? 'day',
    screenWidth: options.screenWidth ?? process.stdout.columns ?? 80,
    screenPadding: 1,
  })
}
