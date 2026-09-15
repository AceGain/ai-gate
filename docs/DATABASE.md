# AI Gate 数据库设计

## 概述

| 项 | 说明 |
|---|---|
| 数据库 | SQLite（`@libsql/client` + `Drizzle ORM`，全异步/零编译依赖） |
| 数据库文件 | `server/data/ai-gate.db`（目录可用环境变量 `AI_GATE_DATA_DIR` 覆盖；已被 gitignore） |
| 连接策略 | 进程级单例（`server/src/db.ts`），WAL 模式，`busy_timeout = 5000` |
| Schema 定义 | TypeScript 单源定义在 `server/src/schema/index.ts` |
| 迁移方式 | `drizzle-kit` 自动化管理（`pnpm db:generate` 生成至 `server/drizzle/`），启动自动执行 |
| 命名约定 | 表名 `sys_` 前缀 + snake_case；API 载荷统一 camelCase（Drizzle 自动映射） |
| 时间约定 | 由数据库维护（`CURRENT_TIMESTAMP`，UTC，格式 `YYYY-MM-DD HH:MM:SS`），写入方不传 |

## 表清单

| 表名 | 说明 | 所属模块 |
|---|---|---|
| `sys_provider` | 供应商基础信息 | 供应商（`/providers`） |
| `sys_endpoint` | 供应商端点配置（base/models/protocol 路径与协议） | 供应商配置 - 端点（`/providers/:id`） |
| `sys_key` | 供应商 API 密钥（状态/过期/排序） | 供应商配置 - 密钥（`/providers/:id`） |
| `sys_model` | 供应商模型（模态/上下文/推理档位等） | 供应商配置 - 模型（`/providers/:id`） |
| `sys_key_model` | 供应商-密钥-模型速查关系 | 关联关系 |

---

## sys_provider 供应商

供应商基础信息表。`code` 为对外模型标识前缀（如 `agnes/agnes-2.5-flash` 中的 `agnes`）。

### DDL

```sql
-- 供应商
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
);
```

### 字段说明

| 字段 | 类型 | 约束 / 默认值 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID，路由与持久化主键，服务端生成 |
| `code` | TEXT | NOT NULL UNIQUE | 编码；对外模型标识前缀，如 `agnes/agnes-2.5-flash` |
| `name` | TEXT | NOT NULL | 供应商名称 |
| `icon` | TEXT | NOT NULL DEFAULT `''` | 品牌图标 id；空串时前端首字母 fallback |
| `enabled` | BOOLEAN | NOT NULL DEFAULT FALSE, CHECK (`enabled IN (TRUE, FALSE)`) | 是否启用；SQLite 以 0/1 存储 |
| `description` | TEXT | NOT NULL DEFAULT `''` | 描述 |
| `sort` | INTEGER | NOT NULL DEFAULT `0` | 排序值，升序 |
| `create_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间（UTC，数据库维护） |
| `update_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 更新时间（每次 UPDATE 由服务端刷新为 `CURRENT_TIMESTAMP`） |

### 排序约定

列表查询：`ORDER BY sort ASC, create_time ASC`（sort 相同时按创建时间正序）。

### 字段映射（DB → API）

| DB（snake_case） | API（camelCase） |
|---|---|
| `create_time` | `createTime` |
| `update_time` | `updateTime` |

其余字段名两态一致。

### API（`/api/providers`，Hono 路由 `server/src/routes/providers.ts`）

| 方法 | 路径 | 说明 | 错误 |
|---|---|---|---|
| GET | `/api/providers` | 列表（按排序约定） | — |
| GET | `/api/providers/:id` | 详情 | 404 不存在 |
| POST | `/api/providers` | 新增；`id` 服务端生成，时间戳数据库生成；需传 `baseUrl`，事务内自动初始化默认 `base` 端点与 `/v1/models` 端点；可选传 `protocolEndpoint`（`{protocol, path}`，初始协议端点，写入并设为默认）与 `apiKey`（`{name, secret}`，初始密钥），事务内一并写入 | 400 参数缺失；409 `code` 重复 |
| PUT | `/api/providers/reorder` | 批量排序（列表拖拽后的持久化），body 为 `[{id, sort}]`，单事务执行；须注册在 `PUT /:id` 之前 | 400 格式非法 |
| PUT | `/api/providers/:id` | 全量更新可写字段（`code`/`name`/`icon`/`enabled`/`description`/`sort`） | 400；404；409 |
| DELETE | `/api/providers/:id` | 删除 | 404 |

