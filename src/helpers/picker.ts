import { APP_SCREENS_INFO, AppScreenType } from '@/constants/screen.js'
import {
  createPrompt,
  isBackspaceKey,
  isDownKey,
  isEnterKey,
  isUpKey,
  makeTheme,
  useKeypress,
  useMemo,
  usePagination,
  usePrefix,
  useState,
} from '@inquirer/core'
import { styleText } from 'node:util'

type ScreenChoice = {
  value: AppScreenType
  name: string
  description: string
}

const SCREENS: ScreenChoice[] = APP_SCREENS_INFO.map((screen) => ({
  value: screen.type,
  name: screen.title,
  description: screen.description,
}))

export async function pickScreen(): Promise<AppScreenType> {
  return screenPicker({ message: 'Select a screen to display:' })
}

// ─── Custom prompt ──────────────────────────────────────────────────────────

const pickerTheme = {
  icon: { cursor: '❯' },
  style: {
    searchTerm: (text: string) => styleText('cyan', text),
    description: (text: string) => styleText('dim', text),
    answer: (text: string) => styleText('cyan', text),
  },
}

const screenPicker = createPrompt<AppScreenType, { message: string }>(
  (config, done) => {
    const theme = makeTheme(pickerTheme, {})
    const [status, setStatus] = useState('idle')
    const [searchTerm, setSearchTerm] = useState('')
    const prefix = usePrefix({ status, theme })

    const filtered = useMemo(() => {
      const term = searchTerm.trim().toLowerCase()
      if (!term) return SCREENS
      return SCREENS.filter(
        (screen) =>
          screen.name.toLowerCase().includes(term) ||
          screen.description.toLowerCase().includes(term)
      )
    }, [searchTerm])

    const [active, setActive] = useState(0)

    const bounds = useMemo(
      () => ({ first: 0, last: Math.max(filtered.length - 1, 0) }),
      [filtered]
    )

    useKeypress((key, rl) => {
      if (isEnterKey(key)) {
        const selected = filtered[active]
        if (selected) {
          setStatus('done')
          done(selected.value)
        }
      } else if (isUpKey(key) || isDownKey(key)) {
        rl.clearLine(0)
        if (
          (isUpKey(key) && active !== bounds.first) ||
          (isDownKey(key) && active !== bounds.last)
        ) {
          setActive(
            Math.min(
              Math.max(active + (isUpKey(key) ? -1 : 1), bounds.first),
              bounds.last
            )
          )
        }
      } else if (isBackspaceKey(key)) {
        rl.clearLine(0)
        setSearchTerm(rl.line)
      } else {
        setSearchTerm(rl.line)
      }
    })

    const message = theme.style.message(config.message, status)

    if (status === 'done') {
      const selected = filtered[active]
      return [prefix, message, theme.style.answer(selected?.name ?? '')]
        .filter(Boolean)
        .join(' ')
        .trimEnd()
    }

    const page = usePagination({
      items: filtered,
      active,
      pageSize: 8,
      loop: false,
      renderItem({ item, isActive }) {
        const color = isActive ? theme.style.highlight : (x: string) => x
        const cursor = isActive ? theme.icon.cursor : ' '
        return color(renderScreenLine(item, cursor))
      },
    })

    const searchStr = theme.style.searchTerm(searchTerm)
    const header = [prefix, message, searchStr]
      .filter(Boolean)
      .join(' ')
      .trimEnd()

    const helpLine = theme.style.help('↑↓ navigate • type to search • ⏎ select')

    let body: string
    if (filtered.length === 0) {
      body = theme.style.error('No screens match your search.')
    } else {
      body = page
    }

    return [header, [body, ' ', helpLine].filter(Boolean).join('\n').trimEnd()]
  }
)

// ─── Layout helpers ─────────────────────────────────────────────────────────

function renderScreenLine(choice: ScreenChoice, cursor: string): string {
  const width = process.stdout.columns ?? 80
  const rightPad = 2
  const minGap = 2
  const left = `${cursor} ${choice.name}`
  const descSpace = Math.max(10, width - left.length - rightPad)
  const description = truncate(choice.description, descSpace)
  const gap = Math.max(minGap, descSpace - description.length)
  return `${left}${' '.repeat(gap)}${description}`
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  if (maxLen <= 1) return text.slice(0, maxLen)
  return text.slice(0, maxLen - 1) + '…'
}
