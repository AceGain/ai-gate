<script setup lang="ts">
defineProps<{
  label: string
  value: string
  icon: string
}>()
</script>

<template>
  <UCard :ui="{ body: 'flex items-center gap-4 p-5' }">
    <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
      <UIcon :name="icon" class="size-5 text-primary"/>
    </div>
    <div class="min-w-0">
      <p class="truncate text-xs text-muted">
        {{ label }}
      </p>
      <p class="mt-0.5 truncate text-xl font-semibold text-highlighted">
        {{ value }}
      </p>
    </div>
  </UCard>
</template>
