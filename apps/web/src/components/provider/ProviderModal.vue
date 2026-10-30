<script setup lang="ts">
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import type { GenEndpointType, SProvider } from '@ai-gate/shared'
import { GEN_ENDPOINT_TYPES, GEN_ENDPOINT_DEFAULT_PATHS } from '@ai-gate/shared'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { PhArrowLeft, PhCamera, PhFloppyDisk, PhX } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { ApiError } from '@/lib/api'
import { useProvidersStore } from '@/stores/providers'
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
import { Textarea } from '@/components/ui/textarea'
import { defaultProviderIcon } from '@/utils/brandIcons'
import ProviderIconPicker from './ProviderIconPicker.vue'
import ProviderIcon from './ProviderIcon.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/**
 * 供应商新增/编辑弹窗：基本信息（图标、编码、名称、描述、启用）
 * 新增模式额外初始化端点（端点类型 + 端点地址，默认路径自动填充）与首个密钥；
 * 编辑模式仅维护基本信息，端点/密钥在供应商详情页管理
 */
const props = defineProps<{
  /** 编辑目标；null = 新增 */
  provider: SProvider | null
}>()

const emit = defineEmits<{saved: [provider: SProvider]}>()

const open = defineModel<boolean>('open', {default: false})

const store = useProvidersStore()
const pickingIcon = ref(false)
const iconTrigger = ref<InstanceType<typeof Button> | null>(null)
const modalTitle = computed(() => props.provider ? t('providers.edit') : t('providers.create'))
let formScrollTop = 0

function openIconPicker() {
  formScrollTop = formBody.value?.viewport?.scrollTop ?? 0
  pickingIcon.value = true
}

async function returnToForm() {
  pickingIcon.value = false
  await nextTick()
  if (!open.value) return
  const viewport = formBody.value?.viewport
  if (viewport) viewport.scrollTop = formScrollTop
  iconTrigger.value?.$el?.focus({ preventScroll: true })
}

function selectIcon(icon: string) {
  form.icon = icon
  void returnToForm()
}

function handleEscape(event: KeyboardEvent) {
  if (!pickingIcon.value) return
  event.preventDefault()
  void returnToForm()
}

const form = reactive({
  code: '',
  name: '',
  icon: defaultProviderIcon,
  baseUrl: '',
  generate: GEN_ENDPOINT_TYPES[0] as GenEndpointType,
  generatePath: '',
  secret: '',
  remark: '',
  enabled: true,
})

/** 服务端 409 冲突信息（客户端校验通过但与并发写入冲突时展示） */
const serverCodeError = ref(false)

/** 是否展示校验错误：仅在尝试保存后置真，避免弹窗一打开就红字 */
const showErrors = ref(false)

/** 打开时按模式重置表单 */
watch(open, (v) => {
  pickingIcon.value = false
  formScrollTop = 0
  if (!v) return
  form.code = props.provider?.code ?? ''
  form.name = props.provider?.name ?? ''
  form.icon = props.provider?.icon ?? defaultProviderIcon
  form.baseUrl = ''
  form.generate = GEN_ENDPOINT_TYPES[0]
  form.generatePath = GEN_ENDPOINT_DEFAULT_PATHS[GEN_ENDPOINT_TYPES[0]]
  form.secret = ''
  form.remark = props.provider?.remark ?? ''
  form.enabled = props.provider?.enabled ?? true
  serverCodeError.value = false
  showErrors.value = false
})

/** 端点地址占位符：当前生成端点类型的默认路径 */
const generatePathPlaceholder = computed(() =>
  GEN_ENDPOINT_DEFAULT_PATHS[form.generate],
)

