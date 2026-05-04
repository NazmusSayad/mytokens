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
import { RenderScreen } from './render/render-screen.js'
import { RenderTokenScreen } from './screens/tokens.js'

type ScreenType =
  | 'costs'
  | 'tokens'
  | `${'apps' | 'modes' | 'models' | 'projects' | 'providers'}-by-${'costs' | 'tokens'}`

const SCREENS_MAP: Record<ScreenType, typeof RenderScreen> = {
  tokens: RenderTokenScreen,
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

  const ScreenConstructor = SCREENS_MAP[options.screen ?? 'tokens']
  const screen = new ScreenConstructor(data, {
    showBy: options.showBy ?? 'day',

    screenPadding: 1,
    screenWidth: options.screenWidth ?? process.stdout.columns ?? 80,

    enabledApps: options.enabledApps ?? null,
    disabledApps: options.disabledApps ?? null,

    dateStart: options.dateStart ?? null,
    dateEnd: options.dateEnd ?? null,
  })

  await screen.init()
  await screen.render()
}
