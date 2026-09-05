<script setup lang="ts">
import {useSortable} from '@vueuse/integrations/useSortable'
import type {SysProvider} from '~/utils/providers'

const {t} = useI18n()
const {providers, removeProvider, toggleProvider, saveOrder} = useProviders()
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

/** 配置入口：配置页待设计，先占位 */
function openConfig(_p: SysProvider) {
  // TODO: 供应商配置页（协议端点 / 密钥 / 模型），按后续安排实现
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
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton icon="i-lucide-plus" @click="openCreate">{{ t('providers.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <!-- 有数据：一行一条独立卡片，卡片间留间距；拖拽手柄排序 -->
      <div v-if="providers.length" class="h-full overflow-y-auto p-4">
        <div ref="listEl" class="flex flex-col gap-3">
          <div
            v-for="p in providers"
            :key="p.id"
            class="flex select-none items-center gap-2.5 rounded-lg border border-default bg-default px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-elevated/50"
          >
            <!-- 拖拽手柄（扩大命中区，hover 高亮） -->
            <div
              class="drag-handle -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-dimmed transition-colors hover:bg-elevated hover:text-default"
              role="button"
              :aria-label="t('providers.dragToSort')"
            >
              <UIcon name="i-lucide-grip-vertical" class="size-4"/>
            </div>

            <ProviderIcon :icon="p.icon" :name="p.name || p.code"/>

            <!-- 名称 + 编码（对外模型标识前缀） -->
            <span
              class="shrink-0 text-sm font-medium"
              :class="p.enabled ? 'text-highlighted' : 'text-dimmed'"
            >{{ p.name || p.code }}</span>
            <UBadge color="neutral" variant="subtle" class="shrink-0 font-mono">{{ p.code }}</UBadge>

            <!-- 描述 -->
            <p class="min-w-0 flex-1 truncate text-xs text-muted">{{ p.description }}</p>

            <!-- 启用开关 -->
            <USwitch
              :model-value="p.enabled"
              :aria-label="t('providers.toggleEnabled')"
              class="shrink-0"
              @update:model-value="v => toggleProvider(p, !!v)"
            />

            <!-- 配置 / 修改 / 删除 -->
            <UButton
              icon="i-lucide-settings-2"
              variant="ghost"
              color="neutral"
              class="shrink-0 text-muted hover:text-default"
              :aria-label="t('providers.config')"
              @click="openConfig(p)"
            />
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              class="shrink-0 text-muted hover:text-default"
              :aria-label="t('providers.edit')"
              @click="openEdit(p)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              class="shrink-0 text-muted hover:text-error"
              :aria-label="t('providers.remove')"
              @click="confirmRemove(p)"
            />
          </div>
        </div>
      </div>

      <!-- 空态 -->
      <div v-else class="flex min-h-full flex-col items-center justify-center gap-4">
        <UEmpty
          :title="t('common.empty')"
          icon="i-lucide-server-cog"
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
/* 拖拽期间全局隐藏鼠标光标：视线零遮挡，纯靠半透明卡片与落点虚影提供反馈 */
body.provider-sortable-dragging,
body.provider-sortable-dragging * {
  cursor: none !important;
}
</style>
