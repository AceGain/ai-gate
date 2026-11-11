import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const dbFile = process.env.AI_GATE_DB_PATH || fileURLToPath(new URL('../../data/server.db', import.meta.url))
const schemaFile = fileURLToPath(new URL('../../sql/schema.sql', import.meta.url))

fs.mkdirSync(path.dirname(dbFile), { recursive: true })

export const sqlite = new Database(dbFile)
sqlite.pragma('journal_mode = WAL')
// SQLite 默认不启用外键，DDL 里的 ON DELETE CASCADE 依赖这一句
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('busy_timeout = 5000')

// 在同一个写事务内检查并初始化，避免两个进程同时判定为空库后重复建表。
// 仅在没有业务表的空库执行最新全量 DDL；已有数据库的结构调整由维护者手动处理。
sqlite.transaction(() => {
  const initialized = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' LIMIT 1")
    .get()
  if (!initialized) {
    sqlite.exec(fs.readFileSync(schemaFile, 'utf8'))
  }
}).immediate()

export const db = drizzle(sqlite, { schema })
