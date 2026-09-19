<script setup lang="ts">
import {CurveType, LegendPosition} from 'nuxt-charts/enums'
import type {UsageAggregate, UsageRange} from '~/utils/usageStats'
import {
  aggregateByKeys,
  aggregateByModel,
  aggregateByProvider,
  formatCompactNumber,
  formatPercent,
  usageActivity,
  usageAxisDate,
  usageDelta,
  usageHighlights,
  usageSeries,
  usageSummary,
  usageTrendCategories,
  usageTrendRows
} from '~/utils/usageStats'

const {t, locale} = useI18n()

// 统计范围（Navbar 右侧分段切换）：作用于统计 / 分析 / 明细（每日活动固定为近一年累计）
const rangeItems = computed(() => ([
  {label: t('usage.range7d'), value: 7},
  {label: t('usage.range30d'), value: 30},
  {label: t('usage.range90d'), value: 90},
  {label: t('usage.range180d'), value: 180},
  {label: t('usage.range365d'), value: 365}
] as Array<{ label: string, value: UsageRange }>))
const range = ref<UsageRange>(7)

const series = computed(() => usageSeries(range.value))
const summary = computed(() => usageSummary(range.value))
const highlights = computed(() => usageHighlights(range.value))
// 每日活动：GitHub 贡献图样式的近一年累计视图，不随范围切换
const activity = computed(() => usageActivity(365))
const activityTotal = computed(() => activity.value.reduce((sum, day) => sum + day.count, 0))

// 模型配色：显式绑定语义色变量，趋势线 / 柱色 / 饼图扇区恒定对应
const SERIES_COLORS = ['var(--ui-primary)', 'var(--ui-secondary)', 'var(--ui-success)', 'var(--ui-info)', 'var(--ui-warning)']
const colorOf = (code: string) => {
  const index = series.value.findIndex(({model}) => model.code === code)
  return SERIES_COLORS[index % SERIES_COLORS.length]
}
const trendCategories = computed(() => {
  const categories = usageTrendCategories(series.value)
  return Object.fromEntries(Object.entries(categories).map(([code, category]) => [code, {...category, color: colorOf(code)}]))
})

/** 统计模块 8 张指标卡：前 4 张带环比（lowerIsBetter 决定涨跌好坏），后 4 张为摘要型 */
const kpis = computed(() => {
  const s = summary.value
  const hl = highlights.value
  const totalLatencyHours = hl.totalLatencyMs / 3_600_000
  const totalTokens = s.inputTokens + s.outputTokens
  const topShare = hl.topTokensModel && totalTokens > 0 ? hl.topTokensModel.tokens / totalTokens : 0
  const errorRate = s.requests > 0 ? s.errors / s.requests : 0
  const prevErrorRate = s.prevRequests > 0 ? s.prevErrors / s.prevRequests : 0
  return [
    {
      icon: 'i-lucide-arrow-right-left',
      label: t('usage.stats.requests'),
      value: formatCompactNumber(s.requests, locale.value),
      delta: usageDelta(s.requests, s.prevRequests) as number | null,
      lowerIsBetter: false,
      hint: t('usage.stats.requestsHint', {value: formatCompactNumber(s.requests / s.days, locale.value)})
    },
    {
      icon: 'i-lucide-arrow-down-to-line',
      label: t('usage.stats.inputTokens'),
      value: formatCompactNumber(s.inputTokens, locale.value),
      delta: usageDelta(s.inputTokens, s.prevInputTokens) as number | null,
      lowerIsBetter: false,
      hint: t('usage.stats.tokensHint', {value: formatCompactNumber(s.inputTokens / s.days, locale.value)})
    },
    {
      icon: 'i-lucide-arrow-up-from-line',
      label: t('usage.stats.outputTokens'),
      value: formatCompactNumber(s.outputTokens, locale.value),
      delta: usageDelta(s.outputTokens, s.prevOutputTokens) as number | null,
      lowerIsBetter: false,
      hint: t('usage.stats.tokensHint', {value: formatCompactNumber(s.outputTokens / s.days, locale.value)})
    },
    {
      icon: 'i-lucide-circle-alert',
      label: t('usage.stats.errorRate'),
      value: formatPercent(errorRate),
      delta: usageDelta(errorRate, prevErrorRate) as number | null,
      lowerIsBetter: true,
      hint: t('usage.stats.errorRateHint', {value: formatCompactNumber(s.errors, locale.value)})
    },
    {
      icon: 'i-lucide-coins',
      label: t('usage.stats.topTokensModel'),
      value: hl.topTokensModel?.name ?? t('common.empty'),
      delta: null,
      lowerIsBetter: false,
      hint: hl.topTokensModel
        ? t('usage.stats.topTokensHint', {value: formatCompactNumber(hl.topTokensModel.tokens, locale.value), percent: formatPercent(topShare)})
        : ''
    },
    {
      icon: 'i-lucide-message-square-text',
      label: t('usage.stats.topRequestsModel'),
      value: hl.topRequestsModel?.name ?? t('common.empty'),
      delta: null,
      lowerIsBetter: false,
      hint: hl.topRequestsModel
        ? t('usage.stats.topRequestsHint', {value: formatCompactNumber(hl.topRequestsModel.requests, locale.value)})
        : ''
    },
    {
      icon: 'i-lucide-flame',
      label: t('usage.stats.peakDay'),
      value: hl.peakDay ? usageAxisDate(hl.peakDay.date) : t('common.empty'),
      delta: null,
      lowerIsBetter: false,
      hint: hl.peakDay
        ? t('usage.stats.peakDayHint', {value: formatCompactNumber(hl.peakDay.requests, locale.value)})
        : ''
    },
    {
      icon: 'i-lucide-hourglass',
      label: t('usage.stats.totalLatency'),
      value: `${formatCompactNumber(totalLatencyHours, locale.value)} ${t('usage.stats.hours')}`,
      delta: null,
      lowerIsBetter: false,
      hint: t('usage.stats.totalLatencyHint', {value: formatCompactNumber(totalLatencyHours / s.days, locale.value)})
    }
  ]
})