---

## sys_endpoint 供应商端点

管理供应商网络接入点（基础 URL、拉取模型列表 URL、各模型协议路径映射）。

### DDL

```sql
-- 端点
CREATE TABLE IF NOT EXISTS sys_endpoint (
  id TEXT PRIMARY KEY, -- UUID
  provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('base', 'models', 'protocol')), -- base、models、protocol
  protocol TEXT NOT NULL DEFAULT '', -- 协议标识，如 Chat Completions、Responses、Messages
  path TEXT NOT NULL, -- 路径或完整URL，如 https://apihub.example.com、/v1/models、/v1/messages
  is_default BOOLEAN NOT NULL DEFAULT FALSE CHECK (is_default IN (TRUE, FALSE)),
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_endpoint_provider ON sys_endpoint (provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoint_provider_type_protocol ON sys_endpoint (provider_id, type, protocol);
```

### 约束说明

同一供应商下 `(provider_id, type, protocol)` 具备唯一约束：
- `type = 'protocol'` 端点按协议强唯一（同一供应商下每种 protocol 仅允许新增一个）；
- `type = 'base'` 与 `type = 'models'` 各仅允许存在一条。

### 字段说明

| 字段 | 类型 | 约束 / 默认值 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID，单条记录主键 |
| `provider_id` | TEXT | NOT NULL REFERENCES `sys_provider(id)` ON DELETE CASCADE | 关联的供应商 ID |
| `type` | TEXT | NOT NULL, CHECK (`type IN ('base', 'models', 'protocol')`) | 类型；`base`（基地址）、`models`（模型列表地址）、`protocol`（协议地址） |
| `protocol` | TEXT | NOT NULL DEFAULT `''` | 协议名称（如 `Chat Completions`、`Responses`、`Messages`），base/models 类型为空字符串 |
| `path` | TEXT | NOT NULL | 路径或完整 URL |
| `is_default` | BOOLEAN | NOT NULL DEFAULT FALSE, CHECK (`is_default IN (TRUE, FALSE)`) | 是否默认端点 |
| `create_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间（UTC，数据库维护） |
| `update_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 更新时间（每次 UPDATE 由服务端刷新） |

### 排序约定

列表查询：`ORDER BY create_time ASC`（按创建时间正序，设为默认不改变列表顺序）。

### 字段映射（DB → API）

| DB（snake_case） | API（camelCase） |
|---|---|
| `provider_id` | `providerId` |
| `is_default` | `isDefault` |
| `create_time` | `createTime` |
| `update_time` | `updateTime` |

其余字段名两态一致。

### API（`/api/providers/:providerId/endpoints`）

| 方法 | 路径 | 说明 | 错误 |
|---|---|---|---|
| GET | `/api/providers/:providerId/endpoints` | 列表（按排序约定） | 404 供应商不存在 |
| POST | `/api/providers/:providerId/endpoints` | 新增端点 | 400 参数校验失败；409 同类协议端点已存在 |
| PUT | `/api/providers/:providerId/endpoints/:id` | 修改端点 | 400；404；409 同类协议端点已存在 |
| DELETE | `/api/providers/:providerId/endpoints/:id` | 删除端点 | 404 |

---

## sys_key 供应商密钥

管理供应商各账户的 API Key、有效状态及到期时间。

### DDL

