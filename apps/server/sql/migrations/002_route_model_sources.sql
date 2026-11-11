-- 由 migrateRouteModels 在事务内执行；仅适用于尚无模型记录的 001 旧表。
-- 旧表已有记录时必须先明确来源映射，禁止猜测或丢弃数据。
DROP TABLE r_model;

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