/** 环比徽标：涨跌方向与「好坏」由指标语义共同决定（错误率升降的好坏为反向） */
function deltaView(delta: number, lowerIsBetter: boolean) {
  if (Math.abs(delta) < 0.0005) {
    return {icon: 'i-lucide-minus', color: 'neutral' as const, label: '0%'}
  }
  const up = delta > 0
  const good = lowerIsBetter ? !up : up
  return {
    icon: up ? 'i-lucide-trending-up' : 'i-lucide-trending-down',
    color: good ? ('success' as const) : ('error' as const),
    label: `${Math.abs(delta * 100).toFixed(1)}%`
  }
}

// 趋势曲线：Token / 请求数双指标切换，一个模型一条线
type TrendRow = Record<string, number | string>
const lineMetric = ref<'tokens' | 'requests'>('tokens')
const lineRows = computed<TrendRow[]>(() =>
  lineMetric.value === 'tokens'
    ? usageTrendRows(series.value, day => day.inputTokens + day.outputTokens)
    : usageTrendRows(series.value, day => day.requests)
)
const lineXFormatter = (i: number) => usageAxisDate(String(lineRows.value[i]?.date ?? ''))
const trendTooltipTitle = (row: TrendRow) => usageAxisDate(String(row.date))
const yCompactFormatter = (tick: number) => formatCompactNumber(tick, locale.value)

const lineTotal = computed(() => lineMetric.value === 'tokens'
  ? series.value.reduce((sum, {days}) => sum + days.reduce((acc, day) => acc + day.inputTokens + day.outputTokens, 0), 0)
  : series.value.reduce((sum, {days}) => sum + days.reduce((acc, day) => acc + day.requests, 0), 0)
)

// 范围内总请求：柱状图合计共用
const requestTotal = computed(() => series.value.reduce((sum, {days}) => sum + days.reduce((acc, day) => acc + day.requests, 0), 0))

// 每日请求构成：堆叠柱状图（与趋势线共用模型配色）
const barRows = computed<TrendRow[]>(() => usageTrendRows(series.value, day => day.requests))
// BarChart 的 yAxis 依赖库内 NumericKeys 派生（索引签名行类型下恒为 never），动态模型编码只能断言
const barYAxis = computed(() => series.value.map(({model}) => model.code) as never[])

