<script setup lang="ts">
import type {RemoteModelItem, SysModel, SysModelInput} from '~/utils/providers'

/**
 * 从供应商模型列表端点获取模型：打开后自动拉取上游 /models 列表，
 * 勾选需要的模型后批量导入（已存在的编码置灰且不可选）
 */
const props = defineProps<{
  providerId: string
  existingModels?: SysModel[]
}>()

const emit = defineEmits<{saved: [count: number]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {fetchRemoteModels, importModels} = useProviderConfig()

const loading = ref(false)
const importing = ref(false)
/** 后端返回的错误码（MISSING_BASE_ENDPOINT 等），空表示无错误 */
const errorCode = ref<string | null>(null)
const items = ref<RemoteModelItem[]>([])
const selected = ref<Set<string>>(new Set())
const filter = ref('')

const existingCodes = computed(() => new Set((props.existingModels ?? []).map(m => m.code)))

const filteredItems = computed(() => {
  const kw = filter.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter(i => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw))
})

/** 当前过滤结果中可导入（未存在）的条目 */
const importableItems = computed(() => filteredItems.value.filter(i => !existingCodes.value.has(i.code)))
const selectedCount = computed(() => importableItems.value.filter(i => selected.value.has(i.code)).length)
const allVisibleSelected = computed(() =>
  importableItems.value.length > 0 && importableItems.value.every(i => selected.value.has(i.code))
)

async function load() {
  loading.value = true
  errorCode.value = null
  items.value = []
  selected.value = new Set()
  filter.value = ''
  try {
    const list = await fetchRemoteModels(props.providerId)
    items.value = list
    for (const it of list) {
      if (!existingCodes.value.has(it.code)) selected.value.add(it.code)
    }
  } catch (err) {
    console.warn('[ai-gate] 获取上游模型列表失败', err)
    errorCode.value = (err as {data?: {error?: string}}).data?.error ?? 'FETCH_FAILED'
  } finally {
    loading.value = false
  }
}

watch(open, (v) => {
  if (v) void load()
})

function toggleItem(code: string) {
  const next = new Set(selected.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  selected.value = next
}

function toggleAll() {
  const next = new Set(selected.value)
  if (allVisibleSelected.value) {
    for (const i of importableItems.value) next.delete(i.code)
  } else {
    for (const i of importableItems.value) next.add(i.code)
  }
  selected.value = next
}

const errorMessage = computed(() => {
  switch (errorCode.value) {
    case 'MISSING_BASE_ENDPOINT':
      return t('providerModels.errorMissingBase')
    case 'MISSING_MODELS_ENDPOINT':
      return t('providerModels.errorMissingModelsEndpoint')
    case 'UPSTREAM_UNREACHABLE':
      return t('providerModels.errorUnreachable')
    case 'UPSTREAM_ERROR':
      return t('providerModels.errorUpstream')
    case 'UPSTREAM_INVALID_RESPONSE':
      return t('providerModels.errorInvalidResponse')
    default:
      return t('providerModels.errorFetchFailed')
  }
})

async function importSelected() {
  if (!selectedCount.value || importing.value) return
  importing.value = true
  const inputs: SysModelInput[] = importableItems.value
    .filter(i => selected.value.has(i.code))
    .map(i => ({code: i.code, name: i.name, type: 'GenText'}))
  try {
    const {imported} = await importModels(props.providerId, inputs)
    toast.add({color: 'success', title: t('providerModels.importSuccess', {count: imported})})
    open.value = false
    emit('saved', imported)
  } catch (err) {
    console.warn('[ai-gate] 导入模型失败', err)
    toast.add({color: 'error', title: t('providers.backendUnavailable')})
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('providerModels.fetchTitle')"
    :ui="{content: 'sm:max-w-md', body: 'no-scrollbar', footer: 'justify-end'}"
  >
    <template #body>
      <!-- 加载骨架：与条目行同构，避免加载完成跳动 -->
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 5" :key="i" class="flex items-center gap-2.5">
          <USkeleton class="size-4.5 rounded-sm"/>
          <div class="flex-1 space-y-1.5">
            <USkeleton class="h-3.5 w-40 rounded-sm"/>
            <USkeleton class="h-3 w-24 rounded-sm"/>
          </div>
        </div>
      </div>

      <!-- 拉取失败：错误文案 + 重试入口 -->
      <div v-else-if="errorCode" class="flex flex-col items-center justify-center gap-3 py-10">
        <UEmpty :title="errorMessage" variant="naked"/>
        <UButton
          icon="i-lucide-refresh-cw"
          variant="outline"
          color="neutral"
          @click="load"
        >
          {{ t('common.retry') }}
        </UButton>
      </div>

      <!-- 上游列表为空 -->
      <div v-else-if="!items.length" class="flex min-h-40 items-center justify-center">
        <UEmpty :title="t('providerModels.fetchEmpty')" variant="naked"/>
      </div>

      <!-- 模型勾选列表：搜索 + 全选 + 滚动列表 -->
      <div v-else class="space-y-2">
        <UInput
          v-model="filter"
          icon="i-lucide-search"
          :placeholder="t('providerModels.searchModelsPlaceholder')"
          class="w-full"
        />

        <div class="flex items-center justify-between gap-2 rounded-sm px-2.5 py-1">
          <UCheckbox
            :model-value="allVisibleSelected"
            :label="t('providerModels.importSelectAll')"
            @update:model-value="toggleAll"
          />
          <span class="text-xs text-muted">
            {{ t('providerModels.importSelectedCount', {count: selectedCount}) }}
          </span>
        </div>

        <div class="max-h-72 space-y-1.5 overflow-y-auto pe-0.5">
          <UCheckbox
            v-for="item in filteredItems"
            :key="item.code"
            :model-value="selected.has(item.code)"
            :disabled="existingCodes.has(item.code)"
            variant="card"
            :ui="{
              root: 'cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5',
              wrapper: 'flex flex-row items-center gap-2 min-w-0 flex-1',
              label: 'text-xs font-medium min-w-0 flex-1 truncate',
              description: 'text-xs text-muted truncate'
            }"
            @update:model-value="() => toggleItem(item.code)"
          >
            <template #label>
              <span
                class="flex min-w-0 items-center gap-2"
                :class="existingCodes.has(item.code) ? 'text-dimmed' : selected.has(item.code) ? 'text-highlighted' : 'text-default'"
              >
                <span class="truncate" :title="item.code">{{ item.code }}</span>
                <UBadge
                  v-if="existingCodes.has(item.code)"
                  color="neutral"
                  variant="subtle"
                  class="shrink-0 rounded-sm"
                >
                  {{ t('providerModels.importExists') }}
                </UBadge>
              </span>
            </template>

            <template #description>
              <span v-if="item.name && item.name !== item.code" class="truncate">{{ item.name }}</span>
            </template>
          </UCheckbox>

          <!-- 搜索无结果 -->
          <div v-if="!filteredItems.length" class="flex min-h-24 items-center justify-center">
            <UEmpty :title="t('common.empty')" variant="naked"/>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" :disabled="importing" @click="open = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        icon="i-lucide-download"
        :loading="importing"
        :disabled="!selectedCount"
        @click="importSelected"
      >
        {{ t('providerModels.importBtn') }}
      </UButton>
    </template>
  </UModal>
</template>
