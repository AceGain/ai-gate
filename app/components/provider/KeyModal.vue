<script setup lang="ts">
import {CalendarDate, parseDate, DateFormatter, getLocalTimeZone, today} from '@internationalized/date'
import type {SysKey, SysKeyInput} from '~/utils/providers'

const props = defineProps<{
  providerId: string
  keyItem: SysKey | null
}>()

const emit = defineEmits<{saved: [keyItem: SysKey]}>()

const open = defineModel<boolean>('open', {default: false})

const {t, locale} = useI18n()
const toast = useToast()
const {createKey, updateKey} = useProviderConfig()

const df = computed(() => new DateFormatter(locale.value, {
  dateStyle: 'medium'
}))

const form = reactive({
  name: '',
  secret: ''
})

const expiresDate = shallowRef<CalendarDate | null>(null)
const isCalendarOpen = ref(false)
const showErrors = ref(false)
const saving = ref(false)

watch(open, (v) => {
  if (!v) return
  isCalendarOpen.value = false
  form.name = props.keyItem?.name ?? ''
  form.secret = props.keyItem?.secret ?? ''
  const rawDate = props.keyItem?.expiresTime ? props.keyItem.expiresTime.slice(0, 10) : ''
  if (rawDate) {
    try {
      expiresDate.value = parseDate(rawDate)
    } catch {
      expiresDate.value = null
    }
  } else {
    expiresDate.value = null
  }
  showErrors.value = false
})

function setToday(close?: () => void) {
  expiresDate.value = today(getLocalTimeZone())
  close?.()
}

function clearDate(close?: () => void) {
  expiresDate.value = null
  close?.()
}

const nameError = computed(() =>
  showErrors.value && !form.name.trim() ? t('providerKeys.nameRequired') : undefined
)

const secretError = computed(() =>
  showErrors.value && !form.secret.trim() ? t('providerKeys.secretRequired') : undefined
)

const canSave = computed(() => !!form.name.trim() && !!form.secret.trim() && !saving.value)

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    toast.add({color: 'error', title: t('providers.invalidForm')})
    return
  }
  saving.value = true
  const input: SysKeyInput = {
    name: form.name.trim(),
    secret: form.secret.trim(),
    // 新增默认启用；编辑时透传旧值（开关已移至列表行内）
    enabled: props.keyItem?.enabled ?? true,
    status: props.keyItem?.status ?? 'ACTIVE',
    expiresTime: expiresDate.value ? expiresDate.value.toString() : null
  }
  try {
    const saved = props.keyItem
      ? await updateKey(props.providerId, props.keyItem.id, input)
      : await createKey(props.providerId, input)
    toast.add({color: 'success', title: t('providers.saved')})
    open.value = false
    emit('saved', saved)
  } catch (err) {
    console.warn('[ai-gate] 保存密钥失败', err)
    toast.add({color: 'error', title: t('providers.backendUnavailable')})
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="props.keyItem ? t('providerKeys.editTitle') : t('providerKeys.newTitle')"
    :ui="{ content: 'max-w-md', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('providerKeys.name')" :error="nameError">
          <UInput
            v-model="form.name"
            :placeholder="t('providerKeys.namePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('providerKeys.secret')" :error="secretError">
          <UInput
            v-model="form.secret"
            type="password"
            :placeholder="t('providerKeys.secretPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('providerKeys.expiresTime')"
          :help="t('providerKeys.permanentHint')"
        >
          <UPopover
            v-model:open="isCalendarOpen"
            :content="{ side: 'bottom', align: 'start', sideOffset: 4 }"
            :ui="{ content: 'divide-y divide-default overflow-hidden p-0' }"
            class="w-full"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-calendar"
              class="w-full justify-start font-normal"
              :class="expiresDate ? 'text-highlighted' : 'text-dimmed'"
            >
              <span class="truncate">
                {{ expiresDate ? df.format(expiresDate.toDate(getLocalTimeZone())) : t('providerKeys.expiresSelectPlaceholder') }}
              </span>

              <template #trailing>
                <span
                  v-if="expiresDate"
                  role="button"
                  tabindex="0"
                  class="ms-auto -me-1 inline-flex items-center justify-center size-5 rounded-sm text-dimmed hover:text-default hover:bg-elevated cursor-pointer transition-colors"
                  :aria-label="t('providerKeys.clearExpires')"
                  :title="t('providerKeys.clearExpires')"
                  @click.stop="expiresDate = null"
                  @keydown.enter.stop="expiresDate = null"
                  @keydown.space.stop="expiresDate = null"
                >
                  <UIcon name="i-lucide-circle-x" class="size-4" />
                </span>
              </template>
            </UButton>

            <template #content="{ close }">
              <div class="flex flex-col divide-y divide-default">
                <!-- 头部：标题与状态提示 -->
                <div class="flex items-center justify-between px-3 py-2 text-xs">
                  <span class="font-medium text-highlighted">{{ t('providerKeys.expiresTime') }}</span>
                  <span v-if="expiresDate" class="text-xs text-muted">
                    {{ df.format(expiresDate.toDate(getLocalTimeZone())) }}
                  </span>
                  <span v-else class="text-xs text-dimmed">
                    {{ t('providerKeys.permanentHint') }}
                  </span>
                </div>

                <!-- 主体：日历选择器 -->
                <div class="p-2.5">
                  <UCalendar
                    v-model="expiresDate"
                    size="sm"
                    @update:model-value="() => close()"
                  />
                </div>

                <!-- 底部：操作栏 -->
                <div class="flex items-center justify-between px-2.5 py-1.5 bg-elevated/40 text-xs">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-calendar-clock"
                    :label="t('common.today')"
                    @click="setToday(close)"
                  />
                  <UButton
                    v-if="expiresDate"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-circle-x"
                    :label="t('providerKeys.clearExpires')"
                    @click="clearDate(close)"
                  />
                  <span v-else class="text-xs text-dimmed px-2">
                    {{ t('providerKeys.permanentHint') }}
                  </span>
                </div>
              </div>
            </template>
          </UPopover>
        </UFormField>

      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" :disabled="saving" @click="open = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton icon="i-lucide-save" :loading="saving" @click="save">
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
