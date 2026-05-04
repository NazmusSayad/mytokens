import type { BarSegment, ChartDay, ChartItem } from './types'
import { BAR_WIDTH, formatShortDate, getDateKey } from './utils'

export function ChartPlot({
  days,
  items,
  maxTotal,
  rowCount,
}: {
  days: ChartDay[]
  items: ChartItem[]
  maxTotal: number
  rowCount: number
}) {
  const barSegments = days.map((day) => {
    const segments: BarSegment[] = []
    let currentRow = rowCount - 1

    for (const item of [...items].sort(
      (a, b) => (day.values[b.id] ?? 0) - (day.values[a.id] ?? 0),
    )) {
      const value = day.values[item.id] ?? 0
      const segmentHeight =
        maxTotal > 0 ? Math.max(0, Math.round((value / maxTotal) * rowCount)) : 0
      if (segmentHeight > 0) {
        segments.push({
          color: item.color,
          startRow: currentRow - segmentHeight + 1,
          endRow: currentRow,
        })
        currentRow -= segmentHeight
      }
    }

    return segments
  })

  return (
    <box style={{ flexDirection: 'column' }}>
      <box style={{ flexDirection: 'column', height: rowCount }}>
        {Array.from({ length: rowCount }, (_, row) => (
          <box key={row} style={{ flexDirection: 'row', height: 1 }}>
            {barSegments.map((segments, index) => {
              const segment = segments.find(
                (item) => row >= item.startRow && row <= item.endRow,
              )
              return (
                <text
                  key={index}
                  style={{ width: BAR_WIDTH }}
                  fg={segment?.color}
                >
                  {segment ? '█'.repeat(BAR_WIDTH) : ' '.repeat(BAR_WIDTH)}
                </text>
              )
            })}
          </box>
        ))}
      </box>

      <box style={{ flexDirection: 'row', height: 1 }}>
        {days.map((day, index) => {
          const label = index % 3 === 0 ? formatShortDate(day.date) : ''
          const padLeft = Math.max(0, Math.ceil((BAR_WIDTH - label.length) / 2))
          const padRight = Math.max(0, BAR_WIDTH - label.length - padLeft)
          return (
            <text
              key={getDateKey(day.date)}
              fg="#888888"
              style={{ width: BAR_WIDTH }}
            >
              {' '.repeat(padLeft) + label + ' '.repeat(padRight)}
            </text>
          )
        })}
      </box>
    </box>
  )
}
