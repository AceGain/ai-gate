<script setup lang="ts">
/**
 * 通用加载态：居中旋转图标 + 文案。尺寸无关、不与真实内容结构耦合（替代骨架屏，见 docs/DESIGN.md 加载规范）
 */
const {t} = useI18n()
</script>

<template>
  <div class="flex items-center justify-center gap-2 py-6 text-dimmed" role="status">
    <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin"/>
    <span class="text-sm">{{ t('common.loading') }}</span>
  </div>
</template>
