<script setup lang="ts">
import type {ProviderConfig, ProviderKeyConfig} from '~/utils/providers'
import {maskKey} from '~/utils/providers'

const props = defineProps<{
  provider: ProviderConfig
}>()

const {t} = useI18n()
const {persistNow} = useProviders()
const confirmDialog = useConfirmDialog()

// 新增/编辑密钥弹窗
const editOpen = ref(false)
const editingKey = ref<ProviderKeyConfig | null>(null)

function openCreate() {
  editingKey.value = null
  editOpen.value = true
}

// 新增密钥按钮在父页面 Tab 栏右侧，通过此暴露打开弹窗
defineExpose({openCreate})

function openEdit(key: ProviderKeyConfig) {
  editingKey.value = key
  editOpen.value = true
}

/** 密钥弹窗保存回调：新增追加密钥；编辑原地更新 */
function onKeySaved(key: ProviderKeyConfig | null) {
  if (key) props.provider.keys.push(key)
  editOpen.value = false
  persistNow()
}

/** 今日日期（yyyy-MM-dd，本地时区），用于过期判断 */
function todayStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isExpired(key: ProviderKeyConfig) {
  return !!key.expiresAt && key.expiresAt < todayStr()
}

/** 删除密钥：二次确认 */
async function removeKey(key: ProviderKeyConfig) {
  const confirmed = await confirmDialog({
    title: t('providers.removeKeyConfirmTitle'),
    description: t('providers.removeKeyConfirmDesc')
  })
  if (!confirmed) return
  const idx = props.provider.keys.findIndex(k => k.id === key.id)
  if (idx !== -1) props.provider.keys.splice(idx, 1)
}

/** 多密钥选择策略选项 */
const strategyItems = computed(() =>
  keyStrategies.map(s => ({label: t(s.labelKey), value: s.id}))
)
</script>

<template>
  <div class="space-y-4">
    <!-- 密钥列表：仅凭证信息（新增密钥按钮在 Tab 栏右侧） -->
    <div v-if="props.provider.keys.length" class="divide-y divide-default overflow-hidden rounded-lg border border-default">
      <div
        v-for="key in props.provider.keys"
        :key="key.id"
        class="flex items-center gap-3 bg-default px-4 py-3 transition-colors hover:bg-elevated/50"
        :class="!key.enabled ? 'opacity-60' : ''"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span v-if="key.name" class="shrink-0 text-sm font-medium text-highlighted">{{ key.name }}</span>
            <span class="min-w-0 truncate font-mono text-sm text-highlighted">
              {{ maskKey(key.value) || t('providers.keyEmptyMask') }}
            </span>
          </div>
        </div>
        <UBadge v-if="isExpired(key)" variant="subtle" color="error">
          {{ t('providers.keyExpired') }}
        </UBadge>
        <UBadge v-else-if="key.expiresAt" variant="subtle" color="neutral">
          {{ t('providers.keyExpiresAtBadge', {date: key.expiresAt}) }}
        </UBadge>
        <!-- 启用开关：与模型行一致 -->
        <USwitch
          v-model="key.enabled"
          :aria-label="t('providers.enableKey')"
          class="shrink-0"
        />
        <UButton
          icon="i-lucide-pencil"
          variant="ghost"
          color="neutral"
          class="shrink-0 text-dimmed hover:text-default"
          :aria-label="t('providers.edit')"
          @click="openEdit(key)"
        />
        <UButton
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          class="shrink-0"
          :aria-label="t('providers.removeKey')"
          @click="removeKey(key)"
        />
      </div>
    </div>

    <!-- 空态：与其他页面统一 UEmpty -->
    <div v-else class="py-16">
      <UEmpty
        :title="t('providers.keysEmpty')"
        :description="t('providers.keysHint')"
        icon="i-lucide-key-round"
        variant="naked"
      />
    </div>

    <!-- 多密钥策略：网关转发功能上线后生效 -->
    <template v-if="props.provider.keys.length > 1">
      <USeparator/>
      <UFormField
        :label="t('providers.keyStrategyLabel')"
        :help="t('providers.keyStrategyHint')"
      >
        <USelectMenu
          v-model="provider.keyStrategy"
          :items="strategyItems"
          value-key="value"
          class="w-full"
        />
      </UFormField>
    </template>

    <!-- 新增/编辑密钥弹窗 -->
    <ProviderKeyCreateModal
      v-model:open="editOpen"
      :edit-key="editingKey"
      @close="onKeySaved"
    />
  </div>
</template>
