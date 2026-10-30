<script setup lang="ts">
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import type { SModel, SModelInput, SRemoteModelItem, SRemoteModelKeyFetch } from '@ai-gate/shared'
import { computed, ref, watch } from 'vue'
import {
  PhArrowsClockwise,
  PhCaretDown,
  PhDownloadSimple,
  PhFloppyDisk,
  PhKey,
  PhMagnifyingGlass,
  PhWarning,
  PhX,
} from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { ApiError } from '@/lib/api'
import { useProvidersStore } from '@/stores/providers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import AppEmpty from '@/components/AppEmpty.vue'
import AppLoading from '@/components/AppLoading.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/**
 * 从供应商模型列表端点获取模型：获取方式在弹窗内选择——
 * 密钥以可切换卡片勾选（默认全选）；模型行标注支持它的密钥数量（悬停看明细），
 * 保存时随导入写入密钥-模型绑定，未入库前不产生任何持久化
 */
const props = defineProps<{
  providerId: number
  existingModels?: SModel[]
}>()

const emit = defineEmits<{saved: [count: number]}>()

const open = defineModel<boolean>('open', {default: false})

const store = useProvidersStore()

const loading = ref(false)
const importing = ref(false)
/** 后端返回的错误码（MISSING_BASE_ENDPOINT 等），空表示无错误 */
const errorCode = ref<string | null>(null)
/** 本次拉取使用的密钥 id 集合：全部选中即等价于「获取所有」 */
const selectedKeyIds = ref<number[]>([])
/** 逐密钥拉取结果（含失败条目） */
const keyResults = ref<SRemoteModelKeyFetch[]>([])
/** 是否已执行过至少一次获取：决定结果区展示还是引导提示 */
const fetched = ref(false)
const selected = ref<Set<string>>(new Set())
const filter = ref('')
const resultsBody = ref<InstanceType<typeof DialogBody> | null>(null)

watch(filter, () => {
  resultsBody.value?.viewport?.scrollTo({ top: 0 })
}, { flush: 'post' })

const activeKeys = computed(() => store.keys.filter(k => k.enabled && k.status === 'ACTIVE'))
const okResults = computed(() => keyResults.value.filter(r => r.ok))
const failedResults = computed(() => keyResults.value.filter(r => !r.ok))
/** 拉取成功的密钥多于一把时，逐模型标注支持它的密钥 */
const multiKey = computed(() => okResults.value.length > 1)

const existingCodes = computed(() => new Set((props.existingModels ?? []).map(m => m.code)))

interface MergedItem extends SRemoteModelItem {
  /** 报告该模型可用的密钥 id（按拉取顺序去重） */
  keyIds: number[]
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
      } else {
        if (!entry.name && m.name) entry.name = m.name
        if (!entry.type && m.type) entry.type = m.type
      }
      entry.keyIds.push(r.keyId)
    }
  }
  return order.map(code => map.get(code)!)
})

const keyNameById = computed(() => new Map(store.keys.map(k => [k.id, k.name])))

/** 下拉框摘要文案：全部选中显示「全部密钥 (N)」，否则显示已选数量；悬停展示明细 */
const keySelectSummary = computed(() => {
  if (!selectedKeyIds.value.length) return t('importModels.selectKey')
  if (selectedKeyIds.value.length === activeKeys.value.length) {
    return activeKeys.value.length > 1
      ? t('importModels.allKeysCount', { count: selectedKeyIds.value.length })
      : t('importModels.allKeys')
  }
  return t('importModels.selectedKeys', { count: selectedKeyIds.value.length })
})

const keySelectSummaryTitle = computed(() =>
  selectedKeyIds.value.map(id => keyNameById.value.get(id) ?? String(id)).join('、'),
)

function toggleSelectAllKeys() {
  if (selectedKeyIds.value.length === activeKeys.value.length) {
    selectedKeyIds.value = []
  } else {
    selectedKeyIds.value = activeKeys.value.map(k => k.id)
  }
}

function toggleKey(id: number) {
  const next = [...selectedKeyIds.value]
  const idx = next.indexOf(id)
  if (idx >= 0) {
    next.splice(idx, 1)
  } else {
    next.push(id)
  }
  selectedKeyIds.value = next
}

const filteredItems = computed(() => {
  const kw = filter.value.trim().toLowerCase()
  if (!kw) return mergedItems.value
  return mergedItems.value.filter(i => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw))
})