/** 切换生成端点类型时，端点地址为空或仍是上一类型的默认路径则自动填充新类型默认路径 */
watch(() => form.generate, (newGen, oldGen) => {
  const oldDefault = oldGen && oldGen in GEN_ENDPOINT_DEFAULT_PATHS
    ? GEN_ENDPOINT_DEFAULT_PATHS[oldGen as GenEndpointType]
    : ''
  if (!form.generatePath || form.generatePath === oldDefault) {
    if (newGen in GEN_ENDPOINT_DEFAULT_PATHS) {
      form.generatePath = GEN_ENDPOINT_DEFAULT_PATHS[newGen as GenEndpointType]
    }
  }
})

/** 编码实际校验结果（与错误展示解耦，供 canSave 使用）：不限制字符，仅要求非空且全局唯一 */
const codeInvalidReason = computed(() => {
  const v = form.code.trim()
  if (!v) return t('validation.providerCodeRequired')
  if (store.providers.some(p => p.code === v && p.id !== props.provider?.id)) {
    return t('validation.duplicateProviderCode')
  }
  return undefined
})

const codeError = computed(() => {
  if (serverCodeError.value) return t('validation.duplicateProviderCode')
  if (!showErrors.value) return undefined
  return codeInvalidReason.value
})

const nameError = computed(() =>
  showErrors.value && !form.name.trim() ? t('validation.nameRequired') : undefined,
)

/** Base URL 校验结果：仅新增模式下校验必填 */
const baseUrlInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.baseUrl.trim() ? undefined : t('validation.baseUrlRequired')
})

const baseUrlError = computed(() =>
  showErrors.value ? baseUrlInvalidReason.value : undefined,
)

/** 生成端点地址校验结果：仅新增模式下校验必填 */
const generatePathInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.generatePath.trim() ? undefined : t('validation.endpointPathRequired')
})

const generatePathError = computed(() =>
  showErrors.value ? generatePathInvalidReason.value : undefined,
)

/** 密钥校验结果：仅新增模式下校验必填 */
const secretInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.secret.trim() ? undefined : t('validation.keySecretRequired')
})

const secretError = computed(() =>
  showErrors.value ? secretInvalidReason.value : undefined,
)

