<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex items-start justify-between gap-4 border-b border-default pb-5">
    <div class="min-w-0">
      <h1 class="text-xl font-semibold text-highlighted">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-1 text-sm text-muted">
        {{ description }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2 pt-1">
      <slot />
    </div>
  </div>
</template>
