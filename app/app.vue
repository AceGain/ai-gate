<script setup lang="ts">
const {locale} = useI18n()

useHead({
  meta: [
    {name: 'viewport', content: 'width=device-width, initial-scale=1'}
  ],
  htmlAttrs: {
    lang: locale
  }
})

useSeoMeta({
  title: 'ai-gate'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator/>

    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
  </UApp>
</template>
