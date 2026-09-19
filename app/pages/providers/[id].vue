<script setup lang="ts">
import {useClipboard} from '@vueuse/core'
import {useSortable} from '@vueuse/integrations/useSortable'
import type {TabsItem} from '@nuxt/ui'
import {
  SYS_ENDPOINT_GENERATES,
  SYS_MODEL_DEFAULT_CATEGORY,
  type SysEndpoint,
  type SysEndpointType,
  type SysKey,
  type SysModel,
  type SysProvider
} from '~/utils/providers'

const {t} = useI18n()
const route = useRoute()
const toast = useToast()
const confirmDialog = useConfirmDialog()
const {copy, copied} = useClipboard()

const {providers, fetchProvider, toggleProvider} = useProviders()
const {
  endpoints,
  keys,
  models,
  loading: configLoading,
  reset,
  loadAll,
  loadEndpoints,
  updateEndpoint,
  removeEndpoint,
  loadKeys,
  updateKey,
  removeKey,
  saveKeyOrder,
  testKey,
  loadModels,
  updateModel,
  removeModel,
  saveModelOrder
} = useProviderConfig()

const id = computed(() => route.params.id as string)
const provider = computed<SysProvider | undefined>(() => providers.value.find(p => p.id === id.value))
const title = computed(() => provider.value ? (provider.value.name || provider.value.code) : t('providers.configTitle'))

const loadingProvider = ref(false)

watch(id, async (newId) => {
  reset()
  if (newId) {
    if (!providers.value.some(p => p.id === newId)) {
      loadingProvider.value = true
      try {
        await fetchProvider(newId)
      } finally {
        loadingProvider.value = false
      }
    }
    void loadAll(newId)
  }
}, {immediate: true})

onBeforeUnmount(() => {
  document.body.classList.remove('provider-sortable-dragging')
  reset()
  if (copyTimer) clearTimeout(copyTimer)
})

/* ---------------- 1. 供应商基础信息编辑弹窗 ---------------- */
const editModalOpen = ref(false)

function openEditProvider() {
  editModalOpen.value = true
}

/* ---------------- 2. 端点操作与弹窗 ---------------- */
const endpointModalOpen = ref(false)
const editingEndpoint = ref<SysEndpoint | null>(null)
const endpointModalType = ref<SysEndpointType>('generate')

const baseEndpoint = computed(() => endpoints.value.find(e => e.type === 'base'))
const modelsEndpoint = computed(() => endpoints.value.find(e => e.type === 'models'))
const generateEndpoints = computed(() => endpoints.value.filter(e => e.type === 'generate'))
const isAllGeneratesAdded = computed(() => {
  const addedGenerates = new Set(generateEndpoints.value.map(e => e.generate))
  return SYS_ENDPOINT_GENERATES.every(p => addedGenerates.has(p))
})

function splitUrl(baseUrl?: string, path?: string): { basePart: string; pathPart: string; fullUrl: string } {
  if (!path) return {basePart: '', pathPart: '', fullUrl: ''}
  const trimmedPath = path.trim()
  if (!trimmedPath) return {basePart: '', pathPart: '', fullUrl: ''}

  if (/^https?:\/\//i.test(trimmedPath)) {
    try {
      const u = new URL(trimmedPath)
      const origin = u.origin
      const pathname = trimmedPath.slice(origin.length)
      return {basePart: origin, pathPart: pathname, fullUrl: trimmedPath}
    } catch {
      return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
    }
  }

  const base = baseUrl?.trim()
  if (!base) {
    return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
  }

  const baseNormalized = base.replace(/\/+$/, '')
  const subNormalized = trimmedPath.replace(/^\/+/, '')
  const full = `${baseNormalized}/${subNormalized}`
  return {basePart: baseNormalized, pathPart: `/${subNormalized}`, fullUrl: full}
}

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

