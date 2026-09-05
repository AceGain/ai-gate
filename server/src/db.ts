/**
 * SQLite 数据库连接：node:sqlite（Node 24+ 内置，零依赖）
 * 数据库文件位于 AI_GATE_DATA_DIR（默认 server/data，已被 gitignore）
 * 表结构设计文档：docs/database-design.md
 */
import {mkdirSync} from 'node:fs'
import path from 'node:path'
import {DatabaseSync} from 'node:sqlite'

const DATA_DIR = process.env.AI_GATE_DATA_DIR ?? path.resolve(process.cwd(), 'server', 'data')
export const DB_FILE = path.join(DATA_DIR, 'ai-gate.db')

mkdirSync(DATA_DIR, {recursive: true})

/** 进程级单例：tsx watch 重启或生产多模块导入均复用同一连接 */
export const db = new DatabaseSync(DB_FILE)

// WAL 提升读写并发；busy_timeout 避免短暂写锁冲突直接报错
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA busy_timeout = 5000')

// 清理开发阶段旧设计的遗留表（正式表结构以 docs/database-design.md 为准）
db.exec('DROP TABLE IF EXISTS providers_v2')

// 供应商
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_provider (
    id TEXT PRIMARY KEY, -- UUID
    code TEXT NOT NULL UNIQUE, -- 编码；对外模型标识前缀，如 agnes/agnes-2.5-flash
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (enabled IN (TRUE, FALSE)),
    description TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)
