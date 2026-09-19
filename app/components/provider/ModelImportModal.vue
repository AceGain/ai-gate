<script setup lang="ts">
import type {RemoteModelItem, RemoteModelKeyFetch, SysModel, SysModelInput} from '~/utils/providers'

/**
 * 从供应商模型列表端点获取模型：获取方式在弹窗内选择——
 * 「获取所有」遍历全部可用密钥；「按需获取」勾选密钥后按需拉取。
 * 模型行标注支持它的密钥数量（悬停看明细），保存时随导入写入密钥-模型绑定，
 * 未入库前不产生任何持久化
 */
const props = defineProps<{
  providerId: string
  existingModels?: SysModel[]
}>()

const emit = defineEmits<{saved: [count: number]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {keys, fetchRemoteModels, importModels} = useProviderConfig()

const loading = ref(false)
const importing = ref(false)
/** 后端返回的错误码（MISSING_BASE_ENDPOINT 等），空表示无错误 */
const errorCode = ref<string | null>(null)
/** 本次拉取使用的密钥 id 集合：全部选中即等价于「获取所有」 */
const selectedKeyIds = ref<string[]>([])
/** 逐密钥拉取结果（含失败条目） */
const keyResults = ref<RemoteModelKeyFetch[]>([])
/** 是否已执行过至少一次获取：决定结果区展示还是引导提示 */
const fetched = ref(false)
const selected = ref<Set<string>>(new Set())
const filter = ref('')

const activeKeys = computed(() => keys.value.filter(k => k.enabled && k.status === 'ACTIVE'))
const okResults = computed(() => keyResults.value.filter(r => r.ok))
const failedResults = computed(() => keyResults.value.filter(r => !r.ok))
/** 拉取成功的密钥多于一把时，逐模型标注支持它的密钥 */
const multiKey = computed(() => okResults.value.length > 1)

const existingCodes = computed(() => new Set((props.existingModels ?? []).map(m => m.code)))

interface MergedItem extends RemoteModelItem {
  /** 报告该模型可用的密钥 id（按拉取顺序去重） */
  keyIds: string[]
}

/** 合并各成功密钥的列表：按 code 取并集（保持首现顺序），聚合来源密钥与首个非空显示名 */
const mergedItems = computed<MergedItem[]>(() => {
  const order: string[] = []
  const map = new Map<string, MergedItem>()
  for (const r of okResults.value) {
    for (const m of r.models) {
      let entry = map.get(m.code)
      if (!entry) {
        entry = {...m, keyIds: []}
        map.set(m.code, entry)
        order.push(m.code)
      } else if (!entry.name && m.name) {
        entry.name = m.name
      }
      entry.keyIds.push(r.keyId)
    }
  }
  return order.map(code => map.get(code)!)
})

const keyNameById = computed(() => new Map(keys.value.map(k => [k.id, k.name])))

/** 按需获取下拉框选项 */
const keySelectItems = computed(() => activeKeys.value.map(k => ({label: k.name, value: k.id})))

/** 下拉框摘要文案：全部选中显示「全部密钥」，否则显示已选数量；悬停展示明细 */
const keySelectSummary = computed(() => {
  if (!selectedKeyIds.value.length) return t('providerModels.fetchSelectKeys')
  if (selectedKeyIds.value.length === activeKeys.value.length) {
    return t('providerModels.fetchAllKeysSelected', {count: selectedKeyIds.value.length})
  }
  return t('providerModels.fetchKeysSelected', {count: selectedKeyIds.value.length})
})

const keySelectSummaryTitle = computed(() =>
  selectedKeyIds.value.map(id => keyNameById.value.get(id) ?? id).join('、')
)

const filteredItems = computed(() => {
  const kw = filter.value.trim().toLowerCase()
  if (!kw) return mergedItems.value
  return mergedItems.value.filter(i => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw))
})

/** 当前过滤结果中可导入（未存在）的条目 */
const importableItems = computed(() => filteredItems.value.filter(i => !existingCodes.value.has(i.code)))
const selectedCount = computed(() => importableItems.value.filter(i => selected.value.has(i.code)).length)
const allVisibleSelected = computed(() =>
  importableItems.value.length > 0 && importableItems.value.every(i => selected.value.has(i.code))
)

