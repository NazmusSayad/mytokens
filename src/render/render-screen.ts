import { UsageDataMessage } from '@/core/types.js'
import chalk from 'chalk'
import { ColorGenerator } from './color-generator.js'
import { printLn } from './stdout.js'
import {
  RenderDataItem,
  RenderScreenOptions,
  RenderValueUnit,
} from './types.js'
import {
  formatDateKey,
  formatHumanReadableNumber,
  getDateLabelWidth,
  placeLabels,
} from './utils.js'

export class RenderScreen {
  private initialized = false
  private data: UsageDataMessage[]
  private options: RenderScreenOptions
  private colorGenerator = new ColorGenerator()

  // Should be overridden by subclasses
  protected title: string = ''

  // Should be overridden by subclasses if they want to support units other than 'none'
  protected valueUnit: RenderValueUnit = 'none'

  // Ignore, anyone can override this if needed
  protected async init() {}

  // Must be implemented by subclasses to resolve a UsageDataMessage into a RenderDataItem
  protected resolveItem(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    item: UsageDataMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    add: (resolved: RenderDataItem) => void
  ) {
    throw new Error('Not implemented, should be implemented by subclasses')
  }

  constructor(data: UsageDataMessage[], options: RenderScreenOptions) {
    this.data = data
    this.options = options
  }

  private isMessageIgnored(message: UsageDataMessage) {
    const { dateStart, dateEnd, enabledApps, disabledApps } = this.options

    if (dateEnd && message.date.getTime() > dateEnd.getTime()) {
      return true
    }

    if (dateStart && message.date.getTime() < dateStart.getTime()) {
      return true
    }

    if (enabledApps?.length && !enabledApps.includes(message.app)) {
      return true
    }

    if (disabledApps?.length && disabledApps.includes(message.app)) {
      return true
    }

    if (
      this.options.enabledProviders?.length &&
      !this.options.enabledProviders.includes(message.model.provider)
    ) {
      return true
    }

    if (
      this.options.disabledProviders?.length &&
      this.options.disabledProviders.includes(message.model.provider)
    ) {
      return true
    }

    if (
      this.options.enabledModels?.length &&
      !this.options.enabledModels.includes(message.model.id)
    ) {
      return true
    }

    if (
      this.options.disabledModels?.length &&
      this.options.disabledModels.includes(message.model.id)
    ) {
      return true
    }

    if (
      this.options.enabledModes?.length &&
      !this.options.enabledModes.includes(message.mode)
    ) {
      return true
    }

    if (
      this.options.disabledModes?.length &&
      this.options.disabledModes.includes(message.mode)
    ) {
      return true
    }

    if (
      message.project?.name &&
      this.options.enabledProjects?.length &&
      !this.options.enabledProjects.includes(message.project.name)
    ) {
      return true
    }

    if (
      message.project?.name &&
      this.options.disabledProjects?.length &&
      this.options.disabledProjects.includes(message.project.name)
    ) {
      return true
    }

    return false
  }

  public async setup() {
    await this.init()
    this.initialized = true
  }

