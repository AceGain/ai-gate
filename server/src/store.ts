/**
 * 供应商与配置持久化层：基于 @libsql/client + Drizzle ORM（全异步）
 * 时间戳由数据库维护（CURRENT_TIMESTAMP / UPDATE 时显式刷新）；列表按 sort 升序
 */
import {and, asc, desc, eq, ne, sql} from 'drizzle-orm'
import {newId} from '../../shared/sys-provider'
import type {SysProvider, SysProviderInput} from '../../shared/sys-provider'
import type {SysEndpoint, SysEndpointInput} from '../../shared/sys-endpoint'
import type {SysKey, SysKeyInput} from '../../shared/sys-key'
import type {SysModel, SysModelInput} from '../../shared/sys-model'
import {db} from './db'
import {sysEndpoint, sysKey, sysKeyModel, sysModel, sysProvider} from './schema/index'

/* =========================================================================
 * 供应商（sys_provider）
 * ========================================================================= */

/** 查询全部供应商（sort 升序，同序按创建时间正序） */
export async function listProviders(): Promise<SysProvider[]> {
  return await db.select()
    .from(sysProvider)
    .orderBy(asc(sysProvider.sort), asc(sysProvider.createTime))
}

/** 按 id 查询单个供应商 */
export async function getProvider(id: string): Promise<SysProvider | null> {
  const row = await db.select()
    .from(sysProvider)
    .where(eq(sysProvider.id, id))
    .get()
  return row ?? null
}

/** 新增供应商：时间戳由数据库默认值生成；同时初始化默认 base 与 models 端点；可选初始化生成端点（设为默认）与初始密钥；code 重复抛出约束错误（由路由层转 409） */
export async function insertProvider(id: string, input: SysProviderInput): Promise<SysProvider> {
  await db.transaction(async (tx) => {
    await tx.insert(sysProvider)
      .values({
        id,
        code: input.code,
        name: input.name,
        icon: input.icon ?? '',
        enabled: input.enabled === true,
        description: input.description ?? '',
        sort: input.sort ?? 0
      })

    if (input.baseUrl) {
      await tx.insert(sysEndpoint)
        .values({
          id: newId(),
          providerId: id,
          type: 'base',
          generate: '',
          path: input.baseUrl,
          isDefault: false
        })

      await tx.insert(sysEndpoint)
        .values({
          id: newId(),
          providerId: id,
          type: 'models',
          generate: '',
          path: '/v1/models',
          isDefault: false
        })
    }

    if (input.generateEndpoint) {
      await tx.insert(sysEndpoint)
        .values({
          id: newId(),
          providerId: id,
          type: 'generate',
          generate: input.generateEndpoint.generate,
          path: input.generateEndpoint.path,
          isDefault: true
        })
    }

    if (input.apiKey) {
      await tx.insert(sysKey)
        .values({
          id: newId(),
          providerId: id,
          name: input.apiKey.name,
          secret: input.apiKey.secret,
          enabled: true,
          status: 'ACTIVE',
          expiresTime: null,
          sort: 0
        })
    }
  })
  return (await getProvider(id))!
}

/** 按 id 全量更新可写字段（不存在时不生效）；code 创建后不可变，更新时忽略 */
export async function updateProvider(id: string, input: SysProviderInput): Promise<SysProvider | null> {
  const values: Record<string, unknown> = {
    name: input.name,
    icon: input.icon ?? '',
    enabled: input.enabled === true,
    description: input.description ?? '',
    updateTime: sql`CURRENT_TIMESTAMP`
  }
  if (input.sort !== undefined) {
    values.sort = input.sort
  }
  const res = await db.update(sysProvider)
    .set(values)
    .where(eq(sysProvider.id, id))
  return res.rowsAffected > 0 ? await getProvider(id) : null
}

/** 按 id 删除供应商 */
export async function removeProvider(id: string): Promise<boolean> {
  const res = await db.delete(sysProvider).where(eq(sysProvider.id, id))
  return res.rowsAffected > 0
}

