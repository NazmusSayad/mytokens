import { initializePriceDetector } from '@/core/price-detector.js'
import { UsageDataMessage } from '@/core/types.js'
import { ColorGenerator } from '@/render/color-generator.js'
import { formatDateKey } from '@/render/utils.js'
import { RenderValueShowBy } from '@/render/types.js'

export type OverviewRankItem = {
  id: string
  name: string
  value: number
  color: string
}

export type OverviewDailyPoint = {
  label: string
  total: number
  input: number
  output: number
  reasoning: number
  cache: number
  cost: number
}

export type OverviewTokenSlice = {
  id: string
  name: string
  value: number
  color: string
}

export type OverviewSummary = {
  dateStart: Date | null
  dateEnd: Date | null
  dataStart: Date | null
  dataEnd: Date | null
  totalTokens: number
  totalCost: number
  totalMessages: number
  activeDays: number
  topModel: string
  topApp: string
  daily: OverviewDailyPoint[]
  composition: OverviewTokenSlice[]
  models: OverviewRankItem[]
  apps: OverviewRankItem[]
  providers: OverviewRankItem[]
  projects: OverviewRankItem[]
  modes: OverviewRankItem[]
}

const COMPOSITION_COLORS = {
  input: '#6366f1',
  output: '#8b5cf6',
  reasoning: '#f59e0b',
  cache: '#10b981',
}

export async function computeOverview(
  messages: UsageDataMessage[],
  range: {
    dateStart: Date | null
    dateEnd: Date | null
    usageBy?: RenderValueShowBy
    projects?: number
  }
): Promise<OverviewSummary> {
  if (messages.length === 0) {
    throw new Error('No data to export.')
  }

  const priceDetector = await initializePriceDetector()

  const daily = new Map<string, OverviewDailyPoint>()
  const tokenTotals = { input: 0, output: 0, reasoning: 0, cache: 0 }
  const modelTotals = new Map<string, number>()
  const appTotals = new Map<string, number>()
  const providerTotals = new Map<string, number>()
  const projectTotals = new Map<string, number>()
  const modeTotals = new Map<string, number>()
  const modelNames = new Map<string, string>()
  const projectNames = new Map<string, string>()
  let totalCost = 0
  let dataStart: Date | null = null
  let dataEnd: Date | null = null

  for (const message of messages) {
    if (!dataStart || message.date.getTime() < dataStart.getTime()) {
      dataStart = message.date
    }
    if (!dataEnd || message.date.getTime() > dataEnd.getTime()) {
      dataEnd = message.date
    }

    const tokens = message.tokens
    const input = tokens.input
    const output = tokens.output
    const reasoning = tokens.reasoning
    const cache = tokens.cacheInput + tokens.cacheOutput
    const all = input + output + reasoning + cache

    const inputPrice = priceDetector.getInputPrice(message.model)
    const outputPrice = priceDetector.getOutputPrice(message.model)
    const cacheInputPrice = priceDetector.getCacheInputPrice(message.model)
    const cacheOutputPrice = priceDetector.getCacheOutputPrice(message.model)
    totalCost +=
      input * inputPrice +
      output * outputPrice +
      reasoning * outputPrice +
      tokens.cacheInput * cacheInputPrice +
      tokens.cacheOutput * cacheOutputPrice

    const key = formatDateKey(message.date, range.usageBy ?? 'day')
    let point = daily.get(key)
    if (!point) {
      point = {
        label: formatUsageLabel(key, range.usageBy ?? 'day'),
        total: 0,
        input: 0,
        output: 0,
        reasoning: 0,
        cache: 0,
        cost: 0,
      }
      daily.set(key, point)
    }
    point.total += all
    point.input += input
    point.output += output
    point.reasoning += reasoning
    point.cache += cache
    point.cost +=
      input * inputPrice +
      output * outputPrice +
      reasoning * outputPrice +
      tokens.cacheInput * cacheInputPrice +
      tokens.cacheOutput * cacheOutputPrice

    tokenTotals.input += input
    tokenTotals.output += output
    tokenTotals.reasoning += reasoning
    tokenTotals.cache += cache

    modelTotals.set(
      message.model.id,
      (modelTotals.get(message.model.id) ?? 0) + all
    )
    modelNames.set(message.model.id, message.model.id)
    appTotals.set(message.app, (appTotals.get(message.app) ?? 0) + all)
    providerTotals.set(
      message.model.provider,
      (providerTotals.get(message.model.provider) ?? 0) + all
    )
    modeTotals.set(message.mode, (modeTotals.get(message.mode) ?? 0) + all)

    if (message.project?.name) {
      const name = message.project.name
      projectTotals.set(name, (projectTotals.get(name) ?? 0) + all)
      projectNames.set(name, name)
    }
  }

  const activeDays = daily.size
  if (dataStart && dataEnd) {
    fillUsagePeriods(daily, dataStart, dataEnd, range.usageBy ?? 'day')
  }

  const dailyPoints = Array.from(daily.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, point]) => point)

  const [models, apps, providers, projects, modes] = await Promise.all([
    toRankItems(modelTotals, modelNames, 6),
    toRankItems(appTotals, new Map(), 6),
    toRankItems(providerTotals, new Map(), 6),
    toRankItems(projectTotals, projectNames, range.projects ?? 10),
    toRankItems(modeTotals, new Map(), 6),
  ])

  return {
    dateStart: range.dateStart,
    dateEnd: range.dateEnd,
    dataStart,
    dataEnd,
    totalTokens:
      tokenTotals.input +
      tokenTotals.output +
      tokenTotals.reasoning +
      tokenTotals.cache,
    totalCost,
    totalMessages: messages.length,
    activeDays,
    topModel: models[0]?.name ?? '—',
    topApp: apps[0]?.name ?? '—',
    daily: dailyPoints,
    composition: [
      {
        id: 'input',
        name: 'Input',
        value: tokenTotals.input,
        color: COMPOSITION_COLORS.input,
      },
      {
        id: 'output',
        name: 'Output',
        value: tokenTotals.output,
        color: COMPOSITION_COLORS.output,
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        value: tokenTotals.reasoning,
        color: COMPOSITION_COLORS.reasoning,
      },
      {
        id: 'cache',
        name: 'Cache',
        value: tokenTotals.cache,
        color: COMPOSITION_COLORS.cache,
      },
    ],
    models,
    apps,
    providers,
    projects,
    modes,
  }
}

