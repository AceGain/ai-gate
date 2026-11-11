<script setup lang="ts">
import type { REndpoint, RKey, RModel } from '@ai-gate/shared'
import { isEditableRouteModel } from '@ai-gate/shared'
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@vueuse/core'
import { useSortable } from '@vueuse/integrations/useSortable'
import { PhCopy, PhDotsSixVertical, PhEye, PhEyeSlash, PhPencilSimple, PhTrashSimple } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import AppEmpty from '@/components/AppEmpty.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Item, ItemActions, ItemContent } from '@/components/ui/item'
import { Switch } from '@/components/ui/switch'

type RecordItem = REndpoint | RKey | RModel
const props = defineProps<{routeId: number, kind: 'endpoints' | 'keys' | 'models', items: RecordItem[], prefixPath: string}>()
const emit = defineEmits<{edit: [item: RecordItem], changed: []}>()
const { t } = useI18n()
const { confirmDialog } = useConfirmDialog()
const { copy } = useClipboard({legacy: true})
const listEl = ref<HTMLElement | null>(null)
const items = ref<RecordItem[]>([])
const pending = ref(new Set<number>())
const revealed = ref(new Set<number>())
watch(() => props.items, value => { items.value = [...value] }, {immediate: true})
const path = (id: number) => `/set/routes/${props.routeId}/${props.kind}/${id}`
function label(item: RecordItem) { return 'path' in item ? item.type : 'code' in item ? item.name || item.code : item.name }
function fullPath(value: string) { return `${props.prefixPath === '/' ? '' : props.prefixPath}${value === '/' ? '' : value}` || '/' }
async function toggle(item: RecordItem, enabled: boolean) {
  if (pending.value.has(item.id)) return
  pending.value.add(item.id)
  try {
    const updated = await api<RecordItem>(`${path(item.id)}/enabled`, {method: 'PATCH', body: JSON.stringify({enabled})})
    const index = items.value.findIndex(row => row.id === item.id)
    if (index >= 0) items.value[index] = updated
    emit('changed')
  }
  catch (error) { toast.error(apiErrorMessage(error)) }
  finally { pending.value.delete(item.id) }
}
async function remove(item: RecordItem) {
  if (!await confirmDialog({title: () => t('common.delete'), description: () => t('routes.deleteRecordConfirm', {name: label(item)})})) return
  try { await api(path(item.id), {method: 'DELETE'}); toast.success(t('common.deleted')); emit('changed') }
  catch (error) { toast.error(apiErrorMessage(error)) }
}
async function copyText(value: string) {
  try { await copy(value); toast.success(t('common.copied')) }
  catch { toast.error(t('routes.copyFailed')) }
}
function reveal(id: number) { if (revealed.value.has(id)) revealed.value.delete(id); else revealed.value.add(id) }
function expired(item: RKey) { return item.expireTime ? item.expireTime < new Date().toISOString().slice(0, 10) : false }
useSortable(listEl, items, {
  handle: '.drag-handle', animation: 150, watchElement: true,
  onEnd: event => {
    if (event.oldIndex === event.newIndex) return
    void nextTick(async () => {
      try { await api(`/set/routes/${props.routeId}/${props.kind}/reorder`, {method: 'PUT', body: JSON.stringify(items.value.map((item, sort) => ({id: item.id, sort})))}) }
      catch (error) { items.value = [...props.items]; toast.error(apiErrorMessage(error)) }
      emit('changed')
    })
  },
})
</script>

<template>
  <div v-if="items.length" ref="listEl" class="flex min-w-0 flex-col gap-2" role="list">
    <Item v-for="item in items" :key="item.id" variant="outline" role="listitem" class="min-h-16 min-w-0 flex-nowrap gap-3 px-3.5">
      <div class="drag-handle text-muted-foreground flex size-7 shrink-0 cursor-grab items-center justify-center" aria-hidden="true" :title="t('common.dragToSort')"><PhDotsSixVertical class="size-4" /></div>
      <ItemContent class="min-w-0">
        <span class="truncate text-sm font-medium" :title="label(item)">{{ label(item) }}</span>
        <p v-if="'path' in item" class="text-muted-foreground truncate text-xs" :title="fullPath(item.path)">{{ fullPath(item.path) }}</p>
        <template v-else-if="'secret' in item">
          <p class="text-muted-foreground truncate font-mono text-xs">{{ revealed.has(item.id) ? item.secret : '••••••••••••••••' }}</p>
          <p v-if="item.expireTime" class="text-muted-foreground text-xs">{{ t('keys.expiresAt') }} · {{ item.expireTime }} <Badge v-if="expired(item)" variant="destructive">{{ t('common.invalid') }}</Badge></p>
        </template>
        <template v-else>
          <p class="text-muted-foreground truncate text-xs" :title="`${item.code} → ${item.providerName || ''} / ${item.sourceCode || ''}`">{{ item.code }} → {{ item.sourceType === 'V_MODEL' ? t('routes.virtualModel') : `${item.providerName || ''} / ${item.sourceCode || t('routes.sourceMissing')}` }}</p>
          <p v-if="!isEditableRouteModel(item)" class="text-muted-foreground text-xs">{{ t('routes.unsupportedModel') }}</p>
        </template>
      </ItemContent>
      <Switch size="sm" :model-value="item.enabled" :disabled="pending.has(item.id)" :aria-label="t('common.toggleEnabled')" class="shrink-0" @update:model-value="value => toggle(item, !!value)" />
      <ItemActions class="shrink-0 gap-1">
        <Button v-if="'secret' in item" variant="ghost" size="icon-sm" :aria-label="revealed.has(item.id) ? t('keys.hideSecret') : t('keys.showSecret')" @click="reveal(item.id)"><PhEyeSlash v-if="revealed.has(item.id)" /><PhEye v-else /></Button>
        <Button v-if="'secret' in item || 'path' in item" variant="ghost" size="icon-sm" :aria-label="t('common.copy')" @click="copyText('secret' in item ? item.secret : fullPath(item.path))"><PhCopy /></Button>
        <Button variant="ghost" size="icon-sm" :disabled="'modelId' in item && !isEditableRouteModel(item)" :title="'modelId' in item && !isEditableRouteModel(item) ? t('routes.unsupportedModel') : t('common.edit')" :aria-label="t('common.edit')" @click="emit('edit', item)"><PhPencilSimple /></Button>
        <Button variant="ghost" size="icon-sm" :aria-label="t('common.delete')" @click="remove(item)"><PhTrashSimple /></Button>
      </ItemActions>
    </Item>
  </div>
  <AppEmpty v-else />
</template>

<style scoped>
:deep(.sortable-ghost) { opacity: 0.35; }
</style>
