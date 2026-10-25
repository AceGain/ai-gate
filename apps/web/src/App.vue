<script setup lang="ts">
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
  <RouterView />
  <Toaster />
  <AppConfirmDialog />
</template>