```sql
-- 密钥
CREATE TABLE IF NOT EXISTS sys_key (
  id TEXT PRIMARY KEY, -- UUID
  provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  secret TEXT NOT NULL, -- 敏感字段
  enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (enabled IN (TRUE, FALSE)),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVALID')),
  expires_time TEXT, -- NULL=永久，或 'YYYY-MM-DD HH:MM:SS'
  sort INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_key_provider ON sys_key (provider_id, sort);
```

### 字段说明

| 字段 | 类型 | 约束 / 默认值 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `provider_id` | TEXT | NOT NULL REFERENCES `sys_provider(id)` ON DELETE CASCADE | 关联供应商 ID |
| `name` | TEXT | NOT NULL | 密钥名称/备注 |
| `secret` | TEXT | NOT NULL | 密钥明文内容（API 输出支持脱敏，如 `sk-***abcd`） |
| `enabled` | BOOLEAN | NOT NULL DEFAULT FALSE, CHECK (`enabled IN (TRUE, FALSE)`) | 是否启用 |
| `status` | TEXT | NOT NULL DEFAULT 'ACTIVE', CHECK (`status IN ('ACTIVE', 'INVALID')`) | 状态：`ACTIVE`（可用）/ `INVALID`（失效） |
| `expires_time` | TEXT | NULL（永久）或时间字符串 | 过期时间（不含 EXPIRED 状态枚举） |
| `sort` | INTEGER | NOT NULL DEFAULT 0 | 排序值，升序 |
| `create_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 排序约定

列表查询：`ORDER BY sort ASC, create_time ASC`。

### 字段映射（DB → API）

| DB（snake_case） | API（camelCase） |
|---|---|
| `provider_id` | `providerId` |
| `expires_time` | `expiresTime` |
| `create_time` | `createTime` |
| `update_time` | `updateTime` |

其余字段名两态一致。

### API（`/api/providers/:providerId/keys`）

| 方法 | 路径 | 说明 | 错误 |
|---|---|---|---|
| GET | `/api/providers/:providerId/keys` | 列表（可按需返回脱敏字段与原密文） | 404 供应商不存在 |
| POST | `/api/providers/:providerId/keys` | 新增密钥 | 400 |
| PUT | `/api/providers/:providerId/keys/reorder` | 批量排序，body 为 `[{id, sort}]` | 400 |
| PUT | `/api/providers/:providerId/keys/:id` | 更新密钥 | 400；404 |
| DELETE | `/api/providers/:providerId/keys/:id` | 删除密钥 | 404 |

---

## sys_model 供应商模型

管理供应商下属的具体模型及其模态、上下文限额、推理支持程度与协议。

### DDL

```sql
-- 模型
CREATE TABLE IF NOT EXISTS sys_model (
  id TEXT PRIMARY KEY, -- UUID
  provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- 对外模型标识，如 gpt-4o
  name TEXT NOT NULL DEFAULT '', -- 显示名；空串时展示 code
  category TEXT NOT NULL DEFAULT '', -- 分组
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
```

### 字段说明

| 字段 | 类型 | 约束 / 默认值 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `provider_id` | TEXT | NOT NULL REFERENCES `sys_provider(id)` ON DELETE CASCADE | 关联供应商 ID |
| `code` | TEXT | NOT NULL | 对外模型标识（同 provider 下唯一） |
| `name` | TEXT | NOT NULL DEFAULT `''` | 模型展示名，空串时 fallback 到 `code` |
| `category` | TEXT | NOT NULL DEFAULT `''` | 模型分组/分类 |
| `enabled` | BOOLEAN | NOT NULL DEFAULT FALSE | 是否启用 |
| `status` | TEXT | NOT NULL DEFAULT 'ACTIVE', CHECK (`status IN ('ACTIVE', 'INVALID')`) | 状态：`ACTIVE` / `INVALID` |
| `type` | TEXT | NOT NULL, CHECK (`type IN ('GenText', 'GenImage', 'GenAudio', 'GenVideo', 'Embedding', 'Rerank')`) | 模型大类 |
| `input_modal` | TEXT | NOT NULL DEFAULT `'["text"]'`, JSON 数组 | 输入模态，如 `["Text", "Image"]` |
| `output_modal` | TEXT | NOT NULL DEFAULT `'["text"]'`, JSON 数组 | 输出模态，如 `["Text"]` |
| `protocols` | TEXT | NOT NULL DEFAULT `'[]'`, JSON 数组 | 支持协议，如 `["Chat Completions"]` |
| `max_context` | INTEGER | NOT NULL DEFAULT 0 | 最大上下文 tokens |
| `max_input` | INTEGER | NOT NULL DEFAULT 0 | 最大输入 tokens |
| `max_output` | INTEGER | NOT NULL DEFAULT 0 | 最大输出 tokens |
| `reasoning` | TEXT | NOT NULL DEFAULT 'TOGGLE', CHECK (`reasoning IN ('DISABLE', 'ALWAYS', 'SWITCH', 'TOGGLE')`) | 推理支持模式：DISABLE 不支持、ALWAYS 仅支持、SWITCH 开关、TOGGLE 切换 |
| `effort_level` | TEXT | NOT NULL DEFAULT `'[]'`, JSON 数组 | 推理程度选项：`["none", "low", "medium", "high", "xhigh", "max"]` |
| `sort` | INTEGER | NOT NULL DEFAULT 0 | 排序值，升序 |
| `description` | TEXT | NOT NULL DEFAULT `''` | 描述 |
| `create_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 排序约定

列表查询：`ORDER BY sort ASC, create_time ASC`。

### 字段映射（DB → API）

| DB（snake_case） | API（camelCase） |
|---|---|
| `provider_id` | `providerId` |
| `input_modal` | `inputModal`（DB 为 JSON 字符串，API 载荷序列化为 string[]） |
| `output_modal` | `outputModal`（DB 为 JSON 字符串，API 载荷序列化为 string[]） |
| `protocols` | `protocols`（DB 为 JSON 字符串，API 载荷序列化为 string[]） |
| `max_context` | `maxContext` |
| `max_input` | `maxInput` |
| `max_output` | `maxOutput` |
| `effort_level` | `effortLevel`（DB 为 JSON 字符串，API 载荷序列化为 string[]） |
| `create_time` | `createTime` |
| `update_time` | `updateTime` |

其余字段名两态一致。

### API（`/api/providers/:providerId/models`）

| 方法 | 路径 | 说明 | 错误 |
|---|---|---|---|
| GET | `/api/providers/:providerId/models` | 列表（JSON 字段自动解析为数组） | 404 供应商不存在 |
| POST | `/api/providers/:providerId/models` | 新增模型 | 400；409 `code` 重复 |
| PUT | `/api/providers/:providerId/models/reorder` | 批量排序，body 为 `[{id, sort}]` | 400 |
| PUT | `/api/providers/:providerId/models/:id` | 更新模型 | 400；404；409 |
| DELETE | `/api/providers/:providerId/models/:id` | 删除模型 | 404 |

---

## sys_key_model 供应商-密钥-模型关联

速查关系表，记录哪些密钥可用访问哪些模型。

### DDL

```sql
-- 供应商-密钥-模型速查关联
CREATE TABLE IF NOT EXISTS sys_key_model (
  provider_id TEXT NOT NULL REFERENCES sys_provider (id) ON DELETE CASCADE,
  key_id TEXT NOT NULL REFERENCES sys_key (id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES sys_model (id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, key_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_key_model_key ON sys_key_model (key_id);
CREATE INDEX IF NOT EXISTS idx_key_model_model ON sys_key_model (model_id);
```

### 字段说明

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `provider_id` | TEXT | NOT NULL REFERENCES `sys_provider(id)` ON DELETE CASCADE | 关联供应商 |
| `key_id` | TEXT | NOT NULL REFERENCES `sys_key(id)` ON DELETE CASCADE | 关联密钥 |
| `model_id` | TEXT | NOT NULL REFERENCES `sys_model(id)` ON DELETE CASCADE | 关联模型 |

