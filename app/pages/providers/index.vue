<script setup lang="ts">
import {useSortable} from '@vueuse/integrations/useSortable'
import type {SysProvider} from '~/utils/providers'

const {t} = useI18n()
const {providers, loading, removeProvider, toggleProvider, saveOrder} = useProviders()
const confirmDialog = useConfirmDialog()

/** 供应商卡片 UCard 主题覆盖：行式密度（内边距由行容器接管），圆角与 hover 效果对齐项目基线 */
const providerCardUi = {
  root: 'rounded-sm select-none transition hover:ring-primary/40 hover:bg-elevated/50',
  body: 'p-0 sm:p-0'
}

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
  // Tauri 内部拖放处理器启用时会替换 WebView2 的拖放实现并拦截 HTML5 drag（tauri.conf.json 的 dragDropEnabled）；
  // 本项目已设 dragDropEnabled:false，保留 forceFallback 是为 Web/桌面行为一致的已验证策略，而非当前配置仍会被拦截
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
  <UDashboardPanel>
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton icon="i-lucide-plus" variant="ghost" @click="openCreate">{{ t('providers.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <!-- 加载中：居中 spinner -->
      <AppLoading v-if="loading && !providers.length" class="h-full"/>

      <!-- 有数据：一行一条独立卡片，严格贴合范式 A -->
      <div v-else-if="providers.length" class="h-full overflow-y-auto p-4">
        <div ref="listEl" class="flex flex-col gap-2.5">
          <UCard v-for="p in providers" :key="p.id" :ui="providerCardUi">
            <div class="flex min-h-[64px] items-center gap-3 px-3.5 py-2.5">
              <!-- 拖拽手柄（扩大命中区，hover 高亮）：排序唯一入口，A11y 例外见 docs/DESIGN.md §6.3 -->
              <div
                class="drag-handle -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-dimmed transition-colors hover:bg-elevated hover:text-default"
                aria-hidden="true"
                :title="t('providers.dragToSort')"
              >
                <UIcon name="i-lucide-grip-vertical" class="size-4"/>
              </div>

              <ProviderIcon :icon="p.icon" :name="p.name || p.code" size="lg"/>

              <!-- 图标右侧信息区（第一行名称，第二行备注，超长省略） -->
              <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
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
                  :title="t('providers.config')"
                  @click="openConfig(p)"
                />
                <UButton
                  icon="i-lucide-square-pen"
                  variant="ghost"
                  color="neutral"
                  class="text-muted hover:text-default"
                  :aria-label="t('providers.edit')"
                  :title="t('providers.edit')"
                  @click="openEdit(p)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  class="text-muted hover:text-error"
                  :aria-label="t('providers.remove')"
                  :title="t('providers.remove')"
                  @click="confirmRemove(p)"
                />
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <!-- 空态 -->
      <div v-else class="h-full overflow-y-auto p-4">
        <div class="flex min-h-full items-center justify-center">
          <UEmpty
            :title="t('common.empty')"
            variant="naked"
          />
        </div>
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
