/**
 * 供应商持久化：SQLite（sys_provider 表）
 * 时间戳由数据库维护（DEFAULT CURRENT_TIMESTAMP / UPDATE 时显式刷新）；列表按 sort 升序
 */
import type {SysProvider, SysProviderInput} from '../../shared/sys-provider'
import type {SysEndpoint, SysEndpointInput} from '../../shared/sys-endpoint'
import type {SysKey, SysKeyInput} from '../../shared/sys-key'
import type {SysModel, SysModelInput, SysModelReasoning, SysModelType} from '../../shared/sys-model'
import {db} from './db'

/** 表行结构（snake_case；enabled 为 0/1） */
interface SysProviderRow {
  id: string
  code: string
  name: string
  icon: string
  enabled: number
  description: string
  sort: number
  create_time: string
  update_time: string
}

/** 行 → camelCase 载荷 */
function toProvider(row: SysProviderRow): SysProvider {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    icon: row.icon,
    enabled: row.enabled !== 0,
    description: row.description,
    sort: row.sort,
    createTime: row.create_time,
    updateTime: row.update_time
  }
}

/** 可写字段的入库参数（缺省值与表默认值一致） */
function toParams(input: SysProviderInput) {
  return {
    code: input.code,
    name: input.name,
    icon: input.icon ?? '',
    enabled: input.enabled === true ? 1 : 0,
    description: input.description ?? '',
    sort: input.sort ?? 0
  }
}

/** 查询全部供应商（sort 升序，同序按创建时间正序） */
export function listProviders(): SysProvider[] {
  const rows = db.prepare('SELECT * FROM sys_provider ORDER BY sort ASC, create_time ASC').all() as unknown as SysProviderRow[]
  return rows.map(toProvider)
}

/** 按 id 查询单个供应商 */
export function getProvider(id: string): SysProvider | null {
  const row = db.prepare('SELECT * FROM sys_provider WHERE id = ?').get(id) as unknown as SysProviderRow | undefined
  return row ? toProvider(row) : null
}

/** 新增供应商：时间戳由数据库默认值生成；code 重复时抛出约束错误（由路由层转 409）。返回完整记录 */
export function insertProvider(id: string, input: SysProviderInput): SysProvider {
  const v = toParams(input)
  db.prepare(`
    INSERT INTO sys_provider (id, code, name, icon, enabled, description, sort)
    VALUES (@id, @code, @name, @icon, @enabled, @description, @sort)
  `).run({...v, id})
  return getProvider(id)!
}

