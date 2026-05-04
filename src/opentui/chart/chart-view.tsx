import type { MouseEvent } from '@opentui/core'
import { useEffect, useMemo, useState } from 'react'
import { ChartPlot } from './chart-plot'
import { Legend } from './legend'
import { RangeBar } from './range-bar'
import { RangeLabelsColumn } from './range-labels-column'
import type { ChartViewData } from './types'
import { createChartLayout, createChartRenderData } from './utils'

export type { ChartViewData } from './types'

type ChartViewProps = {
  data: ChartViewData[]
  height: number
  width: number
}

export function ChartView({ data, height, width }: ChartViewProps) {
  const [scrollOffset, setScrollOffset] = useState(0)

  const dataChunk = useMemo(
    () => createChartRenderData(data, scrollOffset, width),
    [data, scrollOffset, width],
  )

  const layout = useMemo(() => {
    return createChartLayout({ chartData: dataChunk, height, width })
  }, [dataChunk, width, height])

  useEffect(() => {
    if (scrollOffset !== dataChunk.scrollOffset) {
      setScrollOffset(dataChunk.scrollOffset)
    }
  }, [dataChunk.scrollOffset, scrollOffset])

  return (
    <box style={{ flexDirection: 'column', width, height }}>
      <box
        style={{
          flexDirection: 'row',
          width: layout.width,
          height: layout.chartAreaHeight,
        }}
      >
        <RangeLabelsColumn
          labels={dataChunk.yLabels}
          rowCount={layout.chartHeight}
          width={layout.rangeLabelWidth}
        />

        <box style={{ width: 1 }} />

        <box
          style={{
            flexDirection: 'column',
            width: layout.mainWidth,
            height: layout.chartAreaHeight,
          }}
          onMouseScroll={(event: MouseEvent) => {
            const direction = event.scroll?.direction ?? 'down'
            const delta = direction === 'left' || direction === 'up' ? 1 : -1
            setScrollOffset(
              Math.max(
                0,
                Math.min(dataChunk.scrollOffset + delta, dataChunk.maxScroll),
              ),
            )
          }}
        >
          <ChartPlot
            days={dataChunk.days}
            items={dataChunk.visibleItems}
            maxTotal={dataChunk.maxTotal}
            rowCount={layout.chartHeight}
          />

          <RangeBar
            days={dataChunk.allDays}
            visibleDays={dataChunk.days}
            width={layout.mainWidth}
            scrollOffset={Math.max(
              0,
              dataChunk.maxScroll - dataChunk.scrollOffset,
            )}
          />
        </box>

        {layout.rightEmptyWidth > 0 && (
          <box style={{ width: layout.rightEmptyWidth }} />
        )}
      </box>

      <box style={{ height: 1 }} />

      <Legend items={dataChunk.visibleItems} width={width} />
    </box>
  )
}
