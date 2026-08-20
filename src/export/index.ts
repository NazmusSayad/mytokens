import { UsageDataMessage } from '@/core/types.js'
import { writeFileForced } from '@/helpers/fs.js'
import { DateRange } from '@/helpers/parser.js'
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
import { isMessageIgnored } from './chart.js'
import { copyPngToClipboard } from './clipboard.js'
import { renderPng } from './image.js'
import { renderOverviewToSvg } from './overview-svg.js'
import { computeOverview } from './overview.js'
import {
  renderImageInTerminal,
  TerminalImageOptions,
} from './terminal-image.js'
import { DEFAULT_EXPORT_THEME } from './themes.js'
import { ExportFilterOptions, ExportFormat, ExportThemeId } from './types.js'

export async function loadUsageData(
  range?: DateRange
): Promise<UsageDataMessage[]> {
  return (
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
      parseGemini(range),
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
}

function filterMessages(
  data: UsageDataMessage[],
  options: ExportFilterOptions
): UsageDataMessage[] {
  return data.filter((message) => !isMessageIgnored(message, options))
}

export async function buildOverviewSvg(
  options: ExportFilterOptions,
  themeId: ExportThemeId = DEFAULT_EXPORT_THEME,
  projects = 10
): Promise<string> {
  const data = await loadUsageData({
    from: options.dateStart ?? null,
    to: options.dateEnd ?? null,
  })
  const messages = filterMessages(data, options)
  const overview = await computeOverview(messages, {
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    usageBy: options.usageBy,
    projects,
  })
  return renderOverviewToSvg(overview, themeId)
}

export async function exportReportToSvg(
  outputPath: string,
  options: ExportFilterOptions,
  fileOptions: {
    format?: ExportFormat
    theme?: ExportThemeId
    scale?: number
    projects?: number
  } = {}
): Promise<string> {
  const {
    format = 'svg',
    theme = DEFAULT_EXPORT_THEME,
    scale = 1,
  } = fileOptions
  const svg = await buildOverviewSvg(options, theme, fileOptions.projects)
  if (format === 'png') {
    await writeFileForced(outputPath, renderPng(svg, { scale }))
    return outputPath
  }
  await writeFileForced(outputPath, svg)
  return outputPath
}

export async function showReportImage(
  options: ExportFilterOptions,
  imageOptions: TerminalImageOptions & {
    copy?: boolean
    theme?: ExportThemeId
    projects?: number
  } = {}
): Promise<string> {
  const {
    copy = false,
    theme = DEFAULT_EXPORT_THEME,
    ...terminalImageOptions
  } = imageOptions
  const svg = await buildOverviewSvg(options, theme, imageOptions.projects)
  const png = await renderImageInTerminal(svg, terminalImageOptions)
  if (copy) {
    await copyPngToClipboard(png)
  }
  return svg
}
