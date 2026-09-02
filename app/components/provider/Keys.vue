<script setup lang="ts">
import type {ProviderConfig, ProviderKeyConfig} from '~/utils/providers'

const props = defineProps<{
  provider: ProviderConfig
}>()

const {t} = useI18n()
const {persistNow} = useProviders()
const toast = useToast()
const confirmDialog = useConfirmDialog()

// 各密钥的"获取模型"请求加载态（key id -> boolean）
const fetching = reactive<Record<string, boolean>>({})
// 各密钥卡片的展开状态（默认折叠）
const expanded = reactive<Record<string, boolean>>({})
// 各密钥的手动模型输入
const manualInputs = reactive<Record<string, string>>({})
// 新增/编辑密钥弹窗
const editOpen = ref(false)
const editingKey = ref<ProviderKeyConfig | null>(null)

function openCreate() {
  editingKey.value = null
  editOpen.value = true
}

function openEdit(key: ProviderKeyConfig) {
  editingKey.value = key
  editOpen.value = true
}

/** 密钥弹窗保存回调：新增追加密钥并展开；编辑原地更新 */
function onKeySaved(key: ProviderKeyConfig | null) {
  if (key) {
    props.provider.keys.push(key)
    expanded[key.id] = true
  }
  editOpen.value = false
  persistNow()
}

