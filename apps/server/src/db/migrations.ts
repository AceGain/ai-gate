import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'

// 001 版本没有任何来源关联，不能通过编码猜测供应商或虚拟模型。
// 调用方与本函数均使用事务，失败时保留原表、索引及数据。
export function migrateRouteModels(sqlite: Database.Database): void {
  sqlite.transaction(() => {
    const columns = sqlite.pragma('table_info(r_model)') as { name: string }[]
    if (['source_type', 'model_id', 'mode'].every(name => columns.some(column => column.name === name))) {
      return
    }
    if (columns.length === 0) {
      throw new Error('Missing r_model table; initialize the inbound routing schema before migrating')
    }
    if (columns.some(column => ['source_type', 'model_id', 'mode'].includes(column.name))) {
      throw new Error('Unsupported partial r_model migration; restore or complete the source mapping migration')
    }
    const { count } = sqlite.prepare('SELECT COUNT(*) AS count FROM r_model').get() as { count: number }
    if (count > 0) {
      throw new Error(
        'Cannot migrate populated legacy r_model: explicit source_type and model_id mappings are required; no data was changed',
      )
    }
    const migrationFile = fileURLToPath(new URL('../../sql/migrations/002_route_model_sources.sql', import.meta.url))
    sqlite.exec(fs.readFileSync(migrationFile, 'utf8'))
  })()
}
