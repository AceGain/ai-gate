<script setup lang="ts">
import {useSortable} from '@vueuse/integrations/useSortable'
import type {SysProvider} from '~/utils/providers'

const {t} = useI18n()
const {providers, loading, removeProvider, toggleProvider, saveOrder} = useProviders()
const confirmDialog = useConfirmDialog()

/** 新增/编辑弹窗状态（editing 为 null = 新增） */
const modalOpen = ref(false)
const editing = ref<SysProvider | null>(null)

function openCreate() {
  editing.value = null
  modalOpen.value = true
}

function openEdit(p: SysProvider) {
  editing.value = p
  modalOpen.value = true
}

/** 配置入口：进入供应商配置详情页 */
function openConfig(p: SysProvider) {
  navigateTo(`/providers/${p.id}`)
}

/** 删除：二次确认 */
async function confirmRemove(p: SysProvider) {
  const confirmed = await confirmDialog({
    title: t('providers.removeConfirmTitle'),
    description: t('providers.removeConfirmDesc', {name: p.name || p.code})
  })
  if (confirmed) await removeProvider(p.id)
}

/** 拖拽排序：useSortable 直接绑定 providers 数组（自动同步顺序与 DOM）；拖拽结束持久化 */
const listEl = ref<HTMLElement | null>(null)

useSortable(listEl, providers, {
  handle: '.drag-handle',
  animation: 150,
  // Tauri WebView2 的原生 file-drop 处理会拦截 HTML5 drag 事件，导致拖拽完全无效；
  // forceFallback 改用纯鼠标事件模拟拖拽，Web 与桌面端行为一致
  forceFallback: true,
  // 拖拽跟随元素挂到 body：避免被列表的 overflow-y-auto 滚动容器裁剪
  fallbackOnBody: true,
  // 列表容器在 v-if 内（空态切换），需监听元素变化自动重建实例
  watchElement: true,
  onStart: () => {
    // fallback 模式浏览器不接管光标，会随指针下方元素来回切换（手↔箭头闪烁）；拖拽期间全局锁定
    document.body.classList.add('provider-sortable-dragging')
  },
  onEnd: (evt) => {
    document.body.classList.remove('provider-sortable-dragging')
    if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
    // 数组同步在 nextTick 中执行，持久化需排在其后读取新顺序
    void nextTick(() => saveOrder())
  }
})

onBeforeUnmount(() => {
  document.body.classList.remove('provider-sortable-dragging')
})
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton icon="i-lucide-plus" variant="ghost" @click="openCreate">{{ t('providers.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <!-- 加载中骨架屏 -->
      <div v-if="loading && !providers.length" class="h-full overflow-y-auto p-4">
        <div class="flex flex-col gap-2.5">
          <div
            v-for="i in 5"
            :key="i"
            class="flex min-h-[56px] items-center gap-2.5 rounded-sm border border-default bg-default px-3 py-2"
          >
            <USkeleton class="size-7 rounded-sm" />
            <USkeleton class="size-8 rounded-sm" />
            <div class="flex-1 space-y-1.5">
              <USkeleton class="h-4 w-32 rounded-sm" />
              <USkeleton class="h-3 w-48 rounded-sm" />
            </div>
            <USkeleton class="h-5 w-9 rounded-sm" />
            <div class="flex items-center gap-1">
              <USkeleton class="size-6 rounded-sm" />
              <USkeleton class="size-6 rounded-sm" />
              <USkeleton class="size-6 rounded-sm" />
            </div>
          </div>
        </div>
      </div>

      <!-- 有数据：一行一条独立卡片，严格贴合范式 A -->
      <div v-else-if="providers.length" class="h-full overflow-y-auto p-4">
        <div ref="listEl" class="flex flex-col gap-2.5">
          <div
            v-for="p in providers"
            :key="p.id"
            class="flex min-h-[56px] select-none items-center gap-2.5 rounded-sm border border-default bg-default px-3 py-2 transition-colors hover:border-primary/40 hover:bg-elevated/50"
          >
            <!-- 拖拽手柄（扩大命中区，hover 高亮） -->
            <div
              class="drag-handle -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-dimmed transition-colors hover:bg-elevated hover:text-default"
              role="button"
              :aria-label="t('providers.dragToSort')"
            >
              <UIcon name="i-lucide-grip-vertical" class="size-4"/>
            </div>

            <ProviderIcon :icon="p.icon" :name="p.name || p.code"/>

            <!-- 图标右侧信息区（第一行名称，第二行备注，超长省略） -->
            <div class="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <span
                class="truncate text-sm font-medium"
                :class="p.enabled ? 'text-highlighted' : 'text-dimmed'"
                :title="p.name || p.code"
              >{{ p.name || p.code }}</span>
              <p
                v-if="p.description"
                class="truncate text-xs text-muted"
                :title="p.description"
              >{{ p.description }}</p>
            </div>

            <!-- 启用开关 -->
            <USwitch
              :model-value="p.enabled"
              :aria-label="t('providers.toggleEnabled')"
              class="shrink-0"
              @update:model-value="v => toggleProvider(p, !!v)"
            />

            <!-- 配置 / 修改 / 删除 -->
            <div class="flex items-center gap-1 shrink-0">
              <UButton
                icon="i-lucide-settings-2"
                variant="ghost"
                color="neutral"
                class="text-muted hover:text-default"
                :aria-label="t('providers.config')"
                @click="openConfig(p)"
              />
              <UButton
                icon="i-lucide-square-pen"
                variant="ghost"
                color="neutral"
                class="text-muted hover:text-default"
                :aria-label="t('providers.edit')"
                @click="openEdit(p)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                class="text-muted hover:text-error"
                :aria-label="t('providers.remove')"
                @click="confirmRemove(p)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 空态 -->
      <div v-else class="flex min-h-full items-center justify-center p-4">
        <UEmpty
          :title="t('common.empty')"
          variant="naked"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- 新增/编辑弹窗 -->
  <ProviderModal v-model:open="modalOpen" :provider="editing"/>
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
