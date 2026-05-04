import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'

export class RenderProjectsByTokensScreen extends RenderScreen {
  protected title = 'Projects by Tokens'

  protected resolveItem(item: UsageDataMessage) {
    const projectId = item.project?.name ?? item.project?.path ?? '(no project)'

    if (item.tokens.input) {
      return {
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.input,
      }
    }

    if (item.tokens.output) {
      return {
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.output,
      }
    }

    if (item.tokens.reasoning) {
      return {
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.reasoning,
      }
    }

    if (item.tokens.cacheInput) {
      return {
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.cacheInput,
      }
    }

    if (item.tokens.cacheOutput) {
      return {
        id: projectId,
        name: projectId,
        date: item.date,
        value: item.tokens.cacheOutput,
      }
    }
  }
}