// Token 占比：饼图
const donutData = computed(() => series.value.map(({model, days}) => ({
  name: model.name,
  value: days.reduce((acc, day) => acc + day.inputTokens + day.outputTokens, 0)
})))
const donutCategories = computed(() => Object.fromEntries(series.value.map(({model}) => [model.name, {name: model.name, color: colorOf(model.code)}])))
const donutTotal = computed(() => donutData.value.reduce((sum, item) => sum + item.value, 0))

// 明细统计表：按模型 / 供应商 / 密钥分组，可排序
const tableTab = ref('model')
const tableTabs = computed(() => [
  {label: t('usage.table.byModel'), value: 'model', slot: 'model'},
  {label: t('usage.table.byProvider'), value: 'provider', slot: 'provider'},
  {label: t('usage.table.byKey'), value: 'key', slot: 'key'}
])
const modelRows = computed<UsageAggregate[]>(() => aggregateByModel(series.value))
const providerRows = computed<UsageAggregate[]>(() => aggregateByProvider(series.value))
const keyRows = computed<UsageAggregate[]>(() => aggregateByKeys(series.value))
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppNavbar>
        <template #right>
          <!-- 极窄窗口下 Tab 栏横向滚动（DESIGN §6.1），不挤压页面标题 -->
          <div class="max-w-full overflow-x-auto">
            <UTabs
              v-model="range"
              :items="rangeItems"
              :aria-label="t('usage.title')"
            />
          </div>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <div class="h-full overflow-y-auto p-4">
        <div class="flex flex-col gap-4">
          <!-- 每日活动：近一年累计热力图（不随范围切换） -->
          <UCard :ui="{header: 'px-4 pt-3 pb-3 sm:px-4 sm:pt-3 sm:pb-3', body: 'px-4 pb-3 pt-0 sm:px-4 sm:pb-3 sm:pt-0'}">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="truncate text-sm font-semibold text-highlighted">
                  {{ t('usage.activity.title') }}
                  <span class="font-normal text-muted">· {{ t('usage.activity.pastYear') }}</span>
                </h3>
                <p class="shrink-0 text-xs text-muted">
                  <span class="font-medium text-highlighted tabular-nums">{{ formatCompactNumber(activityTotal, locale) }}</span>
                  {{ t('usage.activity.unit') }}
                </p>
              </div>
            </template>
            <UsageActivityHeatmap :days="activity"/>
          </UCard>

          <!-- 统计：8 张指标卡，一行 4 个 -->
          <section>
            <div class="overflow-hidden border border-default">
              <div class="border-b border-default px-4 py-3 text-sm font-semibold text-highlighted">
                {{ t('usage.stats.title') }}
              </div>
              <div class="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
                <div v-for="kpi in kpis" :key="kpi.label" class="bg-default p-4">
                  <div class="flex items-center gap-1.5 text-muted">
                    <UIcon :name="kpi.icon" class="size-3.5 shrink-0" aria-hidden="true"/>
                    <span class="truncate text-xs">{{ kpi.label }}</span>
                  </div>
                  <div class="mt-2 flex items-center gap-2">
                    <span class="truncate text-xl font-semibold text-highlighted tabular-nums" :title="kpi.value">{{ kpi.value }}</span>
                    <UBadge
                      v-if="kpi.delta !== null"
                      :icon="deltaView(kpi.delta, kpi.lowerIsBetter).icon"
                      :color="deltaView(kpi.delta, kpi.lowerIsBetter).color"
                      :label="deltaView(kpi.delta, kpi.lowerIsBetter).label"
                      variant="subtle"
                      :title="t('usage.stats.vsPrev')"
                    />
                  </div>
                  <p class="mt-1.5 truncate text-xs text-muted" :title="kpi.hint">{{ kpi.hint }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 分析：曲线 / 柱状 / 饼图 -->
          <section class="flex flex-col gap-4">
            <UCard :ui="{header: 'px-4 pt-3 pb-3 sm:px-4 sm:pt-3 sm:pb-3', body: 'px-4 pb-3 pt-0 sm:px-4 sm:pb-3 sm:pt-0'}">
              <template #header>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold text-highlighted">{{ t('usage.charts.trend') }}</h3>
                  <div class="flex items-center gap-3">
                    <p class="text-xs text-muted">
                      {{ t('usage.charts.totalLabel') }}
                      <span class="font-medium text-highlighted tabular-nums">{{ formatCompactNumber(lineTotal, locale) }}</span>
                    </p>
                    <UTabs
                      v-model="lineMetric"
                      :items="[{label: t('usage.charts.tokens'), value: 'tokens'}, {label: t('usage.charts.requests'), value: 'requests'}]"
                      :aria-label="t('usage.charts.trend')"
                    />
                  </div>
                </div>
              </template>
              <LineChart
                :data="lineRows"
                :categories="trendCategories"
                x-axis="date"
                :height="260"
                :curve-type="CurveType.MonotoneX"
                :x-formatter="lineXFormatter"
                :y-formatter="yCompactFormatter"
                :tooltip-title-formatter="trendTooltipTitle"
                :legend-position="LegendPosition.TopLeft"
                y-grid-line
                :aria-label="t('usage.charts.trend')"
              />
            </UCard>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <UCard :ui="{header: 'px-4 pt-3 pb-3 sm:px-4 sm:pt-3 sm:pb-3', body: 'px-4 pb-3 pt-0 sm:px-4 sm:pb-3 sm:pt-0'}">
                <template #header>
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="truncate text-sm font-semibold text-highlighted">{{ t('usage.charts.barTitle') }}</h3>
                    <p class="shrink-0 text-xs text-muted">
                      {{ t('usage.charts.totalLabel') }}
                      <span class="font-medium text-highlighted tabular-nums">{{ formatCompactNumber(requestTotal, locale) }}</span>
                    </p>
                  </div>
                </template>
                <BarChart
                  :data="barRows"
                  :categories="trendCategories"
                  :y-axis="barYAxis"
                  x-axis="date"
                  :height="240"
                  stacked
                  :radius="0"
                  :x-formatter="lineXFormatter"
                  :y-formatter="yCompactFormatter"
                  :tooltip-title-formatter="trendTooltipTitle"
                  hide-legend
                  y-grid-line
                  :aria-label="t('usage.charts.barTitle')"
                />
              </UCard>

              <UCard :ui="{header: 'px-4 pt-3 pb-3 sm:px-4 sm:pt-3 sm:pb-3', body: 'px-4 pb-3 pt-0 sm:px-4 sm:pb-3 sm:pt-0'}">
                <template #header>
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="truncate text-sm font-semibold text-highlighted">{{ t('usage.charts.donutTitle') }}</h3>
                    <p class="shrink-0 text-xs text-muted">
                      {{ t('usage.charts.totalLabel') }}
                      <span class="font-medium text-highlighted tabular-nums">{{ formatCompactNumber(donutTotal, locale) }}</span>
                    </p>
                  </div>
                </template>
                <DonutChart
                  :data="donutData"
                  name-key="name"
                  value-key="value"
                  :categories="donutCategories"
                  :height="240"
                  :aria-label="t('usage.charts.donutTitle')"
                >
                  <div class="flex flex-col items-center">
                    <span class="text-lg font-semibold text-highlighted tabular-nums">{{ formatCompactNumber(donutTotal, locale) }}</span>
                    <span class="text-xs text-muted">{{ t('usage.charts.centerTokens') }}</span>
                  </div>
                </DonutChart>
              </UCard>
            </div>
          </section>

          <!-- 明细统计表：按模型 / 供应商 / 密钥分组，可排序 -->
          <section>
            <UTabs
              v-model="tableTab"
              :items="tableTabs"
              variant="link"
              color="neutral"
              class="w-full"
              :ui="{list: 'border-b border-default', indicator: '-bottom-px h-0.5 bg-primary', trigger: 'cursor-pointer', content: 'pt-3'}"
            >
              <template #model>
                <UsageStatsTable kind="model" :rows="modelRows"/>
              </template>
              <template #provider>
                <UsageStatsTable kind="provider" :rows="providerRows"/>
              </template>
              <template #key>
                <UsageStatsTable kind="key" :rows="keyRows"/>
              </template>
            </UTabs>
          </section>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
