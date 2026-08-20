<script setup lang="ts">
defineProps<{
  icon: string
  text: string
}>()
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
    <div class="flex size-14 items-center justify-center rounded-full bg-elevated">
      <UIcon :name="icon" class="size-7" />
    </div>
    <p class="text-sm">
      {{ text }}
    </p>
    <slot />
  </div>
</template>
