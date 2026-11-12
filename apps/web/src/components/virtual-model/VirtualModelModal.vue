<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useForm } from 'vee-validate'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { V_MODEL_KINDS, V_MODEL_KIND_ROLES, MODEL_TYPES, VModelInputSchema, VOrchConfigSchema,
  VModelCapabilitiesSchema, VModelGeneratesSchema, isVOrchConfigForKind, isVModelReady,
  type VModel, type VModelKind, type VModelMemberInput, type VModelSource } from '@ai-gate/shared'
import { PhFloppyDisk, PhPlus, PhTrashSimple, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { api, ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import VirtualOrchEditor from './VirtualOrchEditor.vue'

const props = defineProps<{ item: VModel | null }>()
const emit = defineEmits<{ saved: [model: VModel] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const id = useId()
const body = ref<InstanceType<typeof DialogBody> | null>(null)
const sources = ref<VModelSource[]>([])
const sourceSearch = ref('')
const sourcesLoading = ref(false)
const sourcesError = ref(false)
const saveError = ref('')
let sourceVersion = 0
onBeforeUnmount(() => { sourceVersion++ })
const title = computed(() => props.item ? t('virtualModels.edit') : t('virtualModels.create'))
const initialValues = { code: '', name: '', category: 'Default', kind: 'GROUP' as VModelKind, type: 'TEXT',
  enabled: false, timeout: '180000', maxCalls: '16', sort: '0', remark: '',
  generates: 'null', config: 'null', orchConfig: '{}', members: [] as VModelMemberInput[] }
const integer = (input: string, min: number, max = Number.MAX_SAFE_INTEGER) => input.trim() !== '' &&
  Number.isSafeInteger(Number(input)) && Number(input) >= min && Number(input) <= max
function validJSON(input: string, schema: v.GenericSchema) {
  try { return v.safeParse(schema, JSON.parse(input)).success }
  catch { return false }
}
const { values, errors, submitCount, isSubmitting, setFieldValue, setFieldError, resetForm, handleSubmit } = useForm({
  initialValues,
  validationSchema: computed(() => ({
    code: (value: string) => !!value?.trim() || t('validation.modelCodeRequired'),
    category: (value: string) => !!value?.trim() || t('validation.checkForm'),
    timeout: (value: string) => integer(value, 1, 2147483647) || t('routes.timeoutInvalid'),
    maxCalls: (value: string) => integer(value, 1) || t('virtualModels.positiveInteger'),
    sort: (value: string) => integer(value, 0) || t('routes.retriesInvalid'),
    generates: (value: string) => validJSON(value, VModelGeneratesSchema) || t('virtualModels.arrayJSON'),
    config: (value: string) => validJSON(value, v.nullable(VModelCapabilitiesSchema)) || t('virtualModels.capabilitiesInvalid'),
    orchConfig: (value: string) => {
      try {
        const result = v.safeParse(VOrchConfigSchema, JSON.parse(value))
        return (result.success && isVOrchConfigForKind(values.kind, result.output)) || t('virtualModels.orchInvalid')
      } catch { return t('virtualModels.orchInvalid') }
    },
    members: (members: VModelMemberInput[]) => members.every(member => sources.value.some(source => source.id === member.modelId) &&
      V_MODEL_KIND_ROLES[values.kind].includes(member.role) && Number.isSafeInteger(member.sort) && member.sort >= 0 &&
      Number.isSafeInteger(member.weight) && member.weight > 0) &&
      new Set(members.map(member => `${member.role}:${member.modelId}`)).size === members.length || t('virtualModels.membersInvalid'),
  })),
})
const visibleErrors = computed(() => submitCount.value ? errors.value : {})
const filteredSources = computed(() => sources.value.filter(source =>
  `${source.providerName} ${source.name} ${source.code}`.toLowerCase().includes(sourceSearch.value.toLowerCase())))
async function loadSources() {
  const version = ++sourceVersion
  sourcesLoading.value = true; sourcesError.value = false; sources.value = []
  try {
    const result = await api<VModelSource[]>('/set/virtual-models/model-sources')
    if (version === sourceVersion) sources.value = result
  } catch { if (version === sourceVersion) sourcesError.value = true }
  finally { if (version === sourceVersion) sourcesLoading.value = false }
}
watch(open, value => {
  if (!value) { sourceVersion++; sourcesLoading.value = false; return }
  saveError.value = ''; sourceSearch.value = ''
  const item = props.item
  resetForm({ values: item ? { ...initialValues, code: item.code, name: item.name, category: item.category,
    kind: item.kind, type: item.type, enabled: item.enabled, timeout: String(item.timeout), maxCalls: String(item.maxCalls),
    sort: String(item.sort), remark: item.remark, generates: JSON.stringify(item.generates, null, 2),
    config: JSON.stringify(item.config, null, 2), orchConfig: JSON.stringify(item.orchConfig, null, 2),
    members: item.members.map(member => ({ id: member.id, modelId: member.modelId, role: member.role,
      enabled: member.enabled, sort: member.sort, weight: member.weight, remark: member.remark })),
  } : { ...initialValues, members: [] } })
  void loadSources()
})
function changeKind(next: unknown) {
  if (!props.item && V_MODEL_KINDS.includes(next as VModelKind)) setFieldValue('kind', next as VModelKind)
}
function changeMember(index: number, patch: Partial<VModelMemberInput>) {
  setFieldValue('members', values.members.map((member, current) => current === index ? { ...member, ...patch } : member))
}
function addMember() {
  setFieldValue('members', [...values.members, { modelId: 0, role: V_MODEL_KIND_ROLES[values.kind][0]!,
    enabled: true, sort: values.members.length, weight: 1, remark: '' }])
}
const textFields = computed(() => [
  { key: 'code' as const, label: t('routes.code'), type: 'text' },
  { key: 'name' as const, label: t('common.name'), type: 'text' },
  { key: 'category' as const, label: t('models.category'), type: 'text' },
  { key: 'timeout' as const, label: t('virtualModels.timeout'), type: 'number' },
  { key: 'maxCalls' as const, label: t('virtualModels.maxCalls'), type: 'number' },
  { key: 'sort' as const, label: t('virtualModels.sort'), type: 'number' },
])
const jsonFields = computed(() => [
  { key: 'generates' as const, label: t('virtualModels.protocolsJSON') },
  { key: 'config' as const, label: t('virtualModels.capabilitiesJSON') },
])
const save = handleSubmit(async form => {
  if (sourcesLoading.value || sourcesError.value) return
  saveError.value = ''
  const result = v.safeParse(VModelInputSchema, { ...form, timeout: Number(form.timeout), maxCalls: Number(form.maxCalls),
    sort: Number(form.sort), generates: JSON.parse(form.generates), config: JSON.parse(form.config), orchConfig: JSON.parse(form.orchConfig) })
  if (!result.success) { saveError.value = t('virtualModels.configurationInvalid'); return }
  const available = new Set(sources.value.filter(source => source.enabled).map(source => source.id))
  if (form.enabled && !isVModelReady(result.output, available)) { saveError.value = t('virtualModels.notReady'); return }
  try {
    const model = await api<VModel>(`/set/virtual-models${props.item ? `/${props.item.id}` : ''}`,
      { method: props.item ? 'PUT' : 'POST', body: JSON.stringify(result.output) })
    toast.success(t('common.saved')); open.value = false; emit('saved', model)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'DUPLICATE_VIRTUAL_MODEL') setFieldError('code', apiErrorMessage(error))
    saveError.value = apiErrorMessage(error)
    await body.value?.focusFirstInvalid()
  }
}, async () => { await nextTick(); await body.value?.focusFirstInvalid() })
</script>

<template>
  <Dialog :open="open" @update:open="value => { if (!isSubmitting) open = value }">
    <DialogContent :aria-describedby="undefined" class="sm:max-w-3xl" @interact-outside="event => { if (isSubmitting) event.preventDefault() }" @escape-key-down="event => { if (isSubmitting) event.preventDefault() }">
      <DialogHeader><DialogTitle>{{ title }}</DialogTitle></DialogHeader>
      <DialogBody ref="body" :aria-label="title">
        <form :id="id" @submit.prevent="save">
          <FieldGroup>
            <Alert v-if="saveError" variant="destructive"><AlertDescription>{{ saveError }}</AlertDescription></Alert>
            <Field>
              <FieldLabel>{{ t('virtualModels.kind') }}</FieldLabel>
              <ToggleGroup type="single" variant="outline" :model-value="values.kind" :disabled="isSubmitting || !!item" :aria-label="t('virtualModels.kind')" @update:model-value="changeKind">
                <ToggleGroupItem v-for="kind in V_MODEL_KINDS" :key="kind" :value="kind">{{ kind }}</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>{{ t(`virtualModels.kindHints.${values.kind}`) }}</FieldDescription>
              <FieldDescription>{{ t('virtualModels.immutableHint') }}</FieldDescription>
            </Field>
            <FieldGroup class="sm:grid sm:grid-cols-2">
              <Field v-for="field in textFields" :key="field.key" :data-invalid="!!visibleErrors[field.key]">
                <FieldLabel :for="`${id}-${field.key}`">{{ field.label }}</FieldLabel>
                <Input :id="`${id}-${field.key}`" :type="field.type" :model-value="values[field.key]" :disabled="isSubmitting || (field.key === 'code' && !!item)"
                  :aria-invalid="!!visibleErrors[field.key] || undefined" @update:model-value="value => setFieldValue(field.key, String(value))" />
                <FieldError v-if="visibleErrors[field.key]">{{ visibleErrors[field.key] }}</FieldError>
              </Field>
              <Field>
                <FieldLabel :for="`${id}-type`">{{ t('models.type') }}</FieldLabel>
                <Select :model-value="values.type" :disabled="isSubmitting" @update:model-value="value => setFieldValue('type', String(value))">
                  <SelectTrigger :id="`${id}-type`" class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem v-for="type in MODEL_TYPES" :key="type" :value="type">{{ type }}</SelectItem></SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal"><FieldLabel :for="`${id}-enabled`">{{ t('common.enabled') }}</FieldLabel><Switch :id="`${id}-enabled`" :model-value="values.enabled" :disabled="isSubmitting" @update:model-value="value => setFieldValue('enabled', !!value)" /></Field>
            </FieldGroup>
            <Field><FieldLabel :for="`${id}-remark`">{{ t('common.description') }}</FieldLabel><Textarea :id="`${id}-remark`" :model-value="values.remark" :disabled="isSubmitting" @update:model-value="value => setFieldValue('remark', String(value))" /></Field>
            <FieldSet>
              <FieldLegend>{{ t('virtualModels.members') }}</FieldLegend>
              <FieldDescription>{{ t('virtualModels.membersHint') }}</FieldDescription>
              <Alert v-if="sourcesError" variant="destructive"><AlertDescription class="flex items-center justify-between gap-2">{{ t('errors.backendUnavailable') }}<Button type="button" variant="outline" size="sm" @click="loadSources">{{ t('common.retry') }}</Button></AlertDescription></Alert>
              <Field><FieldLabel :for="`${id}-source-search`">{{ t('common.search') }}</FieldLabel><Input :id="`${id}-source-search`" v-model="sourceSearch" :disabled="isSubmitting" /></Field>
              <FieldError v-if="visibleErrors.members">{{ visibleErrors.members }}</FieldError>
              <FieldSet v-for="(member, index) in values.members" :key="index" :disabled="isSubmitting">
                <FieldLegend>{{ t('virtualModels.memberNumber', { number: index + 1 }) }}</FieldLegend>
                <FieldGroup class="sm:grid sm:grid-cols-2">
                  <Field>
                    <FieldLabel :for="`${id}-member-${index}-model`">{{ t('routes.sourceModel') }}</FieldLabel>
                    <Select :model-value="String(member.modelId)" :disabled="isSubmitting || sourcesLoading || sourcesError" @update:model-value="value => changeMember(index, { modelId: Number(value) })">
                      <SelectTrigger :id="`${id}-member-${index}-model`" class="w-full" :aria-invalid="!!visibleErrors.members || undefined"><SelectValue :placeholder="t('routes.sourceRequired')" /></SelectTrigger>
                      <SelectContent><SelectGroup><SelectItem v-for="source in filteredSources" :key="source.id" :value="String(source.id)">{{ source.providerName }} / {{ source.name || source.code }}{{ source.enabled ? '' : ` (${t('common.disabled')})` }}</SelectItem></SelectGroup></SelectContent>
                    </Select>
                    <FieldDescription v-if="member.modelId">{{ sources.find(source => source.id === member.modelId)?.generates.join(' · ') }}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel :for="`${id}-member-${index}-role`">{{ t('virtualModels.role') }}</FieldLabel>
                    <Select :model-value="member.role" :disabled="isSubmitting" @update:model-value="value => changeMember(index, { role: value as VModelMemberInput['role'] })">
                      <SelectTrigger :id="`${id}-member-${index}-role`" class="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup><SelectItem v-for="role in V_MODEL_KIND_ROLES[values.kind]" :key="role" :value="role">{{ role }}</SelectItem></SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field v-for="key in (['sort', 'weight'] as const)" :key="key">
                    <FieldLabel :for="`${id}-member-${index}-${key}`">{{ key === 'sort' ? t('virtualModels.priority') : t('virtualModels.weight') }}</FieldLabel>
                    <Input :id="`${id}-member-${index}-${key}`" type="number" step="1" :min="key === 'sort' ? 0 : 1" :model-value="member[key]" :aria-invalid="!!visibleErrors.members || undefined" @update:model-value="value => changeMember(index, { [key]: value === '' ? NaN : Number(value) })" />
                  </Field>
                  <Field class="sm:col-span-2"><FieldLabel :for="`${id}-member-${index}-remark`">{{ t('common.description') }}</FieldLabel><Input :id="`${id}-member-${index}-remark`" :model-value="member.remark" @update:model-value="value => changeMember(index, { remark: String(value) })" /></Field>
                  <Field orientation="horizontal"><FieldLabel :for="`${id}-member-${index}-enabled`">{{ t('common.enabled') }}</FieldLabel><Switch :id="`${id}-member-${index}-enabled`" :model-value="member.enabled" :disabled="isSubmitting" @update:model-value="value => changeMember(index, { enabled: !!value })" /></Field>
                  <Button type="button" variant="outline" :disabled="isSubmitting" @click="setFieldValue('members', values.members.filter((_, current) => current !== index))"><PhTrashSimple data-icon="inline-start" />{{ t('common.delete') }}</Button>
                </FieldGroup>
              </FieldSet>
              <FieldDescription v-if="!sourcesLoading && !sourcesError && !sources.length">{{ t('routes.noSources') }}</FieldDescription>
              <Button type="button" variant="outline" :disabled="isSubmitting || sourcesLoading || sourcesError || !sources.length" @click="addMember"><PhPlus data-icon="inline-start" />{{ t('virtualModels.addMember') }}</Button>
            </FieldSet>
            <FieldSet>
              <FieldLegend>{{ t('virtualModels.orchestration') }}</FieldLegend>
              <VirtualOrchEditor :model-value="values.orchConfig" :kind="values.kind" :disabled="isSubmitting" @update:model-value="value => setFieldValue('orchConfig', value)" />
              <Field :data-invalid="!!visibleErrors.orchConfig">
                <FieldLabel :for="`${id}-orchConfig`">orch_config (JSON)</FieldLabel>
                <Textarea :id="`${id}-orchConfig`" :rows="10" :model-value="values.orchConfig" :disabled="isSubmitting" :aria-invalid="!!visibleErrors.orchConfig || undefined" spellcheck="false" @update:model-value="value => setFieldValue('orchConfig', String(value))" />
                <FieldError v-if="visibleErrors.orchConfig">{{ visibleErrors.orchConfig }}</FieldError>
              </Field>
            </FieldSet>
            <Field v-for="field in jsonFields" :key="field.key" :data-invalid="!!visibleErrors[field.key]">
              <FieldLabel :for="`${id}-${field.key}`">{{ field.label }}</FieldLabel>
              <Textarea :id="`${id}-${field.key}`" :rows="3" :model-value="values[field.key]" :disabled="isSubmitting" :aria-invalid="!!visibleErrors[field.key] || undefined" spellcheck="false" @update:model-value="value => setFieldValue(field.key, String(value))" />
              <FieldError v-if="visibleErrors[field.key]">{{ visibleErrors[field.key] }}</FieldError>
              <FieldDescription>{{ t('virtualModels.inheritHint') }}</FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" :disabled="isSubmitting" @click="open = false"><PhX data-icon="inline-start" />{{ t('common.cancel') }}</Button>
        <Button type="submit" :form="id" :disabled="isSubmitting || sourcesLoading || sourcesError"><Spinner v-if="isSubmitting" data-icon="inline-start" /><PhFloppyDisk v-else data-icon="inline-start" />{{ t('common.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