/** 批量更新供应商排序（单事务，逐条刷新 sort 与 update_time） */
export async function reorderProviders(items: {id: string, sort: number}[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const {id, sort} of items) {
      await tx.update(sysProvider)
        .set({sort, updateTime: sql`CURRENT_TIMESTAMP`})
        .where(eq(sysProvider.id, id))
    }
  })
}

/* =========================================================================
 * 供应商端点（sys_endpoint）
 * ========================================================================= */

/** 查询某供应商的所有端点（按创建时间正序） */
export async function listEndpoints(providerId: string): Promise<SysEndpoint[]> {
  return await db.select()
    .from(sysEndpoint)
    .where(eq(sysEndpoint.providerId, providerId))
    .orderBy(asc(sysEndpoint.createTime))
}

/** 按 id 查询单个端点 */
export async function getEndpoint(id: string): Promise<SysEndpoint | null> {
  const row = await db.select()
    .from(sysEndpoint)
    .where(eq(sysEndpoint.id, id))
    .get()
  return row ?? null
}

/** 按 providerId 和 generate 查询 generate 端点 */
export async function getEndpointByGenerate(providerId: string, generate: string): Promise<SysEndpoint | null> {
  const row = await db.select()
    .from(sysEndpoint)
    .where(
      and(
        eq(sysEndpoint.providerId, providerId),
        eq(sysEndpoint.type, 'generate'),
        eq(sysEndpoint.generate, generate)
      )
    )
    .get()
  return row ?? null
}

/** 新增端点（default 仅对 generate 类型生效，原子事务内将同 provider 其它 generate 端点取消默认） */
export async function insertEndpoint(id: string, providerId: string, input: SysEndpointInput): Promise<SysEndpoint> {
  const isDefault = input.type === 'generate' && !!input.isDefault
  if (isDefault) {
    await db.transaction(async (tx) => {
      await tx.update(sysEndpoint)
        .set({isDefault: false, updateTime: sql`CURRENT_TIMESTAMP`})
        .where(and(eq(sysEndpoint.providerId, providerId), eq(sysEndpoint.type, 'generate')))
      await tx.insert(sysEndpoint)
        .values({
          id,
          providerId,
          type: input.type,
          generate: input.generate ?? '',
          path: input.path,
          isDefault: true
        })
    })
  } else {
    await db.insert(sysEndpoint)
      .values({
        id,
        providerId,
        type: input.type,
        generate: input.generate ?? '',
        path: input.path,
        isDefault: false
      })
  }
  return (await getEndpoint(id))!
}

