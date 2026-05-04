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
  opencodeDbPath?: string
}

export async function runApp(_options: RunAppOptions) {
  const priceDetector = await initializePriceDetector()

  await writeFileForced(
    path.resolve('.trash/price.json'),
    JSON.stringify(priceDetector, null, 2)
  )

  const data = [
    ...(await parseAntigravity()),
    ...(await parseAmp()),
    ...(await parseClaude()),
    ...(await parseCodebuff()),
    ...(await parseCodex()),
    ...(await parseCopilot()),
    ...(await parseCrush()),
    ...(await parseCursor()),
    ...(await parseDroid()),
    ...(await parseGemini()),
    ...(await parseGoose()),
    ...(await parseHermes()),
    ...(await parseKilo()),
    ...(await parseKiloCode()),
    ...(await parseKimi()),
    ...(await parseMux()),
    ...(await parseOpenClaw()),
    ...(await parseOpenCode()),
    ...(await parsePi()),
    ...(await parseQwen()),
    ...(await parseRooCode()),
    ...(await parseSynthetic()),
  ]

  await writeFileForced(
    path.resolve('.trash/output.json'),
    JSON.stringify(data, null, 2)
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

  await renderScreen(renderItems)
}
