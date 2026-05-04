import { createCliRenderer } from '@opentui/core'
import { createRoot, useTerminalDimensions } from '@opentui/react'
import { useState, useMemo } from 'react'
import { ChartView, type ChartViewData } from './chart/chart-view'

interface DataItem {
  name: string
  color: string
}

interface DailyData {
  date: string
  values: Record<string, number>
}

interface Dataset {
  name: string
  items: DataItem[]
  data: DailyData[]
}

const TABS = [
  'Overview',
  'By Models',
  'By Apps',
  'By Modes',
  'By Providers',
] as const

const COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
  '#FFD93D',
  '#6BCB77',
  '#4D96FF',
  '#FF9F45',
  '#C9B1FF',
  '#FF8C94',
] as const

function getDates(count: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(`${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`)
  }
  return dates
}

function generateDataset(tabIndex: number): Dataset {
  const dates = getDates(365)
  let items: DataItem[] = []

  switch (tabIndex) {
    case 0:
      items = [
        { name: 'Input', color: COLORS[0] },
        { name: 'Output', color: COLORS[1] },
        { name: 'Cache In', color: COLORS[2] },
        { name: 'Cache Out', color: COLORS[3] },
      ]
      break
    case 1:
      items = [
        { name: 'GPT-3', color: COLORS[0] },
        { name: 'GPT-4', color: COLORS[1] },
        { name: 'Claude', color: COLORS[2] },
        { name: 'Kimi', color: COLORS[3] },
        { name: 'Qwen', color: COLORS[4] },
        { name: 'Gemini', color: COLORS[5] },
        { name: 'Llama', color: COLORS[6] },
      ]
      break
    case 2:
      items = [
        { name: 'OpenCode', color: COLORS[0] },
        { name: 'OpenGlobe', color: COLORS[1] },
        { name: 'OpenNote', color: COLORS[2] },
        { name: 'OpenChat', color: COLORS[3] },
        { name: 'OpenSearch', color: COLORS[4] },
      ]
      break
    case 3:
      items = [
        { name: 'Chat', color: COLORS[0] },
        { name: 'Build', color: COLORS[1] },
        { name: 'Plan', color: COLORS[2] },
        { name: 'Debug', color: COLORS[3] },
        { name: 'Agent', color: COLORS[4] },
      ]
      break
    case 4:
      items = [
        { name: 'OpenAI', color: COLORS[0] },
        { name: 'Anthropic', color: COLORS[1] },
        { name: 'Groq', color: COLORS[2] },
        { name: 'Google', color: COLORS[3] },
        { name: 'Mistral', color: COLORS[4] },
      ]
      break
  }

  const data: DailyData[] = dates.map((date) => {
    const year = Number(date.split('/')[2])
    const values: Record<string, number> = {}
    for (const item of items) {
      if (tabIndex === 1 && item.name === 'GPT-3') {
        values[item.name] =
          year < 2026 ? Math.floor(Math.random() * 90) + 30 : 0
      } else if (tabIndex === 1 && year < 2026 && item.name !== 'GPT-4') {
        values[item.name] = Math.floor(Math.random() * 45) + 5
      } else {
        values[item.name] = Math.floor(Math.random() * 120) + 10
      }
    }
    return { date, values }
  })

  return { name: TABS[tabIndex] ?? TABS[0], items, data }
}

function toChartViewData(dataset: Dataset): ChartViewData[] {
  return dataset.data.flatMap((day) => {
    const [month, date, year] = day.date.split('/').map(Number)
    if (!month || !date || !year) return []

    return dataset.items.map((item) => ({
      id: item.name,
      name: item.name,
      date: new Date(year, month - 1, date),
      value: day.values[item.name] ?? 0,
    }))
  })
}

function App() {
  const [activeTab, setActiveTab] = useState(0)
  const { width, height } = useTerminalDimensions()

  const datasets = useMemo(() => TABS.map((_, i) => generateDataset(i)), [])
  const currentDataset = datasets[activeTab]

  if (!currentDataset) return null

  return (
    <box
      style={{
        width,
        height,
        flexDirection: 'column',
        paddingX: 1,
      }}
    >
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
          height: 2,
        }}
      >
        <box style={{ flexDirection: 'row', gap: 2 }}>
          {TABS.map((tab, i) => {
            const isSelected = i === activeTab
            const fg = isSelected ? '#FFFFFF' : '#888888'

            return (
              <box
                key={tab}
                style={{ height: 1 }}
                onMouseDown={() => setActiveTab(i)}
              >
                <text fg={fg}>{tab}</text>
              </box>
            )
          })}
        </box>
      </box>

      <ChartView
        data={toChartViewData(currentDataset)}
        height={Math.max(0, height - 3)}
        width={width}
      />
    </box>
  )
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
})

createRoot(renderer).render(<App />)
