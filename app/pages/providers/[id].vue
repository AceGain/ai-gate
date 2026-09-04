<script setup lang="ts">
const {t} = useI18n()
const route = useRoute()
const router = useRouter()
const {getProvider, providers, persist} = useProviders()
const confirmDialog = useConfirmDialog()

const provider = computed(() => getProvider(String(route.params.id)))

// 详情页所有改动自动持久化（useProviders 内已防抖）
watch(provider, () => {
  if (provider.value) persist()
}, {deep: true})

const providerIdExists = computed(() => {
  const p = provider.value
  return !!p && providers.value.some(o => o.providerId === p.providerId && o.id !== p.id)
})

/** 预置供应商选项：与新增弹窗一致（首项"自定义"） */
const presetItems = computed(() => [
  {label: t('providers.presetCustom'), value: 'custom'},
  ...providerPresets.map(p => ({label: p.name, value: p.id, description: p.baseUrl}))
])

/** 选择预置供应商：覆盖前若当前配置已偏离预置值，先二次确认 */
async function onPresetChange(value: string) {
  const p = provider.value
  if (!p) return
  if (presetDeviates(p, value)) {
    const presetName = providerPresets.find(pr => pr.id === value)?.name ?? ''
    const confirmed = await confirmDialog({
      title: t('providers.presetOverwriteTitle'),
      description: t('providers.presetOverwriteDesc', {name: presetName})
    })
    if (!confirmed) return
  }
  p.presetId = value === 'custom' ? null : value
  applyPreset(p, value)
}

/** 新增后的配置引导模式：setup=1 进入，三个步骤全部完成后退出并清理 query */
const setupMode = computed(() => route.query.setup === '1')

const setupSteps = computed(() => {
  const p = provider.value
  if (!p) return []
  return [
    {tab: 'protocols', label: t('providers.setupStepProtocols'), done: p.protocols.length > 0},
    {tab: 'keys', label: t('providers.setupStepKeys'), done: p.keys.length > 0},
    {tab: 'models', label: t('providers.setupStepModels'), done: Object.values(p.models).some(m => m.enabled)}
  ]
})

const setupDone = computed(() => setupSteps.value.every(s => s.done))

watch(setupDone, (done) => {
  if (done && route.query.setup === '1') {
    router.replace({query: {...route.query, setup: undefined}})
  }
})

// 移除协议时清理模型对该协议的引用（端点由 ProviderProtocolsForm 处理）
watch(() => provider.value ? [...provider.value.protocols] : [], (list) => {
  const p = provider.value
  if (!p) return
  for (const m of Object.values(p.models)) {
    const filtered = m.protocols.filter(proto => list.includes(proto))
    if (filtered.length !== m.protocols.length) m.protocols = filtered
  }
})

const tab = ref(route.query.setup === '1' ? 'protocols' : 'basic')

// Tab 栏右侧操作按钮：通过子组件暴露的方法打开对应弹窗（弹窗本身仍在子组件内）
const protocolsRef = ref<{openAdd: () => void} | null>(null)
const keysRef = ref<{openCreate: () => void} | null>(null)
const modelsRef = ref<{openCreate: () => void, openFetch: () => void} | null>(null)

