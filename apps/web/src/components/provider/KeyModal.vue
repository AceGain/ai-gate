<script setup lang="ts">
import type { SKey, SKeyInput } from '@ai-gate/shared'
import { computed, reactive, ref, watch } from 'vue'
import { PhFloppyDisk } from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

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

watch(open, (v) => {
  if (!v) return
  form.name = props.keyItem?.name ?? ''
  form.secret = props.keyItem?.secret ?? ''
  form.expireTime = props.keyItem?.expireTime ? props.keyItem.expireTime.slice(0, 10) : ''
  showErrors.value = false
})

const nameError = computed(() =>
  showErrors.value && !form.name.trim() ? '请输入密钥名称' : undefined,
)

const secretError = computed(() =>
  showErrors.value && !form.secret.trim() ? '请输入密钥内容' : undefined,
)

const canSave = computed(() => !!form.name.trim() && !!form.secret.trim() && !saving.value)

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    toast.error('请检查表单填写')
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
    toast.success('已保存')
    open.value = false
    emit('saved', saved)
  } catch (err) {
    console.warn('[ai-gate] 保存密钥失败', err)
    toast.error('后端服务不可用')
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
    <DialogContent class="max-h-[calc(100vh-4rem)] sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ props.keyItem ? '编辑密钥' : '新增密钥' }}</DialogTitle>
      </DialogHeader>

      <FieldGroup class="min-h-0 overflow-y-auto pr-1">
        <Field :data-invalid="!!nameError">
          <FieldLabel>密钥名称 <span class="text-destructive">*</span></FieldLabel>
          <Input
            v-model="form.name"
            :aria-invalid="!!nameError || undefined"
            placeholder="如 生产主 Key"
          />
          <FieldError v-if="nameError">
            {{ nameError }}
          </FieldError>
        </Field>

        <Field :data-invalid="!!secretError">
          <FieldLabel>密钥内容 <span class="text-destructive">*</span></FieldLabel>
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

        <Field>
          <FieldLabel>过期时间</FieldLabel>
          <Input
            v-model="form.expireTime"
            type="date"
          />
          <FieldDescription>留空表示永久有效</FieldDescription>
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
