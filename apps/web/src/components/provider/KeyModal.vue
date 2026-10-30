<script setup lang="ts">
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import type { SKey, SKeyInput } from '@ai-gate/shared'
import { computed, reactive, ref, watch } from 'vue'
import { PhFloppyDisk, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { useProvidersStore } from '@/stores/providers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  providerId: number
  keyItem: SKey | null
}>()

const emit = defineEmits<{saved: [keyItem: SKey]}>()

const open = defineModel<boolean>('open', {default: false})

const store = useProvidersStore()

const form = reactive({
  name: '',
  secret: '',
  /** 过期日期（'YYYY-MM-DD'）；空串 = 永久有效 */
  expireTime: '',
})

const showErrors = ref(false)
const saving = ref(false)
const formBody = ref<InstanceType<typeof DialogBody> | null>(null)

watch(open, (v) => {
  if (!v) return
  form.name = props.keyItem?.name ?? ''
  form.secret = props.keyItem?.secret ?? ''
  form.expireTime = props.keyItem?.expireTime ? props.keyItem.expireTime.slice(0, 10) : ''
  showErrors.value = false
})

const nameError = computed(() =>
  showErrors.value && !form.name.trim() ? t('validation.keyNameRequired') : undefined,
)

const secretError = computed(() =>
  showErrors.value && !form.secret.trim() ? t('validation.keySecretRequired') : undefined,
)

const canSave = computed(() => !!form.name.trim() && !!form.secret.trim() && !saving.value)

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    await formBody.value?.focusFirstInvalid()
    toast.error(t('validation.checkForm'))
    return
  }
  saving.value = true
  const input: SKeyInput = {
    name: form.name.trim(),
    secret: form.secret.trim(),
    // 新增默认启用；编辑时透传旧值（开关已移至列表行内）
    enabled: props.keyItem?.enabled ?? true,
    status: props.keyItem?.status ?? 'ACTIVE',
    expireTime: form.expireTime.trim() || null,
  }
  try {
    const saved = props.keyItem
      ? await store.updateKey(props.providerId, props.keyItem.id, input)
      : await store.createKey(props.providerId, input)
    toast.success(t('common.saved'))
    open.value = false
    emit('saved', saved)
  } catch (err) {
    console.warn('[ai-gate] 保存密钥失败', err)
    toast.error(apiErrorMessage(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="v => open = v"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ props.keyItem ? t('keys.edit') : t('keys.create') }}</DialogTitle>
      </DialogHeader>

      <DialogBody ref="formBody" :aria-label="props.keyItem ? t('keys.edit') : t('keys.create')">
        <FieldGroup>
          <Field :data-invalid="!!nameError">
            <FieldLabel>{{ t('keys.name') }} <span class="text-destructive">*</span></FieldLabel>
            <Input
              v-model="form.name"
              :aria-invalid="!!nameError || undefined"
              :placeholder="t('keys.namePlaceholder')"
            />
            <FieldError v-if="nameError">
              {{ nameError }}
            </FieldError>
          </Field>

          <Field :data-invalid="!!secretError">
            <FieldLabel>{{ t('keys.secret') }} <span class="text-destructive">*</span></FieldLabel>
            <Input
              v-model="form.secret"
              type="password"
              :aria-invalid="!!secretError || undefined"
              :placeholder="t('keys.secretPlaceholder')"
            />
            <FieldError v-if="secretError">
              {{ secretError }}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel>{{ t('keys.expiresAt') }}</FieldLabel>
            <Input
              v-model="form.expireTime"
              type="date"
            />
            <FieldDescription>{{ t('keys.expiryHint') }}</FieldDescription>
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          @click="open = false"
        >
          <PhX data-icon="inline-start" aria-hidden="true" />
          {{ t('common.cancel') }}
        </Button>
        <Button
          :disabled="saving"
          @click="save"
        >
          <Spinner v-if="saving" data-icon="inline-start" />
          <PhFloppyDisk
            v-else
            data-icon="inline-start"
          />
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
