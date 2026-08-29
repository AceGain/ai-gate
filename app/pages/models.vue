<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <!-- 页面操作 Teleport 至内容区头部 Navbar 右侧，与标题同一行 -->
    <Teleport to="#navbar-actions">
      <UButton icon="i-lucide-plus" size="sm">{{ t('virtualModels.add') }}</UButton>
    </Teleport>
    <UEmpty
      icon="i-lucide-layers"
      :title="t('virtualModels.empty')"
      variant="naked"
      class="flex-1"
    />
  </div>
</template>
