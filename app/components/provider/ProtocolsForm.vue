<script setup lang="ts">
import type {ProviderProtocolConfig, ProviderProtocolId} from '~/utils/providers'

/**
 * 端点配置：供应商级模型列表端点 + 端点列表（新增走弹窗：选协议 + 输路径）
 * v-model:protocols 双向绑定协议列表；v-model:modelEndpoint 供应商级模型列表端点；endpoints 直接原地修改（响应式对象）
 */
const protocols = defineModel<ProviderProtocolId[]>('protocols', {required: true})
const modelEndpoint = defineModel<string>('modelEndpoint', {required: true})

const props = defineProps<{
  baseUrl: string
  endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>>
}>()

const {t} = useI18n()
const toast = useToast()

/** 协议增删时同步端点配置：新增补默认值，移除则清理 */
watch(() => [...protocols.value], (list) => {
  for (const p of list) {
    if (!props.endpoints[p]) {
      props.endpoints[p] = {...protocolDefaults[p]}
    }
  }
  for (const p of Object.keys(props.endpoints) as ProviderProtocolId[]) {
    if (!list.includes(p)) delete props.endpoints[p]
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
    <!-- 模型列表端点：供应商级，所有协议共用 -->
    <UFormField :label="t('providers.modelsEndpoint')">
      <UInput v-model="modelEndpoint" class="w-full"/>
      <template #help>
        <span class="block truncate" :title="fullUrl(modelEndpoint)">
          {{ fullUrl(modelEndpoint) }}
        </span>
      </template>
    </UFormField>

    <!-- 端点列表 -->
    <div class="flex items-center justify-between">
      <div class="text-sm font-medium text-highlighted">{{ t('providers.endpointList') }}</div>
      <UButton
        icon="i-lucide-plus"
        variant="outline"
        color="neutral"
        @click="openAdd"
      >
        {{ t('providers.addEndpoint') }}
      </UButton>
    </div>

    <template v-if="protocols.length">
      <div v-for="p in protocols" :key="p" class="space-y-1 rounded-lg border border-default p-4">
        <div class="flex items-center justify-between">
          <div class="text-xs font-medium text-muted">{{ t('providers.protocol.' + p) }}</div>
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            :aria-label="t('providers.removeEndpoint')"
            @click="removeProtocol(p)"
          />
        </div>
        <UInput v-model="endpoints[p]!.chatEndpoint" :placeholder="t('providers.endpointPathPlaceholder')"
                class="w-full"/>
        <span class="block truncate text-xs text-muted" :title="fullUrl(endpoints[p]!.chatEndpoint)">
          {{ fullUrl(endpoints[p]!.chatEndpoint) }}
        </span>
      </div>
    </template>

    <!-- 空态 -->
    <div v-else class="flex flex-col items-center justify-center gap-4 py-12">
      <UEmpty
        :title="t('providers.endpointsEmpty')"
        :description="t('providers.endpointsHint')"
        icon="i-lucide-plug-zap"
        variant="naked"
      />
    </div>

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
