<script setup lang="ts">
import {h, resolveComponent} from 'vue'
import type {TableColumn} from '@nuxt/ui'
import type {UsageAggregate} from '~/utils/usageStats'
import {formatCompactNumber, formatLatency, formatPercent} from '~/utils/usageStats'

const props = defineProps<{
  /** 分组维度：决定首列表头与附加列 */
  kind: 'model' | 'provider' | 'key'
  rows: UsageAggregate[]
}>()

const {t, locale} = useI18n()
const UButton = resolveComponent('UButton')

const HEADER_KEYS = {
  model: 'usage.table.model',
  provider: 'usage.table.provider',
  key: 'usage.table.key'
} as const

type Row = UsageAggregate

/** 与 @tanstack/vue-table 对应类型的结构兼容子集（项目未直接依赖该包，避免深导入） */
type SortState = Array<{
  id: string
  desc: boolean
}>

interface SortableHeaderContext {
  column: {
    getIsSorted: () => false | 'asc' | 'desc'
    toggleSorting: (desc?: boolean) => void
  }
}

/** 数值列表头：右对齐 + 点击排序，箭头指示当前排序方向 */
const sortableHeader = (label: string) => ({column}: SortableHeaderContext) => {
  const isSorted = column.getIsSorted()
  return h(UButton, {
    'label': label,
    'color': 'neutral',
    'variant': 'ghost',
    'class': '-mx-2.5 justify-end',
    'ui': {label: 'whitespace-nowrap'},
    'trailing-icon': isSorted ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow') : 'i-lucide-arrow-up-down',
    'aria-label': label,
    'onClick': () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
}

const columns = computed<TableColumn<Row>[]>(() => {
  const numberMeta = {class: {th: 'text-right whitespace-nowrap', td: 'text-right tabular-nums whitespace-nowrap'}}

  const cols: TableColumn<Row>[] = [
    {
      accessorKey: 'label',
      header: ({column}) => {
        const isSorted = column.getIsSorted()
        return h(UButton, {
          'label': t(HEADER_KEYS[props.kind]),
          'color': 'neutral',
          'variant': 'ghost',
          'class': '-mx-2.5',
          'ui': {label: 'whitespace-nowrap'},
          'trailing-icon': isSorted ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow') : 'i-lucide-arrow-up-down',
          'aria-label': t(HEADER_KEYS[props.kind]),
          'onClick': () => column.toggleSorting(column.getIsSorted() === 'asc')
        })
      },
      meta: {class: {td: 'min-w-40'}}
    },
    {
      accessorKey: 'requests',
      header: sortableHeader(t('usage.table.requests')),
      meta: numberMeta,
      cell: ({row}) => formatCompactNumber(row.original.requests, locale.value)
    },
    {
      accessorKey: 'inputTokens',
      header: sortableHeader(t('usage.table.inputTokens')),
      meta: numberMeta,
      cell: ({row}) => formatCompactNumber(row.original.inputTokens, locale.value)
    },
    {
      accessorKey: 'outputTokens',
      header: sortableHeader(t('usage.table.outputTokens')),
      meta: numberMeta,
      cell: ({row}) => formatCompactNumber(row.original.outputTokens, locale.value)
    },
    {
      id: 'errorRate',
      accessorFn: row => (row.requests > 0 ? row.errors / row.requests : 0),
      header: sortableHeader(t('usage.table.errorRate')),
      meta: numberMeta,
      cell: ({row}) => {
        const rate = row.original.requests > 0 ? row.original.errors / row.original.requests : 0
        // 阈值分级仅作强调，数值本身即状态信息（§1.2 状态不只靠颜色）
        const tone = rate >= 0.02 ? 'text-error' : rate >= 0.01 ? 'text-warning' : 'text-muted'
        return h('span', {class: tone}, formatPercent(rate))
      }
    },
    {
      accessorKey: 'avgLatencyMs',
      header: sortableHeader(t('usage.table.latency')),
      meta: numberMeta,
      cell: ({row}) => formatLatency(row.original.avgLatencyMs)
    }
  ]

  if (props.kind === 'model') {
    cols.splice(1, 0, {
      accessorKey: 'group',
      header: t('usage.table.provider'),
      meta: {class: {td: 'whitespace-nowrap'}}
    })
  }

  return cols
})

// 切换分组维度时回到默认排序（请求数降序）
const sorting = ref<SortState>([{id: 'requests', desc: true}])
watch(() => props.kind, () => {
  sorting.value = [{id: 'requests', desc: true}]
})
</script>

<template>
  <!-- 数据表整体横滚优于压缩列（DESIGN §6.1） -->
  <div class="overflow-x-auto">
    <UTable v-model:sorting="sorting" :data="rows" :columns="columns">
      <template #label-cell="{row}">
        <div class="min-w-0">
          <div class="truncate text-highlighted">{{ row.original.label }}</div>
          <div v-if="row.original.sublabel" class="truncate text-xs text-muted">{{ row.original.sublabel }}</div>
        </div>
      </template>
    </UTable>
  </div>
</template>
