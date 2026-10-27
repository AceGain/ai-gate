<script setup lang="ts">
import type { SKey, SEndpoint, EndpointType, SModel } from '@ai-gate/shared'
import { GEN_ENDPOINT_TYPES, MODEL_DEFAULT_CATEGORY } from '@ai-gate/shared'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClipboard } from '@vueuse/core'
import { useSortable } from '@vueuse/integrations/useSortable'
import { storeToRefs } from 'pinia'
import {
  PhArrowLeft,
  PhCalendarBlank,
  PhCheck,
  PhCopy,
  PhDotsSixVertical,
  PhDownloadSimple,
  PhEye,
  PhEyeSlash,
  PhKey,
  PhPath,
  PhPencilSimple,
  PhPlus,
  PhPulse,
  PhSparkle,
  PhStar,
  PhTrashSimple,
} from '@phosphor-icons/vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useBreadcrumb } from '@/composables/useBreadcrumb'
import { toast } from 'vue-sonner'
import { ApiError } from '@/lib/api'
import { useProvidersStore } from '@/stores/providers'
import { splitUrl } from '@/utils/url'
import AppEmpty from '@/components/AppEmpty.vue'
import AppLoading from '@/components/AppLoading.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EndpointModal from '@/components/provider/EndpointModal.vue'
import KeyModal from '@/components/provider/KeyModal.vue'
import ModelGroup from '@/components/provider/ModelGroup.vue'
import ModelImportModal from '@/components/provider/ModelImportModal.vue'
import ModelModal from '@/components/provider/ModelModal.vue'
import ProviderIcon from '@/components/provider/ProviderIcon.vue'
import ProviderModal from '@/components/provider/ProviderModal.vue'

const route = useRoute()
const router = useRouter()
const {confirmDialog} = useConfirmDialog()
const {copy} = useClipboard()

const store = useProvidersStore()
const {providers, endpoints, keys, models, configLoading} = storeToRefs(store)

const id = computed(() => Number(route.params.id))
const provider = computed(() => providers.value.find(p => p.id === id.value))

useBreadcrumb(() => [
  { label: '供应商', to: '/providers' },
  { label: provider.value?.name || provider.value?.code || '配置' },
])

const loadingProvider = ref(false)

watch(id, async (newId) => {
  store.resetConfig()
  if (newId && Number.isSafeInteger(newId)) {
    if (!providers.value.some(p => p.id === newId)) {
      loadingProvider.value = true
      try {
        await store.fetchProvider(newId)
      } finally {
        loadingProvider.value = false
      }
    }
    void store.loadAll(newId)
  }
}, {immediate: true})

onBeforeUnmount(() => {
  document.body.classList.remove('provider-sortable-dragging')
  store.resetConfig()
  if (copyTimer) clearTimeout(copyTimer)
})

/* ---------------- 1. 供应商基础信息编辑弹窗 ---------------- */
const editModalOpen = ref(false)

/* ---------------- 2. 端点操作与弹窗 ---------------- */
const endpointModalOpen = ref(false)
const editingEndpoint = ref<SEndpoint | null>(null)
const endpointModalType = ref<EndpointType>('generate')

const baseEndpoint = computed(() => endpoints.value.find(e => e.type === 'base'))
const modelsEndpoint = computed(() => endpoints.value.find(e => e.type === 'models'))
const generateEndpoints = computed(() => endpoints.value.filter(e => e.type === 'generate'))
const isAllGeneratesAdded = computed(() => {
  const addedGenerates = new Set(generateEndpoints.value.map(e => e.generate))
  return GEN_ENDPOINT_TYPES.every(p => addedGenerates.has(p))
})

function openCreateEndpoint() {
  editingEndpoint.value = null
  endpointModalType.value = 'generate'
  endpointModalOpen.value = true
}

function openEditBaseEndpoint() {
  editingEndpoint.value = baseEndpoint.value ?? null
  endpointModalType.value = 'base'
  endpointModalOpen.value = true
}

