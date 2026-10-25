/**
 * 出站供应商（S 域）与配置持久化层：Drizzle ORM + better-sqlite3（同步 API）
 * 负责 s_* 表行结构与 camelCase API 载荷的双向映射：
 * - s_endpoint.kind/type ↔ API 的 type（base/models/generate）+ generate（生成端点类型）
 * - s_model.config（JSON）↔ API 的模态/Token/推理扁平字段；gen_type（JSON）↔ generates
 * 列表一律按 sort 升序返回
 */
import {and, asc, eq, ne} from 'drizzle-orm'
import type {
  SKey,
  SKeyInput,
  SEndpoint,
  SEndpointInput,
  SModel,
  SModelInput,
  SProvider,
  SProviderCreateInput,
  SProviderUpdateInput,
} from '@ai-gate/shared'
import {MODEL_DEFAULT_CATEGORY} from '@ai-gate/shared'
import {db} from './db/index.js'
import {sEndpoint, sKey, sModel, sProvider, sRelat} from './db/schema.js'

/* =========================================================================
 * 行结构映射
 * ========================================================================= */

type SProviderRow = typeof sProvider.$inferSelect
type SEndpointRow = typeof sEndpoint.$inferSelect
type SKeyRow = typeof sKey.$inferSelect
type SModelRow = typeof sModel.$inferSelect

function toProvider(row: SProviderRow): SProvider {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    icon: row.icon ?? '',
    enabled: row.enabled,
    status: row.status as SProvider['status'],
    remark: row.remark ?? '',
    sort: row.sort,
    createTime: row.create_time,
    updateTime: row.update_time,
  }
}

const KIND_BY_TYPE = {base: 'BASE', models: 'MODEL', generate: 'GEN'} as const
const TYPE_BY_KIND = {BASE: 'base', MODEL: 'models', GEN: 'generate'} as const

function toEndpoint(row: SEndpointRow): SEndpoint {
  return {
    id: row.id,
    providerId: row.provider_id,
    type: TYPE_BY_KIND[row.kind as keyof typeof TYPE_BY_KIND] ?? 'generate',
    generate: row.kind === 'GEN' ? (row.type ?? '') : '',
    path: row.path,
    isDefault: row.is_default,
    createTime: row.create_time,
    updateTime: row.update_time,
  }
}

function toKey(row: SKeyRow): SKey {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    secret: row.secret,
    enabled: row.enabled,
    status: row.status as SKey['status'],
    expireTime: row.expire_time,
    sort: row.sort,
    createTime: row.create_time,
    updateTime: row.update_time,
  }
}

/** s_model.config 列的 JSON 结构（模态/Token/推理能力的扁平聚合） */
type SModelConfig = {
  inputModal: string[]
  outputModal: string[]
  maxContext: number
  maxInput: number
  maxOutput: number
  reasoning: string
  effortLevel: string[]
}

function modelConfigOf(input: SModelInput): SModelConfig {
  return {
    inputModal: input.inputModal ?? ['text'],
    outputModal: input.outputModal ?? ['text'],
    maxContext: input.maxContext ?? 0,
    maxInput: input.maxInput ?? 0,
    maxOutput: input.maxOutput ?? 0,
    reasoning: input.reasoning ?? 'TOGGLE',
    effortLevel: input.effortLevel ?? [],
  }
}

function toModel(row: SModelRow): SModel {
  const config = (row.config ?? {}) as Partial<SModelConfig>
  return {
    id: row.id,
    providerId: row.provider_id,
    code: row.code,
    name: row.name ?? '',
    category: row.category || MODEL_DEFAULT_CATEGORY,
    enabled: row.enabled,
    status: row.status as SModel['status'],
    type: row.type as SModel['type'],
    inputModal: config.inputModal ?? ['text'],
    outputModal: config.outputModal ?? ['text'],
    generates: row.gen_type ?? [],
    maxContext: config.maxContext ?? 0,
    maxInput: config.maxInput ?? 0,
    maxOutput: config.maxOutput ?? 0,
    reasoning: (config.reasoning ?? 'TOGGLE') as SModel['reasoning'],
    effortLevel: config.effortLevel ?? [],
    sort: row.sort,
    remark: row.remark ?? '',
    createTime: row.create_time,
    updateTime: row.update_time,
  }
}

