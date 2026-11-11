<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useForm } from 'vee-validate'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { RHostSchema, RPathSchema, RRouteCreateSchema, type RRoute } from '@ai-gate/shared'
import { PhArrowLeft, PhCamera, PhFloppyDisk, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { useRoutesStore } from '@/stores/routes'
import { ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Spinner } from '@/components/ui/spinner'
import ProviderIcon from '@/components/provider/ProviderIcon.vue'
import ProviderIconPicker from '@/components/provider/ProviderIconPicker.vue'

const props = defineProps<{routeItem: RRoute | null}>()
const emit = defineEmits<{saved: [route: RRoute]}>()
const open = defineModel<boolean>('open', {default: false})
const { t } = useI18n()
const store = useRoutesStore()
const formId = useId()
const body = ref<InstanceType<typeof DialogBody> | null>(null)
const picking = ref(false)
const iconTrigger = ref<InstanceType<typeof Button> | null>(null)
let scrollTop = 0
const title = computed(() => props.routeItem ? t('routes.edit') : t('routes.create'))
const initialValues = {code: '', name: '', icon: '', mode: 'SHARED', host: '127.0.0.1', port: '5074',
  prefixPath: '/v1', modelsPath: '/models', timeout: '60000', maxRetries: '0', remark: ''}
type FormValues = typeof initialValues
const integer = (value: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER) =>
  value.trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= minimum && Number(value) <= maximum
const { values, errors, submitCount, isSubmitting, setFieldValue, setFieldError, resetForm, handleSubmit } = useForm<FormValues>({
  initialValues,
  validationSchema: computed(() => ({
    code: (value: string) => !!value?.trim() && !store.routes.some(route => route.code === value.trim() && route.id !== props.routeItem?.id) || t('routes.codeInvalid'),
    name: (value: string) => !!value?.trim() || t('validation.nameRequired'),
    mode: (value: string) => ['SHARED', 'DEDICATED'].includes(value) || t('validation.checkForm'),
    host: (value: string) => values.mode !== 'DEDICATED' || v.safeParse(RHostSchema, value).success || t('routes.hostInvalid'),
    port: (value: string) => values.mode !== 'DEDICATED' || integer(value, 1, 65535) || t('routes.portInvalid'),
    prefixPath: (value: string) => v.safeParse(RPathSchema, value).success || t('routes.pathInvalid'),
    modelsPath: (value: string) => v.safeParse(RPathSchema, value).success || t('routes.pathInvalid'),
    timeout: (value: string) => integer(value, 1, 2147483647) || t('routes.timeoutInvalid'),
    maxRetries: (value: string) => integer(value, 0) || t('routes.retriesInvalid'),
  })),
})
const visibleErrors = computed(() => submitCount.value ? errors.value : {})
watch(open, value => {
  picking.value = false
  if (!value) return
  const route = props.routeItem
  resetForm({values: route ? {...initialValues, ...route, host: route.host ?? '127.0.0.1',
    port: String(route.port ?? 5074), timeout: String(route.timeout), maxRetries: String(route.maxRetries)} : {...initialValues}})
})

const fields = computed(() => [
  {key: 'code', label: t('routes.code'), placeholder: t('routes.codePlaceholder'), type: 'text'},
  {key: 'name', label: t('common.name'), placeholder: t('routes.namePlaceholder'), type: 'text'},
  ...(values.mode === 'DEDICATED' ? [
    {key: 'host', label: t('routes.host'), placeholder: '127.0.0.1', type: 'text'},
    {key: 'port', label: t('routes.port'), placeholder: '5074', type: 'number'},
  ] : []),
  {key: 'prefixPath', label: t('routes.prefixPath'), placeholder: '/v1', type: 'text'},
  {key: 'modelsPath', label: t('routes.modelsPath'), placeholder: '/models', type: 'text'},
  {key: 'timeout', label: t('routes.timeout'), placeholder: '60000', type: 'number'},
  {key: 'maxRetries', label: t('routes.maxRetries'), placeholder: '0', type: 'number'},
] as {key: keyof FormValues, label: string, placeholder: string, type: string}[])

const save = handleSubmit(async form => {
  try {
    const input = v.parse(RRouteCreateSchema, {...form,
      host: form.mode === 'DEDICATED' ? form.host.trim() : null,
      port: form.mode === 'DEDICATED' ? Number(form.port) : null,
      timeout: Number(form.timeout), maxRetries: Number(form.maxRetries),
      enabled: props.routeItem?.enabled ?? true, strategy: 'PRIORITY',
    })
    const saved = props.routeItem ? await store.update(props.routeItem.id, input) : await store.create(input)
    toast.success(t('common.saved'))
    open.value = false
    emit('saved', saved)
  } catch (error) {
    if (error instanceof ApiError) {
      const conflictFields: Record<string, keyof FormValues> = {DUPLICATE_ROUTE_CODE: 'code', DUPLICATE_ROUTE_PREFIX: 'prefixPath', DUPLICATE_ROUTE_LISTENER: 'port'}
      const field = conflictFields[error.code]
      if (field) { setFieldError(field, apiErrorMessage(error)); await body.value?.focusFirstInvalid(); return }
    }
    toast.error(apiErrorMessage(error))
  }
}, async () => { await body.value?.focusFirstInvalid() })

function pickIcon() { scrollTop = body.value?.viewport?.scrollTop ?? 0; picking.value = true }
async function returnToForm(icon?: string) {
  if (icon !== undefined) setFieldValue('icon', icon)
  picking.value = false
  await nextTick()
  if (body.value?.viewport) body.value.viewport.scrollTop = scrollTop
  iconTrigger.value?.$el?.focus({preventScroll: true})
}
function handleEscape(event: KeyboardEvent) {
  if (isSubmitting.value || picking.value) event.preventDefault()
  if (picking.value) void returnToForm()
}
</script>

<template>
  <Dialog :open="open" @update:open="value => { if (!isSubmitting) open = value }">
    <DialogContent :aria-describedby="undefined" class="sm:max-w-md" @escape-key-down="handleEscape" @interact-outside="event => { if (isSubmitting) event.preventDefault() }">
      <DialogHeader>
        <template v-if="picking">
          <div class="flex items-center gap-2 pr-6">
            <Button variant="ghost" size="icon-sm" :aria-label="t('common.back')" @click="returnToForm()"><PhArrowLeft /></Button>
            <div class="flex min-w-0 flex-col gap-1"><DialogTitle>{{ t('icons.change') }}</DialogTitle><DialogDescription>{{ title }}</DialogDescription></div>
          </div>
        </template>
        <DialogTitle v-else>{{ title }}</DialogTitle>
      </DialogHeader>
      <ProviderIconPicker v-if="picking" :selected-icon="values.icon" @select="returnToForm" />
      <template v-else>
        <DialogBody ref="body" :aria-label="title">
          <form :id="formId" @submit.prevent="save">
            <FieldGroup>
              <div class="flex justify-center pb-1">
                <Button ref="iconTrigger" type="button" variant="outline" size="icon-lg" class="group relative size-14 shrink-0 p-0" :aria-label="t('icons.change')" :disabled="isSubmitting" @click="pickIcon">
                  <ProviderIcon :icon="values.icon" :name="values.name || '?'" size="xl" />
                  <span class="bg-muted/80 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><PhCamera /></span>
                </Button>
              </div>
              <Field :data-disabled="isSubmitting">
                <FieldLabel :id="`${formId}-mode-label`">{{ t('routes.mode') }}</FieldLabel>
                <ToggleGroup type="single" variant="outline" :model-value="values.mode" :aria-labelledby="`${formId}-mode-label`" :disabled="isSubmitting"
                  @update:model-value="value => { if (value) setFieldValue('mode', String(value)) }">
                  <ToggleGroupItem value="SHARED">{{ t('routes.shared') }}</ToggleGroupItem>
                  <ToggleGroupItem value="DEDICATED">{{ t('routes.dedicated') }}</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>{{ values.mode === 'SHARED' ? t('routes.sharedHint') : t('routes.dedicatedHint') }}</FieldDescription>
              </Field>
              <Field v-for="field in fields" :key="field.key" :data-invalid="!!visibleErrors[field.key]" :data-disabled="isSubmitting || (field.key === 'code' && !!routeItem)">
                <FieldLabel :for="`${formId}-${field.key}`">{{ field.label }} <span class="text-destructive">*</span></FieldLabel>
                <Input :id="`${formId}-${field.key}`" :model-value="values[field.key]" :type="field.type" :placeholder="field.placeholder"
                  :disabled="isSubmitting || (field.key === 'code' && !!routeItem)" :aria-invalid="!!visibleErrors[field.key] || undefined"
                  @update:model-value="value => setFieldValue(field.key, String(value))" />
                <FieldError v-if="visibleErrors[field.key]">{{ visibleErrors[field.key] }}</FieldError>
                <FieldDescription v-if="field.key === 'modelsPath'">{{ t('routes.modelsPathHint') }}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel :for="`${formId}-strategy`">{{ t('routes.strategy') }}</FieldLabel>
                <Input :id="`${formId}-strategy`" :model-value="t('routes.priority')" disabled />
              </Field>
              <Field :data-disabled="isSubmitting">
                <FieldLabel :for="`${formId}-remark`">{{ t('common.description') }}</FieldLabel>
                <Textarea :id="`${formId}-remark`" :model-value="values.remark" :disabled="isSubmitting" @update:model-value="value => setFieldValue('remark', String(value))" />
              </Field>
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" :disabled="isSubmitting" @click="open = false"><PhX data-icon="inline-start" />{{ t('common.cancel') }}</Button>
          <Button type="submit" :form="formId" :disabled="isSubmitting"><Spinner v-if="isSubmitting" data-icon="inline-start" /><PhFloppyDisk v-else data-icon="inline-start" />{{ t('common.save') }}</Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