function openEditModelsEndpoint() {
  editingEndpoint.value = modelsEndpoint.value ?? null
  endpointModalType.value = 'models'
  endpointModalOpen.value = true
}

function openEditEndpoint(ep: SEndpoint) {
  editingEndpoint.value = ep
  endpointModalType.value = ep.type
  endpointModalOpen.value = true
}

async function confirmDeleteEndpoint(ep: SEndpoint) {
  const confirmed = await confirmDialog({
    title: '删除端点',
    description: `确定删除端点「${ep.path}」？`,
  })
  if (confirmed && provider.value) {
    await store.removeEndpoint(provider.value.id, ep.id)
  }
}

async function handleToggleDefault(ep: SEndpoint) {
  if (!provider.value) return
  const nextDefault = !ep.isDefault
  try {
    await store.updateEndpoint(provider.value.id, ep.id, {
      type: ep.type,
      generate: ep.generate,
      path: ep.path,
      isDefault: nextDefault,
    })
    toast.success(nextDefault ? '已设为默认端点' : '已取消默认端点')
  } catch (err) {
    console.warn('[ai-gate] 切换默认端点失败', err)
    toast.error('后端服务不可用')
  }
}

async function handleCopy(text: string) {
  await copy(text)
  toast.success('已复制到剪贴板')
}

/* ---------------- 3. 密钥弹窗与操作 ---------------- */
const keyModalOpen = ref(false)
const editingKey = ref<SKey | null>(null)
const revealedKeys = ref<Set<number>>(new Set())

function toggleReveal(id: number) {
  const next = new Set(revealedKeys.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  revealedKeys.value = next
}

function maskSecret(secret: string): string {
  const dots = '·'.repeat(64)
  if (!secret || secret.length <= 12) return dots
  return `${secret.slice(0, 6)}${dots}${secret.slice(-6)}`
}

const copiedKeyId = ref<number | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function handleCopyKey(k: SKey) {
  await copy(k.secret)
  copiedKeyId.value = k.id
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copiedKeyId.value = null
  }, 2000)
  toast.success('密钥已复制')
}

