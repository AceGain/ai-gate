<script setup lang="ts">
import type { SEndpoint, SEndpointInput, EndpointType } from '@ai-gate/shared'
import { GEN_ENDPOINT_TYPES, GEN_ENDPOINT_DEFAULT_PATHS } from '@ai-gate/shared'
import { computed, reactive, ref, watch } from 'vue'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  providerId: number
  endpoint: SEndpoint | null
  defaultType?: EndpointType
  existingEndpoints?: SEndpoint[]
}>(), {
  defaultType: 'generate',
})

const emit = defineEmits<{saved: [endpoint: SEndpoint]}>()

const open = defineModel<boolean>('open', {default: false})

const store = useProvidersStore()
const {copy} = useClipboard()

const targetType = computed<EndpointType>(() => {
  return props.endpoint?.type ?? props.defaultType ?? 'generate'
})

const form = reactive({
  type: 'generate' as EndpointType,
  generate: '',
  path: '',
  isDefault: false,
})

const showErrors = ref(false)
const saving = ref(false)
const formBody = ref<InstanceType<typeof DialogBody> | null>(null)

/** 基地址端点（用于拼接完整端点预览） */
const baseEndpoint = computed(() => {
  const eps = props.existingEndpoints ?? store.endpoints
  return eps.find(e => e.type === 'base')
})

/** 当前已配置的生成端点类型集合（排除当前正在编辑的端点） */
const configuredGenerates = computed(() => {
  const eps = props.existingEndpoints ?? store.endpoints
  return new Set(
    eps
      .filter(e => e.type === 'generate' && (!props.endpoint || e.id !== props.endpoint.id))
      .map(e => e.generate),
  )
})

/** 尚未配置的生成端点类型列表 */
const availableGenerates = computed(() => {
  return GEN_ENDPOINT_TYPES.filter(p => !configuredGenerates.value.has(p))
})

watch(open, (v) => {
  if (!v) return
  form.type = targetType.value
  const initialGenerate = props.endpoint?.generate
    || (form.type === 'generate' ? (availableGenerates.value[0] ?? '') : '')
  form.generate = initialGenerate
  const defaultPath = form.type === 'generate' && form.generate in GEN_ENDPOINT_DEFAULT_PATHS
    ? GEN_ENDPOINT_DEFAULT_PATHS[form.generate as keyof typeof GEN_ENDPOINT_DEFAULT_PATHS]
    : ''
  form.path = props.endpoint?.path || (form.type === 'generate' ? defaultPath : '')
  form.isDefault = form.type === 'generate' ? (props.endpoint?.isDefault ?? false) : false
  showErrors.value = false
})

watch(() => form.generate, (newGen, oldGen) => {
  if (form.type !== 'generate') return
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
  if (form.type !== 'generate') return undefined
  if (showErrors.value && !form.generate.trim()) return t('validation.selectEndpointType')
  if (!props.endpoint && configuredGenerates.value.has(form.generate.trim())) {
    return t('validation.duplicateEndpointType')
  }
  return undefined
})

const pathError = computed(() =>
  showErrors.value && !form.path.trim() ? t('validation.endpointPathRequired') : undefined,
)

const canSave = computed(() => {
  if (saving.value) return false
  if (!form.path.trim()) return false
  if (form.type === 'generate') {
    if (!form.generate.trim()) return false
    if (!props.endpoint && configuredGenerates.value.has(form.generate.trim())) return false
  }
  return true
})

/** 弹窗标题 */
const modalTitle = computed(() => props.endpoint ? t('endpoints.edit') : t('endpoints.create'))

/** 端点类型只读显示文本 */
const endpointTypeDisplay = computed(() => {
  if (form.type === 'base') return 'Base URL'
  if (form.type === 'models') return t('endpoints.modelList')
  if (form.type === 'generate') return form.generate || t('endpoints.generatePath')
  return form.type
})

const pathPlaceholder = computed(() => {
  if (form.type === 'base') return t('endpoints.basePlaceholder')
  if (form.type === 'models') return '/v1/models'
  if (form.type === 'generate' && form.generate in GEN_ENDPOINT_DEFAULT_PATHS) {
    return GEN_ENDPOINT_DEFAULT_PATHS[form.generate as keyof typeof GEN_ENDPOINT_DEFAULT_PATHS]
  }
  return t('endpoints.pathPlaceholder')
})

/** 完整端点地址拆分与预览 */
const previewUrlParts = computed(() => splitUrl(baseEndpoint.value?.path, form.path.trim()))

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
    type: form.type,
    generate: form.type === 'generate' ? form.generate.trim() : '',
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
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ modalTitle }}</DialogTitle>
        <DialogDescription v-if="form.type === 'generate' && !props.endpoint && availableGenerates.length === 0">
          {{ t('endpoints.allConfigured') }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody ref="formBody" :aria-label="modalTitle">
        <FieldGroup>
          <!-- 端点类型：修改时只读不可操作；新增 generate 时展示下拉选择 -->
          <Field :data-invalid="!props.endpoint ? !!generateError : false">
            <FieldLabel>
              {{ t('endpoints.type') }}
              <span
                v-if="!props.endpoint && form.type === 'generate'"
                class="text-destructive"
              >*</span>
            </FieldLabel>
            <Input
              v-if="props.endpoint"
              :model-value="endpointTypeDisplay"
              disabled
            />
            <Select
              v-else
              v-model="form.generate"
            >
              <SelectTrigger
                class="w-full"
                :disabled="availableGenerates.length === 0"
              >
                <SelectValue :placeholder="t('validation.selectEndpointType')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in availableGenerates"
                  :key="item"
                  :value="item"
                >
                  {{ item }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldError v-if="!props.endpoint && generateError">
              {{ generateError }}
            </FieldError>
          </Field>

          <!-- 端点地址输入框 -->
          <Field :data-invalid="!!pathError">
            <FieldLabel>{{ t('endpoints.path') }} <span class="text-destructive">*</span></FieldLabel>
            <Input
              v-model="form.path"
              :aria-invalid="!!pathError || undefined"
              :placeholder="pathPlaceholder"
              :disabled="form.type === 'generate' && !props.endpoint && availableGenerates.length === 0"
            />
            <FieldError v-if="pathError">
              {{ pathError }}
            </FieldError>
          </Field>

          <!-- 完整端点地址预览 -->
          <Field>
            <FieldLabel>{{ t('endpoints.preview') }}</FieldLabel>
            <div class="bg-muted/40 flex min-h-8 items-center justify-between gap-2 border px-2.5 py-1.5">
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
                size="icon-sm"
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
          :disabled="saving || (form.type === 'generate' && !props.endpoint && availableGenerates.length === 0)"
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
