<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useForm } from 'vee-validate'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { GEN_ENDPOINT_TYPES, REndpointInputSchema, RKeyInputSchema, RModelInputSchema, RPathSchema, RDateSchema, isEditableRouteModel,
  type REndpoint, type RKey, type RModel, type RModelSource } from '@ai-gate/shared'
import { PhFloppyDisk, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'

const props = defineProps<{routeId: number, kind: 'endpoints' | 'keys' | 'models', item: REndpoint | RKey | RModel | null}>()
const emit = defineEmits<{saved: []}>()
const open = defineModel<boolean>('open', {default: false})
const { t } = useI18n()
const formId = useId()
const body = ref<InstanceType<typeof DialogBody> | null>(null)
const sources = ref<RModelSource[]>([])
const sourcesLoading = ref(false)
const sourcesError = ref(false)
const initialValues = {type: 'Chat Completions', path: '/chat/completions', name: '', secret: '', expireTime: '', code: '', modelId: ''}
const { values, errors, submitCount, isSubmitting, setFieldValue, resetForm, handleSubmit } = useForm({
  initialValues,
  validationSchema: computed(() => ({
    type: (value: string) => props.kind !== 'endpoints' || GEN_ENDPOINT_TYPES.some(type => type === value) || t('validation.selectEndpointType'),
    path: (value: string) => props.kind !== 'endpoints' || v.safeParse(RPathSchema, value).success || t('routes.pathInvalid'),
    name: (value: string) => props.kind !== 'keys' || !!value?.trim() || t('validation.keyNameRequired'),
    secret: (value: string) => props.kind !== 'keys' || !!value?.trim() || t('validation.keySecretRequired'),
    expireTime: (value: string) => props.kind !== 'keys' || !value || v.safeParse(RDateSchema, value).success || t('routes.expiryInvalid'),
    code: (value: string) => props.kind !== 'models' || !!value?.trim() || t('validation.modelCodeRequired'),
    modelId: (value: string) => props.kind !== 'models' || sources.value.some(source => source.id === Number(value)) || t('routes.sourceRequired'),
  })),
})
const visibleErrors = computed(() => submitCount.value ? errors.value : {})
const title = computed(() => props.kind === 'endpoints' ? (props.item ? t('endpoints.edit') : t('endpoints.create'))
  : props.kind === 'keys' ? (props.item ? t('keys.edit') : t('keys.create'))
    : props.item ? t('routes.editModel') : t('routes.createModel'))
let sourceRequest = 0
let resetting = false
async function loadSources() {
  const request = ++sourceRequest
  sourcesLoading.value = true
  sourcesError.value = false
  sources.value = []
  try {
    const items = await api<RModelSource[]>('/set/routes/model-sources')
    if (request === sourceRequest) sources.value = items
  } catch { if (request === sourceRequest) sourcesError.value = true }
  finally { if (request === sourceRequest) sourcesLoading.value = false }
}
watch(open, value => {
  if (!value) { sourceRequest++; sourcesLoading.value = false; return }
  const item = props.item
  resetting = true
  resetForm({values: {...initialValues,
    ...(item && 'path' in item ? {type: item.type, path: item.path} : {}),
    ...(item && 'secret' in item ? {name: item.name, secret: item.secret, expireTime: item.expireTime ?? ''} : {}),
    ...(item && 'modelId' in item ? {modelId: String(item.modelId), code: item.code, name: item.name} : {}),
  }})
  void nextTick(() => { resetting = false })
  if (props.kind === 'models') void loadSources()
})
const paths: Record<string, string> = {'Chat Completions': '/chat/completions', Responses: '/responses', Messages: '/messages'}
watch(() => values.type, (value, previous) => {
  if (resetting) return
  if (!values.path || values.path === paths[previous]) setFieldValue('path', paths[value] ?? '')
})
function selectSource(value: string) {
  setFieldValue('modelId', value)
  const source = sources.value.find(source => source.id === Number(value))
  if (source && !props.item) {
    if (!values.code) setFieldValue('code', source.code)
    if (!values.name) setFieldValue('name', source.name)
  }
}
const fields = computed(() => props.kind === 'endpoints' ? [
  {key: 'path', label: t('endpoints.path'), type: 'text'},
] : props.kind === 'keys' ? [
  {key: 'name', label: t('keys.name'), type: 'text'},
  {key: 'secret', label: t('keys.secret'), type: 'password'},
  {key: 'expireTime', label: t('keys.expiresAt'), type: 'date'},
] : [
  {key: 'code', label: t('routes.publicCode'), type: 'text'},
  {key: 'name', label: t('common.name'), type: 'text'},
])
const save = handleSubmit(async form => {
  if (props.kind === 'models' && (sourcesLoading.value || sourcesError.value)) return
  if (props.item && 'modelId' in props.item && !isEditableRouteModel(props.item)) {
    toast.error(t('routes.unsupportedModel'))
    return
  }
  const common = {enabled: props.item?.enabled ?? true, ...(props.item ? {sort: props.item.sort} : {})}
  const schema = props.kind === 'endpoints' ? REndpointInputSchema : props.kind === 'keys' ? RKeyInputSchema : RModelInputSchema
  const parsed = v.safeParse(schema, {...form, ...common, modelId: Number(form.modelId),
    expireTime: form.expireTime || null,
    ...(props.item && 'remark' in props.item ? {remark: props.item.remark} : {}),
    ...(props.item && 'category' in props.item ? {category: props.item.category} : {}),
  })
  if (!parsed.success) { toast.error(t('validation.checkForm')); return }
  try {
    const path = `/set/routes/${props.routeId}/${props.kind}${props.item ? `/${props.item.id}` : ''}`
    await api(path, {method: props.item ? 'PUT' : 'POST', body: JSON.stringify(parsed.output)})
    toast.success(t('common.saved'))
    open.value = false
    emit('saved')
  } catch (error) { toast.error(apiErrorMessage(error)) }
}, async () => { await body.value?.focusFirstInvalid() })
</script>

<template>
  <Dialog :open="open" @update:open="value => { if (!isSubmitting) open = value }">
    <DialogContent :aria-describedby="undefined" class="sm:max-w-md" @interact-outside="event => { if (isSubmitting) event.preventDefault() }" @escape-key-down="event => { if (isSubmitting) event.preventDefault() }">
      <DialogHeader><DialogTitle>{{ title }}</DialogTitle></DialogHeader>
      <DialogBody ref="body" :aria-label="title">
        <form :id="formId" @submit.prevent="save">
          <FieldGroup>
            <Field v-if="kind === 'endpoints'" :data-invalid="!!visibleErrors.type">
              <FieldLabel :for="`${formId}-type`">{{ t('endpoints.type') }}</FieldLabel>
              <Select :model-value="values.type" :disabled="isSubmitting" @update:model-value="value => setFieldValue('type', String(value))">
                <SelectTrigger :id="`${formId}-type`" class="w-full" :aria-invalid="!!visibleErrors.type || undefined"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem v-for="type in GEN_ENDPOINT_TYPES" :key="type" :value="type">{{ type }}</SelectItem></SelectGroup></SelectContent>
              </Select>
              <FieldError v-if="visibleErrors.type">{{ visibleErrors.type }}</FieldError>
              <FieldDescription>{{ t('routes.endpointPathHint') }}</FieldDescription>
            </Field>
            <template v-if="kind === 'models'">
              <Alert v-if="sourcesError" variant="destructive"><AlertDescription class="flex items-center justify-between gap-2">
                {{ t('errors.backendUnavailable') }}<Button type="button" variant="outline" size="sm" @click="loadSources">{{ t('common.retry') }}</Button>
              </AlertDescription></Alert>
              <Field :data-invalid="!!visibleErrors.modelId">
                <FieldLabel :for="`${formId}-modelId`">{{ t('routes.sourceModel') }}</FieldLabel>
                <Select :model-value="values.modelId" :disabled="isSubmitting || sourcesLoading" @update:model-value="value => selectSource(String(value))">
                  <SelectTrigger :id="`${formId}-modelId`" class="w-full" :aria-invalid="!!visibleErrors.modelId || undefined"><SelectValue :placeholder="sourcesLoading ? t('common.loading') : t('routes.sourceRequired')" /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    <SelectItem v-for="source in sources" :key="source.id" :value="String(source.id)">{{ source.providerName }} / {{ source.name || source.code }}{{ source.enabled ? '' : ` (${t('common.disabled')})` }}</SelectItem>
                  </SelectGroup></SelectContent>
                </Select>
                <FieldError v-if="visibleErrors.modelId">{{ visibleErrors.modelId }}</FieldError>
                <FieldDescription>{{ !sourcesLoading && !sourcesError && !sources.length ? t('routes.noSources') : t('routes.directHint') }}</FieldDescription>
              </Field>
            </template>
            <Field v-for="field in fields" :key="field.key" :data-invalid="!!visibleErrors[field.key as keyof typeof initialValues]">
              <FieldLabel :for="`${formId}-${field.key}`">{{ field.label }}</FieldLabel>
              <Input :id="`${formId}-${field.key}`" :model-value="values[field.key as keyof typeof initialValues]" :type="field.type" :disabled="isSubmitting" :autocomplete="field.key === 'secret' ? 'new-password' : undefined"
                :aria-invalid="!!visibleErrors[field.key as keyof typeof initialValues] || undefined" @update:model-value="value => setFieldValue(field.key as keyof typeof initialValues, String(value))" />
              <FieldError v-if="visibleErrors[field.key as keyof typeof initialValues]">{{ visibleErrors[field.key as keyof typeof initialValues] }}</FieldError>
              <FieldDescription v-if="field.key === 'expireTime'">{{ t('keys.expiryHint') }}</FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" :disabled="isSubmitting" @click="open = false"><PhX data-icon="inline-start" />{{ t('common.cancel') }}</Button>
        <Button type="submit" :form="formId" :disabled="isSubmitting || (kind === 'models' && (sourcesLoading || sourcesError))"><Spinner v-if="isSubmitting" data-icon="inline-start" /><PhFloppyDisk v-else data-icon="inline-start" />{{ t('common.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
