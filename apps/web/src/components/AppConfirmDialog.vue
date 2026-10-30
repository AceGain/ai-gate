<script setup lang="ts">
import { toValue } from 'vue'
import { PhWarning } from '@phosphor-icons/vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { DialogBody } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const {state, settle} = useConfirmDialog()

/**
 * 关闭来源区分：按钮点击会先触发 reka-ui 的内置关闭（update:open=false）再执行按钮 @click，
 * 因此非按钮关闭（Esc 等）走延迟落定为取消，让按钮 @click 的落定抢先生效
 */
function handleOpenChange(open: boolean) {
  if (open) return
  setTimeout(() => settle(false))
}
</script>

<template>
  <AlertDialog
    :open="!!state"
    @update:open="handleOpenChange"
  >
    <AlertDialogContent
      v-if="state"
      size="sm"
      class="flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-[calc(100%-2rem)] sm:max-h-[calc(100dvh-4rem)]"
    >
      <AlertDialogHeader class="shrink-0">
        <AlertDialogTitle class="flex items-center gap-2">
          <PhWarning
            class="size-4 shrink-0"
            :class="state.destructive ? 'text-destructive' : 'text-warning'"
          />
          {{ toValue(state.title) }}
        </AlertDialogTitle>
      </AlertDialogHeader>
      <DialogBody
        v-if="state.description"
        :aria-label="toValue(state.title)"
        content-class="text-center wrap-anywhere"
      >
        <AlertDialogDescription>
          {{ toValue(state.description) }}
        </AlertDialogDescription>
      </DialogBody>
      <AlertDialogFooter class="shrink-0">
        <AlertDialogCancel @click="settle(false)">
          {{ toValue(state.cancelText) }}
        </AlertDialogCancel>
        <AlertDialogAction
          :variant="state.destructive ? 'destructive' : 'default'"
          @click="settle(true)"
        >
          {{ toValue(state.confirmText) }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
