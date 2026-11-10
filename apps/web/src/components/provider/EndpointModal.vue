<script setup lang="ts">
import type { SEndpoint, SEndpointInput } from '@ai-gate/shared'
import { GEN_ENDPOINT_TYPES, GEN_ENDPOINT_DEFAULT_PATHS } from '@ai-gate/shared'
import { computed, reactive, ref, watch, useId } from 'vue'
import { useClipboard } from '@vueuse/core'
import { PhCopy, PhFloppyDisk, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { useProvidersStore } from '@/stores/providers'
import { splitUrl } from '@/utils/url'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const formId = useId()

const props = defineProps<{
  providerId: number
  endpoint: SEndpoint | null
  existingEndpoints?: SEndpoint[]
}>()

const emit = defineEmits<{saved: [endpoint: SEndpoint]}>()

const open = defineModel<boolean>('open', {default: false})

const store = useProvidersStore()
const {copy} = useClipboard()

const form = reactive({type: '', path: ''})

const showErrors = ref(false)
const saving = ref(false)
const formBody = ref<InstanceType<typeof DialogBody> | null>(null)

const baseUrl = computed(() => store.providers.find(p => p.id === props.providerId)?.baseUrl)

/** 当前已配置的生成端点类型集合（排除当前正在编辑的端点） */
const configuredGenerates = computed(() => {
  const eps = props.existingEndpoints ?? store.endpoints
  return new Set(
    eps
      .filter(e => !props.endpoint || e.id !== props.endpoint.id)
      .map(e => e.type),
  )
})

/** 尚未配置的生成端点类型列表 */
const availableGenerates = computed(() => {
  return GEN_ENDPOINT_TYPES.filter(p => !configuredGenerates.value.has(p))
})

const showUnavailableDescription = computed(() =>
  !props.endpoint && availableGenerates.value.length === 0,
)

watch(open, (v) => {
  if (!v) return
  form.type = props.endpoint?.type || availableGenerates.value[0] || ''
  const defaultPath = GEN_ENDPOINT_DEFAULT_PATHS[form.type as keyof typeof GEN_ENDPOINT_DEFAULT_PATHS] ?? ''
  form.path = props.endpoint?.path || defaultPath
  showErrors.value = false
})

watch(() => form.type, (newGen, oldGen) => {
  const oldDefault = oldGen && oldGen in GEN_ENDPOINT_DEFAULT_PATHS
    ? GEN_ENDPOINT_DEFAULT_PATHS[oldGen as keyof typeof GEN_ENDPOINT_DEFAULT_PATHS]
    : ''
  if (!form.path || form.path === oldDefault) {
    if (newGen && newGen in GEN_ENDPOINT_DEFAULT_PATHS) {
      form.path = GEN_ENDPOINT_DEFAULT_PATHS[newGen as keyof typeof GEN_ENDPOINT_DEFAULT_PATHS]
    }
  }
})

const generateError = computed(() => {
  if (showErrors.value && !form.type.trim()) return t('validation.selectEndpointType')
  if (!props.endpoint && configuredGenerates.value.has(form.type.trim())) {
    return t('validation.duplicateEndpointType')
  }
  return undefined
})

const pathError = computed(() =>
  showErrors.value && !form.path.trim() ? t('validation.endpointPathRequired') : undefined,
)

const canSave = computed(() =>
  !saving.value && !!form.path.trim() && !!form.type.trim()
  && !configuredGenerates.value.has(form.type.trim()),
)

/** 弹窗标题 */
const modalTitle = computed(() => props.endpoint ? t('endpoints.edit') : t('endpoints.create'))

const endpointTypeDisplay = computed(() => form.type || t('endpoints.generatePath'))
const pathPlaceholder = computed(() =>
  GEN_ENDPOINT_DEFAULT_PATHS[form.type as keyof typeof GEN_ENDPOINT_DEFAULT_PATHS] ?? t('endpoints.pathPlaceholder'),
)

/** 完整端点地址拆分与预览 */
const previewUrlParts = computed(() => splitUrl(baseUrl.value, form.path.trim()))

async function handleCopyPreview() {
  if (!previewUrlParts.value.fullUrl) return
  await copy(previewUrlParts.value.fullUrl)
  toast.success(t('endpoints.copied'))
}

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    await formBody.value?.focusFirstInvalid()
    toast.error(t('validation.checkForm'))
    return
  }
  saving.value = true
  const isDefault = props.endpoint ? props.endpoint.isDefault : false
  const input: SEndpointInput = {
    type: form.type.trim(),
    path: form.path.trim(),
    isDefault,
  }
  try {
    const saved = props.endpoint
      ? await store.updateEndpoint(props.providerId, props.endpoint.id, input)
      : await store.createEndpoint(props.providerId, input)
    toast.success(t('common.saved'))
    open.value = false
    emit('saved', saved)
  } catch (err) {
    console.warn('[ai-gate] 保存端点失败', err)
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
    <DialogContent
      v-bind="showUnavailableDescription ? {} : { 'aria-describedby': undefined }"
      class="sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle>{{ modalTitle }}</DialogTitle>
        <DialogDescription v-if="showUnavailableDescription">
          {{ t('endpoints.allConfigured') }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody ref="formBody" :aria-label="modalTitle">
        <FieldGroup>
          <!-- 生成类型：修改时只读，新增时选择未配置的类型 -->
          <Field :data-invalid="!props.endpoint ? !!generateError : false">
            <FieldLabel :for="`${formId}-generate`">
              {{ t('endpoints.type') }}
              <span
                v-if="!props.endpoint"
                class="text-destructive"
              >*</span>
            </FieldLabel>
            <Input
              v-if="props.endpoint"
              :id="`${formId}-generate`"
              :model-value="endpointTypeDisplay"
              disabled
            />
            <Select
              v-else
              v-model="form.type"
            >
              <SelectTrigger
                class="w-full"
                :disabled="availableGenerates.length === 0"
                :id="`${formId}-generate`"
                :aria-invalid="!!generateError || undefined"
              >
                <SelectValue :placeholder="t('validation.selectEndpointType')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="item in availableGenerates"
                    :key="item"
                    :value="item"
                  >
                    {{ item }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError v-if="!props.endpoint && generateError">
              {{ generateError }}
            </FieldError>
          </Field>

          <!-- 端点地址输入框 -->
          <Field :data-invalid="!!pathError">
            <FieldLabel :for="`${formId}-path`">{{ t('endpoints.path') }} <span class="text-destructive">*</span></FieldLabel>
            <Input
              v-model="form.path"
              :aria-invalid="!!pathError || undefined"
              :placeholder="pathPlaceholder"
              :disabled="!props.endpoint && availableGenerates.length === 0"
              :id="`${formId}-path`"
            />
            <FieldError v-if="pathError">
              {{ pathError }}
            </FieldError>
          </Field>

          <!-- 完整端点地址预览 -->
          <Field>
            <FieldLabel>{{ t('endpoints.preview') }}</FieldLabel>
            <div class="bg-muted/40 flex h-8 min-w-0 items-center justify-between gap-2 border px-2.5">
              <code
                class="min-w-0 flex-1 truncate text-xs select-all"
                :title="previewUrlParts.fullUrl || t('common.noData')"
              >
                <span
                  v-if="previewUrlParts.basePart"
                  class="text-muted-foreground"
                >{{ previewUrlParts.basePart }}</span>
                <span :class="previewUrlParts.basePart ? 'font-medium' : 'text-muted-foreground'">{{ previewUrlParts.pathPart || (!previewUrlParts.fullUrl ? t('common.noData') : '') }}</span>
              </code>
              <Button
                v-if="previewUrlParts.fullUrl"
                variant="ghost"
                size="icon-xs"
                class="shrink-0"
                :title="t('common.copy')"
                :aria-label="t('common.copy')"
                @click="handleCopyPreview"
              >
                <PhCopy />
              </Button>
            </div>
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
          :disabled="saving || (!props.endpoint && availableGenerates.length === 0)"
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
