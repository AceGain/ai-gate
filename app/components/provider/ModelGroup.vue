<script setup lang="ts">
import {useSortable} from '@vueuse/integrations/useSortable'
import type {SysModel} from '~/utils/providers'

/**
 * 供应商模型分组列表：按模型分组（category）渲染一个分组
 * 分组头可折叠展开；行内单行压缩展示：显示名 + 模型类型（图标 + 标签）
 * 行内自带可用性测试（最小生成请求经后端转发），结果以 Toast 就近反馈
 */
const props = defineProps<{
  providerId: string
  label: string
  items: SysModel[]
}>()

const emit = defineEmits<{
  reorder: [ids: string[]]
  edit: [item: SysModel]
  remove: [item: SysModel]
  toggle: [item: SysModel, enabled: boolean]
}>()

const {t} = useI18n()
const toast = useToast()
const {testModel} = useProviderConfig()

/** 正在测试的模型 id：单行粒度的加载态 */
const testingId = ref<string | null>(null)

/** 测试失败文案：按后端错误码就近映射 */
function testErrorMessage(code: string | undefined, detail?: string): string {
  switch (code) {
    case 'MISSING_BASE_ENDPOINT':
      return t('providerModels.errorMissingBase')
    case 'MISSING_GENERATE_ENDPOINT':
      return t('providerModels.errorMissingGenerateEndpoint')
    case 'UPSTREAM_UNREACHABLE':
      return t('providerModels.errorUnreachable')
    case 'UPSTREAM_TIMEOUT':
      return t('providerModels.errorUpstreamTimeout')
    case 'UPSTREAM_ERROR':
      return detail ? t('providerModels.testFailedDetail', {detail}) : t('providerModels.testFailed')
    default:
      return t('providers.backendUnavailable')
  }
}

async function runTest(m: SysModel) {
  if (testingId.value) return
  testingId.value = m.id
  try {
    const res = await testModel(props.providerId, m.id)
    toast.add({color: 'success', title: t('providerModels.testSuccess', {ms: res.latencyMs})})
  } catch (err) {
    console.warn('[ai-gate] 测试模型失败', err)
    const data = (err as {data?: {error?: string, detail?: string}}).data
    toast.add({color: 'error', title: testErrorMessage(data?.error, data?.detail)})
  } finally {
    testingId.value = null
  }
}

/** 分组折叠状态：默认展开，页面会话内保持 */
const isOpen = ref(true)

/** 显示名：未设置时回退模型编码 */
function displayName(m: SysModel): string {
  return m.name || m.code
}

/* 拖拽排序绑定本地副本，结束后把新顺序上报父级统一持久化 */
const localItems = ref<SysModel[]>([...props.items])
watch(() => props.items, (v) => {
  localItems.value = [...v]
})

const listEl = ref<HTMLElement | null>(null)

useSortable(listEl, localItems, {
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
    if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
    emit('reorder', localItems.value.map(m => m.id))
  }
})

/** 模型类型图标（与编辑弹窗的类型选项保持一致） */
function modelTypeIcon(type: string): string {
  switch (type) {
    case 'GenText':
      return 'i-lucide-type'
    case 'GenImage':
      return 'i-lucide-image'
    case 'GenVideo':
      return 'i-lucide-video'
    case 'GenAudio':
      return 'i-lucide-music'
    case 'Embedding':
      return 'i-lucide-binary'
    case 'Rerank':
      return 'i-lucide-arrow-up-down'
    default:
      return 'i-lucide-type'
  }
}

function getModelTypeLabel(type: string): string {
  const map: Record<string, string> = {
    GenText: t('providerModels.typeGenText'),
    GenImage: t('providerModels.typeGenImage'),
    GenAudio: t('providerModels.typeGenAudio'),
    GenVideo: t('providerModels.typeGenVideo'),
    Embedding: t('providerModels.typeEmbedding'),
    Rerank: t('providerModels.typeRerank')
  }
  return map[type] || type
}
</script>

<template>
  <UCollapsible v-model:open="isOpen" :unmount-on-hide="false">
    <!-- 分组头：折叠/展开触发器 -->
    <UButton
      color="neutral"
      variant="ghost"
      block
      class="justify-between px-1 py-1.5 rounded-sm"
      :trailing-icon="isOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      :ui="{trailingIcon: 'text-dimmed'}"
    >
      <span class="text-xs font-semibold text-muted">{{ label }}</span>
    </UButton>

    <!-- 模型行：单行压缩（显示名 + 类型徽章） -->
    <template #content>
      <div ref="listEl" class="divide-y divide-default/50">
        <div
          v-for="m in localItems"
          :key="m.id"
          class="group flex items-center justify-between py-1.5 px-1 hover:bg-elevated/20 transition-colors rounded-sm gap-2"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              class="drag-handle flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-dimmed hover:bg-elevated hover:text-default"
              aria-hidden="true"
              :title="t('providers.dragToSort')"
            >
              <UIcon name="i-lucide-grip-vertical" class="size-4"/>
            </div>

            <!-- 单行：显示名（无则回退模型编码）+ 模型类型 + 失效图标（仅异常时） -->
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <span
                class="min-w-0 shrink truncate text-sm font-semibold"
                :class="m.enabled ? 'text-highlighted' : 'text-dimmed'"
                :title="displayName(m)"
              >
                {{ displayName(m) }}
              </span>

              <UBadge
                color="neutral"
                variant="subtle"
                size="sm"
                :icon="modelTypeIcon(m.type)"
                :label="getModelTypeLabel(m.type)"
                class="shrink-0 rounded-sm"
              />

              <UIcon
                v-if="m.status !== 'ACTIVE'"
                name="i-lucide-circle-alert"
                class="size-4 shrink-0 text-error"
                :title="t('providerModels.statusInvalid')"
              />
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1.5">
            <USwitch
              :model-value="m.enabled"
              :aria-label="t('providers.toggleEnabled')"
              @update:model-value="v => emit('toggle', m, !!v)"
            />
            <UButton
              icon="i-lucide-activity"
              variant="ghost"
              color="neutral"
              size="xs"
              :loading="testingId === m.id"
              :aria-label="t('providerModels.testBtn')"
              :title="t('providerModels.testBtn')"
              @click="runTest(m)"
            />
            <UButton
              icon="i-lucide-square-pen"
              variant="ghost"
              color="neutral"
              size="xs"
              :aria-label="t('providers.edit')"
              :title="t('providers.edit')"
              @click="emit('edit', m)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              :aria-label="t('providers.remove')"
              :title="t('providers.remove')"
              @click="emit('remove', m)"
            />
          </div>
        </div>
      </div>
    </template>
  </UCollapsible>
</template>
