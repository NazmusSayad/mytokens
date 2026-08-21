import { APP_SCREENS_MAP, AppScreenType } from './constants/screen.js'
import { flushFileMessagesCache } from './helpers/parse-cache.js'
import { DateRange } from './helpers/parser.js'
import { parseAmp } from './parsers/amp.js'
import { parseAntigravity } from './parsers/antigravity.js'
import { parseClaude } from './parsers/claude.js'
import { parseCodebuff } from './parsers/codebuff.js'
import { parseCodex } from './parsers/codex.js'
import { parseCopilot } from './parsers/copilot.js'
import { parseCrush } from './parsers/crush.js'
import { parseCursor } from './parsers/cursor.js'
import { parseDroid } from './parsers/droid.js'
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
import { RenderScreenOptions } from './render/types.js'

export async function runApp(
  options: RenderScreenOptions & { screen: AppScreenType }
) {
  const range: DateRange = {
    from: options.dateStart ?? null,
    to: options.dateEnd ?? null,
  }

  const data = (
    await Promise.all([
      parseAntigravity(range),
      parseAmp(range),
      parseClaude(range),
      parseCodebuff(range),
      parseCodex(range),
      parseCopilot(range),
      parseCrush(range),
      parseCursor(range),
      parseDroid(range),
      parseGoose(range),
      parseHermes(range),
      parseKilo(range),
      parseKiloCode(range),
      parseKimi(range),
      parseMux(range),
      parseOpenClaw(range),
      parseOpenCode(range),
      parsePi(range),
      parseQwen(range),
      parseRooCode(range),
      parseSynthetic(range),
    ])
  ).flat()

  flushFileMessagesCache()

  const ScreenConstructor = APP_SCREENS_MAP[options.screen]
  if (!ScreenConstructor) {
    throw new Error(`Screen "${options.screen}" not found`)
  }

  const screen = new ScreenConstructor(data, options)
  await screen.setup()
  await screen.render()
}
