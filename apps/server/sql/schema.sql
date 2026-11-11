-- ai-gate server 数据库表结构（SQLite）
-- 出站域（S 域）：s_ 前缀 = 对接的上游供应商；入站域（R 域）：r_ 前缀 = 对外路由代理；模板域为 hub 的 t_，各域不得合并
-- 全量建表语句：s_provider、s_endpoint、s_key、s_model、s_relat；r_route、r_endpoint、r_key、r_model

-- 供应商
CREATE TABLE s_provider (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, -- 对外编码，唯一；如 agnes/agnes-2.5-flash；
  name TEXT NOT NULL,
  icon TEXT DEFAULT NULL,
  base_url TEXT NOT NULL, -- 请求根地址;
  models_path TEXT NOT NULL DEFAULT '/v1/models', -- 模型列表路径，与 base_url 拼接；
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
  type TEXT NOT NULL, -- 类型，例如：Chat、Responses、Messages；同一供应商每种类型仅一个；
  path TEXT NOT NULL, -- 路径，例如：/v1/chat/completions、/v1/responses、/v1/messages；
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX s_endpoint_idx_type ON s_endpoint (type);

CREATE UNIQUE INDEX s_endpoint_uq_provider_type ON s_endpoint (provider_id, type);

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

-- 入站域：已有库通过 migrations/001_add_routes.sql、002_route_model_sources.sql 升级至本结构。
-- 路由代理
CREATE TABLE r_route (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, -- 对外编码，全局唯一；
  name TEXT NOT NULL,
  icon TEXT DEFAULT NULL,
  mode TEXT NOT NULL DEFAULT 'SHARED', -- SHARED：复用当前 HTTP 服务；DEDICATED：独立 HTTP 监听器；
  host TEXT DEFAULT NULL, -- SHARED：NULL；DEDICATED：绑定地址，如 127.0.0.1、0.0.0.0；
  port INTEGER DEFAULT NULL, -- SHARED：NULL；DEDICATED：独立监听端口，如 5074；
  prefix_path TEXT NOT NULL DEFAULT '/v1', -- 路由入口前缀，如 /v1、/zen、/go；
  models_path TEXT NOT NULL DEFAULT '/models', -- 模型列表接口路径，相对于 prefix_path；
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE：正常；INACTIVE：不可用；ERROR：异常；
  strategy TEXT NOT NULL DEFAULT 'PRIORITY', -- 第一阶段支持 PRIORITY，后续扩展 ROUND_ROBIN / WEIGHTED；
  timeout INTEGER NOT NULL DEFAULT 60000, -- 每次上游请求超时时间，单位毫秒；
  max_retries INTEGER NOT NULL DEFAULT 0, -- 尚未向客户端提交响应前允许的最大重试次数；
  sort INTEGER NOT NULL DEFAULT 0,
  remark TEXT DEFAULT NULL,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX r_route_idx_code ON r_route (code);

CREATE INDEX r_route_idx_enabled ON r_route (enabled);

CREATE INDEX r_route_idx_status ON r_route (status);

-- 一个独立监听地址和端口只分配给一条路由。
CREATE UNIQUE INDEX r_route_uq_dedicated_host_port ON r_route (host, port) WHERE mode = 'DEDICATED';

-- 共享当前服务的路由不能配置相同入口前缀。
CREATE UNIQUE INDEX r_route_uq_shared_prefix_path ON r_route (prefix_path) WHERE mode = 'SHARED';

-- 路由生成端点
CREATE TABLE r_endpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES r_route (id) ON DELETE CASCADE, -- r_route.id；
  type TEXT NOT NULL, -- Chat、Responses、Messages；同一路由每种类型仅一个；
  path TEXT NOT NULL, -- 相对于 prefix_path，如 /chat/completions、/responses、/messages；
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX r_endpoint_uq_route_type ON r_endpoint (route_id, type);

CREATE UNIQUE INDEX r_endpoint_uq_route_path ON r_endpoint (route_id, path);

-- 入站密钥
CREATE TABLE r_key (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES r_route (id) ON DELETE CASCADE, -- r_route.id；
  name TEXT NOT NULL,
  secret TEXT NOT NULL, -- 敏感，后续落库前加密；
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE：正常；INACTIVE：不可用；EXPIRED：过期；
  expire_time TEXT DEFAULT NULL, -- NULL：永久；
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX r_key_idx_enabled ON r_key (enabled);

CREATE INDEX r_key_idx_status ON r_key (status);

-- 对外模型
CREATE TABLE r_model (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES r_route (id) ON DELETE CASCADE, -- r_route.id；
  source_type TEXT NOT NULL DEFAULT 'S_MODEL', -- S_MODEL：s_model；V_MODEL：v_model；
  model_id INTEGER NOT NULL, -- 来源表的 id；由应用层验证来源存在性和删除引用；
  mode TEXT NOT NULL DEFAULT 'DIRECT', -- DIRECT：采用来源能力配置；CUSTOM：基于来源能力配置覆盖；
  code TEXT NOT NULL, -- 对外编码，路由内唯一，不同路由可重复；如 gpt-4o；
  name TEXT DEFAULT NULL, -- 为 NULL 时默认展示 code；
  category TEXT DEFAULT 'Default',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE：正常；INACTIVE：不可用；ERROR：异常；
  type TEXT DEFAULT NULL, -- CUSTOM 类型覆盖；NULL 时继承；DIRECT 不使用；
  gen_type TEXT DEFAULT NULL CHECK (gen_type IS NULL OR json_valid(gen_type)), -- CUSTOM 入站协议数组覆盖，整体替换；NULL 时继承；
  config TEXT DEFAULT NULL CHECK (config IS NULL OR json_valid(config)), -- CUSTOM 配置对象覆盖，按顶层键合并；NULL 时继承；
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX r_model_uq_route_code ON r_model (route_id, code);

CREATE INDEX r_model_idx_route_enabled_sort ON r_model (route_id, enabled, sort, id);

CREATE INDEX r_model_idx_status ON r_model (status);

CREATE INDEX r_model_idx_source_model ON r_model (source_type, model_id);
