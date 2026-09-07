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

// WAL 提升读写并发；busy_timeout 避免短暂写锁冲突直接报错；开启外键约束级联生效
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA busy_timeout = 5000')
db.exec('PRAGMA foreign_keys = ON')

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

// 端点
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_endpoint (
    id TEXT PRIMARY KEY, -- UUID
    provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('base', 'models', 'protocol')),
    protocol TEXT NOT NULL DEFAULT '',
    path TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE CHECK (is_default IN (TRUE, FALSE)),
    create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_endpoint_provider ON sys_endpoint (provider_id);
`)

// 密钥
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_key (
    id TEXT PRIMARY KEY, -- UUID
    provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    secret TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (enabled IN (TRUE, FALSE)),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVALID')),
    expires_time TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_key_provider ON sys_key (provider_id, sort);
`)

// 模型
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_model (
    id TEXT PRIMARY KEY, -- UUID
    provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (enabled IN (TRUE, FALSE)),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVALID')),
    type TEXT NOT NULL CHECK (type IN ('GenText', 'GenImage', 'GenAudio', 'GenVideo', 'Embedding', 'Rerank')),
    input_modal TEXT NOT NULL DEFAULT '["text"]' CHECK (json_valid(input_modal)),
    output_modal TEXT NOT NULL DEFAULT '["text"]' CHECK (json_valid(output_modal)),
    protocols TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(protocols)),
    max_context INTEGER NOT NULL DEFAULT 0,
    max_input INTEGER NOT NULL DEFAULT 0,
    max_output INTEGER NOT NULL DEFAULT 0,
    reasoning TEXT NOT NULL DEFAULT 'TOGGLE' CHECK (reasoning IN ('DISABLE', 'ALWAYS', 'SWITCH', 'TOGGLE')),
    effort_level TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(effort_level)),
    sort INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider_id, code)
  );
  CREATE INDEX IF NOT EXISTS idx_model_provider ON sys_model (provider_id, sort);
`)

// 供应商-密钥-模型速查关联
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_key_model (
    provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
    key_id TEXT NOT NULL REFERENCES sys_key (id) ON DELETE CASCADE,
    model_id TEXT NOT NULL REFERENCES sys_model (id) ON DELETE CASCADE,
    PRIMARY KEY (provider_id, key_id, model_id)
  );
  CREATE INDEX IF NOT EXISTS idx_key_model_key ON sys_key_model (key_id);
  CREATE INDEX IF NOT EXISTS idx_key_model_model ON sys_key_model (model_id);
`)
