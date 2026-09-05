# AI Gate 数据库设计

## 概述

| 项 | 说明 |
|---|---|
| 数据库 | SQLite（`node:sqlite`，Node 24+ 内置，无第三方依赖） |
| 数据库文件 | `server/data/ai-gate.db`（目录可用环境变量 `AI_GATE_DATA_DIR` 覆盖；已被 gitignore） |
| 连接策略 | 进程级单例（`server/src/db.ts`），WAL 模式，`busy_timeout = 5000` |
| 建表方式 | 幂等 `CREATE TABLE IF NOT EXISTS`，DDL 统一收敛在 `server/src/db.ts` |
| 命名约定 | 表名 `sys_` 前缀 + snake_case；API 载荷统一 camelCase |
| 时间约定 | 由数据库维护（`CURRENT_TIMESTAMP`，UTC，格式 `YYYY-MM-DD HH:MM:SS`），写入方不传 |

## 表清单

| 表名 | 说明 | 所属模块 |
|---|---|---|
| `sys_provider` | 供应商基础信息 | 供应商（`/providers`） |

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
| POST | `/api/providers` | 新增；`id` 服务端生成，时间戳数据库生成 | 400 参数缺失；409 `code` 重复 |
| PUT | `/api/providers/reorder` | 批量排序（列表拖拽后的持久化），body 为 `[{id, sort}]`，单事务执行；须注册在 `PUT /:id` 之前 | 400 格式非法 |
| PUT | `/api/providers/:id` | 全量更新可写字段（`code`/`name`/`icon`/`enabled`/`description`/`sort`） | 400；404；409 |
| DELETE | `/api/providers/:id` | 删除 | 404 |
