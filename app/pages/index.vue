<script setup lang="ts">
const greetMsg = ref('')
const name = ref('')

async function greet() {
  try {
    greetMsg.value = await invokeTauri<string>('greet', { name: name.value })
  }
  catch (error) {
    greetMsg.value = error instanceof Error ? error.message : String(error)
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader title="概览" />

    <div class="grid grid-cols-4 gap-4">
      <AppStatCard label="供应商" value="—" icon="i-lucide-server" />
      <AppStatCard label="API 密钥" value="—" icon="i-lucide-key-round" />
      <AppStatCard label="今日请求" value="—" icon="i-lucide-activity" />
      <AppStatCard label="今日 Token" value="—" icon="i-lucide-coins" />
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-plug-zap" class="size-4 text-muted" />
          <span class="text-sm font-medium">Tauri 连通性测试</span>
        </div>
      </template>

      <form class="flex items-center gap-3" @submit.prevent="greet">
        <UInput
          v-model="name"
          placeholder="输入名称..."
          class="w-72"
        />
        <UButton
          type="submit"
          icon="i-lucide-hand"
        >
          Greet
        </UButton>
      </form>
      <p v-if="greetMsg" class="mt-3 text-sm text-muted">
        {{ greetMsg }}
      </p>
    </UCard>
  </div>
</template>
