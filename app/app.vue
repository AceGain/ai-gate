<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'ai-gate'
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
