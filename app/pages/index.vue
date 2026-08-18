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
  <div class="flex flex-col items-center justify-center gap-6 min-h-dvh p-4">
    <h1 class="text-2xl font-bold">Welcome to Tauri + Nuxt</h1>

    <form class="flex items-center gap-2" @submit.prevent="greet">
      <UInput
        v-model="name"
        placeholder="Enter a name..."
        class="w-64"
      />
      <UButton
        type="submit"
        icon="i-lucide-hand"
      >
        Greet
      </UButton>
    </form>

    <p class="text-muted">
      {{ greetMsg }}
    </p>
  </div>
</template>
