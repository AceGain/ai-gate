<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowReactive, watch, type ComponentPublicInstance } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { PhMagnifyingGlass, PhSparkle, PhUploadSimple, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { DialogBody } from '@/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { getLoadedBrandIcon, loadBrandIcon, providerIconOptions, resolveBrandId } from '@/utils/brandIcons'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ selectedIcon: string }>()
const emit = defineEmits<{ select: [icon: string] }>()
const { t } = useI18n()
const selectedBrandId = computed(() => resolveBrandId(props.selectedIcon))
const search = ref('')
const iconButtons = shallowReactive(new Map<string, HTMLElement>())
const pendingIcons = shallowReactive(new Set<string>())
const failedIcons = shallowReactive(new Set<string>())
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

// 错误状态跟随当前搜索结果，避免提示改变布局后因图标离开视口而反复显隐。
const failedDisplayedIcons = computed(() => displayedIcons.value.filter(item =>
  failedIcons.has(item.value) && !getLoadedBrandIcon(item.value),
))

function requestIcon(id: string) {
  if (pendingIcons.has(id) || getLoadedBrandIcon(id)) return
  pendingIcons.add(id)
  failedIcons.delete(id)
  void loadBrandIcon(id)
    .catch(() => { failedIcons.add(id) })
    .finally(() => { pendingIcons.delete(id) })
}

function retryIcons() {
  for (const item of failedDisplayedIcons.value) requestIcon(item.value)
}

function setIconButton(id: string, button: Element | ComponentPublicInstance | null) {
  if (button) {
    const element = '$el' in button ? button.$el : button
    if (element instanceof HTMLElement) iconButtons.set(id, element)
  } else {
    iconButtons.delete(id)
  }
}

// 只请求滚动区域内可见的品牌；搜索和滚动不会预加载整组 SVG。
useIntersectionObserver(
  () => [...iconButtons.values()],
  entries => {
    for (const entry of entries) {
      const id = entry.target.getAttribute('data-brand-id')!
      // 搜索可能已移除目标，忽略旧观察器排队中的通知。
      if (iconButtons.get(id) !== entry.target) continue
      if (entry.isIntersecting && !failedIcons.has(id)) requestIcon(id)
    }
  },
  { root: () => resultsBody.value?.viewport },
)

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
        <InputGroupButton size="icon-xs" class="[&>svg:not([class*=size-])]:size-3" :aria-label="t('common.clear')" @click="search = ''">
          <PhX />
        </InputGroupButton>
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

  <DialogBody ref="resultsBody" class="flex-1" :aria-label="t('icons.change')">
    <Empty v-if="failedDisplayedIcons.length" class="py-8">
      <EmptyHeader>
        <EmptyTitle role="alert">{{ t('icons.loadFailed') }}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" @click="retryIcons()">{{ t('common.retry') }}</Button>
      </EmptyContent>
    </Empty>
    <div v-if="displayedIcons.length" class="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
      <Button
        v-for="item in displayedIcons"
        :ref="button => setIconButton(item.value, button)"
        :key="item.value"
        :data-brand-id="item.value"
        :variant="selectedBrandId === item.value ? 'outline' : 'secondary'"
        size="icon-lg"
        class="w-full [&_svg:not([class*=size-])]:size-6"
        :title="item.label"
        :aria-label="item.label"
        :aria-pressed="selectedBrandId === item.value"
        @click="emit('select', item.value)"
        @focus="requestIcon(item.value)"
      >
        <component v-if="getLoadedBrandIcon(item.value)" :is="getLoadedBrandIcon(item.value)" :size="24" aria-hidden="true" />
        <Spinner v-else-if="pendingIcons.has(item.value)" />
        <span v-else aria-hidden="true">{{ item.label.charAt(0) }}</span>
      </Button>
    </div>
    <Empty v-else class="text-muted-foreground flex-none gap-0 p-0 py-8 text-wrap">
      <EmptyHeader class="max-w-none gap-0">
        <EmptyTitle class="text-xs font-normal">{{ t('icons.noMatches') }}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  </DialogBody>

  <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange">
</template>