const saving = ref(false)
const formBody = ref<InstanceType<typeof DialogBody> | null>(null)
const canSave = computed(() =>
  !codeInvalidReason.value &&
  !!form.name.trim() &&
  !baseUrlInvalidReason.value &&
  !generatePathInvalidReason.value &&
  !secretInvalidReason.value &&
  !saving.value,
)

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    await formBody.value?.focusFirstInvalid()
    toast.error(t('validation.checkForm'))
    return
  }
  saving.value = true
  try {
    const saved = props.provider
      ? await store.updateProvider(props.provider.id, {
        code: props.provider.code,
        name: form.name.trim(),
        icon: form.icon,
        enabled: form.enabled,
        remark: form.remark.trim(),
      })
      : await store.createProvider({
        code: form.code.trim(),
        name: form.name.trim(),
        icon: form.icon,
        enabled: form.enabled,
        remark: form.remark.trim(),
        baseUrl: form.baseUrl.trim(),
        generateEndpoint: {generate: form.generate, path: form.generatePath.trim()},
        // 首个密钥名称固定为 default（标识符，不随界面语言本地化）
        apiKey: {name: 'default', secret: form.secret.trim()},
      })
    toast.success(t('common.saved'))
    open.value = false
    emit('saved', saved)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 409 || err.code === 'DUPLICATE_PROVIDER_CODE')) {
      serverCodeError.value = true
      await formBody.value?.focusFirstInvalid()
    } else {
      console.warn('[ai-gate] 保存供应商失败', err)
      toast.error(apiErrorMessage(err))
    }
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
    <DialogContent class="sm:max-w-md" @escape-key-down="handleEscape">
      <DialogHeader>
        <div v-if="pickingIcon" class="flex items-center gap-2 pr-6">
          <Button variant="ghost" size="icon-sm" :aria-label="t('common.back')" @click="returnToForm">
            <PhArrowLeft />
          </Button>
          <div class="flex min-w-0 flex-col gap-1">
            <DialogTitle>{{ t('icons.change') }}</DialogTitle>
            <DialogDescription>{{ modalTitle }}</DialogDescription>
          </div>
        </div>
        <DialogTitle v-else>{{ modalTitle }}</DialogTitle>
      </DialogHeader>

      <ProviderIconPicker v-if="pickingIcon" :selected-icon="form.icon" @select="selectIcon" />

      <template v-else>
        <DialogBody ref="formBody" :aria-label="props.provider ? t('providers.edit') : t('providers.create')">
          <FieldGroup>
            <!-- 显示图标：居中展示，点击选择/上传 -->
            <div class="flex justify-center pb-1">
              <Button
                ref="iconTrigger"
                variant="outline"
                size="icon-lg"
                class="group relative size-14 shrink-0 p-0"
                :aria-label="t('icons.change')"
                @click="openIconPicker"
              >
                <ProviderIcon :icon="form.icon" :name="form.name || '?'" size="xl" />
                <span class="bg-muted/80 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <PhCamera />
                </span>
              </Button>
            </div>

            <!-- 编码全局唯一，创建后不可修改：编辑态只读禁用 -->
            <Field :data-invalid="!!codeError">
              <FieldLabel>{{ t('providers.code') }} <span class="text-destructive">*</span></FieldLabel>
              <Input
                v-model="form.code"
                :aria-invalid="!!codeError || undefined"
                :placeholder="t('providers.codePlaceholder')"
                :disabled="!!props.provider"
              />
              <FieldError v-if="codeError">
                {{ codeError }}
              </FieldError>
            </Field>

            <Field :data-invalid="!!nameError">
              <FieldLabel>{{ t('common.name') }} <span class="text-destructive">*</span></FieldLabel>
              <Input
                v-model="form.name"
                :aria-invalid="!!nameError || undefined"
                :placeholder="t('providers.namePlaceholder')"
              />
              <FieldError v-if="nameError">
                {{ nameError }}
              </FieldError>
            </Field>

            <Field
              v-if="!props.provider"
              :data-invalid="!!baseUrlError"
            >
              <FieldLabel>Base URL <span class="text-destructive">*</span></FieldLabel>
              <Input
                v-model="form.baseUrl"
                :aria-invalid="!!baseUrlError || undefined"
                :placeholder="t('endpoints.basePlaceholder')"
              />
              <FieldError v-if="baseUrlError">
                {{ baseUrlError }}
              </FieldError>
            </Field>

            <template v-if="!props.provider">
              <!-- 初始生成端点：端点类型 + 端点地址（默认路径自动填充） -->
              <Field>
                <FieldLabel>{{ t('endpoints.type') }}</FieldLabel>
                <Select v-model="form.generate">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="t('validation.selectEndpointType')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="item in GEN_ENDPOINT_TYPES"
                      :key="item"
                      :value="item"
                    >
                      {{ item }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field :data-invalid="!!generatePathError">
                <FieldLabel>{{ t('endpoints.path') }} <span class="text-destructive">*</span></FieldLabel>
                <Input
                  v-model="form.generatePath"
                  :aria-invalid="!!generatePathError || undefined"
                  :placeholder="generatePathPlaceholder"
                />
                <FieldError v-if="generatePathError">
                  {{ generatePathError }}
                </FieldError>
              </Field>

              <!-- 初始密钥：创建后可在供应商详情页管理 -->
              <Field :data-invalid="!!secretError">
                <FieldLabel>{{ t('keys.title') }} <span class="text-destructive">*</span></FieldLabel>
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
            </template>

            <Field>
              <FieldLabel>{{ t('common.description') }}</FieldLabel>
              <Textarea
                v-model="form.remark"
                :rows="2"
                :placeholder="t('common.optional')"
              />
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
      </template>
    </DialogContent>
  </Dialog>
</template>