/** 未勾选任何密钥时无法拉取 */
const refetchDisabled = computed(() => !selectedKeyIds.value.length)

async function load() {
  if (refetchDisabled.value || loading.value) return
  loading.value = true
  errorCode.value = null
  keyResults.value = []
  selected.value = new Set()
  filter.value = ''
  try {
    const keyIds = activeKeys.value.filter(k => selectedKeyIds.value.includes(k.id)).map(k => k.id)
    const results = await fetchRemoteModels(props.providerId, keyIds)
    keyResults.value = results
    fetched.value = true
    for (const it of mergedItems.value) {
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
  if (v) {
    // 打开弹窗不产生任何上游请求：由用户选好密钥后手动点击「获取」
    selectedKeyIds.value = activeKeys.value.map(k => k.id)
    keyResults.value = []
    selected.value = new Set()
    filter.value = ''
    errorCode.value = null
    fetched.value = false
  }
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
    case 'NO_ACTIVE_KEYS':
      return t('providerModels.fetchNoActiveKeys')
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

/** 单把密钥拉取失败的就近文案 */
function keyFetchErrorText(r: RemoteModelKeyFetch): string {
  switch (r.error) {
    case 'KEY_INACTIVE':
      return t('providerModels.errorKeyInactive')
    case 'UPSTREAM_TIMEOUT':
      return t('providerModels.errorUpstreamTimeout')
    case 'UPSTREAM_UNREACHABLE':
      return t('providerModels.errorUnreachable')
    case 'UPSTREAM_INVALID_RESPONSE':
      return t('providerModels.errorInvalidResponse')
    case 'UPSTREAM_ERROR':
      return r.detail
        ? t('providerModels.testFailedDetail', {detail: r.detail})
        : t('providerModels.errorUpstream')
    default:
      return t('providerModels.errorFetchFailed')
  }
}

async function importSelected() {
  if (!selectedCount.value || importing.value) return
  importing.value = true
  // 待导入 = 勾选的新模型 + 拉取到的已存在模型（后者仅用于补全密钥关系，不会重复插入）
  const inputs: SysModelInput[] = [
    ...importableItems.value
      .filter(i => selected.value.has(i.code))
      .map(i => ({code: i.code, name: i.name, type: 'TEXT'} as SysModelInput)),
    ...mergedItems.value
      .filter(i => existingCodes.value.has(i.code))
      .map(i => ({code: i.code, name: i.name, type: 'TEXT'} as SysModelInput))
  ]
  // 绑定 = 每把成功密钥 × 其报告的模型（保守原则：只记录已验证事实，未拉取密钥不建绑定）
  const bindings = okResults.value.map(r => ({
    keyId: r.keyId,
    codes: r.models.map(m => m.code)
  }))
  try {
    const {imported, bindings: bindingCount} = await importModels(props.providerId, inputs, bindings)
    toast.add({
      color: 'success',
      title: bindingCount > 0
        ? t('providerModels.importSuccessWithBindings', {imported, count: bindingCount})
        : t('providerModels.importSuccess', {count: imported})
    })
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
  <!-- body 为 flex 列：列表 flex-1 撑满、超视口时列表内部滚动；header 禁收缩（shrink-0），
       否则主题自带的 min-h 显式高度会豁免 flexbox 的 min-content 保护，内容超高时 header 被压缩，标题与关闭按钮错位 -->
  <UModal
    v-model:open="open"
    :title="t('providerModels.fetchTitle')"
    :dismissible="!importing"
    :ui="{content: 'sm:max-w-md', header: 'shrink-0', body: 'no-scrollbar flex flex-col', footer: 'justify-end'}"
  >
    <template #body>
      <!-- 工具栏：密钥多选 + 获取按钮，任何状态下常驻（拉取时不随结果区一起 loading） -->
      <div class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 pb-2">
        <USelect
          v-model="selectedKeyIds"
          multiple
          :items="keySelectItems"
          icon="i-lucide-key"
          :aria-label="t('providerModels.fetchSelectKeys')"
          :ui="{content: 'min-w-64', value: 'truncate'}"
          class="min-w-0 flex-1"
        >
          <template #default>
            <span class="truncate" :title="keySelectSummaryTitle">{{ keySelectSummary }}</span>
          </template>
        </USelect>
        <UButton
          icon="i-lucide-refresh-cw"
          variant="outline"
          color="neutral"
          class="shrink-0"
          :disabled="refetchDisabled"
          :loading="loading"
          @click="load"
        >
          {{ fetched ? t('providerModels.refetch') : t('providerModels.fetchBtn') }}
        </UButton>
      </div>

      <!-- 结果区：加载 / 错误 / 引导 / 空态 / 模型列表
           min-h-72 兜底：未获取/加载中/模型少时高度恒定；模型多时随内容生长至上限，列表内滚动 -->
      <div class="flex min-h-72 flex-1 flex-col gap-2">
        <!-- 拉取中：仅结果区进入加载态，工具栏保持可见 -->
        <AppLoading v-if="loading" class="min-h-0 flex-1"/>

        <!-- 拉取失败：错误文案 + 重试入口 -->
        <div v-else-if="errorCode" class="flex flex-1 flex-col items-center justify-center gap-3">
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

        <!-- 尚未获取：引导用户点击「获取」 -->
        <div v-else-if="!fetched" class="flex flex-1 items-center justify-center">
          <UEmpty :title="t('providerModels.fetchNotStarted')" variant="naked"/>
        </div>

        <template v-else>
          <!-- 部分密钥拉取失败：逐把就近提示，不阻塞其余结果（可点击「重新获取」重试） -->
          <div v-if="failedResults.length" class="shrink-0 space-y-1">
            <div
              v-for="r in failedResults"
              :key="r.keyId"
              class="flex items-center gap-1.5 text-xs text-warning"
            >
              <UIcon name="i-lucide-alert-triangle" class="size-3.5 shrink-0"/>
              <span class="truncate">{{ r.keyName || r.keyId }}：{{ keyFetchErrorText(r) }}</span>
            </div>
          </div>

          <!-- 有失败密钥时由上方明细说明原因，不再叠加「列表为空」 -->
          <div v-if="!mergedItems.length && !failedResults.length" class="flex flex-1 items-center justify-center">
            <UEmpty :title="t('providerModels.fetchEmpty')" variant="naked"/>
          </div>

          <template v-else-if="mergedItems.length">
            <UInput
              v-model="filter"
              icon="i-lucide-search"
              :placeholder="t('providerModels.searchModelsPlaceholder')"
              class="w-full"
            />

          <div class="flex items-center justify-between gap-2">
            <UCheckbox
              :model-value="allVisibleSelected"
              :label="t('providerModels.importSelectAll')"
              @update:model-value="toggleAll"
            />
            <span class="text-xs text-muted">
              {{ t('providerModels.importSelectedCount', {count: selectedCount}) }}
            </span>
          </div>

          <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pe-0.5">
            <UCheckbox
              v-for="item in filteredItems"
              :key="item.code"
              :model-value="selected.has(item.code)"
              :disabled="existingCodes.has(item.code)"
              variant="card"
              :ui="{
                root: 'cursor-pointer select-none items-center px-2.5 py-1.5',
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
                    class="shrink-0"
                  >
                    {{ t('providerModels.importExists') }}
                  </UBadge>
                </span>
              </template>

              <template #description>
                <!-- 多密钥拉取时标注该模型被哪些密钥支持：计数 + 悬停明细，避免长密钥名挤行 -->
                <span
                  v-if="multiKey"
                  class="flex min-w-0 items-center justify-end gap-1.5"
                  :title="t('providerModels.supportKeys', {keys: item.keyIds.map(id => keyNameById.get(id) || id).join('、')})"
                >
                  <span
                    v-if="item.name && item.name !== item.code"
                    class="max-w-48 min-w-0 truncate"
                  >{{ item.name }}</span>
                  <span class="shrink-0 text-xs text-dimmed">
                    {{ t('providerModels.supportCount', {count: item.keyIds.length}) }}
                  </span>
                </span>
                <span v-else-if="item.name && item.name !== item.code" class="min-w-0 truncate">
                  {{ item.name }}
                </span>
              </template>
            </UCheckbox>

            <!-- 搜索无结果 -->
            <div v-if="!filteredItems.length" class="flex min-h-24 items-center justify-center">
              <UEmpty :title="t('providerModels.searchEmpty')" variant="naked"/>
            </div>
          </div>
          </template>
        </template>
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
