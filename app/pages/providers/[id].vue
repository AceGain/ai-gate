<script setup lang="ts">
import {useClipboard} from '@vueuse/core'
import {useSortable} from '@vueuse/integrations/useSortable'
import type {
  SysEndpoint,
  SysKey,
  SysModel,
  SysProvider
} from '~/utils/providers'

const {t} = useI18n()
const route = useRoute()
const toast = useToast()
const confirmDialog = useConfirmDialog()
const {copy, copied} = useClipboard()

const {providers, toggleProvider} = useProviders()
const {
  endpoints,
  keys,
  models,
  loadAll,
  loadEndpoints,
  removeEndpoint,
  updateKey,
  removeKey,
  saveKeyOrder,
  updateModel,
  removeModel,
  saveModelOrder
} = useProviderConfig()

const id = computed(() => route.params.id as string)
const provider = computed<SysProvider | undefined>(() => providers.value.find(p => p.id === id.value))
const title = computed(() => provider.value ? (provider.value.name || provider.value.code) : t('providers.configTitle'))

onMounted(() => {
  if (id.value) void loadAll(id.value)
})

watch(id, (newId) => {
  if (newId) void loadAll(newId)
})

/* ---------------- 1. 供应商基础信息编辑弹窗 ---------------- */
const editModalOpen = ref(false)

function openEditProvider() {
  editModalOpen.value = true
}

/* ---------------- 2. 端点操作与弹窗 ---------------- */
const endpointModalOpen = ref(false)
const editingEndpoint = ref<SysEndpoint | null>(null)

function openCreateEndpoint() {
  editingEndpoint.value = null
  endpointModalOpen.value = true
}