/** 更新端点（default 仅对 generate 类型生效，原子事务维护默认互斥） */
export async function updateEndpoint(id: string, input: SysEndpointInput): Promise<SysEndpoint | null> {
  const existing = await getEndpoint(id)
  if (!existing) return null

  const isDefault = input.type === 'generate' && !!input.isDefault
  let rowsAffected = 0
  if (isDefault) {
    await db.transaction(async (tx) => {
      await tx.update(sysEndpoint)
        .set({isDefault: false, updateTime: sql`CURRENT_TIMESTAMP`})
        .where(
          and(
            eq(sysEndpoint.providerId, existing.providerId),
            eq(sysEndpoint.type, 'generate'),
            ne(sysEndpoint.id, id)
          )
        )
      const res = await tx.update(sysEndpoint)
        .set({
          type: input.type,
          generate: input.generate ?? '',
          path: input.path,
          isDefault: true,
          updateTime: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(sysEndpoint.id, id))
      rowsAffected = res.rowsAffected
    })
  } else {
    const res = await db.update(sysEndpoint)
      .set({
        type: input.type,
        generate: input.generate ?? '',
        path: input.path,
        isDefault: false,
        updateTime: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(sysEndpoint.id, id))
    rowsAffected = res.rowsAffected
  }

  return rowsAffected > 0 ? await getEndpoint(id) : null
}

/** 删除端点 */
export async function removeEndpoint(id: string): Promise<boolean> {
  const res = await db.delete(sysEndpoint).where(eq(sysEndpoint.id, id))
  return res.rowsAffected > 0
}

/* =========================================================================
 * 供应商密钥（sys_key）
 * ========================================================================= */

/** 查询某供应商的所有密钥（sort 升序，创建时间升序） */
export async function listKeys(providerId: string): Promise<SysKey[]> {
  return await db.select()
    .from(sysKey)
    .where(eq(sysKey.providerId, providerId))
    .orderBy(asc(sysKey.sort), asc(sysKey.createTime))
}

/** 按 id 查询单个密钥 */
export async function getKey(id: string): Promise<SysKey | null> {
  const row = await db.select()
    .from(sysKey)
    .where(eq(sysKey.id, id))
    .get()
  return row ?? null
}

/** 新增密钥 */
export async function insertKey(id: string, providerId: string, input: SysKeyInput): Promise<SysKey> {
  await db.insert(sysKey)
    .values({
      id,
      providerId,
      name: input.name,
      secret: input.secret,
      enabled: input.enabled !== false,
      status: input.status ?? 'ACTIVE',
      expiresTime: input.expiresTime ?? null,
      sort: input.sort ?? 0
    })
  return (await getKey(id))!
}

/** 更新密钥 */
export async function updateKey(id: string, input: SysKeyInput): Promise<SysKey | null> {
  const values: Record<string, unknown> = {
    name: input.name,
    secret: input.secret,
    enabled: input.enabled !== false,
    status: input.status ?? 'ACTIVE',
    expiresTime: input.expiresTime ?? null,
    updateTime: sql`CURRENT_TIMESTAMP`
  }
  if (input.sort !== undefined) {
    values.sort = input.sort
  }
  const res = await db.update(sysKey)
    .set(values)
    .where(eq(sysKey.id, id))
  return res.rowsAffected > 0 ? await getKey(id) : null
}

/** 删除密钥 */
export async function removeKey(id: string): Promise<boolean> {
  const res = await db.delete(sysKey).where(eq(sysKey.id, id))
  return res.rowsAffected > 0
}

/** 批量更新密钥排序 */
export async function reorderKeys(items: {id: string, sort: number}[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const {id, sort} of items) {
      await tx.update(sysKey)
        .set({sort, updateTime: sql`CURRENT_TIMESTAMP`})
        .where(eq(sysKey.id, id))
    }
  })
}

/* =========================================================================
 * 供应商模型（sys_model）
 * ========================================================================= */

/** 查询某供应商的所有模型（sort 升序，创建时间升序） */
export async function listModels(providerId: string): Promise<SysModel[]> {
  return await db.select()
    .from(sysModel)
    .where(eq(sysModel.providerId, providerId))
    .orderBy(asc(sysModel.sort), asc(sysModel.createTime))
}

/** 按 id 查询单个模型 */
export async function getModel(id: string): Promise<SysModel | null> {
  const row = await db.select()
    .from(sysModel)
    .where(eq(sysModel.id, id))
    .get()
  return row ?? null
}

/** 新增模型 */
export async function insertModel(id: string, providerId: string, input: SysModelInput): Promise<SysModel> {
  await db.insert(sysModel)
    .values({
      id,
      providerId,
      code: input.code,
      name: input.name ?? '',
      category: input.category ?? '',
      enabled: input.enabled !== false,
      status: input.status ?? 'ACTIVE',
      type: input.type,
      inputModal: input.inputModal ?? ['text'],
      outputModal: input.outputModal ?? ['text'],
      generates: input.generates ?? [],
      maxContext: input.maxContext ?? 0,
      maxInput: input.maxInput ?? 0,
      maxOutput: input.maxOutput ?? 0,
      reasoning: input.reasoning ?? 'TOGGLE',
      effortLevel: input.effortLevel ?? [],
      sort: input.sort ?? 0,
      description: input.description ?? ''
    })
  return (await getModel(id))!
}

