<script setup lang="ts">
import type { AvatarImageProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { cn } from 'cn'
import { AvatarImage } from 'reka-ui'

const props = defineProps<AvatarImageProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <AvatarImage
    data-slot="avatar-image"
    v-bind="delegatedProps"
    :class="cn('rounded-full aspect-square size-full object-cover', props.class)"
  >
    <slot />
  </AvatarImage>
</template>