function openEditEndpoint(ep: SysEndpoint) {
  editingEndpoint.value = ep
  endpointModalType.value = ep.type
  endpointModalOpen.value = true
}

async function confirmDeleteEndpoint(ep: SysEndpoint) {
  const confirmed = await confirmDialog({
    title: t('providerEndpoints.removeConfirmTitle'),
    description: t('providerEndpoints.removeConfirmDesc', {path: ep.path})
  })
  if (confirmed && provider.value) {
    await removeEndpoint(provider.value.id, ep.id)
  }
}

async function handleToggleDefault(ep: SysEndpoint) {
  if (!provider.value) return
  const nextDefault = !ep.isDefault
  try {
    await updateEndpoint(provider.value.id, ep.id, {
      type: ep.type,
      generate: ep.generate,
      path: ep.path,
      isDefault: nextDefault
    })
    toast.add({
      color: 'success',
      title: nextDefault ? t('providerEndpoints.defaultSet') : t('providerEndpoints.defaultCanceled')
    })
  } catch (err: any) {
    console.warn('[ai-gate] 切换默认端点失败', err)
    toast.add({color: 'error', title: t('providers.backendUnavailable')})
  }
}

/* ---------------- 3. 密钥弹窗与操作 ---------------- */
const keyModalOpen = ref(false)
const editingKey = ref<SysKey | null>(null)
const revealedKeys = ref<Set<string>>(new Set())

/** 密钥卡片 UCard 主题覆盖：行式密度（内边距由行容器接管），圆角与 hover 效果对齐项目基线；group 供密文操作按钮悬浮显现 */
const keyCardUi = {
  root: 'group transition hover:ring-primary/40 hover:bg-elevated/30',
  body: 'p-0 sm:p-0'
}

function toggleReveal(id: string) {
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

async function handleCopy(text: string) {
  await copy(text)
  toast.add({color: 'success', title: t('common.copied')})
}

const copiedKeyId = ref<string | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function handleCopyKey(k: SysKey) {
  await copy(k.secret)
  copiedKeyId.value = k.id
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copiedKeyId.value = null
  }, 2000)
  toast.add({color: 'success', title: t('providerKeys.copied')})
}

