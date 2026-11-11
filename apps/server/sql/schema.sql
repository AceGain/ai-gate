-- ai-gate server 数据库表结构（SQLite）
-- 出站域（S 域）：s_ 前缀 = 对接的上游供应商；入站域（R 域）：r_ 前缀 = 对外路由代理；模板域为 hub 的 t_，各域不得合并
-- 虚拟模型域（V 域）：v_ 前缀 = 虚拟模型及其实际模型角色关系
-- 全量建表语句：s_provider、s_endpoint、s_key、s_model、s_relat；v_model、v_model_relat；r_route、r_endpoint、r_key、r_model

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

-- 虚拟模型
CREATE TABLE v_model (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  code TEXT NOT NULL UNIQUE, -- 内部编码，全局唯一，创建后不可修改；
  name TEXT DEFAULT NULL, -- 显示名称，为空时展示 code；
  category TEXT NOT NULL DEFAULT 'Default',

  kind TEXT NOT NULL, -- GROUP：组合；FUSION：融合；DECISION：决策；
  type TEXT NOT NULL, -- 任务类型，沿用 s_model.type：TEXT、IMAGE、AUDIO、VIDEO、OMNI 等；

  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE、INACTIVE、ERROR；

  gen_type TEXT DEFAULT NULL,
  -- JSON 数组，对外允许的协议；
  -- NULL：按当前编排能够执行的能力推导；
  -- 非 NULL：在可执行能力范围内进一步限制；

  config TEXT DEFAULT NULL,
  -- JSON 对象，对外能力限制，如输入模态、输出上限；
  -- NULL：不增加限制；
  -- 不替代关联实际模型的能力配置；

  orch_config TEXT NOT NULL DEFAULT '{}',
  -- JSON 对象，按角色保存编排配置；
  --
  -- GROUP：
  --   SELECT：选模策略；
  --
  -- FUSION：
  --   WORKER：参与数量、并发数、最低成功数量、提示词等；
  --   MERGER：汇总模型选模策略、提示词等；
  --
  -- DECISION：
  --   PROPOSER：参与数量、并发数、最低成功数量、提案提示词等；
  --   DECIDER：决策模型选模策略、决策提示词等；
  --   EXECUTOR：执行模型选模策略、执行提示词等；
  --
  -- 单次选模角色支持：
  --   strategy：PRIORITY、WEIGHTED、ROUND_ROBIN；
  --
  -- 并行角色支持：
  --   maxParticipants：最多参与数量，NULL 表示全部合格成员；
  --   maxConcurrency：最大并发数；
  --   minSuccess：继续下一阶段所需的最少成功结果数；
  --
  -- 角色公共配置：
  --   endpointType：内部调用协议；SELECT 随入站协议；
  --   timeout：单次调用超时，NULL 继承路由配置；
  --   deadline：角色阶段总时限，NULL 使用请求剩余时间；
  --   maxRetries：局部额外重试上限，NULL 不增加局部限制；
  --   promptTemplate：提示词模板，NULL 使用内置模板；
  --   requestConfig：模型调用参数；

  timeout INTEGER NOT NULL DEFAULT 180000,
  -- 整条请求总时限，毫秒，包含排队、全部阶段和重试；

  max_calls INTEGER NOT NULL DEFAULT 16,
  -- 整条请求最多发起的上游 HTTP 调用数，包含计划调用和重试；

  sort INTEGER NOT NULL DEFAULT 0,
  remark TEXT DEFAULT NULL,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX v_model_idx_enabled_sort
  ON v_model (enabled, sort, id);


-- 虚拟模型与实际模型的角色关系
CREATE TABLE v_model_relat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  v_model_id INTEGER NOT NULL
    REFERENCES v_model (id) ON DELETE CASCADE,

  s_model_id INTEGER NOT NULL
    REFERENCES s_model (id) ON DELETE RESTRICT,

  role TEXT NOT NULL,
  -- GROUP：
  --   SELECT：实际模型候选；
  --
  -- FUSION：
  --   WORKER：并行处理成员；
  --   MERGER：汇总模型候选；
  --
  -- DECISION：
  --   PROPOSER：并行提案成员；
  --   DECIDER：决策模型候选；
  --   EXECUTOR：执行模型候选；

  enabled BOOLEAN NOT NULL DEFAULT FALSE,

  sort INTEGER NOT NULL DEFAULT 0,
  -- PRIORITY：越小越优先；
  -- 并行角色：按此顺序选取参与成员；
  -- 相同 sort 按 id 升序；

  weight INTEGER NOT NULL DEFAULT 1,
  -- WEIGHTED 策略使用，必须大于 0；
  -- 其他策略忽略；

  remark TEXT DEFAULT NULL,

  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX v_model_relat_uq_model_role_source
  ON v_model_relat (v_model_id, role, s_model_id);

CREATE INDEX v_model_relat_idx_model_role_enabled_sort
  ON v_model_relat (v_model_id, role, enabled, sort, id);

CREATE INDEX v_model_relat_idx_s_model
  ON v_model_relat (s_model_id);

-- 入站域：以下为最新表结构，仅用于空库初始化；已有数据库由维护者手动调整。
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
