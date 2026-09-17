<script setup lang="ts">
import {useSortable} from '@vueuse/integrations/useSortable'
import type {SysModel} from '~/utils/providers'

/**
 * 供应商模型分组列表：按模型分组（category）渲染一个分组
 * 分组头可折叠展开；行内单行压缩展示：显示名 + 完整模型标识（供应商编码/模型编码）+ 类型图标
 */
const props = defineProps<{
  label: string
  providerCode: string
  items: SysModel[]
}>()

const emit = defineEmits<{
  reorder: [ids: string[]]
  edit: [item: SysModel]
  remove: [item: SysModel]
  toggle: [item: SysModel, enabled: boolean]
}>()

const {t} = useI18n()

/** 分组折叠状态：默认展开，页面会话内保持 */
const isOpen = ref(true)

/** 对外完整模型标识：供应商编码/模型编码 */
function fullCode(m: SysModel): string {
  return `${props.providerCode}/${m.code}`
}

function displayName(m: SysModel): string {
  return m.name || fullCode(m)
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

/** 模型类型图标颜色（语义 Token） */
function modelTypeColor(type: string): string {
  switch (type) {
    case 'GenText':
      return 'text-primary'
    case 'GenImage':
      return 'text-secondary'
    case 'GenAudio':
    case 'GenVideo':
      return 'text-warning'
    case 'Embedding':
      return 'text-success'
    default:
      return 'text-neutral'
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

    <!-- 模型行：单行压缩（显示名 + 完整模型标识 + 类型徽章） -->
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

            <!-- 单行：显示名（无则回退完整标识）+ 完整模型标识 + 类型图标 + 失效图标（仅异常时） -->
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <span
                class="min-w-0 shrink truncate text-sm font-semibold"
                :class="m.enabled ? 'text-highlighted' : 'text-dimmed'"
                :title="displayName(m)"
              >
                {{ displayName(m) }}
              </span>

              <code
                v-if="m.name && m.name !== m.code"
                class="min-w-0 shrink truncate text-xs text-muted select-all"
                :title="fullCode(m)"
              >
                {{ fullCode(m) }}
              </code>

              <UIcon
                :name="modelTypeIcon(m.type)"
                class="size-4 shrink-0"
                :class="modelTypeColor(m.type)"
                :title="getModelTypeLabel(m.type)"
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
              icon="i-lucide-square-pen"
              variant="ghost"
              color="neutral"
              size="xs"
              :aria-label="t('providers.edit')"
              @click="emit('edit', m)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              :aria-label="t('providers.remove')"
              @click="emit('remove', m)"
            />
          </div>
        </div>
      </div>
    </template>
  </UCollapsible>
</template>
