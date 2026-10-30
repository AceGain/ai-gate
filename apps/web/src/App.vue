<script setup lang="ts">
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import { Toaster } from '@/components/ui/sonner'
import { ConfigProvider } from 'reka-ui'
import { currentLocale } from '@/i18n'
</script>

<template>
  <ConfigProvider :locale="currentLocale" dir="ltr">
    <RouterView />
    <Toaster />
    <AppConfirmDialog />
  </ConfigProvider>
</template>
