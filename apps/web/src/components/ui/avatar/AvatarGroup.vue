<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from 'cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="avatar-group"
    :class="cn(
      'group/avatar-group flex [&>:not(:first-child)]:-ms-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
