<script setup lang="ts">
import type {ProviderConfig} from '~/utils/providers'
import {maskKey} from '~/utils/providers'

/**
 * 从上游获取模型弹窗：
 * 打开时自动拉取模型列表（多密钥时可选拉取用密钥），
 * 勾选未配置的模型确认后批量创建默认配置并启用；已配置模型仅展示不可勾选
 */
const props = defineProps<{
  provider: ProviderConfig
}>()

const {t} = useI18n()
const toast = useToast()

const open = defineModel<boolean>('open', {default: false})

// 拉取状态
const fetching = ref(false)
const fetched = ref(false)
const fetchedModels = ref<string[]>([])
// 勾选的模型（均为未配置）
const selected = ref<string[]>([])
const search = ref('')
// 拉取用密钥（默认第一个；密钥被删后自动回退）
const fetchKeyId = ref('')

watch(() => props.provider.keys, (keys) => {
  if (!keys.some(k => k.id === fetchKeyId.value)) {
    fetchKeyId.value = keys[0]?.id ?? ''
  }
}, {immediate: true, deep: true})

/** 拉取用密钥选项 */
const keyItems = computed(() =>
  props.provider.keys.map(k => ({
    label: k.name || maskKey(k.value) || t('providers.keyEmptyMask'),
    value: k.id
  }))
)

/** 拉取前置条件：密钥 / 协议 / 基础 URL / 模型列表端点均已配置 */
const fetchDisabled = computed(() =>
  !props.provider.keys.length
  || !props.provider.protocols.length
  || !props.provider.baseUrl.trim()
  || !props.provider.modelsEndpoint.trim()
)

/** 通过供应商级模型列表端点拉取模型（多协议共用一个接口） */
async function fetchModels() {
  const key = props.provider.keys.find(k => k.id === fetchKeyId.value)
  if (!key || !key.value.trim()) {
    toast.add({color: 'warning', title: t('providers.fetchModelsNeedKey')})
    return
  }

  fetching.value = true
  try {
    // 模型列表端点是供应商级的（多协议共用）；用默认协议的鉴权方式请求
    const protocol = props.provider.defaultProtocol ?? props.provider.protocols[0]!
    const models = await fetchProviderModels(
      props.provider.baseUrl.trim(),
      protocol,
      props.provider.modelsEndpoint.trim(),
      key.value.trim()
    )

    fetchedModels.value = models
    fetched.value = true
    selected.value = []
    if (models.length) {
      toast.add({color: 'success', title: t('providers.modelsFetched', {count: models.length})})
    } else {
      toast.add({color: 'warning', title: t('providers.fetchModelsEmpty')})
    }
  } catch (err) {
    // 优先展示后端/上游返回的结构化错误信息（{error: string}），否则回退到异常 message
    const data = (err as { data?: { error?: string } }).data
    toast.add({
      color: 'error',
      title: t('providers.fetchModelsFailed'),
      description: data?.error ?? (err instanceof Error ? err.message : String(err))
    })
  } finally {
    fetching.value = false
  }
}

/** 打开时重置状态并自动拉取 */
watch(open, (v) => {
  if (!v) return
  fetchedModels.value = []
  selected.value = []
  search.value = ''
  fetched.value = false
  if (!fetchDisabled.value) fetchModels()
})

/** 过滤后的展示列表（搜索） */
const displayModels = computed(() => {
  const list = [...fetchedModels.value].sort()
  const q = search.value.trim().toLowerCase()
  return q ? list.filter(m => m.toLowerCase().includes(q)) : list
})

/** 是否已在主列表配置（不可勾选） */
function isConfigured(m: string) {
  return m in props.provider.models
}

/** 当前过滤结果中可勾选的模型 */
const selectableModels = computed(() => displayModels.value.filter(m => !isConfigured(m)))

const allSelected = computed(() =>
  selectableModels.value.length > 0 && selectableModels.value.every(m => selected.value.includes(m))
)

/** 全选 / 取消全选（仅作用于当前过滤出的可选模型） */
function toggleAll() {
  selected.value = allSelected.value ? [] : selectableModels.value
}

function toggleModel(m: string) {
  const idx = selected.value.indexOf(m)
  if (idx === -1) selected.value.push(m)
  else selected.value.splice(idx, 1)
}

/** 确认：为勾选模型批量创建默认配置并启用 */
function confirmSelection() {
  if (!selected.value.length) return
  const p = props.provider
  for (const m of selected.value) {
    if (m in p.models) continue
    p.models[m] = {
      ...defaultModelConfig(),
      enabled: true,
      protocols: p.protocols.slice(0, 1)
    }
  }
  toast.add({color: 'success', title: t('providers.modelsEnabled', {count: selected.value.length})})
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('providers.fetchModalTitle')"
    :ui="{ content: 'sm:max-w-lg', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-3">
        <!-- 拉取控制：密钥选择（多密钥时）+ 刷新 -->
        <div class="flex items-center gap-2">
          <USelectMenu
            v-if="provider.keys.length > 1"
            v-model="fetchKeyId"
            :items="keyItems"
            value-key="value"
            :placeholder="t('providers.fetchKeySelect')"
            class="min-w-0 flex-1"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            variant="outline"
            color="neutral"
            :loading="fetching"
            :disabled="fetchDisabled"
            @click="fetchModels"
          >
            {{ t('providers.fetchModels') }}
          </UButton>
        </div>
        <p v-if="fetchDisabled" class="text-xs text-dimmed">
          {{ t('providers.fetchModelsNeedSetup') }}
        </p>

        <!-- 搜索 + 全选 -->
        <div v-if="fetchedModels.length" class="flex items-center gap-2">
          <UInput
            v-if="fetchedModels.length > 8"
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('providers.searchModelsPlaceholder')"
            class="min-w-0 flex-1"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="!selectableModels.length"
            @click="toggleAll"
          >
            {{ allSelected ? t('providers.fetchModalDeselectAll') : t('providers.fetchModalSelectAll') }}
          </UButton>
        </div>

        <!-- 模型列表：已配置的置灰不可勾选 -->
        <div v-if="displayModels.length" class="max-h-72 divide-y divide-default overflow-y-auto rounded-lg border border-default">
          <div
            v-for="m in displayModels"
            :key="m"
            class="flex items-center gap-3 px-3 py-2"
            :class="isConfigured(m) ? 'opacity-60' : ''"
          >
            <UCheckbox
              :model-value="selected.includes(m)"
              :disabled="isConfigured(m)"
              :aria-label="m"
              @update:model-value="() => toggleModel(m)"
            />
            <span class="min-w-0 flex-1 truncate font-mono text-sm text-highlighted">{{ m }}</span>
            <UBadge v-if="isConfigured(m)" variant="subtle" color="neutral">
              {{ t('providers.fetchModalConfigured') }}
            </UBadge>
          </div>
        </div>
        <!-- 空态：搜索无结果 / 上游返回空 -->
        <p v-else-if="fetchedModels.length" class="py-4 text-center text-sm text-dimmed">
          {{ t('providers.noMatchModels') }}
        </p>
        <p v-else-if="fetched && !fetching" class="py-4 text-center text-sm text-dimmed">
          {{ t('providers.fetchModelsEmpty') }}
        </p>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" @click="open = false">
        {{ t('providers.cancel') }}
      </UButton>
      <UButton
        icon="i-lucide-check"
        :disabled="!selected.length"
        @click="confirmSelection"
      >
        {{ t('providers.fetchModalConfirm', {count: selected.length}) }}
      </UButton>
    </template>
  </UModal>
</template>
