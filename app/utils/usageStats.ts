/**
 * 使用统计 Mock 数据：后端统计接口就绪前的页面搭建数据源
 * 生成固定种子（mulberry32）的 730 天主序列，保证同一范围内多次切换数据稳定、
 * 且当前周期与对比周期（上一等长周期）来自同一序列
 */

export type UsageRange = 7 | 30 | 90 | 180 | 365

/** 主序列长度 = 最大统计维度（365 天）+ 等长对比周期（365 天） */
const MASTER_DAYS = 730

export interface UsageModel {
  code: string
  name: string
  provider: string
  /** 日均请求基数 */
  baseRequests: number
  /** 输出/输入 Token 比 */
  outputRatio: number
  /** 单次请求平均输入规模 */
  inputPerRequest: number
  errorRate: number
  avgLatencyMs: number
  p95LatencyMs: number
}

export interface UsageDayRow {
  /** YYYY-MM-DD */
  date: string
  requests: number
  inputTokens: number
  outputTokens: number
  errors: number
}

export interface UsageModelSeries {
  model: UsageModel
  days: UsageDayRow[]
}

export interface UsageAggregate {
  id: string
  label: string
  sublabel?: string
  /** 供应商（按模型维度时作为独立列） */
  group?: string
  requests: number
  inputTokens: number
  outputTokens: number
  errors: number
  avgLatencyMs: number
}

export interface UsageSummary {
  days: number
  requests: number
  prevRequests: number
  inputTokens: number
  prevInputTokens: number
  outputTokens: number
  prevOutputTokens: number
  errors: number
  prevErrors: number
  avgLatencyMs: number
  p95LatencyMs: number
  prevAvgLatencyMs: number
}

/** KPI 补充指标：Top 模型与高峰日 */
export interface UsageHighlights {
  topTokensModel: { name: string; tokens: number } | null
  topRequestsModel: { name: string; requests: number } | null
  peakDay: { date: string; requests: number } | null
  /** 模型累计响应时长（毫秒）：Σ(请求数 × 平均耗时) */
  totalLatencyMs: number
}

