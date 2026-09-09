<script setup lang="ts">
import {useClipboard} from '@vueuse/core'
import {useSortable} from '@vueuse/integrations/useSortable'
import type {TabsItem} from '@nuxt/ui'
import type {
  SysEndpoint,
  SysEndpointType,
  SysKey,
  SysModel,
  SysProvider
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
  reset,
  loadAll,
  loadEndpoints,
  removeEndpoint,
  loadKeys,
  updateKey,
  removeKey,
  saveKeyOrder,
  loadModels,
  updateModel,
  removeModel,
  saveModelOrder
} = useProviderConfig()

const id = computed(() => route.params.id as string)
const provider = computed<SysProvider | undefined>(() => providers.value.find(p => p.id === id.value))
const title = computed(() => provider.value ? (provider.value.name || provider.value.code) : t('providers.configTitle'))

watch(id, (newId) => {
  reset()
  if (newId) {
    if (!providers.value.some(p => p.id === newId)) {
      void fetchProvider(newId)
    }
    void loadAll(newId)
  }
}, { immediate: true })

onBeforeUnmount(() => {
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
const endpointModalType = ref<SysEndpointType>('protocol')

const baseEndpoint = computed(() => endpoints.value.find(e => e.type === 'base'))
const modelsEndpoint = computed(() => endpoints.value.find(e => e.type === 'models'))
const protocolEndpoints = computed(() => endpoints.value.filter(e => e.type === 'protocol'))

function splitUrl(baseUrl?: string, path?: string): {basePart: string; pathPart: string; fullUrl: string} {
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
  endpointModalType.value = 'protocol'
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

/* ---------------- 3. 密钥弹窗与操作 ---------------- */
const keyModalOpen = ref(false)
const editingKey = ref<SysKey | null>(null)
const revealedKeys = ref<Set<string>>(new Set())

function toggleReveal(id: string) {
  const next = new Set(revealedKeys.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  revealedKeys.value = next
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••••••'
  return `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`
}

async function handleCopy(secret: string) {
  await copy(secret)
  toast.add({color: 'success', title: t('providerKeys.copied')})
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
    sort: k.sort,
    description: k.description
  })
}

const keyListEl = ref<HTMLElement | null>(null)

useSortable(keyListEl, keys, {
  handle: '.drag-handle',
  animation: 150,
  forceFallback: true,
  fallbackOnBody: true,
  watchElement: true,
  onEnd: (evt) => {
    if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex || !provider.value) return
    void nextTick(() => saveKeyOrder(provider.value!.id))
  }
})

/* ---------------- 4. 模型弹窗与操作 ---------------- */
const modelModalOpen = ref(false)
const editingModel = ref<SysModel | null>(null)

function openCreateModel() {
  editingModel.value = null
  modelModalOpen.value = true
}

function openEditModel(m: SysModel) {
  editingModel.value = m
  modelModalOpen.value = true
}

async function confirmDeleteModel(m: SysModel) {
  const confirmed = await confirmDialog({
    title: t('providerModels.removeConfirmTitle'),
    description: t('providerModels.removeConfirmDesc', {code: m.code})
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
    protocols: m.protocols,
    maxContext: m.maxContext,
    maxInput: m.maxInput,
    maxOutput: m.maxOutput,
    reasoning: m.reasoning,
    effortLevel: m.effortLevel,
    sort: m.sort,
    description: m.description
  })
}

function formatTokens(count: number): string {
  if (!count) return '0'
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${Math.round(count / 1000)}K`
  return String(count)
}

function modelTypeBadgeColor(type: string): 'primary' | 'secondary' | 'neutral' | 'success' | 'warning' {
  switch (type) {
    case 'GenText':
      return 'primary'
    case 'GenImage':
      return 'secondary'
    case 'GenAudio':
    case 'GenVideo':
      return 'warning'
    case 'Embedding':
      return 'success'
    default:
      return 'neutral'
  }
}

const modelListEl = ref<HTMLElement | null>(null)

useSortable(modelListEl, models, {
  handle: '.drag-handle',
  animation: 150,
  forceFallback: true,
  fallbackOnBody: true,
  watchElement: true,
  onEnd: (evt) => {
    if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex || !provider.value) return
    void nextTick(() => saveModelOrder(provider.value!.id))
  }
})

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
    label: t('providerEndpoints.title'),
    icon: 'i-lucide-route',
    badge: endpoints.value.length > 0 ? {
      label: String(endpoints.value.length),
      color: 'neutral',
      variant: 'subtle',
      size: 'xs'
    } : undefined
  },
  {
    value: 'keys',
    label: t('providerKeys.title'),
    icon: 'i-lucide-key',
    badge: keys.value.length > 0 ? {
      label: String(keys.value.length),
      color: 'neutral',
      variant: 'subtle',
      size: 'xs'
    } : undefined
  },
  {
    value: 'models',
    label: t('providerModels.title'),
    icon: 'i-lucide-sparkles',
    badge: models.value.length > 0 ? {
      label: String(models.value.length),
      color: 'neutral',
      variant: 'subtle',
      size: 'xs'
    } : undefined
  }
])
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
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
      <div v-if="provider" class="h-full overflow-y-auto p-4 sm:p-6">
        <div class="mx-auto max-w-5xl space-y-6">
          <!-- 1. 顶部档案区：纯净自然留白分层，无冗余线条，契合页面通透扁平风格 -->
          <div class="flex items-center justify-between gap-4 pb-1">
            <!-- 左侧：图标 + 名称/编码 + 描述 -->
            <div class="flex min-w-0 items-center gap-3.5">
              <ProviderIcon :icon="provider.icon" :name="provider.name || provider.code" size="lg" />
              <div class="flex min-w-0 flex-col gap-0.5">
                <h1 class="truncate text-base font-bold text-highlighted">
                  {{ provider.name || provider.code }}
                </h1>
                <p v-if="provider.description" class="truncate text-xs text-muted" :title="provider.description">
                  {{ provider.description }}
                </p>
              </div>
            </div>

            <!-- 右侧：启用状态开关 + 编辑按钮 -->
            <div class="flex shrink-0 items-center gap-2.5">
              <div class="flex items-center gap-1.5 rounded-full border border-default bg-elevated/50 px-2.5 py-1 text-xs">
                <span
                  class="size-1.5 rounded-full"
                  :class="provider.enabled ? 'bg-success' : 'bg-neutral'"
                />
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

              <UButton
                icon="i-lucide-square-pen"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="openEditProvider"
              >
                {{ t('providers.edit') }}
              </UButton>
            </div>
          </div>

          <!-- 2. Tab 切换与操作栏：UTabs (variant="link") + #list-trailing 操作按钮 -->
          <UTabs
            v-model="activeTab"
            :items="tabs"
            variant="link"
            color="neutral"
            :content="false"
            class="w-full"
            :ui="{
              list: 'border-b border-default',
              indicator: '-bottom-px h-0.5 bg-primary',
              trigger: 'cursor-pointer'
            }"
          >
            <!-- 右侧操作按钮通过 list-trailing 插槽与 Tab 同行对齐 -->
            <template #list-trailing>
              <div class="ms-auto flex items-center">
                <UButton
                  v-if="activeTab === 'endpoints'"
                  icon="i-lucide-plus"
                  variant="ghost"
                  size="xs"
                  @click="openCreateEndpoint"
                >
                  {{ t('providers.add') }}
                </UButton>
                <UButton
                  v-else-if="activeTab === 'keys'"
                  icon="i-lucide-plus"
                  variant="ghost"
                  size="xs"
                  @click="openCreateKey"
                >
                  {{ t('providers.add') }}
                </UButton>
                <UButton
                  v-else-if="activeTab === 'models'"
                  icon="i-lucide-plus"
                  variant="ghost"
                  size="xs"
                  @click="openCreateModel"
                >
                  {{ t('providers.add') }}
                </UButton>
              </div>
            </template>
          </UTabs>

          <!-- 3. 各 Tab 配置内容区域 -->
          <!-- 1. 网络端点 Tab -->
          <div v-if="activeTab === 'endpoints'">
            <!-- 端点列表：两行格式（第一行标题，第二行地址） -->
            <div class="divide-y divide-default/50">
              <!-- 默认端点 1: Base URL -->
              <div
                class="group flex items-center justify-between py-2.5 px-2 hover:bg-elevated/20 transition-colors rounded-sm gap-4"
              >
                <!-- 左侧两行信息：第一行标题，第二行地址 -->
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <!-- 第一行：标题 -->
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-highlighted font-mono">
                      Base URL
                    </span>
                  </div>

                  <!-- 第二行：地址 -->
                  <div class="flex items-center gap-2 min-w-0">
                    <code
                      class="truncate font-mono text-xs text-muted select-all"
                      :title="baseEndpoint?.path || t('common.empty')"
                    >
                      {{ baseEndpoint?.path || t('common.empty') }}
                    </code>
                    <button
                      v-if="baseEndpoint?.path"
                      type="button"
                      class="cursor-pointer text-dimmed transition-colors hover:text-default shrink-0 opacity-0 group-hover:opacity-100"
                      :title="t('providerKeys.copySecret')"
                      @click="handleCopy(baseEndpoint.path)"
                    >
                      <UIcon name="i-lucide-copy" class="size-3" />
                    </button>
                  </div>
                </div>

                <!-- 右侧操作按钮 -->
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="t('providers.edit')"
                    @click="openEditBaseEndpoint"
                  />
                </div>
              </div>

              <!-- 默认端点 2: Models -->
              <div
                class="group flex items-center justify-between py-2.5 px-2 hover:bg-elevated/20 transition-colors rounded-sm gap-4"
              >
                <!-- 左侧两行信息：第一行标题，第二行全路径地址 -->
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <!-- 第一行：标题 -->
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-highlighted font-mono">
                      Models
                    </span>
                  </div>

                  <!-- 第二行：全路径展示（域名弱化，路径高亮） -->
                  <div class="flex items-center gap-2 min-w-0">
                    <code
                      class="truncate font-mono text-xs select-all"
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
                    <button
                      v-if="splitUrl(baseEndpoint?.path, modelsEndpoint?.path).fullUrl"
                      type="button"
                      class="cursor-pointer text-dimmed transition-colors hover:text-default shrink-0 opacity-0 group-hover:opacity-100"
                      :title="t('providerKeys.copySecret')"
                      @click="handleCopy(splitUrl(baseEndpoint?.path, modelsEndpoint?.path).fullUrl)"
                    >
                      <UIcon name="i-lucide-copy" class="size-3" />
                    </button>
                  </div>
                </div>

                <!-- 右侧操作按钮 -->
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="t('providers.edit')"
                    @click="openEditModelsEndpoint"
                  />
                </div>
              </div>

              <!-- 协议端点列表 -->
              <div
                v-for="ep in protocolEndpoints"
                :key="ep.id"
                class="group flex items-center justify-between py-2.5 px-2 hover:bg-elevated/20 transition-colors rounded-sm gap-4"
              >
                <!-- 左侧两行信息：第一行标题，第二行全路径地址 -->
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <!-- 第一行：标题（协议名称） + 默认标识（仅针对 protocol 生效） -->
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-highlighted font-mono">
                      {{ ep.protocol }}
                    </span>
                    <UBadge
                      v-if="ep.isDefault"
                      color="success"
                      variant="subtle"
                      size="xs"
                    >
                      {{ t('providerEndpoints.defaultBadge') }}
                    </UBadge>
                  </div>

                  <!-- 第二行：全路径展示（域名弱化，路径高亮） -->
                  <div class="flex items-center gap-2 min-w-0">
                    <code
                      class="truncate font-mono text-xs select-all"
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
                    <button
                      v-if="splitUrl(baseEndpoint?.path, ep.path).fullUrl"
                      type="button"
                      class="cursor-pointer text-dimmed transition-colors hover:text-default shrink-0 opacity-0 group-hover:opacity-100"
                      :title="t('providerKeys.copySecret')"
                      @click="handleCopy(splitUrl(baseEndpoint?.path, ep.path).fullUrl)"
                    >
                      <UIcon name="i-lucide-copy" class="size-3" />
                    </button>
                  </div>
                </div>

                <!-- 右侧操作按钮 -->
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="t('providers.edit')"
                    @click="openEditEndpoint(ep)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    :aria-label="t('providers.remove')"
                    @click="confirmDeleteEndpoint(ep)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 2. API 密钥 Tab -->
          <div v-else-if="activeTab === 'keys'">
            <!-- 密钥列表：单层卡片结构，无多层嵌套，纵向分行清晰 -->
            <div v-if="keys.length" ref="keyListEl" class="flex flex-col gap-3">
              <div
                v-for="k in keys"
                :key="k.id"
                class="group flex items-start justify-between gap-4 rounded-lg border border-default bg-default p-3.5 transition-colors hover:border-primary/40 hover:bg-elevated/30"
              >
                <!-- 左侧信息区：拖拽手柄 + 纵向信息流（第一行名称/状态/过期，第二行密文与操作，第三行备注） -->
                <div class="flex min-w-0 flex-1 items-start gap-2.5">
                  <div
                    class="drag-handle -ml-1 mt-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-dimmed transition-colors hover:bg-elevated hover:text-default"
                    role="button"
                    :aria-label="t('providers.dragToSort')"
                  >
                    <UIcon name="i-lucide-grip-vertical" class="size-4" />
                  </div>

                  <div class="flex min-w-0 flex-1 flex-col gap-1.5">
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
                        size="xs"
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
                        class="truncate font-mono text-xs select-all text-muted"
                        :title="revealedKeys.has(k.id) ? k.secret : undefined"
                      >
                        {{ revealedKeys.has(k.id) ? k.secret : maskSecret(k.secret) }}
                      </code>

                      <button
                        type="button"
                        class="cursor-pointer text-dimmed transition-colors hover:text-default shrink-0"
                        :title="revealedKeys.has(k.id) ? t('providerKeys.hideSecret') : t('providerKeys.showSecret')"
                        @click="toggleReveal(k.id)"
                      >
                        <UIcon :name="revealedKeys.has(k.id) ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-3.5" />
                      </button>

                      <button
                        type="button"
                        class="cursor-pointer text-dimmed transition-colors hover:text-default shrink-0"
                        :title="t('providerKeys.copySecret')"
                        @click="handleCopyKey(k)"
                      >
                        <UIcon
                          :name="copiedKeyId === k.id ? 'i-lucide-check' : 'i-lucide-copy'"
                          class="size-3.5"
                          :class="copiedKeyId === k.id ? 'text-success' : ''"
                        />
                      </button>
                    </div>

                    <!-- 第三行（选填）：备注说明 -->
                    <p
                      v-if="k.description"
                      class="truncate text-xs text-muted"
                      :title="k.description"
                    >
                      {{ k.description }}
                    </p>
                  </div>
                </div>

                <!-- 右侧操作按钮：启用状态开关 + 编辑 + 删除 -->
                <div class="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <USwitch
                    :model-value="k.enabled"
                    :aria-label="t('providers.toggleEnabled')"
                    @update:model-value="v => handleToggleKeyEnabled(k, !!v)"
                  />
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="t('providers.edit')"
                    @click="openEditKey(k)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    :aria-label="t('providers.remove')"
                    @click="confirmDeleteKey(k)"
                  />
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <UEmpty
              v-else
              :title="t('common.empty')"
              variant="naked"
              size="sm"
              :ui="{
                root: 'rounded-lg border border-dashed border-default/70 bg-elevated/20 py-6',
                title: 'text-xs font-medium text-muted'
              }"
            />
          </div>

          <!-- 3. 模型列表 Tab -->
          <div v-else-if="activeTab === 'models'">
            <!-- 模型列表：扁平无边框行 -->
            <div v-if="models.length" ref="modelListEl" class="divide-y divide-default/50">
              <div
                v-for="m in models"
                :key="m.id"
                class="flex items-center justify-between py-2 px-1 hover:bg-elevated/20 transition-colors rounded-sm gap-2"
              >
                <div class="flex min-w-0 flex-1 items-center gap-2.5">
                  <div
                    class="drag-handle flex size-6 shrink-0 cursor-pointer items-center justify-center text-dimmed hover:text-default"
                    role="button"
                    :aria-label="t('providers.dragToSort')"
                  >
                    <UIcon name="i-lucide-grip-vertical" class="size-3.5" />
                  </div>

                  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">
                    <span
                      class="font-mono font-medium truncate"
                      :class="m.enabled ? 'text-highlighted' : 'text-dimmed'"
                    >
                      {{ m.code }}
                    </span>

                    <span v-if="m.name && m.name !== m.code" class="text-muted text-[11px] truncate max-w-[140px]">
                      ({{ m.name }})
                    </span>

                    <UBadge :color="modelTypeBadgeColor(m.type)" variant="subtle" size="xs">
                      {{ m.type }}
                    </UBadge>

                    <UBadge v-if="m.category" color="neutral" variant="outline" size="xs">
                      {{ m.category }}
                    </UBadge>

                    <UBadge
                      :color="m.status === 'ACTIVE' ? 'success' : 'error'"
                      variant="subtle"
                      size="xs"
                    >
                      {{ m.status === 'ACTIVE' ? t('providerModels.statusActive') : t('providerModels.statusInvalid') }}
                    </UBadge>

                    <span v-if="m.maxContext" class="text-muted text-[11px]">
                      {{ formatTokens(m.maxContext) }}
                    </span>

                    <span v-if="m.reasoning && m.reasoning !== 'DISABLE'" class="inline-flex items-center gap-0.5 text-[11px] text-primary">
                      <UIcon name="i-lucide-brain" class="size-3" />
                      <span>{{ m.reasoning }}</span>
                    </span>

                    <span v-if="m.inputModal?.length" class="text-dimmed text-[10px]">
                      {{ t('providerModels.inputModalPrefix') }}: [{{ m.inputModal.join(', ') }}]
                    </span>

                    <span v-if="m.outputModal?.length" class="text-dimmed text-[10px]">
                      {{ t('providerModels.outputModalPrefix') }}: [{{ m.outputModal.join(', ') }}]
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1.5">
                  <USwitch
                    :model-value="m.enabled"
                    :aria-label="t('providers.toggleEnabled')"
                    @update:model-value="v => handleToggleModelEnabled(m, !!v)"
                  />
                  <UButton
                    icon="i-lucide-square-pen"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="t('providers.edit')"
                    @click="openEditModel(m)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    :aria-label="t('providers.remove')"
                    @click="confirmDeleteModel(m)"
                  />
                </div>
              </div>
            </div>

            <UEmpty
              v-else
              :title="t('common.empty')"
              variant="naked"
              size="sm"
              :ui="{
                root: 'rounded-lg border border-dashed border-default/70 bg-elevated/20 py-6',
                title: 'text-xs font-medium text-muted'
              }"
            />
          </div>
        </div>
      </div>

      <!-- 供应商不存在 -->
      <div v-else class="flex min-h-full items-center justify-center p-8">
        <UEmpty
          :title="t('common.empty')"
          variant="naked"
          :ui="{
            root: 'rounded-xl border border-dashed border-default/70 bg-elevated/20 p-8',
            title: 'text-sm font-medium text-muted'
          }"
        />
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
    @saved="() => loadModels(provider!.id)"
  />
</template>

<style scoped>
/* 拖拽落点占位提示 */
:deep(.sortable-ghost) {
  opacity: 0.35;
}
</style>

