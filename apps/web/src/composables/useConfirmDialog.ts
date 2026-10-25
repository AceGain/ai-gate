/**
 * 全局确认弹窗：Promise 风格调用
 * const confirmed = await confirmDialog({title, description})
 */
import { ref } from 'vue'

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'description'>> {
  description?: string
}

const state = ref<ConfirmState | null>(null)
let resolver: ((confirmed: boolean) => void) | null = null

export function useConfirmDialog() {
  function confirmDialog(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      // 已有弹窗未决时先按取消落定，避免悬挂
      resolver?.(false)
      state.value = {
        title: options.title,
        description: options.description,
        confirmText: options.confirmText ?? '确认',
        cancelText: options.cancelText ?? '取消',
        destructive: options.destructive ?? true,
      }
      resolver = resolve
    })
  }

  function settle(confirmed: boolean) {
    state.value = null
    resolver?.(confirmed)
    resolver = null
  }

  return {state, confirmDialog, settle}
}
