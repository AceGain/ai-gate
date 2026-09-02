<script setup lang="ts">
import type {ProviderConfig} from '~/utils/providers'

const props = defineProps<{
  provider: ProviderConfig
}>()

const {t} = useI18n()
const confirmDialog = useConfirmDialog()
const search = ref('')

/** 所有密钥确认可用模型的并集 */
const availableModels = computed(() =>
  new Set(props.provider.keys.flatMap(k => k.enabledModels))
)

/** 已配置的模型列表（支持搜索过滤） */
const configuredModels = computed(() => {
  const list = Object.keys(props.provider.models).sort()
  const q = search.value.trim().toLowerCase()
  return q ? list.filter(m => m.toLowerCase().includes(q)) : list
})

function isAvailable(m: string) {
  return availableModels.value.has(m)
}

/** 新增/编辑模型弹窗 */
const editOpen = ref(false)
const editingModel = ref<string | null>(null)

function openCreate() {
  editingModel.value = null
  editOpen.value = true
}

function openEdit(m: string) {
  editingModel.value = m
  editOpen.value = true
}

/** 删除模型配置：二次确认 */
async function removeModel(m: string) {
  const confirmed = await confirmDialog({
    title: t('providers.removeModelConfirmTitle'),
    description: t('providers.removeModelConfirmDesc', {name: m})
  })
  if (!confirmed) return
  delete props.provider.models[m]
}

function typeLabel(type: string) {
  const meta = providerModelTypes.find(ty => ty.id === type)
  return meta ? t(meta.labelKey) : type
}
</script>

<template>
  <div class="space-y-4">
    <template v-if="Object.keys(provider.models).length">
      <!-- 头部：搜索 + 新增 -->
      <div class="flex items-center gap-2">
        <UInput
          v-if="Object.keys(provider.models).length > 8"
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('providers.searchModelsPlaceholder')"
          class="min-w-0 flex-1"
        />
        <UButton icon="i-lucide-plus" @click="openCreate">
          {{ t('providers.addModel') }}
        </UButton>
      </div>

      <!-- 已配置模型列表 -->
      <div class="divide-y divide-default overflow-hidden rounded-lg border border-default">
        <div
          v-for="m in configuredModels"
          :key="m"
          class="group flex items-center gap-3 bg-default px-4 py-3 transition-colors hover:bg-elevated/50"
          :class="!provider.models[m]!.enabled ? 'opacity-60' : ''"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="min-w-0 truncate font-mono text-sm font-medium text-highlighted">{{ m }}</span>
              <UBadge v-if="provider.models[m]!.displayName" variant="subtle" color="neutral">
                {{ provider.models[m]!.displayName }}
              </UBadge>
              <UBadge v-if="!provider.models[m]!.enabled" variant="subtle" color="warning">
                {{ t('providers.modelDisabled') }}
              </UBadge>
              <UBadge v-if="!isAvailable(m)" variant="subtle" color="warning">
                {{ t('providers.modelUnavailable') }}
              </UBadge>
            </div>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
              <span>{{ typeLabel(provider.models[m]!.type) }}</span>
              <span v-if="provider.models[m]!.group">{{ provider.models[m]!.group }}</span>
              <span v-if="provider.models[m]!.reasoning">
                {{
                  t('providers.reasoning')
                }} · {{
                  provider.models[m]!.reasoningEfforts.map(e => t(`providers.reasoningEffortLevel.${e}`)).join(' / ')
                }}
              </span>
              <span v-if="provider.models[m]!.maxContext">
                {{ t('providers.maxContext') }} {{ provider.models[m]!.maxContext.toLocaleString() }}
              </span>
            </div>
          </div>

          <!-- 启用开关 -->
          <USwitch
            v-model="provider.models[m]!.enabled"
            :disabled="!isAvailable(m)"
            :aria-label="t('providers.enableModel')"
            class="shrink-0"
          />

          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            :aria-label="t('providers.editModel')"
            @click="openEdit(m)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            :aria-label="t('providers.removeModel')"
            @click="removeModel(m)"
          />
        </div>
      </div>
    </template>

    <!-- 空态：与其他页面统一 UEmpty -->
    <div v-else class="flex flex-col items-center justify-center gap-4 py-16">
      <UEmpty
        :title="t('providers.modelsEmpty')"
        :description="t('providers.modelsHint')"
        icon="i-lucide-boxes"
        variant="naked"
      />
      <UButton icon="i-lucide-plus" @click="openCreate">
        {{ t('providers.addModel') }}
      </UButton>
    </div>

    <!-- 新增/编辑模型弹窗 -->
    <ProviderModelEditModal
      v-model:open="editOpen"
      :provider="provider"
      :model-id="editingModel"
    />
  </div>
</template>
