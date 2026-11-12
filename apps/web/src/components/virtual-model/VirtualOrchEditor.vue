<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { V_MODEL_KIND_ROLES, V_MODEL_STRATEGIES, GEN_ENDPOINT_TYPES, isParallelRole,
  type VModelKind, type VModelRole, type VOrchConfig, type VRoleConfig } from '@ai-gate/shared'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{ kind: VModelKind, disabled: boolean }>()
const value = defineModel<string>({ required: true })
const { t } = useI18n()
const id = useId()
const parsed = computed<VOrchConfig | null>(() => {
  try { const result = JSON.parse(value.value); return result && typeof result === 'object' && !Array.isArray(result) ? result : null }
  catch { return null }
})
function update(role: VModelRole, key: keyof VRoleConfig, next: unknown) {
  if (!parsed.value) return
  const config = { ...parsed.value, [role]: { ...parsed.value[role] } }
  if (next === '' || next === undefined) delete config[role]![key]
  else Object.assign(config[role]!, { [key]: next })
  value.value = JSON.stringify(config, null, 2)
}
const numbers = computed(() => [
  { key: 'timeout' as const, label: t('virtualModels.callTimeout'), min: 1 },
  { key: 'deadline' as const, label: t('virtualModels.deadline'), min: 1 },
  { key: 'maxRetries' as const, label: t('routes.maxRetries'), min: 0 },
])
</script>

<template>
  <FieldGroup>
    <FieldSet v-for="role in V_MODEL_KIND_ROLES[kind]" :key="role" :disabled="disabled || !parsed">
      <FieldLegend>{{ role }}</FieldLegend>
      <FieldGroup class="sm:grid sm:grid-cols-2">
        <Field v-if="!isParallelRole(role)">
          <FieldLabel :for="`${id}-${role}-strategy`">{{ t('routes.strategy') }}</FieldLabel>
          <Select :model-value="parsed?.[role]?.strategy ?? 'PRIORITY'" :disabled="disabled || !parsed" @update:model-value="next => update(role, 'strategy', next)">
            <SelectTrigger :id="`${id}-${role}-strategy`" class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem v-for="strategy in V_MODEL_STRATEGIES" :key="strategy" :value="strategy">{{ strategy }}</SelectItem></SelectGroup></SelectContent>
          </Select>
        </Field>
        <template v-else>
          <Field v-for="key in (['maxParticipants', 'maxConcurrency', 'minSuccess'] as const)" :key="key">
            <FieldLabel :for="`${id}-${role}-${key}`">{{ t(`virtualModels.${key}`) }}</FieldLabel>
            <Input :id="`${id}-${role}-${key}`" type="number" min="1" step="1" :placeholder="t('virtualModels.defaultValue')" :model-value="parsed?.[role]?.[key] ?? ''"
              @update:model-value="next => update(role, key, next === '' ? '' : Number(next))" />
          </Field>
        </template>
        <Field v-if="role !== 'SELECT'">
          <FieldLabel :for="`${id}-${role}-endpoint`">{{ t('endpoints.type') }}</FieldLabel>
          <Select :model-value="parsed?.[role]?.endpointType ?? 'default'" :disabled="disabled || !parsed" @update:model-value="next => update(role, 'endpointType', next === 'default' ? undefined : next)">
            <SelectTrigger :id="`${id}-${role}-endpoint`" class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="default">{{ t('virtualModels.defaultValue') }}</SelectItem><SelectItem v-for="endpoint in GEN_ENDPOINT_TYPES" :key="endpoint" :value="endpoint">{{ endpoint }}</SelectItem></SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field v-for="field in numbers" :key="field.key">
          <FieldLabel :for="`${id}-${role}-${field.key}`">{{ field.label }}</FieldLabel>
          <Input :id="`${id}-${role}-${field.key}`" type="number" :min="field.min" step="1" :placeholder="t('virtualModels.defaultValue')" :model-value="parsed?.[role]?.[field.key] ?? ''"
            @update:model-value="next => update(role, field.key, next === '' ? '' : Number(next))" />
        </Field>
        <Field v-if="role !== 'SELECT'" class="sm:col-span-2">
          <FieldLabel :for="`${id}-${role}-prompt`">{{ t('virtualModels.promptTemplate') }}</FieldLabel>
          <Textarea :id="`${id}-${role}-prompt`" :model-value="parsed?.[role]?.promptTemplate ?? ''" :rows="3" @update:model-value="next => update(role, 'promptTemplate', next)" />
        </Field>
      </FieldGroup>
    </FieldSet>
    <FieldDescription>{{ t('virtualModels.orchHint') }}</FieldDescription>
  </FieldGroup>
</template>
