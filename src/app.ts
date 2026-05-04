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
import { RenderDataItem, renderScreen } from './render/render-screen.js'

export type RunAppOptions = {
  screen?:
    | 'costs'
    | 'tokens'
    | 'apps-by-costs'
    | 'apps-by-tokens'
    | 'modes-by-costs'
    | 'modes-by-tokens'
    | 'models-by-costs'
    | 'models-by-tokens'
    | 'projects-by-costs'
    | 'projects-by-tokens'
    | 'providers-by-costs'
    | 'providers-by-tokens'

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

  const renderItems: RenderDataItem[] = []
  data.forEach((item) => {
    if (item.tokens.input) {
      renderItems.push({
        id: 'input',
        name: 'Input',
        date: item.date,
        value: item.tokens.input,
      })
    }

    if (item.tokens.output) {
      renderItems.push({
        id: 'output',
        name: 'Output',
        date: item.date,
        value: item.tokens.output,
      })
    }

    if (item.tokens.reasoning) {
      renderItems.push({
        id: 'reasoning',
        name: 'Reasoning',
        date: item.date,
        value: item.tokens.reasoning,
      })
    }

    if (item.tokens.cacheInput) {
      renderItems.push({
        id: 'cacheInput',
        name: 'Cache Input',
        date: item.date,
        value: item.tokens.cacheInput,
      })
    }

    if (item.tokens.cacheOutput) {
      renderItems.push({
        id: 'cacheOutput',
        name: 'Cache Output',
        date: item.date,
        value: item.tokens.cacheOutput,
      })
    }
  })

  await renderScreen({
    title: 'Token Usage',
    data: renderItems,
    showBy: options.showBy ?? 'day',

    screenWidth: options.screenWidth ?? process.stdout.columns ?? 80,
    screenPadding: 1,
  })
}