  public async render() {
    if (!this.initialized) {
      throw new Error(
        'Screen not initialized. Please call setup() before render().'
      )
    }

    if (this.title === '') {
      throw new Error(
        'Title is not set. Please set the title property in the subclass.'
      )
    }

    const resolvedData: RenderDataItem[] = []
    for (let i = 0; i < this.data.length; i++) {
      const message = this.data[i]
      if (this.isMessageIgnored(message)) {
        continue
      }

      this.resolveItem(message, (resolved) => {
        return resolvedData.push(resolved)
      })
    }

    if (resolvedData.length === 0) {
      console.warn('No data to display.')
      return
    }

    const { showBy, screenWidth, screenPadding } = this.options

    const grouped = new Map<string, Map<string, number>>()
    const idToName = new Map<string, string>()

    for (const item of resolvedData) {
      const key = formatDateKey(item.date, showBy)
      if (!grouped.has(key)) {
        grouped.set(key, new Map())
      }
      const bucket = grouped.get(key)!
      bucket.set(item.id, (bucket.get(item.id) ?? 0) + item.value)
      if (!idToName.has(item.id)) {
        idToName.set(item.id, item.name)
      }
    }

    const sortedKeys = Array.from(grouped.keys()).sort()

    let maxTotal = 0
    for (const key of sortedKeys) {
      const bucket = grouped.get(key)!
      let total = 0
      for (const v of bucket.values()) {
        total += v
      }
      if (total > maxTotal) {
        maxTotal = total
      }
    }

    if (maxTotal === 0) {
      console.warn('All values are zero.')
      return
    }

    const dateWidth = getDateLabelWidth(showBy)
    const leftPaddingChars = ' '.repeat(screenPadding)
    const separatorText = ' │ '
    const separator = chalk.dim(separatorText)

    const rightPad = 1
    const availableWidth = screenWidth - screenPadding * 2
    const chartWidth = Math.max(
      10,
      availableWidth - dateWidth - separatorText.length - rightPad
    )

    const idToTotal = new Map<string, number>()
    for (const key of sortedKeys) {
      const bucket = grouped.get(key)!
      for (const [id, val] of bucket) {
        idToTotal.set(id, (idToTotal.get(id) ?? 0) + val)
      }
    }

    const ids = Array.from(idToName.keys()).sort(
      (a, b) => (idToTotal.get(b) ?? 0) - (idToTotal.get(a) ?? 0)
    )
    const idToColor = new Map<string, (s: string) => string>()
    for (const id of ids) {
      const hex = await this.colorGenerator.generate(id)
      idToColor.set(id, chalk.hex(hex))
    }

    const titlePadding = Math.max(
      0,
      Math.floor((availableWidth - this.title.length) / 2)
    )

    printLn()
    printLn(
      leftPaddingChars + ' '.repeat(titlePadding) + chalk.bold(this.title)
    )
    printLn()

    for (const key of sortedKeys) {
      const bucket = grouped.get(key)!
      const total = Array.from(bucket.values()).reduce((a, b) => a + b, 0)

      let barWidth = Math.round((total / maxTotal) * chartWidth)
      if (barWidth === 0 && total > 0) {
        barWidth = 1
      }

      const label = key.padEnd(dateWidth)
      let bar = ''

      const segments = ids
        .map((id) => ({ id, val: bucket.get(id) ?? 0 }))
        .filter((s) => s.val > 0)

      if (segments.length === 0) {
        // nothing
      } else if (segments.length === 1) {
        const colorFn = idToColor.get(segments[0].id)!
        bar = colorFn('█'.repeat(barWidth))
      } else {
        const portions = segments.map((s) => (s.val / total) * barWidth)

        // Ensure every non-zero segment gets at least 1 char
        let chars = portions.map((p) => Math.max(1, Math.floor(p)))
        let allocated = chars.reduce((a, b) => a + b, 0)

        // If forcing 1 char each exceeded barWidth, scale everything down proportionally
        if (allocated > barWidth) {
          const scale = barWidth / allocated
          chars = chars.map((c) => Math.max(1, Math.floor(c * scale)))
          allocated = chars.reduce((a, b) => a + b, 0)
        }

        const remainder = barWidth - allocated
        const indexed = portions.map((p, i) => ({
          i,
          frac: p - Math.floor(p),
        }))
        indexed.sort((a, b) => b.frac - a.frac)

        for (let r = 0; r < remainder; r++) {
          chars[indexed[r % indexed.length].i]++
        }

        for (let i = 0; i < segments.length; i++) {
          const colorFn = idToColor.get(segments[i].id)!
          bar += colorFn('█'.repeat(chars[i]))
        }
      }

      printLn(leftPaddingChars + `${label}${separator}${bar}`)
    }

    const cornerPrefix = ' '.repeat(dateWidth + 1) + '└'
    printLn(
      leftPaddingChars + chalk.dim(cornerPrefix + '─'.repeat(chartWidth + 1))
    )

    const maxDivisions = Math.max(2, Math.floor(chartWidth / 16))
    let divisions = maxDivisions

    const labels: Array<{ text: string; pos: number }> = []
    while (divisions >= 2) {
      labels.length = 0
      let fits = true

      for (let i = 0; i <= divisions; i++) {
        const fraction = i / divisions
        const value = Math.round(maxTotal * fraction)
        const text = formatHumanReadableNumber(value, this.valueUnit)

        let pos: number
        if (i === 0) {
          pos = 1
        } else if (i === divisions) {
          pos = chartWidth - text.length
        } else {
          pos = Math.floor(chartWidth * fraction) - Math.floor(text.length / 2)
        }

        const newStart = pos - 1
        const newEnd = pos + text.length + 1
        const overlaps = labels.some((l) => {
          const exStart = l.pos - 1
          const exEnd = l.pos + l.text.length + 1
          return newStart < exEnd && newEnd > exStart
        })

        if (overlaps) {
          fits = false
          break
        }

        labels.push({ text, pos })
      }

      if (fits) break
      divisions--
    }

    const axisLabels = placeLabels(chartWidth, labels)
    const labelPrefix = ' '.repeat(dateWidth + 2)
    printLn(leftPaddingChars + labelPrefix + axisLabels)

    printLn()

    const legendItems = ids.map((id) => {
      const colorFn = idToColor.get(id)!
      const name = idToName.get(id)!
      const totalVal = idToTotal.get(id) ?? 0
      return [
        colorFn('■'),
        name,
        chalk.dim(
          `(${formatHumanReadableNumber(totalVal.toFixed(2), this.valueUnit)})`
        ),
      ].join(' ')
    })

    function stripAnsi(s: string) {
      return s.replace(/\u001b\[[0-9;]*m/g, '')
    }
    const legendSeparator = '   '

    const legendLines: string[][] = [[]]
    const lineLengths: number[] = [0]

    for (const item of legendItems) {
      const plainItem = stripAnsi(item)
      const itemLength = plainItem.length
      const currentLineIndex = lineLengths.length - 1

      if (lineLengths[currentLineIndex] === 0) {
        legendLines[currentLineIndex].push(item)
        lineLengths[currentLineIndex] = itemLength
      } else if (
        lineLengths[currentLineIndex] + legendSeparator.length + itemLength <=
        availableWidth
      ) {
        legendLines[currentLineIndex].push(item)
        lineLengths[currentLineIndex] += legendSeparator.length + itemLength
      } else {
        legendLines.push([item])
        lineLengths.push(itemLength)
      }
    }

    for (const line of legendLines) {
      const lineStr = line.join(legendSeparator)
      const plainLine = stripAnsi(lineStr)
      const legendPadding = Math.max(
        0,
        Math.floor((availableWidth - plainLine.length) / 2)
      )
      printLn(leftPaddingChars + ' '.repeat(legendPadding) + lineStr)
    }
    printLn()
  }
}