/* =========================================================================
 * 供应商（s_provider）
 * ========================================================================= */

/** 查询全部供应商（sort 升序，同序按创建时间正序） */
export function listProviders(): SProvider[] {
  return db.select().from(sProvider)
    .orderBy(asc(sProvider.sort), asc(sProvider.create_time))
    .all()
    .map(toProvider)
}

/** 按 id 查询单个供应商 */
export function getProvider(id: number): SProvider | null {
  const row = db.select().from(sProvider).where(eq(sProvider.id, id)).get()
  return row ? toProvider(row) : null
}

/** 新增供应商：事务内同时初始化 base 与 models 端点；可选初始化生成端点（设为默认）与初始密钥 */
export function insertProvider(input: SProviderCreateInput): SProvider {
  const id = db.transaction(() => {
    const inserted = db.insert(sProvider).values({
      code: input.code,
      name: input.name,
      icon: input.icon ?? '',
      enabled: input.enabled === true,
      status: 'ACTIVE',
      remark: input.remark ?? '',
      sort: input.sort ?? 0,
    }).returning({id: sProvider.id}).get()
    const providerId = inserted!.id

    db.insert(sEndpoint).values([
      {provider_id: providerId, kind: 'BASE', type: null, path: input.baseUrl!, is_default: false},
      {provider_id: providerId, kind: 'MODEL', type: null, path: '/v1/models', is_default: false},
    ]).run()

    if (input.generateEndpoint) {
      db.insert(sEndpoint).values({
        provider_id: providerId,
        kind: 'GEN',
        type: input.generateEndpoint.generate,
        path: input.generateEndpoint.path,
        is_default: true,
      }).run()
    }

    if (input.apiKey) {
      db.insert(sKey).values({
        provider_id: providerId,
        name: input.apiKey.name,
        secret: input.apiKey.secret,
        enabled: true,
        status: 'ACTIVE',
        expire_time: null,
        sort: 0,
      }).run()
    }
    return providerId
  })
  return getProvider(id)!
}

/** 按 id 全量更新可写字段（不存在时不生效）；code 创建后不可变，更新时忽略 */
export function updateProvider(id: number, input: SProviderUpdateInput): SProvider | null {
  const res = db.update(sProvider).set({
    name: input.name,
    icon: input.icon ?? '',
    enabled: input.enabled === true,
    remark: input.remark ?? '',
    ...(input.sort !== undefined ? {sort: input.sort} : {}),
  }).where(eq(sProvider.id, id)).run()
  return res.changes > 0 ? getProvider(id) : null
}

/** 按 id 删除供应商（端点/密钥/模型由外键级联删除） */
export function removeProvider(id: number): boolean {
  const res = db.delete(sProvider).where(eq(sProvider.id, id)).run()
  return res.changes > 0
}

/** 批量更新供应商排序（单事务） */
export function reorderProviders(items: {id: number, sort: number}[]): void {
  db.transaction(() => {
    for (const {id, sort} of items) {
      db.update(sProvider).set({sort}).where(eq(sProvider.id, id)).run()
    }
  })
}

/* =========================================================================
 * 供应商端点（s_endpoint）
 * ========================================================================= */

/** 查询某供应商的所有端点（按创建时间正序） */
export function listEndpoints(providerId: number): SEndpoint[] {
  return db.select().from(sEndpoint)
    .where(eq(sEndpoint.provider_id, providerId))
    .orderBy(asc(sEndpoint.create_time))
    .all()
    .map(toEndpoint)
}

/** 按 id 查询单个端点 */
export function getEndpoint(id: number): SEndpoint | null {
  const row = db.select().from(sEndpoint).where(eq(sEndpoint.id, id)).get()
  return row ? toEndpoint(row) : null
}

/** 按 providerId 和生成端点类型查询 GEN 端点 */
export function getEndpointByGenerate(providerId: number, generate: string): SEndpoint | null {
  const row = db.select().from(sEndpoint).where(
    and(
      eq(sEndpoint.provider_id, providerId),
      eq(sEndpoint.kind, 'GEN'),
      eq(sEndpoint.type, generate),
    ),
  ).get()
  return row ? toEndpoint(row) : null
}

