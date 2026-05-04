import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderProjectsByTokensScreen extends RenderScreen {
  protected title = 'Projects by Tokens'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    const projectId = item.project?.name ?? item.project?.path ?? '(no project)'

    if (item.tokens.input) {
      add({
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.input,
      })
    }

    if (item.tokens.output) {
      add({
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.output,
      })
    }

    if (item.tokens.reasoning) {
      add({
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.reasoning,
      })
    }

    if (item.tokens.cacheInput) {
      add({
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.cacheInput,
      })
    }

    if (item.tokens.cacheOutput) {
      add({
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.cacheOutput,
      })
    }
  }
}
