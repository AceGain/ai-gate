import {ConfirmRemoveModal} from '#components'

export interface ConfirmDialogOptions {
  title: string
  description?: string
}

/** 通用确认框：Promise<boolean>，确认 resolve true */
export const useConfirmDialog = () => {
  const overlay = useOverlay()

  return (options: ConfirmDialogOptions): Promise<boolean> => {
    const modal = overlay.create(ConfirmRemoveModal, {
      destroyOnClose: true,
      props: options
    })

    return modal.open()
  }
}