/** 当前过滤结果中可导入（未存在）的条目 */
const importableItems = computed(() => filteredItems.value.filter(i => !existingCodes.value.has(i.code)))
const selectedCount = computed(() => importableItems.value.filter(i => selected.value.has(i.code)).length)
const allVisibleSelected = computed(() =>
  importableItems.value.length > 0 && importableItems.value.every(i => selected.value.has(i.code)),
)

/** 未勾选任何密钥时无法拉取 */
const refetchDisabled = computed(() => !selectedKeyIds.value.length)

const loadButtonLabels = computed(() => ({
  load: t('common.load'),
  refresh: t('common.refresh'),
  retry: t('common.retry'),
}))

const loadButtonAction = computed(() => {
  if (errorCode.value) return 'retry'
  return fetched.value ? 'refresh' : 'load'
})
// 请求开始前记录动作，避免清除错误或更新结果时改变按钮文案。
const pendingLoadAction = ref<keyof typeof loadButtonLabels.value>('load')
const loadButtonText = computed(() =>
  loadButtonLabels.value[loading.value ? pendingLoadAction.value : loadButtonAction.value],
)

async function load() {
  if (refetchDisabled.value || loading.value) return
  pendingLoadAction.value = loadButtonAction.value
  loading.value = true
  errorCode.value = null
  keyResults.value = []
  selected.value = new Set()
  filter.value = ''
  try {
    const keyIds = activeKeys.value.filter(k => selectedKeyIds.value.includes(k.id)).map(k => k.id)
    keyResults.value = await store.fetchRemoteModels(props.providerId, keyIds)
    fetched.value = true
    for (const it of mergedItems.value) {
      if (!existingCodes.value.has(it.code)) selected.value.add(it.code)
    }
  } catch (err) {
    console.warn('[ai-gate] 获取上游模型列表失败', err)
    errorCode.value = err instanceof ApiError ? err.code : 'FETCH_FAILED'
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
      return t('errors.missingBaseEndpoint')
    case 'MISSING_MODELS_ENDPOINT':
      return t('errors.missingModelsEndpoint')
    case 'NO_ACTIVE_KEYS':
      return t('errors.noActiveKeys')
    case 'UPSTREAM_UNREACHABLE':
      return t('errors.upstreamUnreachable')
    case 'UPSTREAM_ERROR':
      return t('errors.upstreamError')
    case 'UPSTREAM_INVALID_RESPONSE':
      return t('errors.upstreamInvalidResponse')
    default:
      return t('errors.fetchModelsFailed')
  }
})

/** 单把密钥拉取失败的就近文案 */
function keyFetchErrorText(r: SRemoteModelKeyFetch): string {
  switch (r.error) {
    case 'KEY_INACTIVE':
      return t('errors.keyInactive')
    case 'UPSTREAM_TIMEOUT':
      return t('errors.upstreamTimeout')
    case 'UPSTREAM_UNREACHABLE':
      return t('errors.upstreamUnreachable')
    case 'UPSTREAM_INVALID_RESPONSE':
      return t('errors.upstreamInvalidResponse')
    case 'UPSTREAM_ERROR':
      return r.detail ? t('errors.upstreamErrorDetail', { detail: r.detail }) : t('errors.upstreamError')
    default:
      return t('errors.fetchModelsFailed')
  }
}

