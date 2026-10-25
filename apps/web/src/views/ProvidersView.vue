<script setup lang="ts">
import type { Provider } from '@ai-gate/shared'
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSortable } from '@vueuse/integrations/useSortable'
import { storeToRefs } from 'pinia'
import {
  PhDotsSixVertical,
  PhGearSix,
  PhPencilSimple,
  PhPlus,
  PhTrashSimple,
} from '@phosphor-icons/vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useProvidersStore } from '@/stores/providers'
import AppEmpty from '@/components/AppEmpty.vue'
import AppLoading from '@/components/AppLoading.vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import ProviderIcon from '@/components/provider/ProviderIcon.vue'
import ProviderModal from '@/components/provider/ProviderModal.vue'

const router = useRouter()
const store = useProvidersStore()
const {providers, loading} = storeToRefs(store)
const {confirmDialog} = useConfirmDialog()

/** 新增/编辑弹窗状态（editing 为 null = 新增） */
const modalOpen = ref(false)
const editing = ref<Provider | null>(null)

function openCreate() {
  editing.value = null
  modalOpen.value = true
}

function openEdit(p: Provider) {
  editing.value = p
  modalOpen.value = true
}

/** 配置入口：进入供应商配置详情页 */
function openConfig(p: Provider) {
  void router.push(`/providers/${p.id}`)
}

/** 删除：二次确认 */
async function confirmRemove(p: Provider) {
  const confirmed = await confirmDialog({
    title: '删除供应商',
    description: `删除后供应商「${p.name || p.code}」将无法恢复，确定删除？`,
  })
  if (confirmed) await store.removeProvider(p.id)
}

/** 拖拽排序：useSortable 直接绑定 providers 数组（自动同步顺序与 DOM）；拖拽结束持久化 */
const listEl = ref<HTMLElement | null>(null)

useSortable(listEl, providers, {
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
    // 数组同步在 nextTick 中执行，持久化需排在其后读取新顺序
    void nextTick(() => store.saveOrder())
  },
})

onBeforeUnmount(() => {
  document.body.classList.remove('provider-sortable-dragging')
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- 操作栏：右侧新增入口 -->
    <div class="flex shrink-0 items-center justify-end pb-3">
      <Button @click="openCreate">
        <PhPlus data-icon="inline-start" />
        新增
      </Button>
    </div>

    <!-- 加载中 -->
    <AppLoading v-if="loading && !providers.length" />

    <!-- 有数据：一行一条卡片行 -->
    <div
      v-else-if="providers.length"
      class="min-h-0 flex-1 overflow-y-auto"
    >
      <div
        ref="listEl"
        class="flex flex-col gap-2 pb-1"
      >
        <div
          v-for="p in providers"
          :key="p.id"
          class="group hover:border-primary/40 hover:bg-muted/30 flex min-h-16 items-center gap-3 border px-3.5 py-2.5 transition-colors select-none"
        >
          <!-- 拖拽手柄（扩大命中区，hover 高亮）：排序唯一入口 -->
          <div
            class="drag-handle text-muted-foreground hover:bg-muted hover:text-foreground -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center transition-colors"
            aria-hidden="true"
            title="拖拽排序"
          >
            <PhDotsSixVertical class="size-4" />
          </div>

          <ProviderIcon
            :icon="p.icon"
            :name="p.name || p.code"
            size="lg"
          />

          <!-- 图标右侧信息区（第一行名称，第二行描述，超长省略） -->
          <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <span
              class="truncate text-sm font-medium"
              :title="p.name || p.code"
            >{{ p.name || p.code }}</span>
            <p
              v-if="p.remark"
              class="text-muted-foreground truncate text-xs"
              :title="p.remark"
            >{{ p.remark }}</p>
          </div>

          <!-- 启用开关 -->
          <Switch
            :model-value="p.enabled"
            aria-label="切换启用状态"
            class="shrink-0"
            @update:model-value="v => store.toggleProvider(p, !!v)"
          />

          <!-- 配置 / 修改 / 删除 -->
          <div class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-foreground"
              aria-label="配置"
              title="配置"
              @click="openConfig(p)"
            >
              <PhGearSix />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-foreground"
              aria-label="修改"
              title="修改"
              @click="openEdit(p)"
            >
              <PhPencilSimple />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="删除"
              title="删除"
              @click="confirmRemove(p)"
            >
              <PhTrashSimple />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空态 -->
    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center"
    >
      <AppEmpty />
    </div>
  </div>

  <!-- 新增/编辑弹窗 -->
  <ProviderModal
    v-model:open="modalOpen"
    :provider="editing"
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