/** 更新模型；code 创建后不可变，更新时忽略 */
export async function updateModel(id: string, input: SysModelInput): Promise<SysModel | null> {
  const values: Record<string, unknown> = {
    name: input.name ?? '',
    category: input.category ?? '',
    enabled: input.enabled !== false,
    status: input.status ?? 'ACTIVE',
    type: input.type,
    inputModal: input.inputModal ?? ['text'],
    outputModal: input.outputModal ?? ['text'],
    generates: input.generates ?? [],
    maxContext: input.maxContext ?? 0,
    maxInput: input.maxInput ?? 0,
    maxOutput: input.maxOutput ?? 0,
    reasoning: input.reasoning ?? 'TOGGLE',
    effortLevel: input.effortLevel ?? [],
    description: input.description ?? '',
    updateTime: sql`CURRENT_TIMESTAMP`
  }
  if (input.sort !== undefined) {
    values.sort = input.sort
  }
  const res = await db.update(sysModel)
    .set(values)
    .where(eq(sysModel.id, id))
  return res.rowsAffected > 0 ? await getModel(id) : null
}

/** 删除模型 */
export async function removeModel(id: string): Promise<boolean> {
  const res = await db.delete(sysModel).where(eq(sysModel.id, id))
  return res.rowsAffected > 0
}

/** 批量更新模型排序 */
export async function reorderModels(items: {id: string, sort: number}[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const {id, sort} of items) {
      await tx.update(sysModel)
        .set({sort, updateTime: sql`CURRENT_TIMESTAMP`})
        .where(eq(sysModel.id, id))
    }
  })
}

/** 导入条目：模型输入 + 报告该模型可用的密钥 id 集合 */
export interface ModelImportItem {
  input: SysModelInput
  keyIds: string[]
}

/** 批量导入模型并落库密钥-模型绑定（单事务）：已存在编码跳过插入但仍合并新绑定；绑定只增不删，冲突忽略 */
export async function importModelsWithBindings(
  providerId: string,
  items: ModelImportItem[]
): Promise<{imported: number, skipped: number, bindings: number}> {
  return await db.transaction(async (tx) => {
    const existing = await tx.select()
      .from(sysModel)
      .where(eq(sysModel.providerId, providerId))
    const modelIdByCode = new Map(existing.map(m => [m.code, m.id]))
    let nextSort = existing.reduce((max, m) => Math.max(max, m.sort), -1) + 1

    let imported = 0
    let skipped = 0
    const bindingRows: {providerId: string, keyId: string, modelId: string}[] = []
    for (const item of items) {
      let modelId = modelIdByCode.get(item.input.code)
      if (modelId) {
        skipped++
      } else {
        modelId = newId()
        await tx.insert(sysModel)
          .values({
            id: modelId,
            providerId,
            code: item.input.code,
            name: item.input.name ?? '',
            category: item.input.category ?? '',
            enabled: item.input.enabled !== false,
            status: item.input.status ?? 'ACTIVE',
            type: item.input.type,
            inputModal: item.input.inputModal ?? ['text'],
            outputModal: item.input.outputModal ?? ['text'],
            generates: item.input.generates ?? [],
            maxContext: item.input.maxContext ?? 0,
            maxInput: item.input.maxInput ?? 0,
            maxOutput: item.input.maxOutput ?? 0,
            reasoning: item.input.reasoning ?? 'TOGGLE',
            effortLevel: item.input.effortLevel ?? [],
            sort: nextSort++,
            description: item.input.description ?? ''
          })
        modelIdByCode.set(item.input.code, modelId)
        imported++
      }
      for (const keyId of item.keyIds) {
        bindingRows.push({providerId, keyId, modelId})
      }
    }

    let bindings = 0
    if (bindingRows.length) {
      const res = await tx.insert(sysKeyModel)
        .values(bindingRows)
        .onConflictDoNothing()
      bindings = res.rowsAffected
    }
    return {imported, skipped, bindings}
  })
}

