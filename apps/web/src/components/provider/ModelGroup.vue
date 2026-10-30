<script setup lang="ts">
import type { SModel } from '@ai-gate/shared'
import { computed, nextTick, ref, watch } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import {
  PhArrowsDownUp,
  PhBracketsAngle,
  PhCaretDown,
  PhDotsSixVertical,
  PhImage,
  PhIntersectThree,
  PhPencilSimple,
  PhPulse,
  PhTag,
  PhTextT,
  PhTrashSimple,
  PhVideoCamera,
  PhWarningCircle,
  PhWaveform,
} from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { ApiError } from '@/lib/api'
import { useProvidersStore } from '@/stores/providers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/**
 * 供应商模型分组列表：按模型分组（category）渲染一个分组卡片
 * 分组头可折叠展开；行内单行压缩展示：显示名 + 模型类型徽章
 * 行内自带可用性测试（最小生成请求经后端转发），结果以 Toast 就近反馈
 */
const props = defineProps<{
  providerId: number
  label: string
  items: SModel[]
}>()

const emit = defineEmits<{
  reorder: [ids: number[]]
  edit: [item: SModel]
  remove: [item: SModel]
  toggle: [item: SModel, enabled: boolean]
}>()

const store = useProvidersStore()

/** 正在测试的模型 id：单行粒度的加载态 */
const testingId = ref<number | null>(null)

/** 测试失败文案：按后端错误码就近映射 */
function testErrorMessage(code: string | undefined, detail?: string): string {
  switch (code) {
    case 'MISSING_BASE_ENDPOINT':
      return t('errors.missingBaseEndpoint')
    case 'MISSING_GENERATE_ENDPOINT':
      return t('errors.missingGenerateEndpoint')
    case 'UPSTREAM_UNREACHABLE':
      return t('errors.upstreamUnreachable')
    case 'UPSTREAM_TIMEOUT':
      return t('errors.upstreamTimeout')
    case 'UPSTREAM_ERROR':
      return detail ? t('models.unavailableDetail', { detail: detail }) : t('models.unavailable')
    default:
      return t('errors.backendUnavailable')
  }
}

async function runTest(m: SModel) {
  if (testingId.value) return
  testingId.value = m.id
  try {
    const res = await store.testModel(props.providerId, m.id)
    toast.success(t('models.testSuccess', { latency: res.latencyMs }))
  } catch (err) {
    console.warn('[ai-gate] 测试模型失败', err)
    const apiErr = err instanceof ApiError ? err : undefined
    toast.error(testErrorMessage(apiErr?.code, apiErr?.detail))
  } finally {
    testingId.value = null
  }
}

/** 分组折叠状态：默认展开，页面会话内保持 */
const isOpen = ref(true)

/** 显示名：未设置时回退模型编码 */
function displayName(m: SModel): string {
  return m.name || m.code
}

/* 拖拽排序绑定本地副本，结束后把新顺序上报父级统一持久化 */
const localItems = ref<SModel[]>([...props.items])
watch(() => props.items, (v) => {
  localItems.value = [...v]
})

const listEl = ref<HTMLElement | null>(null)

useSortable(listEl, localItems, {
  handle: '.drag-handle',
  animation: 150,
  // Tauri 内部拖放处理器启用时会替换 WebView2 的拖放实现并拦截 HTML5 drag；
  // forceFallback 保持 Web/桌面行为一致（与 v1 相同的已验证策略）
  forceFallback: true,
  // 拖拽跟随元素挂到 body：避免被列表的滚动容器裁剪
  fallbackOnBody: true,
  // 列表容器在 v-if 内（空态切换），需监听元素变化自动重建实例
  watchElement: true,
  onStart: () => {
    document.body.classList.add('provider-sortable-dragging')
  },
  onEnd: (evt) => {
    document.body.classList.remove('provider-sortable-dragging')
    if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
    // useSortable 的数组同步推迟到 nextTick，须待其落地后再读取新顺序
    void nextTick(() => emit('reorder', localItems.value.map(m => m.id)))
  },
})

/** 模型类型图标与标签（与编辑弹窗的类型选项保持一致） */
const typeMeta = computed(() => new Map<string, {icon: typeof PhTextT, label: string}>([
  ['TEXT', {icon: PhTextT, label: t('models.types.text')}],
  ['IMAGE', {icon: PhImage, label: t('models.types.image')}],
  ['AUDIO', {icon: PhWaveform, label: t('models.types.audio')}],
  ['VIDEO', {icon: PhVideoCamera, label: t('models.types.video')}],
  ['OMNI', {icon: PhIntersectThree, label: t('models.types.omni')}],
  ['EMBEDDING', {icon: PhBracketsAngle, label: t('models.types.embedding')}],
  ['RERANK', {icon: PhArrowsDownUp, label: t('models.types.rerank')}],
  ['CLASS', {icon: PhTag, label: t('models.types.class')}],
]))
</script>

<template>
  <div class="overflow-hidden border">
    <Collapsible v-model:open="isOpen">
      <!-- 分组头：折叠/展开触发器，标题栏底色与内容分层 -->
      <CollapsibleTrigger
        as-child
      >
        <button
          type="button"
          class="bg-muted/50 hover:bg-muted flex w-full cursor-pointer items-center justify-between px-2 py-2 transition-colors"
          :title="label"
        >
          <span class="truncate text-xs font-semibold">{{ label }}</span>
          <PhCaretDown class="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>

      <!-- 模型行：单行压缩（显示名 + 类型徽章） -->
      <CollapsibleContent>
        <div
          ref="listEl"
          class="divide-y"
        >
          <div
            v-for="m in localItems"
            :key="m.id"
            class="group hover:bg-muted/40 flex items-center justify-between gap-2 px-2 py-1.5 transition-colors"
          >
            <div class="flex min-w-0 flex-1 items-center gap-2.5">
              <div
                class="drag-handle text-muted-foreground hover:bg-muted hover:text-foreground -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center transition-colors"
                aria-hidden="true"
                :title="t('common.dragToSort')"
              >
                <PhDotsSixVertical class="size-4" />
              </div>

              <!-- 单行：显示名（无则回退模型编码）+ 模型类型 + 失效图标（仅异常时） -->
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <span
                  class="min-w-0 shrink truncate text-xs font-medium"
                  :title="displayName(m)"
                >{{ displayName(m) }}</span>

                <Badge
                  variant="secondary"
                  class="shrink-0"
                >
                  <component :is="typeMeta.get(m.type)?.icon ?? PhTextT" />
                  {{ typeMeta.get(m.type)?.label ?? m.type }}
                </Badge>

                <PhWarningCircle
                  v-if="m.status !== 'ACTIVE'"
                  class="text-destructive size-4 shrink-0"
                  :title="t('common.invalid')"
                />
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <Switch
                size="sm"
                :model-value="m.enabled"
                :aria-label="t('common.toggleEnabled')"
                @update:model-value="v => emit('toggle', m, !!v)"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="testingId === m.id"
                :aria-label="t('common.test')"
                :title="t('common.test')"
                @click="runTest(m)"
              >
                <Spinner v-if="testingId === m.id" />
                <PhPulse v-else />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="t('common.edit')"
                :title="t('common.edit')"
                @click="emit('edit', m)"
              >
                <PhPencilSimple />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-destructive hover:bg-destructive/10"
                :aria-label="t('common.delete')"
                :title="t('common.delete')"
                @click="emit('remove', m)"
              >
                <PhTrashSimple />
              </Button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>

<style scoped>
/* 拖拽落点占位提示 */
:deep(.sortable-ghost) {
  opacity: 0.35;
}
</style>
