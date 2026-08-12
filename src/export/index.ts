import { APP_SCREENS_MAP, AppScreenType } from '@/constants/screen.js'
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
import { RenderDataItem, RenderScreenOptions } from '@/render/types.js'
import { computeChartModel, isMessageIgnored } from './chart.js'
import { renderImageInTerminal, TerminalImageOptions } from './image.js'
import { createScreenAccessor } from './screens.js'
import { renderChartToSvg, renderDashboardToSvg } from './svg.js'
import { ChartModel } from './types.js'

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

export async function buildChartModels(
  data: UsageDataMessage[],
  screen: AppScreenType | null,
  options: RenderScreenOptions
): Promise<ChartModel[]> {
  const screens: AppScreenType[] = screen
    ? [screen]
    : (Object.keys(APP_SCREENS_MAP) as AppScreenType[])

  const models: ChartModel[] = []
  for (const screenType of screens) {
    const accessor = createScreenAccessor(screenType, data, options)
    await accessor.setup()

    const items: RenderDataItem[] = []
    for (const message of data) {
      if (isMessageIgnored(message, options)) continue
      accessor.resolveItem(message, (resolved) => items.push(resolved))
    }

    if (items.length === 0) continue

    const model = await computeChartModel(
      items,
      options,
      accessor.title,
      accessor.valueUnit
    )
    if (model.rows.length === 0) continue

    models.push(model)
  }

  return models
}

export async function buildReportSvg(
  screen: AppScreenType | null,
  options: RenderScreenOptions
): Promise<string> {
  const data = await loadUsageData()
  const models = await buildChartModels(data, screen, options)
  if (models.length === 0) {
    throw new Error('No data to export.')
  }

  return models.length === 1
    ? renderChartToSvg(models[0])
    : renderDashboardToSvg(models)
}

export async function exportReportToSvg(
  screen: AppScreenType | null,
  outputPath: string,
  options: RenderScreenOptions
): Promise<string> {
  const svg = await buildReportSvg(screen, options)
  await writeFileForced(outputPath, svg)
  return outputPath
}

export async function showReportImage(
  screen: AppScreenType | null,
  options: RenderScreenOptions,
  imageOptions: TerminalImageOptions = {}
): Promise<string> {
  const svg = await buildReportSvg(screen, options)
  await renderImageInTerminal(svg, imageOptions)
  return svg
}
