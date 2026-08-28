<script setup lang="ts">
export interface AppColorItem {
  label: string
  value: string
  swatch: string
}

const props = defineProps<{
  modelValue?: string
  items: AppColorItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const current = computed(() => props.items.find(item => item.value === props.modelValue))

function swatchStyle(swatch: string) {
  return {
    '--chip-light': `var(--color-${swatch}-500)`,
    '--chip-dark': `var(--color-${swatch}-400)`
  }
}

function onSelect(value: unknown) {
  if (typeof value === 'string') {
    emit('update:modelValue', value)
  }
}
</script>

<template>
  <USelect
    :model-value="modelValue"
    :items="items"
    class="w-40"
    @update:model-value="onSelect"
  >
    <template #leading>
      <span
        v-if="current"
        class="size-2.5 rounded-full bg-(--chip-light) ring-1 ring-bg dark:bg-(--chip-dark)"
        :style="swatchStyle(current.swatch)"
      />
    </template>

    <template #item-leading="{ item }">
      <span
        class="size-2.5 rounded-full bg-(--chip-light) ring-1 ring-bg dark:bg-(--chip-dark)"
        :style="swatchStyle((item as AppColorItem).swatch)"
      />
    </template>
  </USelect>
</template>
