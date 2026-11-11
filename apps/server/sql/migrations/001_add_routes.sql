-- 已有数据库增量补建入站域；与 ../schema.sql 的入站域定义保持同步。
-- 路由代理
CREATE TABLE IF NOT EXISTS r_route (
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

CREATE INDEX IF NOT EXISTS r_route_idx_code ON r_route (code);

CREATE INDEX IF NOT EXISTS r_route_idx_enabled ON r_route (enabled);

CREATE INDEX IF NOT EXISTS r_route_idx_status ON r_route (status);

-- 一个独立监听地址和端口只分配给一条路由。
CREATE UNIQUE INDEX IF NOT EXISTS r_route_uq_dedicated_host_port ON r_route (host, port) WHERE mode = 'DEDICATED';

-- 共享当前服务的路由不能配置相同入口前缀。
CREATE UNIQUE INDEX IF NOT EXISTS r_route_uq_shared_prefix_path ON r_route (prefix_path) WHERE mode = 'SHARED';

-- 路由生成端点
CREATE TABLE IF NOT EXISTS r_endpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES r_route (id) ON DELETE CASCADE, -- r_route.id；
  type TEXT NOT NULL, -- Chat、Responses、Messages；同一路由每种类型仅一个；
  path TEXT NOT NULL, -- 相对于 prefix_path，如 /chat/completions、/responses、/messages；
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS r_endpoint_uq_route_type ON r_endpoint (route_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS r_endpoint_uq_route_path ON r_endpoint (route_id, path);

-- 入站密钥
CREATE TABLE IF NOT EXISTS r_key (
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

CREATE INDEX IF NOT EXISTS r_key_idx_enabled ON r_key (enabled);

CREATE INDEX IF NOT EXISTS r_key_idx_status ON r_key (status);

-- 对外模型
CREATE TABLE IF NOT EXISTS r_model (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES r_route (id) ON DELETE CASCADE, -- r_route.id；
  code TEXT NOT NULL, -- 对外编码，路由内唯一，不同路由可重复；如 gpt-4o；
  name TEXT DEFAULT NULL, -- 为 NULL 时默认展示 code；
  category TEXT DEFAULT 'Default',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE：正常；INACTIVE：不可用；ERROR：异常；
  type TEXT NOT NULL, -- TEXT、IMAGE、AUDIO、VIDEO、OMNI、EMBEDDING、RERANK、CLASS；
  gen_type TEXT NOT NULL CHECK (json_valid(gen_type)), -- 允许的入站协议：Chat、Responses、Messages；
  config TEXT NOT NULL CHECK (json_valid(config)), -- 模型配置；
  remark TEXT DEFAULT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS r_model_uq_route_code ON r_model (route_id, code);

CREATE INDEX IF NOT EXISTS r_model_idx_enabled ON r_model (enabled);

CREATE INDEX IF NOT EXISTS r_model_idx_status ON r_model (status);

CREATE INDEX IF NOT EXISTS r_model_idx_type ON r_model (type);
