import { APP_SCREENS_MAP, AppScreenType } from '@/constants/screen.js'
import { UsageDataMessage } from '@/core/types.js'
import {
  RenderDataItem,
  RenderScreenOptions,
  RenderValueUnit,
} from '@/render/types.js'

export type ScreenAccessor = {
  title: string
  valueUnit: RenderValueUnit
  resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ): void
  setup(): Promise<void>
}

export function createScreenAccessor(
  screen: AppScreenType,
  data: UsageDataMessage[],
  options: RenderScreenOptions
): ScreenAccessor {
  const ScreenConstructor = APP_SCREENS_MAP[screen]
  if (!ScreenConstructor) {
    throw new Error(`Screen "${screen}" not found`)
  }

  const instance = new ScreenConstructor(data, options)
  return instance as unknown as ScreenAccessor
}
