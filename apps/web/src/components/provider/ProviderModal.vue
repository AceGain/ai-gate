<script setup lang="ts">
import type { GenEndpointType, SProvider } from '@ai-gate/shared'
import { GEN_ENDPOINT_TYPES, GEN_ENDPOINT_DEFAULT_PATHS } from '@ai-gate/shared'
import { computed, reactive, ref, watch } from 'vue'
import { PhFloppyDisk } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { ApiError } from '@/lib/api'
import { useProvidersStore } from '@/stores/providers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
const serverCodeError = ref('')

/** 是否展示校验错误：仅在尝试保存后置真，避免弹窗一打开就红字 */
const showErrors = ref(false)

/** 打开时按模式重置表单 */
watch(open, (v) => {
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
  serverCodeError.value = ''
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
  if (!v) return '请输入编码'
  if (store.providers.some(p => p.code === v && p.id !== props.provider?.id)) {
    return '编码已存在'
  }
  return undefined
})

const codeError = computed(() => {
  if (serverCodeError.value) return serverCodeError.value
  if (!showErrors.value) return undefined
  return codeInvalidReason.value
})

const nameError = computed(() =>
  showErrors.value && !form.name.trim() ? '请输入名称' : undefined,
)

/** Base URL 校验结果：仅新增模式下校验必填 */
const baseUrlInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.baseUrl.trim() ? undefined : '请输入 Base URL'
})

const baseUrlError = computed(() =>
  showErrors.value ? baseUrlInvalidReason.value : undefined,
)

/** 生成端点地址校验结果：仅新增模式下校验必填 */
const generatePathInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.generatePath.trim() ? undefined : '请输入端点地址'
})

const generatePathError = computed(() =>
  showErrors.value ? generatePathInvalidReason.value : undefined,
)

/** 密钥校验结果：仅新增模式下校验必填 */
const secretInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.secret.trim() ? undefined : '请输入密钥内容'
})

const secretError = computed(() =>
  showErrors.value ? secretInvalidReason.value : undefined,
)

const saving = ref(false)
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
    toast.error('请检查表单填写')
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
    toast.success('已保存')
    open.value = false
    emit('saved', saved)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 409 || err.code.includes('Duplicate provider code'))) {
      serverCodeError.value = '编码已存在'
    } else {
      console.warn('[ai-gate] 保存供应商失败', err)
      toast.error('后端服务不可用')
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
    <DialogContent class="max-h-[calc(100%-4rem)] sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ props.provider ? '修改供应商' : '新增供应商' }}</DialogTitle>
      </DialogHeader>

      <FieldGroup class="min-h-0 overflow-y-auto">
        <!-- 显示图标：居中展示，点击选择/上传 -->
        <div class="flex justify-center pb-1">
          <ProviderIconPicker
            v-model="form.icon"
            :name="form.name"
          />
        </div>

        <!-- 编码全局唯一，创建后不可修改：编辑态只读禁用 -->
        <Field :data-invalid="!!codeError">
          <FieldLabel>编码 <span class="text-destructive">*</span></FieldLabel>
          <Input
            v-model="form.code"
            :aria-invalid="!!codeError || undefined"
            placeholder="对外模型标识前缀，如 agnes"
            :disabled="!!props.provider"
          />
          <FieldError v-if="codeError">
            {{ codeError }}
          </FieldError>
        </Field>

        <Field :data-invalid="!!nameError">
          <FieldLabel>名称 <span class="text-destructive">*</span></FieldLabel>
          <Input
            v-model="form.name"
            :aria-invalid="!!nameError || undefined"
            placeholder="如 Agnes AI"
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
            placeholder="如 https://api.openai.com"
          />
          <FieldError v-if="baseUrlError">
            {{ baseUrlError }}
          </FieldError>
        </Field>

        <template v-if="!props.provider">
          <!-- 初始生成端点：端点类型 + 端点地址（默认路径自动填充） -->
          <Field>
            <FieldLabel>端点类型</FieldLabel>
            <Select v-model="form.generate">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="请选择端点类型" />
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
            <FieldLabel>端点地址 <span class="text-destructive">*</span></FieldLabel>
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
            <FieldLabel>密钥 <span class="text-destructive">*</span></FieldLabel>
            <Input
              v-model="form.secret"
              type="password"
              :aria-invalid="!!secretError || undefined"
              placeholder="请输入 API Key 密文"
            />
            <FieldError v-if="secretError">
              {{ secretError }}
            </FieldError>
          </Field>
        </template>

        <Field>
          <FieldLabel>描述</FieldLabel>
          <Textarea
            v-model="form.remark"
            :rows="2"
            placeholder="选填"
          />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          @click="open = false"
        >
          取消
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
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
