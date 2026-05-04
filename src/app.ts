import { initializePriceDetector } from './core/proce-detector.js'
import { parseClaude } from './parsers/claude.js'
import { parseCodex } from './parsers/codex.js'
import { parseCopilot } from './parsers/copilot.js'
import { parseGemini } from './parsers/gemini.js'
import { parseOpenCode } from './parsers/opencode.js'

export type RunAppOptions = {
  opencodeDbPath?: string
}

export async function runApp(_options: RunAppOptions) {
  const priceDetector = await initializePriceDetector()

  const data = [
    ...(await parseCodex()),
    ...(await parseClaude()),
    ...(await parseGemini()),
    ...(await parseCopilot()),
    ...(await parseOpenCode()),
  ]

  console.log(priceDetector, data)
}
