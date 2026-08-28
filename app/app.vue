<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'zh-CN'
  }
})

useSeoMeta({
  title: 'ai-gate'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout name="custom">
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
