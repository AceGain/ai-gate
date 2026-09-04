<script setup lang="ts">
import type {ProviderProtocolConfig, ProviderProtocolId} from '~/utils/providers'

/**
 * 端点配置：供应商级模型列表端点 + 端点列表（新增走弹窗：选协议 + 输路径）
 * v-model:protocols 双向绑定协议列表；v-model:modelEndpoint 供应商级模型列表端点；
 * v-model:defaultProtocol 默认协议（网关请求优先使用）；endpoints 直接原地修改（响应式对象）
 */
const protocols = defineModel<ProviderProtocolId[]>('protocols', {required: true})
const modelEndpoint = defineModel<string>('modelEndpoint', {required: true})
const defaultProtocol = defineModel<ProviderProtocolId | null>('defaultProtocol', {required: true})

const props = defineProps<{
  baseUrl: string
  endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>>
}>()

const {t} = useI18n()
const toast = useToast()

/** 协议增删时同步端点配置：新增补默认值，移除则清理；默认协议失效时回退到首个协议 */
watch(() => [...protocols.value], (list) => {
  for (const p of list) {
    if (!props.endpoints[p]) {
      props.endpoints[p] = {...protocolDefaults[p]}
    }
  }
  for (const p of Object.keys(props.endpoints) as ProviderProtocolId[]) {
    if (!list.includes(p)) delete props.endpoints[p]
  }
  if (!defaultProtocol.value || !list.includes(defaultProtocol.value)) {
    defaultProtocol.value = list[0] ?? null
  }
})

/** 新增端点弹窗 */
const addOpen = ref(false)
const addForm = reactive({
  protocol: undefined as ProviderProtocolId | undefined,
  path: ''
})

/** 可选协议（尚未配置端点的协议） */
const addableItems = computed(() =>
  providerProtocols
    .filter(p => !protocols.value.includes(p.id))
    .map(p => ({label: t(p.labelKey), value: p.id}))
)

function openAdd() {
  addForm.protocol = undefined
  addForm.path = ''
  addOpen.value = true
}

// 新增端点按钮在父页面 Tab 栏右侧，通过此暴露打开弹窗
defineExpose({openAdd})

/** 选择协议后自动填充默认端点路径 */
watch(() => addForm.protocol, (p) => {
  if (p) addForm.path = protocolDefaults[p].chatEndpoint
})

function confirmAdd() {
  const p = addForm.protocol
  if (!p) {
    toast.add({color: 'error', title: t('providers.protocolRequired')})
    return
  }
  protocols.value = [...protocols.value, p]
  props.endpoints[p] = {chatEndpoint: addForm.path.trim() || protocolDefaults[p].chatEndpoint}
  addOpen.value = false
}

function removeProtocol(id: ProviderProtocolId) {
  protocols.value = protocols.value.filter(p => p !== id)
}

/** 完整 URL 预览：拼接基础 URL 与端点路径（截断显示，完整内容悬浮可见） */
function fullUrl(path: string) {
  return joinUrl(props.baseUrl.trim() || t('providers.baseUrlEmptyPreview'), path)
}
</script>

<template>
  <div class="space-y-4">
    <!-- 端点列表：divide-y 行样式，行内操作悬浮显现（新增端点按钮在 Tab 栏右侧） -->
    <div v-if="protocols.length" class="divide-y divide-default overflow-hidden rounded-lg border border-default">
      <div
        v-for="p in protocols"
        :key="p"
        class="space-y-2 bg-default px-4 py-3 transition-colors hover:bg-elevated/50"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-highlighted">{{ t('providers.protocol.' + p) }}</div>
          <div class="flex items-center gap-1">
            <!-- 默认协议：胶囊形态，当前默认内部填充 primary（如开关滑块），其余空胶囊可点击 -->
            <button
              type="button"
              class="flex h-6 items-center rounded-full border transition-colors disabled:cursor-default"
              :class="p === defaultProtocol
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-default text-dimmed hover:text-default hover:bg-elevated'"
              :aria-label="t('providers.setDefaultProtocol')"
              :disabled="p === defaultProtocol"
              @click="defaultProtocol = p"
            >
              <UIcon name="i-lucide-star" class="mx-1 size-3.5"/>
            </button>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              :aria-label="t('providers.removeEndpoint')"
              @click="removeProtocol(p)"
            />
          </div>
        </div>
        <UInput v-model="endpoints[p]!.chatEndpoint" :placeholder="t('providers.endpointPathPlaceholder')"
                class="w-full"/>
        <span class="block truncate text-xs text-muted" :title="fullUrl(endpoints[p]!.chatEndpoint)">
          {{ fullUrl(endpoints[p]!.chatEndpoint) }}
        </span>
      </div>
    </div>

    <!-- 空态 -->
    <div v-else class="py-16">
      <UEmpty
        :title="t('providers.endpointsEmpty')"
        :description="t('providers.endpointsHint')"
        icon="i-lucide-plug-zap"
        variant="naked"
      />
    </div>

    <!-- 辅助设置：模型列表端点（供应商级，所有协议共用；置于列表下方，与密钥策略位置一致） -->
    <USeparator/>
    <UFormField :label="t('providers.modelsEndpoint')">
      <UInput v-model="modelEndpoint" class="w-full"/>
      <template #help>
        <span class="block truncate" :title="fullUrl(modelEndpoint)">
          {{ fullUrl(modelEndpoint) }}
        </span>
      </template>
    </UFormField>

    <!-- 新增端点弹窗 -->
    <UModal
      v-model:open="addOpen"
      :title="t('providers.addEndpointTitle')"
      :ui="{ footer: 'justify-end gap-2' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('providers.protocols')">
            <USelectMenu
              v-model="addForm.protocol"
              :items="addableItems"
              value-key="value"
              :placeholder="t('providers.protocolsPlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('providers.endpointPath')">
            <UInput
              v-model="addForm.path"
              :placeholder="t('providers.endpointPathPlaceholder')"
              class="w-full"
            />
            <template #help>
              <span class="block truncate" :title="fullUrl(addForm.path)">
                {{ fullUrl(addForm.path) }}
              </span>
            </template>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <UButton variant="solid" color="neutral" @click="addOpen = false">
          {{ t('providers.cancel') }}
        </UButton>
        <UButton icon="i-lucide-check" :disabled="!addForm.protocol" @click="confirmAdd">
          {{ t('common.confirm') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>
