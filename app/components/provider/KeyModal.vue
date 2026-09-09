<script setup lang="ts">
import {CalendarDate, parseDate} from '@internationalized/date'
import type {SysKey, SysKeyInput} from '~/utils/providers'

const props = defineProps<{
  providerId: string
  keyItem: SysKey | null
}>()

const emit = defineEmits<{saved: [keyItem: SysKey]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {createKey, updateKey} = useProviderConfig()

const form = reactive({
  name: '',
  secret: '',
  enabled: true,
  description: ''
})

const expiresDate = shallowRef<CalendarDate | null>(null)
const showErrors = ref(false)
const saving = ref(false)

watch(open, (v) => {
  if (!v) return
  form.name = props.keyItem?.name ?? ''
  form.secret = props.keyItem?.secret ?? ''
  form.enabled = props.keyItem?.enabled ?? true
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
  form.description = props.keyItem?.description ?? ''
  showErrors.value = false
})

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
    enabled: form.enabled,
    status: props.keyItem?.status ?? 'ACTIVE',
    expiresTime: expiresDate.value ? expiresDate.value.toString() : null,
    description: form.description.trim()
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
            class="w-full font-mono"
          />
        </UFormField>

        <UFormField
          :label="t('providerKeys.expiresTime')"
          :help="t('providerKeys.permanentHint')"
        >
          <UInputDate
            v-model="expiresDate"
            class="w-full"
            :ui="{ trailing: 'pe-1' }"
          >
            <template #trailing>
              <div class="flex items-center gap-0.5">
                <UButton
                  v-if="expiresDate"
                  color="neutral"
                  variant="link"
                  size="sm"
                  icon="i-lucide-circle-x"
                  class="text-dimmed hover:text-default"
                  :title="t('providerKeys.clearExpires')"
                  @click="expiresDate = null"
                />

                <UPopover>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    icon="i-lucide-calendar"
                    :title="t('providerKeys.expiresSelectPlaceholder')"
                    class="text-dimmed hover:text-default px-1"
                  />

                  <template #content>
                    <UCalendar v-model="expiresDate" class="p-2" />
                  </template>
                </UPopover>
              </div>
            </template>
          </UInputDate>
        </UFormField>

        <UFormField :label="t('providers.description')">
          <UTextarea
            v-model="form.description"
            autoresize
            :rows="2"
            :placeholder="t('providers.descriptionPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-between rounded-lg border border-default p-3">
          <span class="text-sm font-medium">{{ t('providers.enable') }}</span>
          <USwitch v-model="form.enabled" />
        </div>
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
