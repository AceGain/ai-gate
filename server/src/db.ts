/**
 * SQLite 数据库连接：@libsql/client + Drizzle ORM
 * 数据库文件位于 AI_GATE_DATA_DIR（默认 server/data，已被 gitignore）
 * 迁移目录位于 server/drizzle，支持 drizzle-kit 自动化管理
 */
import {mkdirSync} from 'node:fs'
import path from 'node:path'
import {createClient} from '@libsql/client'
import {drizzle} from 'drizzle-orm/libsql'
import {migrate} from 'drizzle-orm/libsql/migrator'
import * as schema from './schema/index'

const DATA_DIR = process.env.AI_GATE_DATA_DIR ?? path.resolve(process.cwd(), 'server', 'data')
export const DB_FILE = path.join(DATA_DIR, 'ai-gate.db')

mkdirSync(DATA_DIR, {recursive: true})

/** libSQL 客户端单例 */
export const client = createClient({
  url: `file:${DB_FILE}`
})

// WAL 提升并发读写；开启外键约束与并发等待超时
await client.execute('PRAGMA journal_mode = WAL')
await client.execute('PRAGMA busy_timeout = 5000')
await client.execute('PRAGMA foreign_keys = ON')

/** Drizzle ORM 实例 */
export const db = drizzle(client, {schema})

// 服务启动时自动执行 Drizzle 迁移，确保表结构与 schema 保持最新
// 基于 import.meta.dirname 安全定位迁移目录，避免依赖 process.cwd()
const migrationsFolder = path.resolve(import.meta.dirname, '../drizzle')
try {
  await migrate(db, {migrationsFolder})
} catch (err) {
  console.error('[ai-gate] failed to run drizzle migrations:', err)
  throw err
}

// 历史生成端点类型名称平滑迁移：去除 OpenAI/ 与 Anthropic/ 前缀
try {
  await client.execute(`UPDATE sys_endpoint SET \`generate\` = 'Chat Completions' WHERE \`generate\` = 'OpenAI/Chat Completions'`)
  await client.execute(`UPDATE sys_endpoint SET \`generate\` = 'Responses' WHERE \`generate\` = 'OpenAI/Responses'`)
  await client.execute(`UPDATE sys_endpoint SET \`generate\` = 'Messages' WHERE \`generate\` = 'Anthropic/Messages'`)
} catch (err) {
  console.warn('[ai-gate] failed to normalize legacy generate names:', err)
}

