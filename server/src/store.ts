/**
 * 供应商持久化：SQLite（sys_provider 表）
 * 时间戳由数据库维护（DEFAULT CURRENT_TIMESTAMP / UPDATE 时显式刷新）；列表按 sort 升序
 */
import type {SysProvider, SysProviderInput} from '../../shared/sys-provider'
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
