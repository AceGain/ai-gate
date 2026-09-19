<script setup lang="ts">
import {formatCompactNumber} from '~/utils/usageStats'

const props = defineProps<{
  /** 逐日活动（升序，含 count=0 的天） */
  days: Array<{ date: string; count: number }>
}>()

const {t, locale} = useI18n()

/** 色阶：0 级为空底，1~4 级用主色透明度递进（语义 Token，随主题联动） */
const LEVEL_CLASSES = ['bg-elevated', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary'] as const

/** 一周从周一开始；'2024-01-01' 恰为周一，用作星期标签基准 */
const weekdayLabels = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, {weekday: 'short'})
  return Array.from({length: 7}, (_, i) => formatter.format(new Date(2024, 0, 1 + i)))
})
const monthFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {month: 'short'}))

const cellTitle = (date: string, count: number) =>
  t('usage.activity.cellTitle', {date, value: formatCompactNumber(count, locale.value)})

interface HeatCell {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  title: string
}

interface HeatWeek {
  /** 月份标签（跨月首周显示，其余为空） */
  monthLabel: string
  cells: Array<HeatCell | null>
}

const weeks = computed<HeatWeek[]>(() => {
  const first = props.days[0]
  if (!first) return []

  const max = Math.max(...props.days.map(day => day.count), 1)
  const toCell = (day: { date: string; count: number }): HeatCell => {
    const ratio = day.count / max
    const level = day.count === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4
    return {date: day.date, count: day.count, level, title: cellTitle(day.date, day.count)}
  }

  // 首周按星期对齐补位，之后每 7 天切一列，末周补齐
  const firstPad = (new Date(`${first.date}T00:00:00`).getDay() + 6) % 7
  const cells: Array<HeatCell | null> = [...Array<null>(firstPad).fill(null), ...props.days.map(toCell)]
  while (cells.length % 7 !== 0) cells.push(null)

  const result: HeatWeek[] = []
  let lastMonth = -1
  for (let i = 0; i < cells.length; i += 7) {
    const weekCells = cells.slice(i, i + 7)
    const firstDay = weekCells.find(cell => cell !== null)
    const month = firstDay ? new Date(`${firstDay.date}T00:00:00`).getMonth() : lastMonth
    const monthLabel = month !== lastMonth && firstDay ? monthFormatter.value.format(new Date(`${firstDay.date}T00:00:00`)) : ''
    lastMonth = month
    result.push({monthLabel, cells: weekCells})
  }
  return result
})

const total = computed(() => props.days.reduce((sum, day) => sum + day.count, 0))
const summaryLabel = computed(() => {
  const max = Math.max(...props.days.map(day => day.count), 0)
  const peak = props.days.find(day => day.count === max)
  return peak
    ? t('usage.activity.ariaSummary', {total: formatCompactNumber(total.value, locale.value), peak: cellTitle(peak.date, peak.count)})
    : t('usage.activity.title')
})
</script>

<template>
  <!-- 触达摘要：色阶仅表达强弱，具体数值经 title 与图表/表格可达 -->
  <div class="flex flex-col gap-2">
    <div class="overflow-x-auto pb-1">
      <div class="flex w-max gap-[3px]" role="img" :aria-label="summaryLabel">
        <!-- 星期标签列：隔行标注（周一/周三/周五） -->
        <div class="flex flex-col gap-[3px]" aria-hidden="true">
          <div class="h-4"/>
          <div
            v-for="(label, i) in weekdayLabels"
            :key="i"
            class="flex h-[11px] items-center text-[10px] leading-none text-dimmed"
          >
            <span v-if="i % 2 === 0">{{ label }}</span>
          </div>
        </div>

        <!-- 周列：顶部月份标签 + 7 格 -->
        <div v-for="(week, wi) in weeks" :key="wi" class="flex flex-col gap-[3px]">
          <div class="h-4 text-[10px] leading-4 font-medium text-muted">{{ week.monthLabel }}</div>
          <div
            v-for="(cell, ci) in week.cells"
            :key="ci"
            class="size-[11px]"
            :class="cell ? LEVEL_CLASSES[cell.level] : 'bg-transparent'"
            :title="cell?.title"
          />
        </div>
      </div>
    </div>

    <!-- 色阶图例 -->
    <div class="flex items-center justify-end gap-1.5 text-xs text-muted">
      <span>{{ t('usage.activity.less') }}</span>
      <span
        v-for="level in LEVEL_CLASSES"
        :key="level"
        class="size-[11px]"
        :class="level"
        aria-hidden="true"
      />
      <span>{{ t('usage.activity.more') }}</span>
    </div>
  </div>
</template>