function isKeyExpired(expireTime: string | null): boolean {
  if (!expireTime) return false
  const trimmed = expireTime.trim()
  if (!trimmed) return false
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59.999` : trimmed
  const timestamp = Date.parse(dateStr)
  if (isNaN(timestamp)) return false
  return timestamp < Date.now()
}

function formatKeyExpiry(expireTime: string | null): string {
  if (!expireTime) return ''
  if (isKeyExpired(expireTime)) {
    return `${expireTime}（已过期）`
  }
  return expireTime
}

function openCreateKey() {
  editingKey.value = null
  keyModalOpen.value = true
}

function openEditKey(k: SKey) {
  editingKey.value = k
  keyModalOpen.value = true
}

async function confirmDeleteKey(k: SKey) {
  const confirmed = await confirmDialog({
    title: '删除密钥',
    description: `确定删除密钥「${k.name}」？`,
  })
  if (confirmed && provider.value) {
    await store.removeKey(provider.value.id, k.id)
  }
}

async function handleToggleKeyEnabled(k: SKey, enabled: boolean) {
  if (!provider.value) return
  await store.updateKey(provider.value.id, k.id, {
    name: k.name,
    secret: k.secret,
    enabled,
    status: k.status,
    expireTime: k.expireTime,
    sort: k.sort,
  })
}

/** 正在测试的密钥 id：单卡粒度的加载态 */
const testingKeyId = ref<number | null>(null)

/** 密钥测试失败文案：按后端错误码就近映射 */
function keyTestErrorMessage(code: string | undefined, detail?: string): string {
  switch (code) {
    case 'MISSING_BASE_ENDPOINT':
      return '请先在「端点」标签页配置 Base URL'
    case 'MISSING_MODELS_ENDPOINT':
      return '请先在「端点」标签页配置模型列表端点'
    case 'UPSTREAM_UNREACHABLE':
      return '无法连接供应商，请检查网络与端点配置'
    case 'UPSTREAM_TIMEOUT':
      return '上游响应超时'
    case 'UPSTREAM_ERROR':
      return detail ? `密钥不可用（${detail}）` : '密钥不可用'
    default:
      return '后端服务不可用'
  }
}

async function runKeyTest(k: SKey) {
  if (!provider.value || testingKeyId.value) return
  testingKeyId.value = k.id
  try {
    const res = await store.testKey(provider.value.id, k.id)
    toast.success(`密钥可用 · ${res.latencyMs}ms`)
  } catch (err) {
    console.warn('[ai-gate] 测试密钥失败', err)
    const apiErr = err instanceof ApiError ? err : undefined
    toast.error(keyTestErrorMessage(apiErr?.code, apiErr?.detail))
  } finally {
    testingKeyId.value = null
  }
}

const keyListEl = ref<HTMLElement | null>(null)

useSortable(keyListEl, keys, {
  handle: '.drag-handle',
  animation: 150,
  forceFallback: true,
  fallbackOnBody: true,
  watchElement: true,
  onStart: () => {
    document.body.classList.add('provider-sortable-dragging')
  },
  onEnd: (evt) => {
    document.body.classList.remove('provider-sortable-dragging')
    if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex || !provider.value) return
    void nextTick(() => store.saveKeyOrder(provider.value!.id))
  },
})

/* ---------------- 4. 模型弹窗与操作 ---------------- */
const modelModalOpen = ref(false)
const editingModel = ref<SModel | null>(null)
const importModalOpen = ref(false)

function openCreateModel() {
  editingModel.value = null
  modelModalOpen.value = true
}

function openImportModels() {
  importModalOpen.value = true
}

function openEditModel(m: SModel) {
  editingModel.value = m
  modelModalOpen.value = true
}

async function confirmDeleteModel(m: SModel) {
  const label = m.name || m.code
  const confirmed = await confirmDialog({
    title: '删除模型',
    description: `确定删除模型「${label}」？`,
  })
  if (confirmed && provider.value) {
    await store.removeModel(provider.value.id, m.id)
  }
}

async function handleToggleModelEnabled(m: SModel, enabled: boolean) {
  if (!provider.value) return
  await store.updateModel(provider.value.id, m.id, {
    code: m.code,
    name: m.name,
    category: m.category,
    enabled,
    status: m.status,
    type: m.type,
    inputModal: m.inputModal,
    outputModal: m.outputModal,
    generates: m.generates,
    maxContext: m.maxContext,
    maxInput: m.maxInput,
    maxOutput: m.maxOutput,
    reasoning: m.reasoning,
    effortLevel: m.effortLevel,
    sort: m.sort,
    remark: m.remark,
  })
}

/* 模型按「模型分组」(category) 分组展示：分组按首现顺序排列（空分组由后端归一为 Default） */
const modelGroups = computed(() => {
  const groups: {key: string, label: string, items: SModel[]}[] = []
  const map = new Map<string, {key: string, label: string, items: SModel[]}>()
  for (const m of models.value) {
    const category = (m.category || '').trim() || MODEL_DEFAULT_CATEGORY
    let group = map.get(category)
    if (!group) {
      group = {key: category, label: category, items: []}
      map.set(category, group)
      groups.push(group)
    }
    group.items.push(m)
  }
  return groups
})

/** 组内拖拽排序：以该组新顺序重建全局列表（其它分组原位不动）并持久化 */
function handleModelGroupReorder(ids: number[]) {
  if (!provider.value) return
  const idSet = new Set(ids)
  const byId = new Map(models.value.map(m => [m.id, m] as const))
  const ordered = ids.map(id => byId.get(id)).filter((m): m is SModel => !!m)
  const firstIndex = models.value.findIndex(m => idSet.has(m.id))
  if (firstIndex < 0 || ordered.length !== idSet.size) return
  const others = models.value.filter(m => !idSet.has(m.id))
  store.models = [...others.slice(0, firstIndex), ...ordered, ...others.slice(firstIndex)]
  void nextTick(() => store.saveModelOrder(provider.value!.id))
}

/* ---------------- 5. Tab 标签页切换 ---------------- */
type TabKey = 'endpoints' | 'keys' | 'models'
const validTabs: TabKey[] = ['endpoints', 'keys', 'models']
const activeTab = ref<string>(
  validTabs.includes(route.query.tab as TabKey) ? (route.query.tab as string) : 'endpoints',
)

watch(activeTab, (tab) => {
  if (route.query.tab !== tab) {
    void router.replace({query: {...route.query, tab}})
  }
})

watch(() => route.query.tab, (tab) => {
  if (tab && validTabs.includes(tab as TabKey) && activeTab.value !== tab) {
    activeTab.value = tab as string
  }
})

/** 全 URL 拆分展示（域名弱化、路径高亮） */
function urlParts(path?: string) {
  return splitUrl(baseEndpoint.value?.path, path)
}
</script>

<template>
  <!-- 详情加载中 -->
  <AppLoading v-if="loadingProvider && !provider" />

  <div
    v-else-if="provider"
    class="mx-auto flex min-w-0 w-full max-w-5xl flex-1 flex-col"
  >
    <!-- 1. 顶部档案区：图标 + 名称/描述 + 返回与启用控制 -->
    <div class="flex shrink-0 items-center justify-between gap-4 pb-4">
      <!-- 左侧：图标 + 名称/编码 + 描述 -->
      <div class="flex min-w-0 items-center gap-3.5">
        <ProviderIcon
          :icon="provider.icon"
          :name="provider.name || provider.code"
          size="lg"
        />
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex items-center gap-1.5">
            <h1
              class="truncate text-sm font-semibold"
              :title="provider.name || provider.code"
            >
              {{ provider.name || provider.code }}
            </h1>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="修改"
              title="修改"
              @click="editModalOpen = true"
            >
              <PhPencilSimple />
            </Button>
          </div>
          <p
            v-if="provider.remark"
            class="text-muted-foreground truncate text-xs"
            :title="provider.remark"
          >
            {{ provider.remark }}
          </p>
        </div>
      </div>

      <!-- 右侧：返回 + 启用状态开关 -->
      <div class="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="返回"
          title="返回"
          @click="router.push('/providers')"
        >
          <PhArrowLeft />
        </Button>
        <div class="bg-muted/40 flex items-center gap-1.5 border px-2 py-1 text-xs">
          <span class="text-muted-foreground">
            {{ provider.enabled ? '启用' : '停用' }}
          </span>
          <Switch
            :model-value="provider.enabled"
            aria-label="切换启用状态"
            @update:model-value="v => store.toggleProvider(provider!, !!v)"
          />
        </div>
      </div>
    </div>

    <!-- 2. Tab 切换与操作栏 -->
    <Tabs
      v-model="activeTab"
      class="flex min-h-0 flex-1 flex-col"
    >
      <div class="flex shrink-0 items-center justify-between gap-2 pb-3">
        <TabsList>
          <TabsTrigger value="endpoints">
            <PhPath data-icon="inline-start" />
            端点
            <span
              v-if="endpoints.length"
              class="text-muted-foreground"
            >{{ endpoints.length }}</span>
          </TabsTrigger>
          <TabsTrigger value="keys">
            <PhKey data-icon="inline-start" />
            密钥
            <span
              v-if="keys.length"
              class="text-muted-foreground"
            >{{ keys.length }}</span>
          </TabsTrigger>
          <TabsTrigger value="models">
            <PhSparkle data-icon="inline-start" />
            模型
            <span
              v-if="models.length"
              class="text-muted-foreground"
            >{{ models.length }}</span>
          </TabsTrigger>
        </TabsList>

        <!-- 右侧操作按钮与 Tab 同行对齐 -->
        <div class="flex items-center">
          <Button
            v-if="activeTab === 'endpoints'"
            variant="ghost"
            :disabled="isAllGeneratesAdded"
            :title="isAllGeneratesAdded ? '已添加所有支持的生成端点' : '新增'"
            @click="openCreateEndpoint"
          >
            <PhPlus data-icon="inline-start" />
            新增
          </Button>
          <Button
            v-else-if="activeTab === 'keys'"
            variant="ghost"
            @click="openCreateKey"
          >
            <PhPlus data-icon="inline-start" />
            新增
          </Button>
          <template v-else-if="activeTab === 'models'">
            <Button
              variant="ghost"
              aria-label="获取模型"
              title="获取模型"
              @click="openImportModels"
            >
              <PhDownloadSimple data-icon="inline-start" />
              <span class="hidden sm:inline">获取模型</span>
            </Button>
            <Button
              variant="ghost"
              @click="openCreateModel"
            >
              <PhPlus data-icon="inline-start" />
              新增
            </Button>
          </template>
        </div>
      </div>

      <!-- 3. 各 Tab 配置内容区域 -->
      <!-- 1) 网络端点 Tab：两行格式（第一行标题，第二行地址） -->
      <TabsContent
        value="endpoints"
        class="min-h-0 flex-1 overflow-y-auto"
      >
        <AppLoading v-if="configLoading && !endpoints.length" />

        <div
          v-else
          class="divide-y"
        >
          <!-- 固定端点 1: Base URL -->
          <div class="group hover:bg-muted/30 flex items-center justify-between gap-4 px-2 py-2.5 transition-colors">
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="text-xs font-semibold">Base URL</span>
              <div class="flex min-w-0 items-center gap-2">
                <code
                  class="text-muted-foreground truncate text-xs select-all"
                  :title="baseEndpoint?.path || '暂无数据'"
                >
                  {{ baseEndpoint?.path || '暂无数据' }}
                </code>
                <Button
                  v-if="baseEndpoint?.path"
                  variant="ghost"
                  size="icon-xs"
                  class="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  title="复制"
                  aria-label="复制"
                  @click="handleCopy(baseEndpoint.path)"
                >
                  <PhCopy />
                </Button>
              </div>
            </div>
            <div class="flex shrink-0 items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-foreground"
                aria-label="修改"
                title="修改"
                @click="openEditBaseEndpoint"
              >
                <PhPencilSimple />
              </Button>
            </div>
          </div>

          <!-- 固定端点 2: Models（全路径展示：域名弱化，路径高亮） -->
          <div class="group hover:bg-muted/30 flex items-center justify-between gap-4 px-2 py-2.5 transition-colors">
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="text-xs font-semibold">Models</span>
              <div class="flex min-w-0 items-center gap-2">
                <code
                  class="truncate text-xs select-all"
                  :title="urlParts(modelsEndpoint?.path).fullUrl || '暂无数据'"
                >
                  <span
                    v-if="urlParts(modelsEndpoint?.path).basePart"
                    class="text-muted-foreground/70"
                  >{{ urlParts(modelsEndpoint?.path).basePart }}</span>
                  <span :class="urlParts(modelsEndpoint?.path).basePart ? 'font-medium' : 'text-muted-foreground'">{{ urlParts(modelsEndpoint?.path).pathPart || '暂无数据' }}</span>
                </code>
                <Button
                  v-if="urlParts(modelsEndpoint?.path).fullUrl"
                  variant="ghost"
                  size="icon-xs"
                  class="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  title="复制"
                  aria-label="复制"
                  @click="handleCopy(urlParts(modelsEndpoint?.path).fullUrl)"
                >
                  <PhCopy />
                </Button>
              </div>
            </div>
            <div class="flex shrink-0 items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-foreground"
                aria-label="修改"
                title="修改"
                @click="openEditModelsEndpoint"
              >
                <PhPencilSimple />
              </Button>
            </div>
          </div>

          <!-- 生成端点列表 -->
          <div
            v-for="ep in generateEndpoints"
            :key="ep.id"
            class="group hover:bg-muted/30 flex items-center justify-between gap-4 px-2 py-2.5 transition-colors"
          >
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <!-- 第一行：标题（端点类型） + 默认徽章 -->
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold">{{ ep.generate }}</span>
                <Badge
                  v-if="ep.isDefault"
                  variant="secondary"
                >
                  默认
                </Badge>
              </div>
              <!-- 第二行：全路径展示 -->
              <div class="flex min-w-0 items-center gap-2">
                <code
                  class="truncate text-xs select-all"
                  :title="urlParts(ep.path).fullUrl"
                >
                  <span
                    v-if="urlParts(ep.path).basePart"
                    class="text-muted-foreground/70"
                  >{{ urlParts(ep.path).basePart }}</span>
                  <span :class="urlParts(ep.path).basePart ? 'font-medium' : ''">{{ urlParts(ep.path).pathPart }}</span>
                </code>
                <Button
                  v-if="urlParts(ep.path).fullUrl"
                  variant="ghost"
                  size="icon-xs"
                  class="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  title="复制"
                  aria-label="复制"
                  @click="handleCopy(urlParts(ep.path).fullUrl)"
                >
                  <PhCopy />
                </Button>
              </div>
            </div>

            <!-- 右侧操作按钮：默认星标 + 修改 + 删除 -->
            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                :class="ep.isDefault ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
                :title="ep.isDefault ? '点击取消默认' : '设为默认'"
                :aria-label="ep.isDefault ? '点击取消默认' : '设为默认'"
                @click="handleToggleDefault(ep)"
              >
                <PhStar :weight="ep.isDefault ? 'fill' : undefined" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-foreground"
                aria-label="修改"
                title="修改"
                @click="openEditEndpoint(ep)"
              >
                <PhPencilSimple />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="删除"
                title="删除"
                @click="confirmDeleteEndpoint(ep)"
              >
                <PhTrashSimple />
              </Button>
            </div>
          </div>

          <!-- 生成端点为空时的极简空态 -->
          <div v-if="!generateEndpoints.length">
            <AppEmpty title="暂无生成端点，点击右上角「新增」添加" />
          </div>
        </div>
      </TabsContent>

      <!-- 2) API 密钥 Tab -->
      <TabsContent
        value="keys"
        class="min-h-0 flex-1 overflow-y-auto"
      >
        <AppLoading v-if="configLoading && !keys.length" />

        <!-- 密钥列表：单层卡片结构 -->
        <div
          v-else-if="keys.length"
          ref="keyListEl"
          class="flex flex-col gap-2"
        >
          <div
            v-for="k in keys"
            :key="k.id"
            class="group hover:border-primary/40 hover:bg-muted/20 flex items-center justify-between gap-4 border px-3 py-2.5 transition-colors"
          >
            <!-- 左侧信息区：拖拽手柄 + 纵向信息流 -->
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <div
                class="drag-handle text-muted-foreground hover:bg-muted hover:text-foreground -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center transition-colors"
                aria-hidden="true"
                title="拖拽排序"
              >
                <PhDotsSixVertical class="size-4" />
              </div>

              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <!-- 第一行：名称 + 状态徽标 + 有效期 -->
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="truncate text-xs font-semibold"
                    :title="k.name"
                  >{{ k.name }}</span>

                  <Badge
                    v-if="k.status !== 'ACTIVE'"
                    variant="destructive"
                  >
                    失效
                  </Badge>

                  <span
                    v-if="k.expireTime"
                    class="inline-flex items-center gap-1 text-xs"
                    :class="isKeyExpired(k.expireTime) ? 'text-destructive' : 'text-muted-foreground'"
                  >
                    <PhCalendarBlank class="text-muted-foreground/70 size-3.5 shrink-0" />
                    <span>{{ formatKeyExpiry(k.expireTime) }}</span>
                  </span>
                </div>

                <!-- 第二行：密钥密文 + 明文切换 + 快捷复制 -->
                <div class="flex min-w-0 items-center gap-2">
                  <code
                    class="text-muted-foreground truncate text-xs select-all"
                    :title="revealedKeys.has(k.id) ? k.secret : undefined"
                  >
                    {{ revealedKeys.has(k.id) ? k.secret : maskSecret(k.secret) }}
                  </code>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    :title="revealedKeys.has(k.id) ? '隐藏明文' : '显示明文'"
                    :aria-label="revealedKeys.has(k.id) ? '隐藏明文' : '显示明文'"
                    @click="toggleReveal(k.id)"
                  >
                    <PhEyeSlash v-if="revealedKeys.has(k.id)" />
                    <PhEye v-else />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    :class="copiedKeyId === k.id ? 'text-success' : 'text-muted-foreground'"
                    title="复制密钥"
                    aria-label="复制密钥"
                    @click="handleCopyKey(k)"
                  >
                    <PhCheck v-if="copiedKeyId === k.id" />
                    <PhCopy v-else />
                  </Button>
                </div>
              </div>
            </div>

            <!-- 右侧操作按钮：启用开关 + 测试 + 编辑 + 删除 -->
            <div class="flex shrink-0 items-center gap-1">
              <Switch
                :model-value="k.enabled"
                aria-label="切换启用状态"
                @update:model-value="v => handleToggleKeyEnabled(k, !!v)"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-foreground"
                :disabled="testingKeyId === k.id"
                aria-label="测试"
                title="测试"
                @click="runKeyTest(k)"
              >
                <Spinner v-if="testingKeyId === k.id" />
                <PhPulse v-else />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-foreground"
                aria-label="修改"
                title="修改"
                @click="openEditKey(k)"
              >
                <PhPencilSimple />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="删除"
                title="删除"
                @click="confirmDeleteKey(k)"
              >
                <PhTrashSimple />
              </Button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-else
          class="flex min-h-48 items-center justify-center"
        >
          <AppEmpty />
        </div>
      </TabsContent>

      <!-- 3) 模型列表 Tab：按模型分组折叠展示 -->
      <TabsContent
        value="models"
        class="min-h-0 flex-1 overflow-y-auto"
      >
        <AppLoading v-if="configLoading && !models.length" />

        <div
          v-else-if="models.length"
          class="flex flex-col gap-2"
        >
          <ModelGroup
            v-for="group in modelGroups"
            :key="group.key"
            :provider-id="provider.id"
            :label="group.label"
            :items="group.items"
            @reorder="handleModelGroupReorder"
            @edit="openEditModel"
            @remove="confirmDeleteModel"
            @toggle="(m, enabled) => handleToggleModelEnabled(m, enabled)"
          />
        </div>

        <div
          v-else
          class="flex min-h-48 items-center justify-center"
        >
          <AppEmpty />
        </div>
      </TabsContent>
    </Tabs>
  </div>

  <!-- 供应商不存在 -->
  <div
    v-else
    class="flex flex-1 items-center justify-center"
  >
    <AppEmpty />
  </div>

  <!-- 供应商基础信息编辑弹窗 -->
  <ProviderModal
    v-if="provider"
    v-model:open="editModalOpen"
    :provider="provider"
  />

  <!-- 弹窗组件：统一挂载 -->
  <EndpointModal
    v-if="provider"
    v-model:open="endpointModalOpen"
    :provider-id="provider.id"
    :endpoint="editingEndpoint"
    :default-type="endpointModalType"
    :existing-endpoints="endpoints"
    @saved="() => store.loadEndpoints(provider!.id)"
  />

  <KeyModal
    v-if="provider"
    v-model:open="keyModalOpen"
    :provider-id="provider.id"
    :key-item="editingKey"
    @saved="() => store.loadKeys(provider!.id)"
  />

  <ModelModal
    v-if="provider"
    v-model:open="modelModalOpen"
    :provider-id="provider.id"
    :model-item="editingModel"
    :existing-endpoints="endpoints"
    @saved="() => store.loadModels(provider!.id)"
  />

  <!-- 从模型列表端点获取模型：获取方式在弹窗内选择，勾选后随密钥关系批量导入 -->
  <ModelImportModal
    v-if="provider"
    v-model:open="importModalOpen"
    :provider-id="provider.id"
    :existing-models="models"
    @saved="() => store.loadModels(provider!.id)"
  />
</template>

<style scoped>
/* 拖拽落点占位提示 */
:deep(.sortable-ghost) {
  opacity: 0.35;
}
</style>
