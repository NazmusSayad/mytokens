import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderProjectsByRequestsScreen extends RenderScreen {
  protected title = 'Projects by Requests'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    const projectId = item.project?.name ?? item.project?.path ?? '(no project)'

    add({
      id: projectId,
      name: projectId,
      date: item.date,
      value: 1,
    })
  }
}