const tabs = computed(() => [
  {label: t('providers.basicInfo'), value: 'basic'},
  {
    label: t('providers.protocolsEndpoints'),
    value: 'protocols',
    badge: provider.value?.protocols.length || undefined
  },
  {
    label: t('providers.keys'),
    value: 'keys',
    badge: provider.value?.keys.length || undefined
  },
  {
    label: t('providers.models'),
    value: 'models',
    badge: Object.keys(provider.value?.models ?? {}).length || undefined
  }
])
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            to="/providers"
          >
            {{ t('providers.back') }}
          </UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <div v-if="provider" class="flex h-full min-h-0 flex-col">
        <!-- 供应商概要 -->
        <div class="shrink-0 px-4 py-2.5">
          <div class="flex items-center gap-3">
            <ProviderIcon :icon="provider.icon" :name="provider.name || provider.providerId" size="lg"/>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-base font-semibold text-highlighted">{{ provider.name }}</span>
                <UBadge v-if="!provider.enabled" variant="subtle" color="warning">
                  {{ t('providers.disabled') }}
                </UBadge>
              </div>
              <p class="truncate text-xs text-muted">{{ provider.providerId }} · {{ provider.baseUrl }}</p>
            </div>
            <USwitch
              v-model="provider.enabled"
              :aria-label="t('providers.toggleEnabled')"
            />
          </div>
        </div>

        <!-- 配置引导步骤条：新增进入且未全部完成时显示，点击切换对应 Tab -->
        <div v-if="setupMode && !setupDone"
             class="flex shrink-0 flex-wrap items-center gap-1.5 border-y border-default bg-elevated/40 px-4 py-2">
          <template v-for="(step, i) in setupSteps" :key="step.label">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
              :class="step.done
                ? 'border-primary/30 bg-primary/10 text-primary'
                : tab === step.tab
                  ? 'border-primary text-primary'
                  : 'border-default text-muted hover:bg-elevated'"
              @click="tab = step.tab"
            >
              <UIcon :name="step.done ? 'i-lucide-check' : 'i-lucide-circle'" class="size-3.5"/>
              <span>{{ i + 1 }}. {{ step.label }}</span>
            </button>
            <UIcon
              v-if="i < setupSteps.length - 1"
              name="i-lucide-chevron-right"
              class="size-3.5 shrink-0 text-dimmed"
            />
          </template>
        </div>

        <!-- 分区标签页：link 变体自带底部分割线，左缘与导航栏标题对齐 -->
        <UTabs
          v-model="tab"
          :items="tabs"
          variant="link"
          color="neutral"
          class="min-h-0 w-full flex-1"
          :ui="{ content: 'min-h-0 flex-1' }"
        >
          <!-- Tab 栏右侧操作区：随当前 Tab 切换，替代各 Tab 内容里的独立操作栏 -->
          <template #list-trailing>
            <div class="ms-auto flex items-center gap-1.5">
              <div v-if="tab === 'basic'" class="flex items-center gap-1 pe-1 text-xs text-muted">
                <UIcon name="i-lucide-cloud-check" class="size-3.5"/>
                <span>{{ t('providers.autosaveHint') }}</span>
              </div>
              <UButton
                v-else-if="tab === 'protocols'"
                icon="i-lucide-plus"
                variant="outline"
                color="neutral"
                @click="protocolsRef?.openAdd()"
              >
                {{ t('providers.addEndpoint') }}
              </UButton>
              <UButton
                v-else-if="tab === 'keys'"
                icon="i-lucide-plus"
                variant="outline"
                color="neutral"
                @click="keysRef?.openCreate()"
              >
                {{ t('providers.addKey') }}
              </UButton>
              <template v-else>
                <UButton
                  icon="i-lucide-cloud-download"
                  variant="outline"
                  color="neutral"
                  @click="modelsRef?.openFetch()"
                >
                  {{ t('providers.fetchModels') }}
                </UButton>
                <UButton
                  icon="i-lucide-plus"
                  variant="outline"
                  color="neutral"
                  @click="modelsRef?.openCreate()"
                >
                  {{ t('providers.addModel') }}
                </UButton>
              </template>
            </div>
          </template>

          <template #content>
            <!-- 基本信息：与新增/编辑弹窗布局一致（图标→供应商→ID→名称→URL→备注） -->
            <div v-if="tab === 'basic'" class="h-full overflow-y-auto p-4">
              <div class="max-w-3xl space-y-4">
                <!-- 图标：上传图片 / 内置品牌图标 -->
                <UFormField :label="t('providers.icon')">
                  <ProviderIconPicker v-model="provider.icon" :name="provider.name"/>
                </UFormField>

                <!-- 供应商：选择预置供应商自动填充基本信息 -->
                <UFormField :label="t('providers.preset')">
                  <USelectMenu
                    :model-value="provider.presetId ?? 'custom'"
                    :items="presetItems"
                    value-key="value"
                    :placeholder="t('providers.presetPlaceholder')"
                    class="w-full"
                    @update:model-value="onPresetChange"
                  />
                </UFormField>

                <UFormField
                  :label="t('providers.providerId')"
                  :error="providerIdExists ? t('providers.providerIdDuplicate') : undefined"
                >
                  <UInput v-model="provider.providerId" class="w-full"/>
                </UFormField>
                <UFormField :label="t('providers.name')">
                  <UInput v-model="provider.name" class="w-full"/>
                </UFormField>

                <UFormField :label="t('providers.baseUrl')">
                  <UInput v-model="provider.baseUrl" class="w-full"/>
                </UFormField>

                <UFormField :label="t('providers.remark')">
                  <UTextarea
                    v-model="provider.remark"
                    autoresize
                    :rows="2"
                    :placeholder="t('providers.remarkPlaceholder')"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>

            <!-- 协议与端点 -->
            <div v-else-if="tab === 'protocols'" class="h-full overflow-y-auto p-4">
              <div class="max-w-3xl">
                <ProviderProtocolsForm
                  ref="protocolsRef"
                  v-model:protocols="provider.protocols"
                  v-model:default-protocol="provider.defaultProtocol"
                  v-model:model-endpoint="provider.modelsEndpoint"
                  :base-url="provider.baseUrl"
                  :endpoints="provider.endpoints"
                />
              </div>
            </div>

            <!-- 密钥 -->
            <div v-else-if="tab === 'keys'" class="h-full overflow-y-auto p-4">
              <div class="max-w-3xl">
                <ProviderKeys ref="keysRef" :provider="provider"/>
              </div>
            </div>

            <!-- 模型 -->
            <div v-else-if="tab === 'models'" class="h-full overflow-y-auto p-4">
              <div class="max-w-3xl">
                <ProviderModels ref="modelsRef" :provider="provider"/>
              </div>
            </div>
          </template>
        </UTabs>
      </div>

      <div v-else class="flex min-h-full flex-col items-center justify-center gap-4">
        <UEmpty :title="t('providers.notFound')" variant="naked"/>
        <UButton icon="i-lucide-arrow-left" to="/providers">
          {{ t('providers.back') }}
        </UButton>
      </div>
    </template>
  </UDashboardPanel>
</template>