/** 模型清单：挂到虚构供应商下，后续接入真实数据时替换为仓库实际模型 */
const MOCK_MODELS: UsageModel[] = [
  { code: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', baseRequests: 5200, outputRatio: 2.6, inputPerRequest: 1800, errorRate: 0.006, avgLatencyMs: 1450, p95LatencyMs: 3200 },
  { code: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', baseRequests: 4300, outputRatio: 3.1, inputPerRequest: 2400, errorRate: 0.009, avgLatencyMs: 1720, p95LatencyMs: 3800 },
  { code: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', baseRequests: 3100, outputRatio: 2.2, inputPerRequest: 3200, errorRate: 0.012, avgLatencyMs: 1980, p95LatencyMs: 4100 },
  { code: 'deepseek-v3-2', name: 'DeepSeek V3.2', provider: 'DeepSeek', baseRequests: 2400, outputRatio: 2.8, inputPerRequest: 2100, errorRate: 0.018, avgLatencyMs: 2260, p95LatencyMs: 4900 },
  { code: 'glm-4-6', name: 'GLM-4.6', provider: 'Zhipu', baseRequests: 1500, outputRatio: 2.4, inputPerRequest: 1500, errorRate: 0.014, avgLatencyMs: 1640, p95LatencyMs: 3600 }
]

/** 密钥维度：每个供应商 1~2 把密钥的流量分摊 */
const KEY_WEIGHTS: Array<{ key: string; provider: string; modelProviders: Array<{ provider: string; share: number }> }> = [
  { key: 'sk-prod-primary', provider: 'OpenAI', modelProviders: [{ provider: 'OpenAI', share: 0.82 }] },
  { key: 'sk-prod-backup', provider: 'OpenAI', modelProviders: [{ provider: 'OpenAI', share: 0.18 }] },
  { key: 'sk-anthropic-main', provider: 'Anthropic', modelProviders: [{ provider: 'Anthropic', share: 1 }] },
  { key: 'sk-google-main', provider: 'Google', modelProviders: [{ provider: 'Google', share: 0.94 }] },
  { key: 'sk-google-sandbox', provider: 'Google', modelProviders: [{ provider: 'Google', share: 0.06 }] },
  { key: 'sk-agents-pool', provider: 'DeepSeek', modelProviders: [{ provider: 'DeepSeek', share: 0.7 }, { provider: 'Zhipu', share: 0.6 }] }
]

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 近 N 天日期序列（含今天，升序） */
export function usageDateKeys(days: number): string[] {
  const keys: string[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    keys.push(toDateKey(d))
  }
  return keys
}

/** 'YYYY-MM-DD' → 'M/D'（坐标轴刻度与高峰日展示） */
export function usageAxisDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** 紧凑数字：zh-CN 显示「万/亿」，en 显示「k/M」 */
export function formatCompactNumber(value: number, locale = 'zh-CN'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** 比率 → 百分数文案（错误率等） */
export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(rate > 0 && rate < 0.1 ? 2 : 1)}%`
}

/** 毫秒耗时：≥1s 以秒展示 */
export function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

/** 环比变化：(当前-上一)/上一，上一期为 0 时返回 0 */
export function usageDelta(current: number, previous: number): number {
  return previous > 0 ? (current - previous) / previous : 0
}

function buildModelSeries(model: UsageModel, dateKeys: string[]): UsageModelSeries {
  const random = mulberry32(hashSeed(model.code))
  const days = dateKeys.map((date, i) => {
    // 工作日流量略高 + 缓慢增长趋势 + 随机波动
    const weekday = new Date(`${date}T00:00:00`).getDay()
    const weekdayFactor = weekday === 0 || weekday === 6 ? 0.62 : 1
    const growth = 1 + (i / dateKeys.length) * 0.35
    const noise = 0.78 + random() * 0.44
    const burst = random() > 0.96 ? 1.6 : 1
    const requests = Math.max(1, Math.round(model.baseRequests * weekdayFactor * growth * noise * burst))
    const inputTokens = Math.round(requests * model.inputPerRequest * (0.85 + random() * 0.3))
    const outputTokens = Math.round(inputTokens * model.outputRatio * (0.85 + random() * 0.3))
    const errors = Math.round(requests * model.errorRate * (0.5 + random()))
    return { date, requests, inputTokens, outputTokens, errors }
  })
  return { model, days }
}

/** 730 天主序列（模块加载时生成一次，切片得到各范围与对比周期） */
const masterSeries: UsageModelSeries[] = (() => {
  const dateKeys = usageDateKeys(MASTER_DAYS)
  return MOCK_MODELS.map(model => buildModelSeries(model, dateKeys))
})()

function sliceRange(range: UsageRange, offsetDays: number): UsageModelSeries[] {
  const end = MASTER_DAYS - offsetDays
  const start = end - range
  return masterSeries.map(({ model, days }) => ({
    model,
    days: days.slice(start, end)
  }))
}

/** 当前范围各模型逐日序列 */
export function usageSeries(range: UsageRange): UsageModelSeries[] {
  return sliceRange(range, 0)
}

/** 上一等长周期各模型逐日序列（KPI 环比用） */
export function usagePrevSeries(range: UsageRange): UsageModelSeries[] {
  return sliceRange(range, range)
}

function sumDays(series: UsageModelSeries[]): { requests: number; inputTokens: number; outputTokens: number; errors: number } {
  let requests = 0
  let inputTokens = 0
  let outputTokens = 0
  let errors = 0
  for (const { days } of series) {
    for (const day of days) {
      requests += day.requests
      inputTokens += day.inputTokens
      outputTokens += day.outputTokens
      errors += day.errors
    }
  }
  return { requests, inputTokens, outputTokens, errors }
}

/** 页首 KPI（含上一等长周期对比值） */
export function usageSummary(range: UsageRange): UsageSummary {
  const current = sumDays(usageSeries(range))
  const prev = sumDays(usagePrevSeries(range))
  const weighted = usageSeries(range).reduce(
    (acc, { model, days }) => {
      const weight = days.reduce((s, d) => s + d.requests, 0)
      return { latency: acc.latency + model.avgLatencyMs * weight, p95: acc.p95 + model.p95LatencyMs * weight, weight: acc.weight + weight }
    },
    { latency: 0, p95: 0, weight: 0 }
  )
  const prevWeighted = usagePrevSeries(range).reduce(
    (acc, { model, days }) => {
      const weight = days.reduce((s, d) => s + d.requests, 0)
      return { latency: acc.latency + model.avgLatencyMs * weight, weight: acc.weight + weight }
    },
    { latency: 0, weight: 0 }
  )
  return {
    days: range,
    requests: current.requests,
    prevRequests: prev.requests,
    inputTokens: current.inputTokens,
    prevInputTokens: prev.inputTokens,
    outputTokens: current.outputTokens,
    prevOutputTokens: prev.outputTokens,
    errors: current.errors,
    prevErrors: prev.errors,
    avgLatencyMs: Math.round(weighted.latency / Math.max(1, weighted.weight)),
    p95LatencyMs: Math.round(weighted.p95 / Math.max(1, weighted.weight)),
    prevAvgLatencyMs: Math.round(prevWeighted.latency / Math.max(1, prevWeighted.weight))
  }
}

/** KPI 补充指标：用量/请求最多的模型、高峰日、累计响应时长 */
export function usageHighlights(range: UsageRange): UsageHighlights {
  const series = usageSeries(range)
  let topTokensModel: UsageHighlights['topTokensModel'] = null
  let topRequestsModel: UsageHighlights['topRequestsModel'] = null
  for (const { model, days } of series) {
    const sum = sumDays([{ model, days }])
    const tokens = sum.inputTokens + sum.outputTokens
    if (!topTokensModel || tokens > topTokensModel.tokens) topTokensModel = { name: model.name, tokens }
    if (!topRequestsModel || sum.requests > topRequestsModel.requests) topRequestsModel = { name: model.name, requests: sum.requests }
  }
  let peakDay: UsageHighlights['peakDay'] = null
  let totalLatencyMs = 0
  const byDate = new Map<string, number>()
  for (const { model, days } of series) {
    for (const day of days) {
      byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.requests)
      totalLatencyMs += day.requests * model.avgLatencyMs
    }
  }
  for (const [date, requests] of byDate) {
    if (!peakDay || requests > peakDay.requests) peakDay = { date, requests }
  }
  return { topTokensModel, topRequestsModel, peakDay, totalLatencyMs }
}

/** 每日活动：全模型逐日请求量（升序） */
export function usageActivity(range: UsageRange): Array<{ date: string; count: number }> {
  const byDate = new Map<string, number>()
  for (const { days } of usageSeries(range)) {
    for (const day of days) {
      byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.requests)
    }
  }
  return [...byDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 趋势图数据：每天一行，每列是一个模型序列 */
export function usageTrendRows(series: UsageModelSeries[], pick: (day: UsageDayRow) => number): Array<Record<string, number | string>> {
  const byDate = new Map<string, Record<string, number | string>>()
  for (const { model, days } of series) {
    for (const day of days) {
      let row = byDate.get(day.date)
      if (!row) {
        row = { date: day.date }
        byDate.set(day.date, row)
      }
      row[model.code] = pick(day)
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/** 趋势图图例分类：模型编码 → 显示名 */
export function usageTrendCategories(series: UsageModelSeries[]): Record<string, { name: string }> {
  return Object.fromEntries(series.map(({ model }) => [model.code, { name: model.name }]))
}

/** 按模型聚合 */
export function aggregateByModel(series: UsageModelSeries[]): UsageAggregate[] {
  return series.map(({ model, days }) => {
    const sum = sumDays([{ model, days }])
    return {
      id: model.code,
      label: model.name,
      sublabel: model.code,
      group: model.provider,
      ...sum,
      avgLatencyMs: model.avgLatencyMs
    }
  }).sort((a, b) => b.requests - a.requests)
}

/** 按供应商聚合 */
export function aggregateByProvider(series: UsageModelSeries[]): UsageAggregate[] {
  const byProvider = new Map<string, { requests: number; inputTokens: number; outputTokens: number; errors: number; latencyWeighted: number }>()
  for (const { model, days } of series) {
    const entry = byProvider.get(model.provider) ?? { requests: 0, inputTokens: 0, outputTokens: 0, errors: 0, latencyWeighted: 0 }
    const sum = sumDays([{ model, days }])
    entry.requests += sum.requests
    entry.inputTokens += sum.inputTokens
    entry.outputTokens += sum.outputTokens
    entry.errors += sum.errors
    entry.latencyWeighted += model.avgLatencyMs * sum.requests
    byProvider.set(model.provider, entry)
  }
  return [...byProvider.entries()]
    .map(([provider, entry]) => ({
      id: provider,
      label: provider,
      requests: entry.requests,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      errors: entry.errors,
      avgLatencyMs: Math.round(entry.latencyWeighted / Math.max(1, entry.requests))
    }))
    .sort((a, b) => b.requests - a.requests)
}

/** 按密钥聚合：把所属供应商的用量按分摊比例拆到各密钥 */
export function aggregateByKeys(series: UsageModelSeries[]): UsageAggregate[] {
  const providerTotals = new Map(aggregateByProvider(series).map(row => [row.id, row]))
  return KEY_WEIGHTS.flatMap(({ key, provider, modelProviders }) => {
    return modelProviders.map(({ provider: targetProvider, share }) => {
      const total = providerTotals.get(targetProvider)
      return {
        id: `${key}:${targetProvider}`,
        label: key,
        sublabel: provider === targetProvider ? targetProvider : `${targetProvider}（经 ${provider}）`,
        requests: Math.round((total?.requests ?? 0) * share),
        inputTokens: Math.round((total?.inputTokens ?? 0) * share),
        outputTokens: Math.round((total?.outputTokens ?? 0) * share),
        errors: Math.round((total?.errors ?? 0) * share),
        avgLatencyMs: total?.avgLatencyMs ?? 0
      }
    })
  }).sort((a, b) => b.requests - a.requests)
}
