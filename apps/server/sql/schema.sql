-- ai-gate server 数据库表结构（SQLite）
-- 出站域（S 域）：s_ 前缀 = 出站（对接的上游供应商；模板域为 hub 的 t_，入站域预留 r_，即使结构暂时相同也不得合并）
-- 全量建表语句：s_provider（供应商）、s_endpoint（端点）、s_key（密钥）、s_model（模型）、s_relat（供应商-密钥-模型；关系速查）

-- 供应商
CREATE TABLE s_provider (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, -- 对外编码，唯一；如 agnes/agnes-2.5-flash；
  name TEXT NOT NULL,
  icon TEXT DEFAULT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 状态；ACTIVE：正常，INACTIVE：不可用，ERROR：异常；
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX s_provider_idx_code ON s_provider (code);

CREATE INDEX s_provider_idx_enabled ON s_provider (enabled);

CREATE INDEX s_provider_idx_status ON s_provider (status);

-- 端点
CREATE TABLE s_endpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES s_provider (id) ON DELETE CASCADE, -- s_provider.id
  kind TEXT NOT NULL, -- 种类：BASE、MODEL、GEN；
  type TEXT DEFAULT NULL, -- 类型，例如：GEN 对应 Chat、Responses、Messages；
  path TEXT NOT NULL, -- 路径，例如：BASE 对应 https://apihub.agnes-ai.com，MODEL 对应 /v1/models，GEN 对应 /v1/chat/completions、/v1/responses、/v1/message；
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX s_endpoint_idx_kind_type ON s_endpoint (kind, type);

CREATE UNIQUE INDEX s_endpoint_uq_provider_kind_type_path ON s_endpoint (provider_id, kind, type, path);

-- 密钥
CREATE TABLE s_key (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES s_provider (id) ON DELETE CASCADE, -- s_provider.id
  name TEXT NOT NULL,
  secret TEXT NOT NULL, -- 敏感，后续落库前加密；
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 状态；ACTIVE：正常，INACTIVE：不可用，EXPIRED：过期；
  expire_time TEXT DEFAULT NULL, -- NULL：永久；
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX s_key_idx_enabled ON s_key (enabled);

CREATE INDEX s_key_idx_status ON s_key (status);

-- 模型
CREATE TABLE s_model (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES s_provider (id) ON DELETE CASCADE, -- s_provider.id
  code TEXT NOT NULL, -- 对外编码，不唯一；如 gpt-4o；
  name TEXT DEFAULT NULL, -- 显示名称，为 NULL 时默认展示 code；
  category TEXT DEFAULT 'Default', -- 分类，默认 Default；
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 状态；ACTIVE：正常，INACTIVE：不可用，ERROR：异常；
  type TEXT NOT NULL, -- 类型：TEXT、IMAGE、AUDIO、VIDEO、OMNI、EMBEDDING、RERANK、CLASS；
  gen_type TEXT NOT NULL CHECK (json_valid(gen_type)), -- GEN 类型：Chat、Responses、Messages；
  config TEXT NOT NULL CHECK (json_valid(config)), -- 模型配置
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX s_model_uq_provider_code ON s_model (provider_id, code);

CREATE INDEX s_model_idx_enabled ON s_model (enabled);

CREATE INDEX s_model_idx_status ON s_model (status);

CREATE INDEX s_model_idx_type ON s_model (type);

-- 供应商-密钥-模型；关系速查
CREATE TABLE s_relat (
  provider_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  model_id TEXT NOT NULL
);

CREATE UNIQUE INDEX s_relat_uq_provider_key_model ON s_relat (provider_id, key_id, model_id);
