/**
 * 全局确认弹窗：Promise 风格调用
 * const confirmed = await confirmDialog({title, description})
 */
import { t } from '@/i18n'
import type { MaybeRefOrGetter } from 'vue'
import { ref } from 'vue'

interface ConfirmOptions {
  title: MaybeRefOrGetter<string>
  description?: MaybeRefOrGetter<string>
  confirmText?: MaybeRefOrGetter<string>
  cancelText?: MaybeRefOrGetter<string>
  destructive?: boolean
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'description'>> {
  description?: MaybeRefOrGetter<string>
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
        confirmText: options.confirmText ?? (() => t('common.confirm')),
        cancelText: options.cancelText ?? (() => t('common.cancel')),
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
