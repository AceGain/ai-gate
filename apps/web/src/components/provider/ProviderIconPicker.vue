<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDark } from '@vueuse/core'
import { PhMagnifyingGlass, PhSparkle, PhUploadSimple, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { DialogBody } from '@/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { brandIconUrl, providerIconOptions } from '@/utils/brandIcons'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ selectedIcon: string }>()
const emit = defineEmits<{ select: [icon: string] }>()
const { t } = useI18n()
const isDark = useDark()
const search = ref('')
const resultsBody = ref<InstanceType<typeof DialogBody> | null>(null)
const searchInput = ref<InstanceType<typeof InputGroupInput> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let fileReader: FileReader | undefined

const displayedIcons = computed(() => {
  const query = search.value.trim().toLowerCase()
  return providerIconOptions.filter(item => item.value && (
    !query || item.value.toLowerCase().includes(query) || item.label.toLowerCase().includes(query)
  ))
})

watch(search, () => {
  resultsBody.value?.viewport?.scrollTo({ top: 0 })
}, { flush: 'post' })

onMounted(() => searchInput.value?.$el?.focus())
onBeforeUnmount(() => fileReader?.abort())

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error(t('icons.selectImage'))
    return
  }
  if (file.size > 1024 * 1024) {
    toast.error(t('icons.imageTooLarge'))
    return
  }
  fileReader?.abort()
  const reader = new FileReader()
  fileReader = reader
  reader.onload = () => emit('select', String(reader.result))
  reader.readAsDataURL(file)
}
</script>

<template>
  <!-- 与供应商表单共用 DialogContent，只切换内容，不创建另一层浮层。 -->
  <div class="flex shrink-0 flex-col gap-3">
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <PhMagnifyingGlass />
      </InputGroupAddon>
      <InputGroupInput
        ref="searchInput"
        v-model="search"
        :placeholder="t('icons.searchPlaceholder')"
      />
      <InputGroupAddon v-if="search" align="inline-end">
        <Button variant="ghost" size="icon-xs" :aria-label="t('common.clear')" @click="search = ''">
          <PhX />
        </Button>
      </InputGroupAddon>
    </InputGroup>

    <div class="grid grid-cols-2 gap-2">
      <Button :variant="!props.selectedIcon ? 'secondary' : 'outline'" @click="emit('select', '')">
        <PhSparkle data-icon="inline-start" />
        {{ t('icons.auto') }}
      </Button>
      <Button variant="outline" @click="fileInput?.click()">
        <PhUploadSimple data-icon="inline-start" />
        {{ t('icons.upload') }}
      </Button>
    </div>
  </div>

  <DialogBody ref="resultsBody" :aria-label="t('icons.change')">
    <div v-if="displayedIcons.length" class="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
      <Button
        v-for="item in displayedIcons"
        :key="item.value"
        :variant="props.selectedIcon === item.value ? 'outline' : 'secondary'"
        size="icon-lg"
        class="w-full"
        :title="item.label"
        :aria-label="item.label"
        :aria-pressed="props.selectedIcon === item.value"
        @click="emit('select', item.value)"
      >
        <img :src="brandIconUrl(item.value, isDark)" alt="" class="size-6 object-contain">
      </Button>
    </div>
    <div v-else class="text-muted-foreground py-8 text-center text-xs">
      {{ t('icons.noMatches') }}
    </div>
  </DialogBody>

  <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange">
</template>
