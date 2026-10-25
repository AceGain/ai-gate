-- ai-gate hub 数据库表结构（SQLite）
-- 全量建表语句：t_provider（供应商）、t_endpoint（端点）、t_model（模型）

-- 供应商
CREATE TABLE t_provider (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, -- 对外编码，唯一；如 agnes/agnes-2.5-flash；
  name TEXT NOT NULL,
  icon TEXT DEFAULT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 状态；ACTIVE：正常，INACTIVE：不可用，ERROR：异常；
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX t_provider_idx_code ON t_provider (code);

CREATE INDEX t_provider_idx_enabled ON t_provider (enabled);

CREATE INDEX t_provider_idx_status ON t_provider (status);

-- 端点
CREATE TABLE t_endpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES t_provider (id) ON DELETE CASCADE, -- t_provider.id
  kind TEXT NOT NULL, -- 种类：BASE、MODEL、GEN；
  type TEXT DEFAULT NULL, -- 类型，例如：GEN 对应 CHAT、RESPONSES、MESSAGES；
  path TEXT NOT NULL, -- 路径，例如：BASE 对应 https://apihub.agnes-ai.com，MODEL 对应 /v1/models，GEN 对应 /v1/chat/completions、/v1/responses、/v1/message；
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX t_endpoint_idx_kind_type ON t_endpoint (kind, type);

CREATE UNIQUE INDEX t_endpoint_uq_provider_kind_type_path ON t_endpoint (provider_id, kind, type, path);

-- 模型
CREATE TABLE t_model (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES t_provider (id) ON DELETE CASCADE, -- t_provider.id
  code TEXT NOT NULL, -- 对外编码，不唯一；如 gpt-4o；
  name TEXT DEFAULT NULL, -- 显示名称，为 NULL 时默认展示 code；
  category TEXT DEFAULT 'Default', -- 分类，默认 Default；  
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 状态；ACTIVE：正常，INACTIVE：不可用，ERROR：异常；
  type TEXT NOT NULL, -- 类型：TEXT、IMAGE、AUDIO、VIDEO、EMBEDDING、RERANK；
  gen_type TEXT NOT NULL CHECK (json_valid(gen_type)), -- GEN 类型：Chat、Responses、Messages；
  config TEXT NOT NULL CHECK (json_valid(config)), -- 模型配置
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX t_model_uq_provider_code ON t_model (provider_id, code);

CREATE INDEX t_model_idx_enabled ON t_model (enabled);

CREATE INDEX t_model_idx_status ON t_model (status);

CREATE INDEX t_model_idx_type ON t_model (type);