function formatUsageLabel(key: string, usageBy: RenderValueShowBy): string {
  if (usageBy === 'year') {
    return key
  }
  if (usageBy === 'month') {
    const [year, month] = key.split('/')
    return `${year.slice(2)}/${month}`
  }
  const [, month, day] = key.split('/')
  return `${month}/${day}`
}

function fillUsagePeriods(
  points: Map<string, OverviewDailyPoint>,
  start: Date,
  end: Date,
  usageBy: RenderValueShowBy
) {
  const cursor = startUsagePeriod(start, usageBy)
  const last = startUsagePeriod(end, usageBy)

  while (cursor.getTime() <= last.getTime()) {
    const key = formatDateKey(cursor, usageBy)
    if (!points.has(key)) {
      points.set(key, {
        label: formatUsageLabel(key, usageBy),
        total: 0,
        input: 0,
        output: 0,
        reasoning: 0,
        cache: 0,
        cost: 0,
      })
    }

    if (usageBy === 'day') {
      cursor.setDate(cursor.getDate() + 1)
    } else if (usageBy === 'week') {
      cursor.setDate(cursor.getDate() + 7)
    } else if (usageBy === 'month') {
      cursor.setMonth(cursor.getMonth() + 1)
    } else {
      cursor.setFullYear(cursor.getFullYear() + 1)
    }
  }
}

function startUsagePeriod(date: Date, usageBy: RenderValueShowBy): Date {
  const period = new Date(date)
  period.setHours(0, 0, 0, 0)

  if (usageBy === 'week') {
    const day = period.getDay()
    const difference = day === 0 ? -6 : 1 - day
    period.setDate(period.getDate() + difference)
  } else if (usageBy === 'month') {
    period.setDate(1)
  } else if (usageBy === 'year') {
    period.setMonth(0, 1)
  }

  return period
}

async function toRankItems(
  totals: Map<string, number>,
  names: Map<string, string>,
  topCount: number
): Promise<OverviewRankItem[]> {
  if (topCount === 0) {
    return []
  }
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    return []
  }

  const colorGenerator = new ColorGenerator()
  const items: OverviewRankItem[] = []
  for (const [id, value] of sorted.slice(0, topCount)) {
    items.push({
      id,
      name: names.get(id) ?? id,
      value,
      color: await colorGenerator.generate(id),
    })
  }

  if (sorted.length > topCount) {
    const rest = sorted
      .slice(topCount)
      .reduce((sum, [, value]) => sum + value, 0)
    items.push({
      id: '__others__',
      name: 'Others',
      value: rest,
      color: '#9ca3af',
    })
  }

  return items
}