async function importSelected() {
  if (!selectedCount.value || importing.value) return
  importing.value = true
  // 待导入 = 勾选的新模型 + 拉取到的已存在模型（后者仅用于补全密钥关系，不会重复插入）
  const inputs: SModelInput[] = [
    ...importableItems.value
      .filter(i => selected.value.has(i.code))
      .map(i => ({code: i.code, name: i.name, type: i.type ?? 'TEXT'})),
    ...mergedItems.value
      .filter(i => existingCodes.value.has(i.code))
      .map(i => ({code: i.code, name: i.name, type: i.type ?? 'TEXT'})),
  ]
  // 绑定 = 每把成功密钥 × 其报告的模型（保守原则：只记录已验证事实，未拉取密钥不建绑定）
  const bindings = okResults.value.map(r => ({
    keyId: r.keyId,
    codes: r.models.map(m => m.code),
  }))
  try {
    const {imported, bindings: bindingCount} = await store.importModels(props.providerId, inputs, bindings)
    toast.success(bindingCount > 0
      ? t('importModels.importedWithBindings', { count: imported, bindings: bindingCount })
      : t('importModels.imported', { count: imported }))
    open.value = false
    emit('saved', imported)
  } catch (err) {
    console.warn('[ai-gate] 导入模型失败', err)
    toast.error(apiErrorMessage(err))
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="v => open = v"
  >
    <!-- 为模型选择预留稳定空间；矮屏下仍遵循 DialogContent 的视口高度上限。 -->
    <DialogContent class="min-h-[min(384px,calc(100dvh-2rem))] sm:min-h-[min(384px,calc(100dvh-4rem))] sm:max-w-md">
      <DialogHeader class="shrink-0">
        <DialogTitle>{{ t('importModels.title') }}</DialogTitle>
      </DialogHeader>

      <!-- 工具栏：密钥下拉多选 + 获取按钮，任何状态下常驻 -->
      <div class="flex shrink-0 items-center gap-2">
        <Popover v-if="activeKeys.length">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              role="combobox"
              class="h-8 min-w-0 flex-1 justify-between px-2.5 text-xs font-normal select-none"
              :aria-label="keySelectSummary"
            >
              <div class="flex min-w-0 items-center gap-2 truncate">
                <PhKey class="text-muted-foreground size-3.5 shrink-0" />
                <span
                  class="truncate text-xs"
                  :title="keySelectSummaryTitle"
                >
                  {{ keySelectSummary }}
                </span>
              </div>
              <PhCaretDown class="text-muted-foreground size-3.5 shrink-0 opacity-70" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            class="w-64 p-1 text-xs"
            align="start"
          >
            <div
              v-if="activeKeys.length > 1"
              class="flex items-center justify-between border-b px-2 py-1.5 text-xs select-none"
            >
              <span class="text-muted-foreground">{{ t('importModels.chooseKeys') }}</span>
              <button
                type="button"
                class="text-primary hover:underline cursor-pointer"
                @click.stop="toggleSelectAllKeys"
              >
                {{ selectedKeyIds.length === activeKeys.length ? t('common.deselectAll') : t('common.selectAll') }}
              </button>
            </div>
            <ScrollArea type="auto" class="max-h-56" :viewport-label="t('importModels.chooseKeys')">
              <div class="flex flex-col py-0.5 pr-3">
                <div
                  v-for="k in activeKeys"
                  :key="k.id"
                  class="hover:bg-accent hover:text-accent-foreground flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs select-none transition-colors"
                  @click="toggleKey(k.id)"
                >
                  <Checkbox
                    :model-value="selectedKeyIds.includes(k.id)"
                    class="pointer-events-none"
                  />
                  <span
                    class="truncate flex-1 text-xs"
                    :title="k.name"
                  >
                    {{ k.name }}
                  </span>
                </div>
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <span
          v-else
          class="text-muted-foreground min-w-0 flex-1 text-xs"
        >{{ t('errors.noActiveKeys') }}</span>

        <Button
          variant="outline"
          class="shrink-0"
          :disabled="refetchDisabled || loading"
          :aria-busy="loading"
          @click="load"
        >
          <Spinner
            v-if="loading"
            data-icon="inline-start"
          />
          <PhArrowsClockwise
            v-else-if="errorCode || fetched"
            data-icon="inline-start"
          />
          <PhDownloadSimple
            v-else
            data-icon="inline-start"
          />
          <span class="inline-grid place-items-center">
            <!-- 所有状态文案共用一个网格单元，按最长文案预留宽度。 -->
            <span
              v-for="(label, state) in loadButtonLabels"
              :key="state"
              class="invisible col-start-1 row-start-1"
              aria-hidden="true"
            >{{ label }}</span>
            <span class="col-start-1 row-start-1">{{ loadButtonText }}</span>
          </span>
        </Button>
      </div>

      <!-- 少量结果保持初始高度，长列表自然增高，达到上限后在列表内滚动。 -->
      <!-- 搜索与选择统计固定，状态与结果共用唯一的滚动区域。 -->
      <div v-if="!loading && !errorCode && fetched && mergedItems.length" class="flex shrink-0 flex-col gap-2">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <PhMagnifyingGlass />
          </InputGroupAddon>
          <InputGroupInput
            v-model="filter"
            :placeholder="t('importModels.searchPlaceholder')"
          />
        </InputGroup>

        <div class="flex items-center justify-between gap-2">
          <label class="flex cursor-pointer items-center gap-1.5 text-xs select-none">
            <Checkbox
              :model-value="allVisibleSelected"
              @update:model-value="toggleAll"
            />
            {{ t('common.selectAll') }}
          </label>
          <span class="text-muted-foreground text-xs">{{ t('importModels.selectedCount', { count: selectedCount }) }}</span>
        </div>
      </div>

      <!-- 显式传递 flex 高度，避免内层 min-height: 100% 在自适应弹窗内无法撑满。 -->
      <DialogBody
        ref="resultsBody"
        class="flex-auto [&>[data-slot=scroll-area-viewport]]:flex [&>[data-slot=scroll-area-viewport]]:flex-col [&>[data-slot=scroll-area-viewport]>div]:flex-1"
        content-class="flex w-full flex-col gap-2"
        :aria-label="t('importModels.title')"
      >
        <!-- 引导和加载共用全宽居中容器，避免状态切换时对齐位置变化。 -->
        <div
          v-if="loading || (!errorCode && !fetched)"
          class="flex w-full flex-1 items-center justify-center"
        >
          <AppLoading v-if="loading" class="w-full" />
          <AppEmpty v-else :title="t('importModels.loadHint')" />
        </div>

        <!-- 拉取失败：错误文案 + 重试入口 -->
        <div
          v-else-if="errorCode"
          class="flex flex-1 flex-col items-center justify-center gap-3"
        >
          <AppEmpty :title="errorMessage" />
          <Button
            variant="outline"
            @click="load"
          >
            <PhArrowsClockwise data-icon="inline-start" />
            {{ t('common.retry') }}
          </Button>
        </div>

        <template v-else>
          <!-- 部分密钥拉取失败：逐把就近提示，不阻塞其余结果 -->
          <div
            v-if="failedResults.length"
            class="flex shrink-0 flex-col gap-1"
          >
            <div
              v-for="r in failedResults"
              :key="r.keyId"
              class="text-warning flex items-center gap-1.5 text-xs"
            >
              <PhWarning class="size-3.5 shrink-0" />
              <span class="truncate">{{ r.keyName || r.keyId }}：{{ keyFetchErrorText(r) }}</span>
            </div>
          </div>

          <!-- 有失败密钥时由上方明细说明原因，不再叠加「列表为空」 -->
          <div
            v-if="!mergedItems.length && !failedResults.length"
            class="flex flex-1 items-center justify-center"
          >
            <AppEmpty :title="t('importModels.emptyList')" />
          </div>

          <template v-else-if="mergedItems.length">
            <div class="flex flex-col gap-1.5">
              <label
                v-for="item in filteredItems"
                :key="item.code"
                class="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 border px-2.5 py-1.5 transition-colors select-none"
                :class="[
                  existingCodes.has(item.code) ? 'opacity-60' : '',
                  !existingCodes.has(item.code) && selected.has(item.code) ? 'border-primary/40 bg-primary/5' : '',
                ]"
              >
                <Checkbox
                  :model-value="selected.has(item.code)"
                  :disabled="existingCodes.has(item.code)"
                  @update:model-value="() => toggleItem(item.code)"
                />
                <span class="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    class="min-w-0 flex-1 truncate text-xs font-medium"
                    :title="item.code"
                  >{{ item.code }}</span>
                  <Badge
                    v-if="existingCodes.has(item.code)"
                    variant="secondary"
                    class="shrink-0"
                  >
                    {{ t('importModels.exists') }}
                  </Badge>
                  <!-- 多密钥拉取时标注该模型被哪些密钥支持：计数 + 悬停明细 -->
                  <span
                    v-if="multiKey"
                    class="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs"
                    :title="item.keyIds.map(id => keyNameById.get(id) || id).join('、')"
                  >
                    <span
                      v-if="item.name && item.name !== item.code"
                      class="max-w-48 min-w-0 truncate"
                    >{{ item.name }}</span>
                    <span class="text-muted-foreground/70 shrink-0">{{ t('importModels.availableKeys', { count: item.keyIds.length }) }}</span>
                  </span>
                  <span
                    v-else-if="item.name && item.name !== item.code"
                    class="text-muted-foreground min-w-0 shrink truncate text-xs"
                  >
                    {{ item.name }}
                  </span>
                </span>
              </label>

              <!-- 搜索无结果 -->
              <div
                v-if="!filteredItems.length"
                class="flex min-h-24 items-center justify-center"
              >
                <AppEmpty :title="t('importModels.noMatches')" />
              </div>
            </div>
          </template>
        </template>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="importing"
          @click="open = false"
        >
          <PhX data-icon="inline-start" aria-hidden="true" />
          {{ t('common.cancel') }}
        </Button>
        <Button
          :disabled="!selectedCount || importing"
          :aria-busy="importing"
          @click="importSelected"
        >
          <Spinner v-if="importing" data-icon="inline-start" />
          <PhFloppyDisk
            v-else
            data-icon="inline-start"
          />
          {{ t('common.import') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
