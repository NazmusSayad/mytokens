import { UsageDataMessage } from '@/core/types.js'
import { writeFileForced } from '@/helpers/fs.js'
import { parseAmp } from '@/parsers/amp.js'
import { parseAntigravity } from '@/parsers/antigravity.js'
import { parseClaude } from '@/parsers/claude.js'
import { parseCodebuff } from '@/parsers/codebuff.js'
import { parseCodex } from '@/parsers/codex.js'
import { parseCopilot } from '@/parsers/copilot.js'
import { parseCrush } from '@/parsers/crush.js'
import { parseCursor } from '@/parsers/cursor.js'
import { parseDroid } from '@/parsers/droid.js'
import { parseGemini } from '@/parsers/gemini.js'
import { parseGoose } from '@/parsers/goose.js'
import { parseHermes } from '@/parsers/hermes.js'
import { parseKilo } from '@/parsers/kilo.js'
import { parseKimi } from '@/parsers/kimi.js'
import { parseMux } from '@/parsers/mux.js'
import { parseOpenClaw } from '@/parsers/openclaw.js'
import { parseOpenCode } from '@/parsers/opencode.js'
import { parsePi } from '@/parsers/pi.js'
import { parseQwen } from '@/parsers/qwen.js'
import { parseKiloCode, parseRooCode } from '@/parsers/roocode.js'
import { parseSynthetic } from '@/parsers/synthetic.js'
import { RenderScreenOptions } from '@/render/types.js'
import { isMessageIgnored } from './chart.js'
import { renderImageInTerminal, TerminalImageOptions } from './image.js'
import { renderOverviewToSvg } from './overview-svg.js'
import { computeOverview } from './overview.js'

export async function loadUsageData(): Promise<UsageDataMessage[]> {
  return (
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
}

function filterMessages(
  data: UsageDataMessage[],
  options: RenderScreenOptions
): UsageDataMessage[] {
  return data.filter((message) => !isMessageIgnored(message, options))
}

export async function buildOverviewSvg(
  options: RenderScreenOptions
): Promise<string> {
  const data = await loadUsageData()
  const messages = filterMessages(data, options)
  const overview = await computeOverview(messages, {
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
  })
  return renderOverviewToSvg(overview)
}

export async function exportReportToSvg(
  outputPath: string,
  options: RenderScreenOptions
): Promise<string> {
  const svg = await buildOverviewSvg(options)
  await writeFileForced(outputPath, svg)
  return outputPath
}

export async function showReportImage(
  options: RenderScreenOptions,
  imageOptions: TerminalImageOptions = {}
): Promise<string> {
  const svg = await buildOverviewSvg(options)
  await renderImageInTerminal(svg, imageOptions)
  return svg
}