/** 按 id 全量更新可写字段（不存在时不生效）。返回更新后的完整记录 */
export function updateProvider(id: string, input: SysProviderInput): SysProvider | null {
  const v = toParams(input)
  const result = db.prepare(`
    UPDATE sys_provider SET
      code = @code, name = @name, icon = @icon, enabled = @enabled,
      description = @description, sort = @sort, update_time = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({...v, id})
  return result.changes > 0 ? getProvider(id) : null
}

/** 按 id 删除供应商 */
export function removeProvider(id: string): boolean {
  return db.prepare('DELETE FROM sys_provider WHERE id = ?').run(id).changes > 0
}

/** 批量更新排序（列表拖拽后的持久化）：单事务，逐条刷新 sort 与 update_time */
export function reorderProviders(items: {id: string, sort: number}[]): void {
  const stmt = db.prepare('UPDATE sys_provider SET sort = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?')
  try {
    db.exec('BEGIN')
    for (const {id, sort} of items) stmt.run(sort, id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/* =========================================================================
 * 供应商端点（sys_endpoint）
 * ========================================================================= */

interface SysEndpointRow {
  id: string
  provider_id: string
  type: 'base' | 'models' | 'protocol'
  protocol: string
  path: string
  is_default: number
  create_time: string
  update_time: string
}

function toEndpoint(row: SysEndpointRow): SysEndpoint {
  return {
    id: row.id,
    providerId: row.provider_id,
    type: row.type,
    protocol: row.protocol,
    path: row.path,
    isDefault: row.is_default !== 0,
    createTime: row.create_time,
    updateTime: row.update_time
  }
}

/** 查询某供应商的所有端点（默认端点置顶，同默认按创建时间正序） */
export function listEndpoints(providerId: string): SysEndpoint[] {
  const rows = db.prepare(`
    SELECT * FROM sys_endpoint
    WHERE provider_id = ?
    ORDER BY is_default DESC, create_time ASC
  `).all(providerId) as unknown as SysEndpointRow[]
  return rows.map(toEndpoint)
}

/** 按 id 查询单个端点 */
export function getEndpoint(id: string): SysEndpoint | null {
  const row = db.prepare('SELECT * FROM sys_endpoint WHERE id = ?').get(id) as unknown as SysEndpointRow | undefined
  return row ? toEndpoint(row) : null
}

/** 新增端点（若设为默认，同 provider 同 type 的其它端点取消默认） */
export function insertEndpoint(id: string, providerId: string, input: SysEndpointInput): SysEndpoint {
  if (input.isDefault) {
    db.prepare('UPDATE sys_endpoint SET is_default = 0, update_time = CURRENT_TIMESTAMP WHERE provider_id = ? AND type = ?')
      .run(providerId, input.type)
  }
  db.prepare(`
    INSERT INTO sys_endpoint (id, provider_id, type, protocol, path, is_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, providerId, input.type, input.protocol ?? '', input.path, input.isDefault ? 1 : 0)
  return getEndpoint(id)!
}

/** 更新端点 */
export function updateEndpoint(id: string, input: SysEndpointInput): SysEndpoint | null {
  const existing = getEndpoint(id)
  if (!existing) return null

  if (input.isDefault) {
    db.prepare('UPDATE sys_endpoint SET is_default = 0, update_time = CURRENT_TIMESTAMP WHERE provider_id = ? AND type = ? AND id != ?')
      .run(existing.providerId, input.type, id)
  }

  const result = db.prepare(`
    UPDATE sys_endpoint SET
      type = ?, protocol = ?, path = ?, is_default = ?, update_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(input.type, input.protocol ?? '', input.path, input.isDefault ? 1 : 0, id)

  return result.changes > 0 ? getEndpoint(id) : null
}

/** 删除端点 */
export function removeEndpoint(id: string): boolean {
  return db.prepare('DELETE FROM sys_endpoint WHERE id = ?').run(id).changes > 0
}

/* =========================================================================
 * 供应商密钥（sys_key）
 * ========================================================================= */

interface SysKeyRow {
  id: string
  provider_id: string
  name: string
  secret: string
  enabled: number
  status: 'ACTIVE' | 'INVALID'
  expires_time: string | null
  sort: number
  description: string
  create_time: string
  update_time: string
}

function toKey(row: SysKeyRow): SysKey {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    secret: row.secret,
    enabled: row.enabled !== 0,
    status: row.status,
    expiresTime: row.expires_time,
    sort: row.sort,
    description: row.description,
    createTime: row.create_time,
    updateTime: row.update_time
  }
}

/** 查询某供应商的所有密钥（sort 升序，创建时间升序） */
export function listKeys(providerId: string): SysKey[] {
  const rows = db.prepare(`
    SELECT * FROM sys_key
    WHERE provider_id = ?
    ORDER BY sort ASC, create_time ASC
  `).all(providerId) as unknown as SysKeyRow[]
  return rows.map(toKey)
}

/** 按 id 查询单个密钥 */
export function getKey(id: string): SysKey | null {
  const row = db.prepare('SELECT * FROM sys_key WHERE id = ?').get(id) as unknown as SysKeyRow | undefined
  return row ? toKey(row) : null
}

/** 新增密钥 */
export function insertKey(id: string, providerId: string, input: SysKeyInput): SysKey {
  db.prepare(`
    INSERT INTO sys_key (id, provider_id, name, secret, enabled, status, expires_time, sort, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    providerId,
    input.name,
    input.secret,
    input.enabled === false ? 0 : 1,
    input.status ?? 'ACTIVE',
    input.expiresTime ?? null,
    input.sort ?? 0,
    input.description ?? ''
  )
  return getKey(id)!
}

/** 更新密钥 */
export function updateKey(id: string, input: SysKeyInput): SysKey | null {
  const result = db.prepare(`
    UPDATE sys_key SET
      name = ?, secret = ?, enabled = ?, status = ?, expires_time = ?, sort = ?, description = ?,
      update_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    input.name,
    input.secret,
    input.enabled === false ? 0 : 1,
    input.status ?? 'ACTIVE',
    input.expiresTime ?? null,
    input.sort ?? 0,
    input.description ?? '',
    id
  )
  return result.changes > 0 ? getKey(id) : null
}

/** 删除密钥 */
export function removeKey(id: string): boolean {
  return db.prepare('DELETE FROM sys_key WHERE id = ?').run(id).changes > 0
}

/** 批量更新密钥排序 */
export function reorderKeys(items: {id: string, sort: number}[]): void {
  const stmt = db.prepare('UPDATE sys_key SET sort = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?')
  try {
    db.exec('BEGIN')
    for (const {id, sort} of items) stmt.run(sort, id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/* =========================================================================
 * 供应商模型（sys_model）
 * ========================================================================= */

interface SysModelRow {
  id: string
  provider_id: string
  code: string
  name: string
  category: string
  enabled: number
  status: 'ACTIVE' | 'INVALID'
  type: SysModelType
  input_modal: string
  output_modal: string
  protocols: string
  max_context: number
  max_input: number
  max_output: number
  reasoning: SysModelReasoning
  effort_level: string
  sort: number
  description: string
  create_time: string
  update_time: string
}

function safeJsonParseArray(jsonStr: string, fallback: string[] = []): string[] {
  try {
    const val = JSON.parse(jsonStr)
    return Array.isArray(val) ? val : fallback
  } catch {
    return fallback
  }
}

function toModel(row: SysModelRow): SysModel {
  return {
    id: row.id,
    providerId: row.provider_id,
    code: row.code,
    name: row.name,
    category: row.category,
    enabled: row.enabled !== 0,
    status: row.status,
    type: row.type,
    inputModal: safeJsonParseArray(row.input_modal, ['text']),
    outputModal: safeJsonParseArray(row.output_modal, ['text']),
    protocols: safeJsonParseArray(row.protocols, []),
    maxContext: row.max_context,
    maxInput: row.max_input,
    maxOutput: row.max_output,
    reasoning: row.reasoning,
    effortLevel: safeJsonParseArray(row.effort_level, []),
    sort: row.sort,
    description: row.description,
    createTime: row.create_time,
    updateTime: row.update_time
  }
}

/** 查询某供应商的所有模型（sort 升序，创建时间升序） */
export function listModels(providerId: string): SysModel[] {
  const rows = db.prepare(`
    SELECT * FROM sys_model
    WHERE provider_id = ?
    ORDER BY sort ASC, create_time ASC
  `).all(providerId) as unknown as SysModelRow[]
  return rows.map(toModel)
}

/** 按 id 查询单个模型 */
export function getModel(id: string): SysModel | null {
  const row = db.prepare('SELECT * FROM sys_model WHERE id = ?').get(id) as unknown as SysModelRow | undefined
  return row ? toModel(row) : null
}

/** 新增模型 */
export function insertModel(id: string, providerId: string, input: SysModelInput): SysModel {
  db.prepare(`
    INSERT INTO sys_model (
      id, provider_id, code, name, category, enabled, status, type,
      input_modal, output_modal, protocols, max_context, max_input, max_output,
      reasoning, effort_level, sort, description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    providerId,
    input.code,
    input.name ?? '',
    input.category ?? '',
    input.enabled === false ? 0 : 1,
    input.status ?? 'ACTIVE',
    input.type,
    JSON.stringify(input.inputModal ?? ['text']),
    JSON.stringify(input.outputModal ?? ['text']),
    JSON.stringify(input.protocols ?? []),
    input.maxContext ?? 0,
    input.maxInput ?? 0,
    input.maxOutput ?? 0,
    input.reasoning ?? 'TOGGLE',
    JSON.stringify(input.effortLevel ?? []),
    input.sort ?? 0,
    input.description ?? ''
  )
  return getModel(id)!
}

/** 更新模型 */
export function updateModel(id: string, input: SysModelInput): SysModel | null {
  const result = db.prepare(`
    UPDATE sys_model SET
      code = ?, name = ?, category = ?, enabled = ?, status = ?, type = ?,
      input_modal = ?, output_modal = ?, protocols = ?, max_context = ?, max_input = ?, max_output = ?,
      reasoning = ?, effort_level = ?, sort = ?, description = ?, update_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    input.code,
    input.name ?? '',
    input.category ?? '',
    input.enabled === false ? 0 : 1,
    input.status ?? 'ACTIVE',
    input.type,
    JSON.stringify(input.inputModal ?? ['text']),
    JSON.stringify(input.outputModal ?? ['text']),
    JSON.stringify(input.protocols ?? []),
    input.maxContext ?? 0,
    input.maxInput ?? 0,
    input.maxOutput ?? 0,
    input.reasoning ?? 'TOGGLE',
    JSON.stringify(input.effortLevel ?? []),
    input.sort ?? 0,
    input.description ?? '',
    id
  )
  return result.changes > 0 ? getModel(id) : null
}

/** 删除模型 */
export function removeModel(id: string): boolean {
  return db.prepare('DELETE FROM sys_model WHERE id = ?').run(id).changes > 0
}

/** 批量更新模型排序 */
export function reorderModels(items: {id: string, sort: number}[]): void {
  const stmt = db.prepare('UPDATE sys_model SET sort = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?')
  try {
    db.exec('BEGIN')
    for (const {id, sort} of items) stmt.run(sort, id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
