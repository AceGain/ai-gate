import {ConfirmRemoveModal} from '#components'

export interface ConfirmDialogOptions {
  title: string
  description?: string
}

/** 通用确认框：Promise<boolean>，仅确认时为 true；Esc / 关闭 / 外部点击等取消路径统一归一为 false */
export const useConfirmDialog = () => {
  const overlay = useOverlay()

  return async (options: ConfirmDialogOptions): Promise<boolean> => {
    const modal = overlay.create(ConfirmRemoveModal, {
      destroyOnClose: true,
      props: options
    })

    const result = await modal.open()
    return result === true
  }
}
