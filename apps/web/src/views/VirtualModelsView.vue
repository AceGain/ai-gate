<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PhPlus, PhPencilSimple, PhTrashSimple } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import type { VModel } from '@ai-gate/shared'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import AppEmpty from '@/components/AppEmpty.vue'
import AppLoading from '@/components/AppLoading.vue'
import VirtualModelModal from '@/components/virtual-model/VirtualModelModal.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent } from '@/components/ui/item'
import { Switch } from '@/components/ui/switch'

const { t } = useI18n()
const { confirmDialog } = useConfirmDialog()
const models = ref<VModel[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const modalOpen = ref(false)
const editing = ref<VModel | null>(null)
const pending = ref(new Set<number>())
let request = 0
onBeforeUnmount(() => { request++ })
const filtered = computed(() => models.value.filter(model =>
  `${model.code} ${model.name} ${model.category} ${model.kind}`.toLowerCase().includes(search.value.toLowerCase())))
async function load() {
  const version = ++request
  loading.value = true; error.value = ''
  try {
    const items = await api<VModel[]>('/set/virtual-models')
    if (version === request) models.value = items
  } catch (err) { if (version === request) error.value = apiErrorMessage(err) }
  finally { if (version === request) loading.value = false }
}
function edit(item: VModel | null) { editing.value = item; modalOpen.value = true }
function replace(item: VModel) {
  // 成功写入先落到当前列表；后续 GET 失败时仍保留已确认的服务器结果。
  request++
  const index = models.value.findIndex(model => model.id === item.id)
  if (index < 0) models.value.push(item)
  else models.value[index] = item
  models.value.sort((left, right) => left.sort - right.sort || left.id - right.id)
}
async function saved(item: VModel) { replace(item); await load() }
async function toggle(item: VModel, enabled: boolean) {
  if (pending.value.has(item.id)) return
  pending.value.add(item.id)
  try {
    replace(await api<VModel>(`/set/virtual-models/${item.id}/enabled`, { method: 'PATCH', body: JSON.stringify({ enabled }) }))
    await load()
  } catch (err) { toast.error(apiErrorMessage(err)) }
  finally { pending.value.delete(item.id) }
}
async function remove(item: VModel) {
  if (pending.value.has(item.id) || !await confirmDialog({ title: () => t('virtualModels.delete'),
    description: () => t('virtualModels.deleteConfirm', { name: item.name || item.code }) })) return
  pending.value.add(item.id)
  try {
    await api(`/set/virtual-models/${item.id}`, { method: 'DELETE' })
    request++
    models.value = models.value.filter(model => model.id !== item.id)
    toast.success(t('common.deleted')); await load()
  } catch (err) { toast.error(apiErrorMessage(err)) }
  finally { pending.value.delete(item.id) }
}
void load()
</script>

<template>
  <Teleport defer to="#header-actions"><Button variant="ghost" size="sm" @click="edit(null)"><PhPlus data-icon="inline-start" />{{ t('common.add') }}</Button></Teleport>
  <div class="flex min-w-0 flex-1 flex-col gap-3">
    <Input v-model="search" :aria-label="t('common.search')" :placeholder="t('virtualModels.searchPlaceholder')" />
    <Alert v-if="error" variant="destructive"><AlertDescription class="flex items-center justify-between gap-3">{{ error }}<Button variant="outline" size="sm" :disabled="loading" @click="load">{{ t('common.retry') }}</Button></AlertDescription></Alert>
    <AppLoading v-if="loading && !models.length" />
    <div v-else-if="filtered.length" class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" role="list">
      <Item v-for="model in filtered" :key="model.id" variant="outline" role="listitem" class="min-w-0 flex-nowrap">
        <ItemContent class="min-w-0">
          <span class="truncate" :title="model.name || model.code">{{ model.name || model.code }}</span>
          <p class="text-muted-foreground truncate">{{ model.code }} · {{ model.category }} · {{ t('virtualModels.memberCount', { count: model.members.length }) }}</p>
          <p v-if="model.remark" class="text-muted-foreground truncate">{{ model.remark }}</p>
        </ItemContent>
        <Badge variant="secondary">{{ model.kind }}</Badge>
        <Switch :model-value="model.enabled" :disabled="pending.has(model.id)" :aria-label="t('common.toggleEnabled')" @update:model-value="enabled => toggle(model, !!enabled)" />
        <ItemActions>
          <Button variant="ghost" size="icon-sm" :disabled="pending.has(model.id)" :aria-label="t('common.edit')" @click="edit(model)"><PhPencilSimple /></Button>
          <Button variant="ghost" size="icon-sm" :disabled="pending.has(model.id)" :aria-label="t('common.delete')" @click="remove(model)"><PhTrashSimple /></Button>
        </ItemActions>
      </Item>
    </div>
    <AppEmpty v-else-if="!error" :title="search ? t('virtualModels.noMatches') : t('virtualModels.empty')" />
  </div>
  <VirtualModelModal v-model:open="modalOpen" :item="editing" @saved="saved" />
</template>