/** 新增端点（默认标记仅对 generate 生效，事务内将同供应商其它 GEN 端点取消默认） */
export function insertEndpoint(providerId: number, input: SEndpointInput): SEndpoint {
  const isDefault = input.type === 'generate' && !!input.isDefault
  const id = db.transaction(() => {
    if (isDefault) {
      db.update(sEndpoint).set({is_default: false})
        .where(and(eq(sEndpoint.provider_id, providerId), eq(sEndpoint.kind, 'GEN')))
        .run()
    }
    const inserted = db.insert(sEndpoint).values({
      provider_id: providerId,
      kind: KIND_BY_TYPE[input.type],
      type: input.type === 'generate' ? (input.generate ?? '') : null,
      path: input.path,
      is_default: isDefault,
    }).returning({id: sEndpoint.id}).get()
    return inserted!.id
  })
  return getEndpoint(id)!
}

/** 更新端点（默认标记仅对 generate 生效，事务内维护默认互斥） */
export function updateEndpoint(id: number, input: SEndpointInput): SEndpoint | null {
  const existing = getEndpoint(id)
  if (!existing) return null

  const isDefault = input.type === 'generate' && !!input.isDefault
  db.transaction(() => {
    if (isDefault) {
      db.update(sEndpoint).set({is_default: false})
        .where(
          and(
            eq(sEndpoint.provider_id, existing.providerId),
            eq(sEndpoint.kind, 'GEN'),
            ne(sEndpoint.id, id),
          ),
        )
        .run()
    }
    db.update(sEndpoint).set({
      kind: KIND_BY_TYPE[input.type],
      type: input.type === 'generate' ? (input.generate ?? '') : null,
      path: input.path,
      is_default: isDefault,
    }).where(eq(sEndpoint.id, id)).run()
  })
  return getEndpoint(id)
}

/** 删除端点 */
export function removeEndpoint(id: number): boolean {
  const res = db.delete(sEndpoint).where(eq(sEndpoint.id, id)).run()
  return res.changes > 0
}

/* =========================================================================
 * 供应商密钥（s_key）
 * ========================================================================= */

/** 查询某供应商的所有密钥（sort 升序，创建时间升序） */
export function listKeys(providerId: number): SKey[] {
  return db.select().from(sKey)
    .where(eq(sKey.provider_id, providerId))
    .orderBy(asc(sKey.sort), asc(sKey.create_time))
    .all()
    .map(toKey)
}

/** 按 id 查询单个密钥 */
export function getKey(id: number): SKey | null {
  const row = db.select().from(sKey).where(eq(sKey.id, id)).get()
  return row ? toKey(row) : null
}

/** 新增密钥 */
export function insertKey(providerId: number, input: SKeyInput): SKey {
  const inserted = db.insert(sKey).values({
    provider_id: providerId,
    name: input.name,
    secret: input.secret,
    enabled: input.enabled !== false,
    status: input.status ?? 'ACTIVE',
    expire_time: input.expireTime ?? null,
    sort: input.sort ?? 0,
  }).returning({id: sKey.id}).get()
  return getKey(inserted!.id)!
}

/** 更新密钥 */
export function updateKey(id: number, input: SKeyInput): SKey | null {
  const res = db.update(sKey).set({
    name: input.name,
    secret: input.secret,
    enabled: input.enabled !== false,
    status: input.status ?? 'ACTIVE',
    expire_time: input.expireTime ?? null,
    ...(input.sort !== undefined ? {sort: input.sort} : {}),
  }).where(eq(sKey.id, id)).run()
  return res.changes > 0 ? getKey(id) : null
}

/** 删除密钥 */
export function removeKey(id: number): boolean {
  const res = db.delete(sKey).where(eq(sKey.id, id)).run()
  return res.changes > 0
}

/** 批量更新密钥排序 */
export function reorderKeys(items: {id: number, sort: number}[]): void {
  db.transaction(() => {
    for (const {id, sort} of items) {
      db.update(sKey).set({sort}).where(eq(sKey.id, id)).run()
    }
  })
}

/* =========================================================================
 * 供应商模型（s_model）
 * ========================================================================= */

/** 查询某供应商的所有模型（sort 升序，创建时间升序） */
export function listModels(providerId: number): SModel[] {
  return db.select().from(sModel)
    .where(eq(sModel.provider_id, providerId))
    .orderBy(asc(sModel.sort), asc(sModel.create_time))
    .all()
    .map(toModel)
}

