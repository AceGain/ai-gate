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
    expiresTime: expiresDate.value ? expiresDate.value.toString() : null,
    // 备注字段已下线：编辑时透传旧值，避免清空历史数据
    description: props.keyItem?.description ?? ''
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
          <UPopover v-model:open="isCalendarOpen" class="w-full block">
            <UButton
              color="neutral"
              variant="subtle"
              icon="i-lucide-calendar"
              block
              class="justify-start font-normal"
              :class="expiresDate ? 'text-highlighted' : 'text-dimmed'"
            >
              <span class="truncate">
                {{ expiresDate ? df.format(expiresDate.toDate(getLocalTimeZone())) : t('providerKeys.expiresSelectPlaceholder') }}
              </span>

              <template #trailing>
                <UButton
                  v-if="expiresDate"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-circle-x"
                  class="ms-auto -me-1 text-dimmed hover:text-default"
                  :aria-label="t('providerKeys.clearExpires')"
                  :title="t('providerKeys.clearExpires')"
                  @click.stop="expiresDate = null"
                />
              </template>
            </UButton>

            <template #content="{ close }">
              <div class="p-2 space-y-2">
                <UCalendar
                  v-model="expiresDate"
                  @update:model-value="() => close()"
                />
                <div class="flex items-center justify-between border-t border-default/60 pt-2 px-1 text-xs">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
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