/** 密钥掩码：仅显示前 4 位与后 4 位 */
function keyMask(value: string) {
  const v = value.trim()
  if (!v) return t('providers.keyEmptyMask')
  if (v.length <= 8) return `${v.slice(0, 2)}****`
  return `${v.slice(0, 4)} ···· ${v.slice(-4)}`
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

/** 滑块开关：切换某个模型在该密钥下是否可用 */
function toggleModel(key: ProviderKeyConfig, model: string, on: boolean) {
  if (on) {
    if (!key.enabledModels.includes(model)) key.enabledModels.push(model)
  } else {
    key.enabledModels = key.enabledModels.filter(m => m !== model)
  }
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

/** 手动添加模型：加入获取列表并启用 */
function addManualModel(key: ProviderKeyConfig) {
  const m = (manualInputs[key.id] ?? '').trim()
  if (!m) return
  if (!key.fetchedModels.includes(m)) key.fetchedModels.push(m)
  if (!key.enabledModels.includes(m)) key.enabledModels.push(m)
  manualInputs[key.id] = ''
}

/** 拉取模型前置条件：协议 / 基础 URL / 模型列表端点均已配置 */
const fetchDisabled = computed(() =>
  !props.provider.protocols.length
  || !props.provider.baseUrl.trim()
  || !props.provider.modelsEndpoint.trim()
)

/** 密钥启用模型中尚未生成配置的数量 */
const unconfiguredCount = computed(() => {
  const all = new Set(props.provider.keys.flatMap(k => k.enabledModels))
  return [...all].filter(m => !(m in props.provider.models)).length
})

/** 单个模型的配置弹窗（已配置则编辑，未配置按默认值新建） */
const modelEditOpen = ref(false)
const configModelId = ref<string | null>(null)

function openModelConfig(m: string) {
  configModelId.value = m
  modelEditOpen.value = true
}

/** 为所有密钥启用但尚未配置的模型批量生成默认配置 */
function generateModelConfigs() {
  const p = props.provider
  const candidates = [...new Set(p.keys.flatMap(k => k.enabledModels))]
    .filter(m => !(m in p.models))
  if (!candidates.length) {
    toast.add({color: 'warning', title: t('providers.noModelsToGenerate')})
    return
  }
  for (const m of candidates) {
    p.models[m] = {
      ...defaultModelConfig(),
      enabled: true,
      protocols: p.protocols.slice(0, 1)
    }
  }
  persistNow()
  toast.add({color: 'success', title: t('providers.modelConfigsGenerated', {count: candidates.length})})
}

/** 通过供应商级模型列表端点拉取模型（多协议共用一个接口） */
async function fetchModels(key: ProviderKeyConfig) {
  if (!props.provider.protocols.length) {
    toast.add({color: 'warning', title: t('providers.protocolRequired')})
    return
  }
  if (!props.provider.baseUrl.trim()) {
    toast.add({color: 'warning', title: t('providers.baseUrlRequired')})
    return
  }
  if (!key.value.trim()) {
    toast.add({color: 'warning', title: t('providers.fetchModelsNeedKey')})
    return
  }

  fetching[key.id] = true
  try {
    // 模型列表端点是供应商级的（多协议共用）；用第一个协议的鉴权方式请求
    const protocol = props.provider.protocols[0]!
    const models = await fetchProviderModels(
      props.provider.baseUrl.trim(),
      protocol,
      props.provider.modelsEndpoint.trim(),
      key.value.trim()
    )

    if (!models.length) {
      toast.add({color: 'warning', title: t('providers.fetchModelsEmpty')})
      return
    }

    key.fetchedModels = models
    // 已确认可用的模型若不在新列表中则移除
    key.enabledModels = key.enabledModels.filter(m => models.includes(m))
    toast.add({color: 'success', title: t('providers.modelsFetched', {count: models.length})})
  } catch (err) {
    // 优先展示后端/上游返回的结构化错误信息（{error: string}），否则回退到异常 message
    const data = (err as {data?: {error?: string}}).data
    toast.add({
      color: 'error',
      title: t('providers.fetchModelsFailed'),
      description: data?.error ?? (err instanceof Error ? err.message : String(err))
    })
  } finally {
    delete fetching[key.id]
  }
}
</script>

<template>
  <div class="space-y-4">
    <template v-if="props.provider.keys.length">
      <UCard v-for="key in props.provider.keys" :key="key.id" :ui="{ body: 'p-0 sm:p-0' }">
        <!-- 折叠头部：掩码 + 有效期/过期徽章 + 模型计数 + 展开箭头；操作按钮阻止冒泡 -->
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-3 text-start"
          @click="expanded[key.id] = !expanded[key.id]"
        >
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 shrink-0 text-muted transition-transform"
            :class="expanded[key.id] ? 'rotate-180' : ''"
          />
          <UIcon name="i-lucide-key-round" class="size-4 shrink-0 text-muted"/>
          <span v-if="key.name" class="shrink-0 text-sm font-medium text-highlighted">{{ key.name }}</span>
          <span class="min-w-0 flex-1 truncate font-mono text-sm text-highlighted">{{ keyMask(key.value) }}</span>
          <UBadge v-if="isExpired(key)" variant="subtle" color="error">
            {{ t('providers.keyExpired') }}
          </UBadge>
          <UBadge v-else-if="key.expiresAt" variant="subtle" color="neutral">
            {{ t('providers.keyExpiresAtBadge', {date: key.expiresAt}) }}
          </UBadge>
          <UBadge v-if="key.enabledModels.length" color="neutral" variant="subtle">
            {{ t('providers.enabledModelCount', {count: key.enabledModels.length}) }}
          </UBadge>
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            :aria-label="t('providers.edit')"
            @click.stop="openEdit(key)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            :aria-label="t('providers.removeKey')"
            @click.stop="removeKey(key)"
          />
        </button>

        <!-- 展开内容：仅模型配置（名称/值/有效期通过编辑弹窗修改） -->
        <div v-if="expanded[key.id]" class="space-y-3 border-t border-default px-4 py-4">
          <!-- 操作行：手动添加模型 + 获取模型 -->
          <div class="flex items-center gap-2">
            <UInput
              v-model="manualInputs[key.id]"
              :placeholder="t('providers.manualModelPlaceholder')"
              class="min-w-0 flex-1"
              @keydown.enter.prevent="addManualModel(key)"
            />
            <UButton
              icon="i-lucide-plus"
              variant="outline"
              color="neutral"
              :disabled="!(manualInputs[key.id] ?? '').trim()"
              @click="addManualModel(key)"
            >
              {{ t('providers.manualModelAdd') }}
            </UButton>
            <UButton
              icon="i-lucide-refresh-cw"
              variant="outline"
              color="neutral"
              :loading="fetching[key.id]"
              :disabled="fetchDisabled"
              @click="fetchModels(key)"
            >
              {{ t('providers.fetchModels') }}
            </UButton>
          </div>
          <!-- 拉取禁用原因说明 -->
          <p v-if="fetchDisabled" class="text-xs text-dimmed">
            {{ t('providers.fetchModelsNeedSetup') }}
          </p>

          <!-- 模型列表：滑块开关控制该密钥可用哪些模型 -->
          <div v-if="key.fetchedModels.length" class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="text-xs font-medium text-muted">{{ t('providers.availableModels') }}</div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-dimmed">{{
                    t('providers.enabledModelCount', {count: key.enabledModels.length})
                  }} / {{ key.fetchedModels.length }}</span>
                <UButton
                  v-if="unconfiguredCount"
                  icon="i-lucide-list-plus"
                  variant="ghost"
                  color="neutral"
                  @click="generateModelConfigs"
                >
                  {{ t('providers.generateModelConfigs') }}
                </UButton>
              </div>
            </div>
            <div class="max-h-64 divide-y divide-default overflow-y-auto rounded-lg border border-default">
              <div
                v-for="m in key.fetchedModels"
                :key="m"
                class="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span class="min-w-0 flex-1 truncate font-mono text-sm">{{ m }}</span>
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    icon="i-lucide-settings-2"
                    variant="ghost"
                    color="neutral"
                    :aria-label="t('providers.configureModel')"
                    @click="openModelConfig(m)"
                  />
                  <USwitch
                    :model-value="key.enabledModels.includes(m)"
                    @update:model-value="on => toggleModel(key, m, !!on)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <UButton
        icon="i-lucide-plus"
        variant="outline"
        color="neutral"
        @click="openCreate"
      >
        {{ t('providers.addKey') }}
      </UButton>
    </template>

    <!-- 空态：与其他页面统一 UEmpty -->
    <div v-else class="flex flex-col items-center justify-center gap-4 py-16">
      <UEmpty
        :title="t('providers.keysEmpty')"
        :description="t('providers.keysHint')"
        icon="i-lucide-key-round"
        variant="naked"
      />
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        {{ t('providers.addKey') }}
      </UButton>
    </div>

    <!-- 新增/编辑密钥弹窗 -->
    <ProviderKeyCreateModal
      v-model:open="editOpen"
      :edit-key="editingKey"
      @close="onKeySaved"
    />

    <!-- 单个模型的配置弹窗：已配置则编辑，未配置按默认值新建 -->
    <ProviderModelEditModal
      v-model:open="modelEditOpen"
      :provider="provider"
      :model-id="configModelId"
    />
  </div>
</template>