/** 按 id 查询单个模型 */
export function getModel(id: number): SModel | null {
  const row = db.select().from(sModel).where(eq(sModel.id, id)).get()
  return row ? toModel(row) : null
}

/** 新增模型 */
export function insertModel(providerId: number, input: SModelInput): SModel {
  const inserted = db.insert(sModel).values({
    provider_id: providerId,
    code: input.code,
    name: input.name ?? '',
    category: input.category ?? MODEL_DEFAULT_CATEGORY,
    enabled: input.enabled !== false,
    status: input.status ?? 'ACTIVE',
    type: input.type,
    gen_type: input.generates ?? [],
    config: modelConfigOf(input),
    remark: input.remark ?? '',
    sort: input.sort ?? 0,
  }).returning({id: sModel.id}).get()
  return getModel(inserted!.id)!
}

/** 更新模型；code 创建后不可变，更新时忽略 */
export function updateModel(id: number, input: SModelInput): SModel | null {
  const res = db.update(sModel).set({
    name: input.name ?? '',
    category: input.category ?? MODEL_DEFAULT_CATEGORY,
    enabled: input.enabled !== false,
    status: input.status ?? 'ACTIVE',
    type: input.type,
    gen_type: input.generates ?? [],
    config: modelConfigOf(input),
    remark: input.remark ?? '',
    ...(input.sort !== undefined ? {sort: input.sort} : {}),
  }).where(eq(sModel.id, id)).run()
  return res.changes > 0 ? getModel(id) : null
}

/** 删除模型 */
export function removeModel(id: number): boolean {
  const res = db.delete(sModel).where(eq(sModel.id, id)).run()
  return res.changes > 0
}

/** 批量更新模型排序 */
export function reorderModels(items: {id: number, sort: number}[]): void {
  db.transaction(() => {
    for (const {id, sort} of items) {
      db.update(sModel).set({sort}).where(eq(sModel.id, id)).run()
    }
  })
}

/* =========================================================================
 * 密钥-模型绑定（s_relat）
 * ========================================================================= */

/** 导入条目：模型输入 + 报告该模型可用的密钥 id 集合 */
export interface SModelImportItem {
  input: SModelInput
  keyIds: number[]
}

/**
 * 批量导入模型并落库密钥-模型绑定（单事务）：
 * 已存在编码跳过插入但仍合并新绑定；绑定只增不删，冲突忽略。
 * s_relat 列按设计为 TEXT 且无外键，写入时显式转字符串
 */
export function importModelsWithBindings(
  providerId: number,
  items: SModelImportItem[],
): {imported: number, skipped: number, bindings: number} {
  return db.transaction(() => {
    const existing = db.select().from(sModel).where(eq(sModel.provider_id, providerId)).all()
    const modelIdByCode = new Map(existing.map(m => [m.code, m.id]))
    let nextSort = existing.reduce((max, m) => Math.max(max, m.sort), -1) + 1

    let imported = 0
    let skipped = 0
    const bindingRows: {provider_id: string, key_id: string, model_id: string}[] = []
    for (const item of items) {
      let modelId = modelIdByCode.get(item.input.code)
      if (modelId) {
        skipped++
      } else {
        const inserted = db.insert(sModel).values({
          provider_id: providerId,
          code: item.input.code,
          name: item.input.name ?? '',
          category: item.input.category ?? MODEL_DEFAULT_CATEGORY,
          enabled: item.input.enabled !== false,
          status: item.input.status ?? 'ACTIVE',
          type: item.input.type,
          gen_type: item.input.generates ?? [],
          config: modelConfigOf(item.input),
          remark: item.input.remark ?? '',
          sort: nextSort++,
        }).returning({id: sModel.id}).get()
        modelId = inserted!.id
        modelIdByCode.set(item.input.code, modelId)
        imported++
      }
      for (const keyId of item.keyIds) {
        bindingRows.push({provider_id: String(providerId), key_id: String(keyId), model_id: String(modelId)})
      }
    }

    let bindings = 0
    if (bindingRows.length) {
      const res = db.insert(sRelat).values(bindingRows).onConflictDoNothing().run()
      bindings = res.changes
    }
    return {imported, skipped, bindings}
  })
}
