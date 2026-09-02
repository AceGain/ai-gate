<script setup lang="ts">
import type {ProviderConfig} from '~/utils/providers'

const {t} = useI18n()
const {providers, removeProvider, persist} = useProviders()
const confirmDialog = useConfirmDialog()

/** 新增供应商弹窗（编辑一律在详情页进行） */
const createOpen = ref(false)

function openCreate() {
  createOpen.value = true
}

/** 切换启用/停用（持久化） */
function toggleProvider(p: ProviderConfig, value: boolean) {
  p.enabled = value
  persist()
}

/** 删除供应商：二次确认 */
async function confirmRemove(p: ProviderConfig) {
  const confirmed = await confirmDialog({
    title: t('providers.removeProviderConfirmTitle'),
    description: t('providers.removeProviderConfirmDesc', {name: p.name})
  })
  if (confirmed) removeProvider(p.id)
}

function enabledModelCount(p: { models: Record<string, { enabled: boolean }> }) {
  return Object.values(p.models).filter(m => m.enabled).length
}
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
      <div v-if="providers.length" class="h-full overflow-y-auto p-4">
        <!-- 一行一条数据的独立卡片，卡片间留间距 -->
        <div class="flex flex-col gap-3">
          <div
            v-for="p in providers"
            :key="p.id"
            class="group flex cursor-pointer items-center gap-3 rounded-lg border border-default border-l-2 bg-default px-4 py-3 transition-colors hover:border-primary/40 hover:bg-elevated/50"
            :class="p.enabled ? 'border-l-primary' : 'border-l-default'"
            @click="navigateTo(`/providers/${p.id}`)"
          >
            <ProviderIcon :icon="p.icon" :name="p.name || p.providerId"/>

            <!-- 名称 + URL -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-highlighted">{{ p.name }}</span>
              </div>
              <p class="truncate text-xs text-muted">{{ p.baseUrl }}</p>
            </div>

            <!-- 密钥 / 模型计数 -->
            <div class="hidden shrink-0 gap-3 text-xs text-muted md:flex">
              <span>{{ t('providers.keyCount', {count: p.keys.length}) }}</span>
              <span>{{ t('providers.modelCount', {count: enabledModelCount(p)}) }}</span>
            </div>

            <!-- 启用开关 + 修改 + 删除 -->
            <USwitch
              :model-value="p.enabled"
              :aria-label="t('providers.toggleEnabled')"
              class="shrink-0"
              @update:model-value="v => toggleProvider(p, !!v)"
              @click.stop
            />
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              class="shrink-0 text-muted hover:text-default"
              :aria-label="t('providers.edit')"
              :to="`/providers/${p.id}`"
              @click.stop
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              class="shrink-0 text-muted hover:text-error"
              :aria-label="t('providers.removeProvider')"
              @click.stop="confirmRemove(p)"
            />
          </div>
        </div>
      </div>

      <!-- 空态：专属文案 + 新增 CTA -->
      <div v-else class="flex min-h-full flex-col items-center justify-center gap-4">
        <UEmpty
          :title="t('providers.listEmpty')"
          :description="t('providers.listEmptyHint')"
          icon="i-lucide-server"
          variant="naked"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- 新增供应商弹窗 -->
  <ProviderCreateModal v-model:open="createOpen"/>
</template>