function isKeyExpired(expiresTime: string | null): boolean {
  if (!expiresTime) return false
  const trimmed = expiresTime.trim()
  if (!trimmed) return false
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59.999` : trimmed
  const timestamp = Date.parse(dateStr)
  if (isNaN(timestamp)) return false
  return timestamp < Date.now()
}

function formatKeyExpiry(expiresTime: string | null): string {
  if (!expiresTime) return ''
  if (isKeyExpired(expiresTime)) {
    return `${expiresTime} (${t('providerKeys.expired')})`
  }
  return expiresTime
}

function openCreateKey() {
  editingKey.value = null
  keyModalOpen.value = true
}

function openEditKey(k: SysKey) {
  editingKey.value = k
  keyModalOpen.value = true
}

async function confirmDeleteKey(k: SysKey) {
  const confirmed = await confirmDialog({
    title: t('providerKeys.removeConfirmTitle'),
    description: t('providerKeys.removeConfirmDesc', {name: k.name})
  })
  if (confirmed && provider.value) {
    await removeKey(provider.value.id, k.id)
  }
}

async function handleToggleKeyEnabled(k: SysKey, enabled: boolean) {
  if (!provider.value) return
  await updateKey(provider.value.id, k.id, {
    name: k.name,
    secret: k.secret,
    enabled,
    status: k.status,
    expiresTime: k.expiresTime,
    sort: k.sort
  })
}

/** 正在测试的密钥 id：单卡粒度的加载态 */
const testingKeyId = ref<string | null>(null)

/** 密钥测试失败文案：按后端错误码就近映射 */
function keyTestErrorMessage(code: string | undefined, detail?: string): string {
  switch (code) {
    case 'MISSING_BASE_ENDPOINT':
      return t('providerKeys.errorMissingBase')
    case 'MISSING_MODELS_ENDPOINT':
      return t('providerKeys.errorMissingModelsEndpoint')
    case 'UPSTREAM_UNREACHABLE':
      return t('providerKeys.errorUnreachable')
    case 'UPSTREAM_TIMEOUT':
      return t('providerKeys.errorUpstreamTimeout')
    case 'UPSTREAM_ERROR':
      return detail ? t('providerKeys.testFailedDetail', {detail}) : t('providerKeys.testFailed')
    default:
      return t('providers.backendUnavailable')
  }
}

async function runKeyTest(k: SysKey) {
  if (!provider.value || testingKeyId.value) return
  testingKeyId.value = k.id
  try {
    const res = await testKey(provider.value.id, k.id)
    toast.add({color: 'success', title: t('providerKeys.testSuccess', {ms: res.latencyMs})})
  } catch (err) {
    console.warn('[ai-gate] 测试密钥失败', err)
    const data = (err as {data?: {error?: string, detail?: string}}).data
    toast.add({color: 'error', title: keyTestErrorMessage(data?.error, data?.detail)})
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
    void nextTick(() => saveKeyOrder(provider.value!.id))
  }
})

/* ---------------- 4. 模型弹窗与操作 ---------------- */
const modelModalOpen = ref(false)
const editingModel = ref<SysModel | null>(null)
const importModalOpen = ref(false)

function openCreateModel() {
  editingModel.value = null
  modelModalOpen.value = true
}

function openImportModels() {
  importModalOpen.value = true
}

function openEditModel(m: SysModel) {
  editingModel.value = m
  modelModalOpen.value = true
}

async function confirmDeleteModel(m: SysModel) {
  const label = m.name || m.code
  const confirmed = await confirmDialog({
    title: t('providerModels.removeConfirmTitle'),
    description: t('providerModels.removeConfirmDesc', {name: label})
  })
  if (confirmed && provider.value) {
    await removeModel(provider.value.id, m.id)
  }
}

async function handleToggleModelEnabled(m: SysModel, enabled: boolean) {
  if (!provider.value) return
  await updateModel(provider.value.id, m.id, {
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
    description: m.description
  })
}

/* 模型按「模型分组」(category) 分组展示：分组按首现顺序排列（空分组由后端归一为 Default） */
const modelGroups = computed(() => {
  const groups: {key: string, label: string, items: SysModel[]}[] = []
  const map = new Map<string, {key: string, label: string, items: SysModel[]}>()
  for (const m of models.value) {
    const category = (m.category || '').trim() || SYS_MODEL_DEFAULT_CATEGORY
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
function handleModelGroupReorder(ids: string[]) {
  if (!provider.value) return
  const idSet = new Set(ids)
  const byId = new Map(models.value.map(m => [m.id, m] as const))
  const ordered = ids.map(id => byId.get(id)).filter((m): m is SysModel => !!m)
  const firstIndex = models.value.findIndex(m => idSet.has(m.id))
  if (firstIndex < 0 || ordered.length !== idSet.size) return
  const others = models.value.filter(m => !idSet.has(m.id))
  models.value = [...others.slice(0, firstIndex), ...ordered, ...others.slice(firstIndex)]
  void nextTick(() => saveModelOrder(provider.value!.id))
}

/* ---------------- 5. Tab 标签页切换 ---------------- */
type TabKey = 'endpoints' | 'keys' | 'models'
const validTabs: TabKey[] = ['endpoints', 'keys', 'models']
const activeTab = ref<string>(
  validTabs.includes(route.query.tab as TabKey) ? (route.query.tab as string) : 'endpoints'
)

watch(activeTab, (tab) => {
  if (route.query.tab !== tab) {
    void navigateTo({query: {...route.query, tab}}, {replace: true})
  }
})

watch(() => route.query.tab, (tab) => {
  if (tab && validTabs.includes(tab as TabKey) && activeTab.value !== tab) {
    activeTab.value = tab as string
  }
})

const tabs = computed<TabsItem[]>(() => [
  {
    value: 'endpoints',
    slot: 'endpoints',
    label: t('providerEndpoints.title'),
    icon: 'i-lucide-route',
    badge: endpoints.value.length > 0 ? {
      label: String(endpoints.value.length),
      color: 'neutral',
      variant: 'subtle',
    } : undefined
  },
  {
    value: 'keys',
    slot: 'keys',
    label: t('providerKeys.title'),
    icon: 'i-lucide-key',
    badge: keys.value.length > 0 ? {
      label: String(keys.value.length),
      color: 'neutral',
      variant: 'subtle',
    } : undefined
  },
  {
    value: 'models',
    slot: 'models',
    label: t('providerModels.title'),
    icon: 'i-lucide-sparkles',
    badge: models.value.length > 0 ? {
      label: String(models.value.length),
      color: 'neutral',
      variant: 'subtle',
    } : undefined
  }
])
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppNavbar :title="title">
        <template #title>
          <div class="flex items-center gap-1.5 text-base">
            <NuxtLink
              to="/providers"
              class="text-muted transition-colors hover:text-highlighted font-medium"
            >
              {{ t('providers.title') }}
            </NuxtLink>
            <span class="text-muted select-none">/</span>
            <span class="truncate font-semibold text-highlighted">
              {{ title }}
            </span>
          </div>
        </template>

        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            color="neutral"
            to="/providers"
            :aria-label="t('common.back')"
            :title="t('common.back')"
          >
            <span class="hidden sm:inline">{{ t('common.back') }}</span>
          </UButton>
        </template>
      </AppNavbar>
    </template>

    <!-- 页面内容：扁平流式布局 + Tab 标签页切换 -->
    <template #body>
      <!-- 详情加载中：居中 spinner -->
      <AppLoading v-if="loadingProvider && !provider" class="h-full"/>

      <div v-else-if="provider" class="h-full overflow-y-auto p-4 sm:p-6">
        <div class="mx-auto max-w-5xl space-y-3">
          <!-- 1. 顶部档案区：纯净自然留白分层，无冗余线条，契合页面通透扁平风格 -->
          <div class="flex items-center justify-between gap-4">
            <!-- 左侧：图标 + 名称/编码 + 描述 -->
            <div class="flex min-w-0 items-center gap-3.5">
              <ProviderIcon :icon="provider.icon" :name="provider.name || provider.code" size="lg"/>
              <div class="flex min-w-0 flex-col gap-0.5">
                <div class="flex items-center gap-1.5">
                  <h1 class="truncate text-base font-bold text-highlighted">
                    {{ provider.name || provider.code }}
                  </h1>
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    class="shrink-0"
                    :aria-label="t('providers.edit')"
                    :title="t('providers.edit')"
                    @click="openEditProvider"
                  />
                </div>
                <p v-if="provider.description" class="truncate text-xs text-muted" :title="provider.description">
                  {{ provider.description }}
                </p>
              </div>
            </div>

            <!-- 右侧：启用状态开关 -->
            <div class="flex shrink-0 items-center">
              <div class="flex items-center gap-1.5 border border-default bg-elevated/50 px-2 py-1 text-xs">
                <span class="text-muted">
                  {{ provider.enabled ? t('providers.enabled') : t('providers.disabled') }}
                </span>
                <USwitch
                  :model-value="provider.enabled"
                  :aria-label="t('providers.toggleEnabled')"
                  class="ml-1"
                  @update:model-value="v => toggleProvider(provider!, !!v)"
                />
              </div>
            </div>
          </div>

          <!-- 2. Tab 切换与操作栏：UTabs (variant="link") + #list-trailing 操作按钮 -->
          <UTabs
            v-model="activeTab"
            :items="tabs"
            variant="link"
            color="neutral"
            class="w-full"
            :ui="{
              list: 'border-b border-default',
              indicator: '-bottom-px h-0.5 bg-primary',
              trigger: 'cursor-pointer',
              content: 'pt-3'
            }"
          >
            <!-- 右侧操作按钮通过 list-trailing 插槽与 Tab 同行对齐 -->
            <template #list-trailing>
              <div class="ms-auto flex items-center">
                <UButton
                  v-if="activeTab === 'endpoints'"
                  icon="i-lucide-plus"
                  variant="ghost"
                  :disabled="isAllGeneratesAdded"
                  :title="isAllGeneratesAdded ? t('providerEndpoints.allGeneratesAdded') : t('providers.add')"
                  @click="openCreateEndpoint"
                >
                  {{ t('providers.add') }}
                </UButton>
                <UButton
                  v-else-if="activeTab === 'keys'"
                  icon="i-lucide-plus"
                  variant="ghost"
                  @click="openCreateKey"
                >
                  {{ t('providers.add') }}
                </UButton>
                <template v-else-if="activeTab === 'models'">
                  <UButton
                    icon="i-lucide-download"
                    variant="ghost"
                    :aria-label="t('providerModels.fetchAction')"
                    :title="t('providerModels.fetchTitle')"
                    @click="openImportModels"
                  >
                    <span class="hidden sm:inline">{{ t('providerModels.fetchAction') }}</span>
                  </UButton>
                  <UButton
                    icon="i-lucide-plus"
                    variant="ghost"
                    @click="openCreateModel"
                  >
                    {{ t('providers.add') }}
                  </UButton>
                </template>
              </div>
            </template>
          <!-- 3. 各 Tab 配置内容区域：组件内容插槽，由 Nuxt UI 生成 tabpanel 与 ARIA 关联 -->
          <!-- 1. 网络端点 Tab -->
          <template #endpoints>
            <!-- 加载中：居中 spinner -->
            <AppLoading v-if="configLoading && !endpoints.length" class="min-h-40"/>

            <!-- 端点列表：两行格式（第一行标题，第二行地址） -->
            <div v-else class="divide-y divide-default/50">
              <!-- 默认端点 1: Base URL -->
              <div
                class="group flex items-center justify-between py-2.5 px-2 hover:bg-elevated/20 transition-colors gap-4"
              >
                <!-- 左侧两行信息：第一行标题，第二行地址 -->
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <!-- 第一行：标题 -->
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-highlighted">
                      Base URL
                    </span>
                  </div>

                  <!-- 第二行：地址 -->
                  <div class="flex items-center gap-2 min-w-0">
                    <code
                      class="truncate text-xs text-muted select-all"
                      :title="baseEndpoint?.path || t('common.empty')"
                    >
                      {{ baseEndpoint?.path || t('common.empty') }}
                    </code>
                    <UButton
                      v-if="baseEndpoint?.path"
                      icon="i-lucide-copy"
                      variant="ghost"
                      color="neutral"
                      class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      :title="t('common.copy')"
                      :aria-label="t('common.copy')"
                      @click="handleCopy(baseEndpoint.path)"
                    />
                  </div>
                </div>

                <!-- 右侧操作按钮 -->
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    :aria-label="t('providers.edit')"
                    :title="t('providers.edit')"
                    @click="openEditBaseEndpoint"
                  />
                </div>
              </div>

              <!-- 默认端点 2: Models -->
              <div
                class="group flex items-center justify-between py-2.5 px-2 hover:bg-elevated/20 transition-colors gap-4"
              >
                <!-- 左侧两行信息：第一行标题，第二行全路径地址 -->
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <!-- 第一行：标题 -->
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-highlighted">
                      Models
                    </span>
                  </div>

                  <!-- 第二行：全路径展示（域名弱化，路径高亮） -->
                  <div class="flex items-center gap-2 min-w-0">
                    <code
                      class="truncate text-xs select-all"
                      :title="splitUrl(baseEndpoint?.path, modelsEndpoint?.path).fullUrl || t('common.empty')"
                    >
                      <span
                        v-if="splitUrl(baseEndpoint?.path, modelsEndpoint?.path).basePart"
                        class="text-dimmed"
                      >{{ splitUrl(baseEndpoint?.path, modelsEndpoint?.path).basePart }}</span>
                      <span
                        :class="splitUrl(baseEndpoint?.path, modelsEndpoint?.path).basePart ? 'text-highlighted font-medium' : 'text-muted'"
                      >{{ splitUrl(baseEndpoint?.path, modelsEndpoint?.path).pathPart || t('common.empty') }}</span>
                    </code>
                    <UButton
                      v-if="splitUrl(baseEndpoint?.path, modelsEndpoint?.path).fullUrl"
                      icon="i-lucide-copy"
                      variant="ghost"
                      color="neutral"
                      class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      :title="t('common.copy')"
                      :aria-label="t('common.copy')"
                      @click="handleCopy(splitUrl(baseEndpoint?.path, modelsEndpoint?.path).fullUrl)"
                    />
                  </div>
                </div>

                <!-- 右侧操作按钮 -->
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    :aria-label="t('providers.edit')"
                    :title="t('providers.edit')"
                    @click="openEditModelsEndpoint"
                  />
                </div>
              </div>

              <!-- 生成端点列表 -->
              <div
                v-for="ep in generateEndpoints"
                :key="ep.id"
                class="group flex items-center justify-between py-2.5 px-2 hover:bg-elevated/20 transition-colors gap-4"
              >
                <!-- 左侧两行信息：第一行标题，第二行全路径地址 -->
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <!-- 第一行：标题（端点类型） + 默认徽章（仅针对 generate 生效） -->
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-highlighted">
                      {{ ep.generate }}
                    </span>
                    <UBadge
                      v-if="ep.isDefault"
                      color="primary"
                      variant="subtle"
                    >
                      {{ t('providerEndpoints.defaultBadge') }}
                    </UBadge>
                  </div>

                  <!-- 第二行：全路径展示（域名弱化，路径高亮） -->
                  <div class="flex items-center gap-2 min-w-0">
                    <code
                      class="truncate text-xs select-all"
                      :title="splitUrl(baseEndpoint?.path, ep.path).fullUrl"
                    >
                      <span
                        v-if="splitUrl(baseEndpoint?.path, ep.path).basePart"
                        class="text-dimmed"
                      >{{ splitUrl(baseEndpoint?.path, ep.path).basePart }}</span>
                      <span
                        :class="splitUrl(baseEndpoint?.path, ep.path).basePart ? 'text-highlighted font-medium' : 'text-muted'"
                      >{{ splitUrl(baseEndpoint?.path, ep.path).pathPart }}</span>
                    </code>
                    <UButton
                      v-if="splitUrl(baseEndpoint?.path, ep.path).fullUrl"
                      icon="i-lucide-copy"
                      variant="ghost"
                      color="neutral"
                      class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      :title="t('common.copy')"
                      :aria-label="t('common.copy')"
                      @click="handleCopy(splitUrl(baseEndpoint?.path, ep.path).fullUrl)"
                    />
                  </div>
                </div>

                <!-- 右侧操作按钮 -->
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    v-if="ep.isDefault"
                    icon="i-lucide-star"
                    variant="ghost"
                    color="primary"
                    class="[&_svg_path]:fill-current"
                    :title="t('providerEndpoints.cancelDefault')"
                    :aria-label="t('providerEndpoints.cancelDefault')"
                    @click="handleToggleDefault(ep)"
                  />
                  <UButton
                    v-else
                    icon="i-lucide-star"
                    variant="ghost"
                    color="neutral"
                    :title="t('providerEndpoints.setDefault')"
                    :aria-label="t('providerEndpoints.setDefault')"
                    @click="handleToggleDefault(ep)"
                  />
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    :title="t('providers.edit')"
                    :aria-label="t('providers.edit')"
                    @click="openEditEndpoint(ep)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    :title="t('providers.remove')"
                    :aria-label="t('providers.remove')"
                    @click="confirmDeleteEndpoint(ep)"
                  />
                </div>
              </div>

              <!-- 生成端点为空时的极简空态 -->
              <div v-if="!generateEndpoints.length" class="py-8">
                <UEmpty :title="t('providerEndpoints.emptyGenerates')" variant="naked"/>
              </div>
            </div>
          </template>

          <!-- 2. API 密钥 Tab -->
          <template #keys>
            <!-- 加载中：居中 spinner -->
            <AppLoading v-if="configLoading && !keys.length" class="min-h-40"/>

            <!-- 密钥列表：单层卡片结构，无多层嵌套，纵向分行清晰 -->
            <div v-else-if="keys.length" ref="keyListEl" class="flex flex-col gap-2">
              <UCard v-for="k in keys" :key="k.id" :ui="keyCardUi">
                <div class="flex items-center justify-between gap-4 px-3 py-2.5">
                  <!-- 左侧信息区：拖拽手柄 + 纵向信息流（第一行名称/状态/过期，第二行密文与操作） -->
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      class="drag-handle -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center text-dimmed transition-colors hover:bg-elevated hover:text-default"
                      aria-hidden="true"
                      :title="t('providers.dragToSort')"
                    >
                      <UIcon name="i-lucide-grip-vertical" class="size-4"/>
                    </div>

                    <div class="flex min-w-0 flex-1 flex-col gap-1">
                      <!-- 第一行：名称 + 状态徽标 + 有效期 -->
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          class="truncate text-sm font-semibold"
                          :class="k.enabled ? 'text-highlighted' : 'text-dimmed'"
                          :title="k.name"
                        >
                          {{ k.name }}
                        </span>

                        <UBadge
                          v-if="k.status !== 'ACTIVE'"
                          color="error"
                          variant="subtle"
                        >
                          {{ t('providerKeys.statusInvalid') }}
                        </UBadge>

                        <span
                          v-if="k.expiresTime"
                          class="inline-flex items-center gap-1 text-xs"
                          :class="isKeyExpired(k.expiresTime) ? 'text-error' : 'text-muted'"
                        >
                          <UIcon
                            name="i-lucide-calendar-clock"
                            class="size-3.5 shrink-0 text-dimmed"
                          />
                          <span>{{ formatKeyExpiry(k.expiresTime) }}</span>
                        </span>
                      </div>

                      <!-- 第二行：密钥密文 + 明文切换 + 快捷复制（单层卡片内自然排布，无嵌套内盒） -->
                      <div class="flex items-center gap-2 min-w-0">
                        <code
                          class="truncate text-xs select-all text-muted"
                          :title="revealedKeys.has(k.id) ? k.secret : undefined"
                        >
                          {{ revealedKeys.has(k.id) ? k.secret : maskSecret(k.secret) }}
                        </code>

                        <UButton
                          :icon="revealedKeys.has(k.id) ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                          variant="ghost"
                          color="neutral"
                          class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          :title="revealedKeys.has(k.id) ? t('providerKeys.hideSecret') : t('providerKeys.showSecret')"
                          :aria-label="revealedKeys.has(k.id) ? t('providerKeys.hideSecret') : t('providerKeys.showSecret')"
                          @click="toggleReveal(k.id)"
                        />

                        <UButton
                          :icon="copiedKeyId === k.id ? 'i-lucide-check' : 'i-lucide-copy'"
                          :color="copiedKeyId === k.id ? 'success' : 'neutral'"
                          variant="ghost"
                          class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          :title="t('providerKeys.copySecret')"
                          :aria-label="t('providerKeys.copySecret')"
                          @click="handleCopyKey(k)"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- 右侧操作按钮：启用状态开关 + 测试 + 编辑 + 删除 -->
                  <div class="flex shrink-0 items-center gap-1">
                    <USwitch
                      :model-value="k.enabled"
                      :aria-label="t('providers.toggleEnabled')"
                      @update:model-value="v => handleToggleKeyEnabled(k, !!v)"
                    />
                    <UButton
                      icon="i-lucide-activity"
                      variant="ghost"
                      color="neutral"
                      :loading="testingKeyId === k.id"
                      :aria-label="t('providerKeys.testBtn')"
                      :title="t('providerKeys.testBtn')"
                      @click="runKeyTest(k)"
                    />
                    <UButton
                      icon="i-lucide-square-pen"
                      variant="ghost"
                      color="neutral"
                      :aria-label="t('providers.edit')"
                      :title="t('providers.edit')"
                      @click="openEditKey(k)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      variant="ghost"
                      color="error"
                      :aria-label="t('providers.remove')"
                      :title="t('providers.remove')"
                      @click="confirmDeleteKey(k)"
                    />
                  </div>
                </div>
              </UCard>
            </div>

            <!-- 空状态 -->
            <div v-else class="flex min-h-48 items-center justify-center p-4">
              <UEmpty
                :title="t('common.empty')"
                variant="naked"
              />
            </div>
          </template>

          <!-- 3. 模型列表 Tab -->
          <template #models>
            <!-- 加载中：居中 spinner -->
            <AppLoading v-if="configLoading && !models.length" class="min-h-40"/>

            <!-- 模型列表：按模型分组折叠展示，每组一张卡片 -->
            <div v-else-if="models.length" class="flex flex-col gap-2">
              <ProviderModelGroup
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

            <div v-else class="flex min-h-48 items-center justify-center p-4">
              <UEmpty
                :title="t('common.empty')"
                variant="naked"
              />
            </div>
          </template>
          </UTabs>
        </div>
      </div>

      <!-- 供应商不存在 -->
      <div v-else class="h-full overflow-y-auto p-4">
        <div class="flex min-h-full items-center justify-center">
          <UEmpty
            :title="t('common.empty')"
            variant="naked"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- 供应商基础信息编辑弹窗 -->
  <ProviderModal
    v-if="provider"
    v-model:open="editModalOpen"
    :provider="provider"
  />

  <!-- 弹窗组件：统一挂载 -->
  <ProviderEndpointModal
    v-if="provider"
    v-model:open="endpointModalOpen"
    :provider-id="provider.id"
    :endpoint="editingEndpoint"
    :default-type="endpointModalType"
    :existing-endpoints="endpoints"
    @saved="() => loadEndpoints(provider!.id)"
  />

  <ProviderKeyModal
    v-if="provider"
    v-model:open="keyModalOpen"
    :provider-id="provider.id"
    :key-item="editingKey"
    @saved="() => loadKeys(provider!.id)"
  />

  <ProviderModelModal
    v-if="provider"
    v-model:open="modelModalOpen"
    :provider-id="provider.id"
    :model-item="editingModel"
    :existing-endpoints="endpoints"
    @saved="() => loadModels(provider!.id)"
  />

  <!-- 从模型列表端点获取模型：获取方式在弹窗内选择，勾选后随密钥关系批量导入 -->
  <ProviderModelImportModal
    v-if="provider"
    v-model:open="importModalOpen"
    :provider-id="provider.id"
    :existing-models="models"
    @saved="() => loadModels(provider!.id)"
  />
</template>

<style scoped>
/* 拖拽落点占位提示 */
:deep(.sortable-ghost) {
  opacity: 0.35;
}
</style>

<style>
/* 拖拽期间全局光标锁定为抓取状态 */
body.provider-sortable-dragging,
body.provider-sortable-dragging * {
  cursor: grabbing !important;
}
</style>

