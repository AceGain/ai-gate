import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const dbFile = fileURLToPath(new URL('../../data/server.db', import.meta.url))
const schemaFile = fileURLToPath(new URL('../../sql/schema.sql', import.meta.url))

fs.mkdirSync(path.dirname(dbFile), { recursive: true })

export const sqlite = new Database(dbFile)
sqlite.pragma('journal_mode = WAL')
// SQLite 默认不启用外键，DDL 里的 ON DELETE CASCADE 依赖这一句
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('busy_timeout = 5000')

// 空库时执行全量 DDL；schema.sql 没有 IF NOT EXISTS，已有表时重复执行会报错
const initialized = sqlite
  .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 's_provider'")
  .get()
if (!initialized) {
  sqlite.exec(fs.readFileSync(schemaFile, 'utf8'))
}

export const db = drizzle(sqlite, { schema })
