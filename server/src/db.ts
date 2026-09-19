/**
 * SQLite 数据库连接：@libsql/client + Drizzle ORM
 * 数据库文件位于 AI_GATE_DATA_DIR（默认 server/data，已被 gitignore）
 * 无自动迁移：表结构以 schema/index.ts 为单源，结构变更时手工执行 SQL 同步
 */
import {mkdirSync} from 'node:fs'
import path from 'node:path'
import {createClient} from '@libsql/client'
import {drizzle} from 'drizzle-orm/libsql'
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