function openEditEndpoint(ep: SysEndpoint) {
  editingEndpoint.value = ep
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

function typeBadgeColor(type: string): 'primary' | 'secondary' | 'neutral' {
  switch (type) {
    case 'base':
      return 'primary'
    case 'models':
      return 'secondary'
    case 'protocol':
      return 'neutral'
    default:
      return 'neutral'
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

/* ---------------- Tab 标签页切换 ---------------- */
type TabKey = 'endpoints' | 'keys' | 'models'
const validTabs: TabKey[] = ['endpoints', 'keys', 'models']
const activeTab = ref<TabKey>(
  validTabs.includes(route.query.tab as TabKey) ? (route.query.tab as TabKey) : 'endpoints'
)

watch(activeTab, (tab) => {
  void navigateTo({query: {...route.query, tab}}, {replace: true})
})

const tabs = computed(() => [
  {id: 'endpoints' as const, label: t('providerEndpoints.title'), icon: 'i-lucide-network'},
  {id: 'keys' as const, label: t('providerKeys.title'), icon: 'i-lucide-key-round'},
  {id: 'models' as const, label: t('providerModels.title'), icon: 'i-lucide-cpu'}
])
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
    <!-- 极简顶栏：轻量面包屑导航 + 状态微标 + 开关 -->
    <template #header>
      <AppNavbar :title="title">
        <template #title>
          <div class="flex items-center gap-2 text-sm">
            <NuxtLink
              to="/providers"
              class="text-muted transition-colors hover:text-default"
            >
              {{ t('providers.title') }}
            </NuxtLink>
            <span class="text-dimmed">/</span>
            <template v-if="provider">
              <span class="truncate font-semibold text-highlighted">
                {{ provider.name || provider.code }}
              </span>
              <UButton
                icon="i-lucide-square-pen"
                variant="ghost"
                color="neutral"
                size="xs"
                :title="t('providers.edit')"
                :aria-label="t('providers.edit')"
                @click="openEditProvider"
              />
            </template>
            <span v-else>{{ title }}</span>
          </div>
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <div v-if="provider" class="flex items-center gap-1.5 rounded-full border border-default bg-elevated/50 px-2.5 py-1 text-xs">
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
              icon="i-lucide-arrow-left"
              variant="ghost"
              color="neutral"
              size="sm"
              to="/providers"
              :aria-label="t('common.back')"
              :title="t('common.back')"
            >
              <span class="hidden sm:inline">{{ t('common.back') }}</span>
            </UButton>
          </div>
        </template>
      </AppNavbar>
    </template>

    <!-- 页面内容：顶部干净 Tab 栏切换，各 Tab 单屏适读、扁平无卡片框 -->
    <template #body>
      <div v-if="provider" class="flex h-full flex-col overflow-hidden">
        <!-- 顶部 Tab 栏：干净利落的下划线切换条 -->
        <div class="flex shrink-0 items-center gap-6 border-b border-default bg-default px-6">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="relative flex items-center gap-2 py-3 text-sm font-medium transition-colors cursor-pointer"
            :class="activeTab === tab.id ? 'text-highlighted font-semibold' : 'text-muted hover:text-default'"
            @click="activeTab = tab.id"
          >
            <UIcon :name="tab.icon" class="size-4" />
            <span>{{ tab.label }}</span>
            <span
              v-if="activeTab === tab.id"
              class="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
            />
          </button>
        </div>

        <!-- 各 Tab 内容区域：单屏适读、直接标题 + 下方内容、滚动自适应 -->
        <div class="flex-1 overflow-y-auto">
          <!-- 1. 网络端点 Tab -->
          <div v-if="activeTab === 'endpoints'" class="mx-auto max-w-5xl space-y-4 p-6">
            <div class="flex items-center justify-between border-b border-default pb-2">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  {{ t('providerEndpoints.title') }}
                </h2>
                <p class="mt-0.5 text-xs text-muted">
                  {{ t('providerEndpoints.desc') }}
                </p>
              </div>

              <UButton
                icon="i-lucide-plus"
                size="xs"
                @click="openCreateEndpoint"
              >
                {{ t('providers.add') }}
              </UButton>
            </div>

            <!-- 端点列表：扁平无边框行 -->
            <div v-if="endpoints.length" class="divide-y divide-default">
              <div
                v-for="ep in endpoints"
                :key="ep.id"
                class="flex items-center justify-between py-2.5 px-1 hover:bg-elevated/20 transition-colors rounded-sm"
              >
                <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">
                  <UBadge :color="typeBadgeColor(ep.type)" variant="subtle" size="xs">
                    {{ ep.type }}
                  </UBadge>

                  <UBadge
                    v-if="ep.protocol"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    class="font-mono"
                  >
                    {{ ep.protocol }}
                  </UBadge>

                  <UBadge
                    v-if="ep.isDefault"
                    color="success"
                    variant="subtle"
                    size="xs"
                  >
                    {{ t('providerEndpoints.defaultBadge') }}
                  </UBadge>

                  <code class="font-mono text-highlighted select-all text-xs">
                    {{ ep.path }}
                  </code>
                </div>

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

            <UEmpty
              v-else
              icon="i-lucide-network"
              :title="t('common.empty')"
              variant="naked"
              size="sm"
              :ui="{
                root: 'rounded-lg border border-dashed border-default/70 bg-elevated/20 py-8 gap-1.5',
                title: 'text-xs font-medium text-muted'
              }"
            />
          </div>

          <!-- 2. API 密钥 Tab -->
          <div v-else-if="activeTab === 'keys'" class="mx-auto max-w-5xl space-y-4 p-6">
            <div class="flex items-center justify-between border-b border-default pb-2">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  {{ t('providerKeys.title') }}
                </h2>
                <p class="mt-0.5 text-xs text-muted">
                  {{ t('providerKeys.desc') }}
                </p>
              </div>

              <UButton
                icon="i-lucide-plus"
                size="xs"
                @click="openCreateKey"
              >
                {{ t('providers.add') }}
              </UButton>
            </div>

            <!-- 密钥列表：扁平无边框行 -->
            <div v-if="keys.length" ref="keyListEl" class="divide-y divide-default">
              <div
                v-for="k in keys"
                :key="k.id"
                class="flex items-center justify-between py-2.5 px-1 hover:bg-elevated/20 transition-colors rounded-sm gap-2"
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
                      class="truncate font-medium text-sm"
                      :class="k.enabled ? 'text-highlighted' : 'text-dimmed'"
                    >
                      {{ k.name }}
                    </span>

                    <UBadge
                      :color="k.status === 'ACTIVE' ? 'success' : 'error'"
                      variant="subtle"
                      size="xs"
                    >
                      {{ k.status === 'ACTIVE' ? t('providerKeys.statusActive') : t('providerKeys.statusInvalid') }}
                    </UBadge>

                    <span class="text-muted text-[11px]">
                      {{ k.expiresTime || t('providerKeys.permanent') }}
                    </span>

                    <span class="font-mono text-muted bg-elevated/60 px-1.5 py-0.5 rounded text-[11px]">
                      {{ revealedKeys.has(k.id) ? k.secret : maskSecret(k.secret) }}
                    </span>

                    <button
                      type="button"
                      class="cursor-pointer text-dimmed transition-colors hover:text-default"
                      :title="revealedKeys.has(k.id) ? t('providerKeys.hideSecret') : t('providerKeys.showSecret')"
                      @click="toggleReveal(k.id)"
                    >
                      <UIcon :name="revealedKeys.has(k.id) ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-3" />
                    </button>

                    <button
                      type="button"
                      class="cursor-pointer text-dimmed transition-colors hover:text-default"
                      :title="t('providerKeys.copySecret')"
                      @click="handleCopy(k.secret)"
                    >
                      <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="size-3" />
                    </button>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1.5">
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

            <UEmpty
              v-else
              icon="i-lucide-key-round"
              :title="t('common.empty')"
              variant="naked"
              size="sm"
              :ui="{
                root: 'rounded-lg border border-dashed border-default/70 bg-elevated/20 py-8 gap-1.5',
                title: 'text-xs font-medium text-muted'
              }"
            />
          </div>

          <!-- 3. 模型列表 Tab -->
          <div v-else-if="activeTab === 'models'" class="mx-auto max-w-5xl space-y-4 p-6">
            <div class="flex items-center justify-between border-b border-default pb-2">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  {{ t('providerModels.title') }}
                </h2>
                <p class="mt-0.5 text-xs text-muted">
                  {{ t('providerModels.desc') }}
                </p>
              </div>

              <UButton
                icon="i-lucide-plus"
                size="xs"
                @click="openCreateModel"
              >
                {{ t('providers.add') }}
              </UButton>
            </div>

            <!-- 模型列表：扁平无边框行 -->
            <div v-if="models.length" ref="modelListEl" class="divide-y divide-default">
              <div
                v-for="m in models"
                :key="m.id"
                class="flex items-center justify-between py-2.5 px-1 hover:bg-elevated/20 transition-colors rounded-sm gap-2"
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
                      In: [{{ m.inputModal.join(', ') }}]
                    </span>

                    <span v-if="m.outputModal?.length" class="text-dimmed text-[10px]">
                      Out: [{{ m.outputModal.join(', ') }}]
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
              icon="i-lucide-cpu"
              :title="t('common.empty')"
              variant="naked"
              size="sm"
              :ui="{
                root: 'rounded-lg border border-dashed border-default/70 bg-elevated/20 py-8 gap-1.5',
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
          icon="i-lucide-server-cog"
          variant="naked"
          :ui="{
            root: 'rounded-xl border border-dashed border-default/70 bg-elevated/20 p-8 gap-2',
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
    @saved="() => loadEndpoints(provider!.id)"
  />

  <ProviderKeyModal
    v-if="provider"
    v-model:open="keyModalOpen"
    :provider-id="provider.id"
    :key-item="editingKey"
    @saved="() => loadAll(provider!.id)"
  />

  <ProviderModelModal
    v-if="provider"
    v-model:open="modelModalOpen"
    :provider-id="provider.id"
    :model-item="editingModel"
    @saved="() => loadAll(provider!.id)"
  />
</template>
