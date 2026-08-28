<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-4 border-b border-default pb-3">
    <h1 class="truncate text-lg font-semibold text-highlighted">
      {{ title }}
    </h1>
    <div class="flex shrink-0 items-center gap-2">
      <slot />
    </div>
  </div>
</template>
