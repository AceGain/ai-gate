# DESIGN-ROUTING.md — 场景化路由与分组设计（Q1–Q10）

> 评审稿 v2 · 对齐 `DESIGN.md` 总体架构：Tauri 2 + Rust(axum 0.7 + hyper 手写 accept loop) + rusqlite(WAL) + Nuxt 4 + @nuxt/ui v4。
> 本地单用户网关，代理默认 `127.0.0.1:15721`；不做多租户、不做 agent 循环。

---

## 0. 核心摘要

| 维度 | 结论 |
|---|---|
| 问题归类 | 十问归四类：**密钥池**(Q1/Q2)、**模型分组**(Q3–Q6)、**归一化**(Q7/Q10)、**协议模板**(Q8/Q9) |
| 领域模型 | **渠道 Channel**(供应商模板+地区/套餐实例) → **连接 Connection**(渠道内一把密钥，故障域原子单位) → **模型分组 ModelGroup**(对外暴露的"模型") |
| 分组三型 | `routing`(选路) / `wrapper`(提示注入+名称重写，Q5) / `pipeline`(一层扇出+评审，Q6，禁嵌套) |
| 能力计费 | 挂 `(channel, upstream_model)` 实例（channel_models 表）；三级解析：**渠道覆盖 > 目录 > 内置**；`canonical_model` 归一化跨渠道同名 |
| 名称解析 | 分组精确名 → routes 通配 → 渠道模型直通；Q3 以**令牌绑定分组**为主（`api_keys.allowed_models` = 组名 glob） |
| 故障域 | 三级：L1 熔断(per-connection) / L2 冷却(终态永不复活) / L3 模型锁(per connection×model)——**键是 connection，勿动** |
| 记账 | usage_history 增列 `channel_id/group_id/trace_id/parent_id/role(main/fanout/judge)/attempt` |
| DDL 变更 | 新增 `channels/channel_models/model_groups/group_candidates`；`connections` 增 `channel_id/weight/model_scope`；**废弃 `model_aliases` 与 `combos`** |
| 路线图 | routing 型分组 + 渠道密钥池进 **P0**；wrapper/pipeline、cost_first、能力过滤进 **P1** |

---

## 1. 问题分类总览

| # | 场景 | 归类 | 解决机制 | 主要落点 |
|---|---|---|---|---|
| Q1 | 同供应商多 key、模型完全相同 | 密钥池 | 1 Channel + N Connection，加权轮询 + 三级故障域 | `connections.weight` + circuit |
| Q2 | 同供应商多 key、模型部分重合 | 密钥池 | Connection 级 `model_scope` 过滤候选 | `connections.model_scope` |
| Q3 | 跨供应商两组模型暴露 | 模型分组 | 令牌绑定分组为主，路径前缀为辅 | `api_keys.allowed_models` |
| Q4 | 不同供应商同一模型 | 模型分组 | routing 型分组 + canonical 归一 + 候选间 failover | `model_groups(type=routing)` |
| Q5 | 包装成自定义模型(MiMe Cheap) | 模型分组 | wrapper 型：提示注入 + 参数覆写 + 名称重写 | `model_groups(type=wrapper)` |
| Q6 | 并行生成+评审整合(MiMe Costly) | 模型分组 | pipeline 型：一层扇出(N≤4)→judge，心跳帧保活 | `model_groups(type=pipeline)` |
| Q7 | 能力/计费异构 | 归一化 | 能力计费挂渠道实例，三级解析 | `channel_models` |
| Q8 | 上下游协议差异 | 协议模板 | N 解码器 + N 编码器 + IR 枢纽（禁 N² 互译） | `channels.protocol` + IR |
| Q9 | 供应商模板+地区/套餐 | 协议模板 | 模板定义协议/鉴权/默认目录，渠道=模板变体 | `channels.template_id/region/plan` |
| Q10 | 同模型跨渠道上下文/计费差异 | 归一化 | `(channel, upstream_model)` 各自快照 + UI 同名对比 | `channel_models` + 对比抽屉 |

---

## 2. 领域模型

### 2.1 三层结构

```
Channel（渠道）── 供应商模板实例：协议 + endpoint + 地区/套餐变体
   └── Connection（连接）── 渠道内一把密钥：weight / model_scope / 故障域状态
ModelGroup（模型分组）── 对外暴露的"模型"，三型 routing / wrapper / pipeline
   └── GroupCandidate ── 指向 (channel, upstream_model) 的候选，带 role/weight/priority
```

关键约束：

- **Connection 是故障域原子单位**。L1 熔断、L2 冷却、L3 模型锁全部以 connection（或 connection×model）为键，与密钥一一对应，永不引入"密钥组"作为故障域。
- **对外模型名 = 分组名**。客户端在 `model` 字段里写的就是分组名；`/v1/models` 返回的是（经令牌授权过滤后的）分组列表。
- **Channel 不持有密钥，Group 不持有 endpoint**。职责单一：渠道管"怎么连"，分组管"怎么选"。

### 2.2 名称解析顺序（三级）

```
resolve(model_name, api_key):
  1. model_groups 精确名命中            → 走分组（三型之一）
  2. routes 按 priority 通配匹配        → 指向分组或渠道直通（'claude-*' → 组）
  3. channel_models 直通                → upstream_model / canonical_model 精确命中即转发
  过滤: api_key.allowed_models 必须放行该分组名（Q3 隔离）
```

### 2.3 候选选择与故障转移

```
select_candidate(group, request):
  cands = group_candidates(enabled)
        × connection(enabled ∧ circuit=closed|half_open ∧ cooldown IS NULL
                     ∧ model_scope 命中目标模型)        # Q2
  按 priority 分层，层内平滑加权轮询(SWRR)
  sticky-N=3：会话指纹(请求前缀 hash) → 粘住上次成功的 connection，
              保留上游 prompt cache 命中；3 轮后回归轮询
  失败转移：attempt++ → 排除该 connection → 重选，受 max_attempts 限制
```

三级故障域语义（沿用 DESIGN.md，此处仅列路由相关行为）：

| 级别 | 粒度 | 触发 | 恢复 | 对选路的影响 |
|---|---|---|---|---|
| L1 熔断 | connection | 连续 N 次瞬时失败(5xx/超时) | 半开探测成功后自动闭合 | 候选临时剔除 |
| L2 冷却 | connection | 终态：quota 耗尽 / key 无效 / 余额不足 | **永不自动复活**，仅用户手动 | 候选永久剔除直至干预 |
| L3 模型锁 | connection×model | 该 key 对该模型 404/无权限 | 手动或渠道目录刷新 | 仅锁该模型，其余模型仍可用 |

---

## 3. 逐问方案

### Q1 同供应商多 key、模型完全相同 → 负载均衡/容错/轮询

- **建模**：`Channel("DeepSeek 官方")` + N 行 `connections`。模型完全相同 ⇒ 不需要分组，走第 3 级"渠道模型直通"。
- **负载均衡**：层内平滑加权轮询（SWRR），`weight` 支持 1–100；同权重即纯轮询。
- **容错**：L1/L2/L3 如上表；attempt 链完整写入 usage_history（同一 trace_id，attempt 递增）。
- **边界**：所有 connection 同时不可用 → 返回 503 + 明确错误体（列出各 attempt 的失败原因），**不做无限重试**。

### Q2 同供应商多 key、模型部分重合

- 与 Q1 的唯一差异：不同 key 的**可用模型集不同**（典型：Claude 订阅号 A 可用 sonnet+haiku，号 B 仅 sonnet）。
- **建模**：`connections.model_scope`（模型名 glob，`NULL` = 渠道全部模型）。
- **选路过滤**：候选 = 分组候选 ∩ connection 的 model_scope 命中。若被过滤后为空 → 503 + "该模型在渠道 X 的所有密钥均超出 model_scope" 的可诊断错误。
- **UI 映射**：渠道详情 → 密钥池表格的"模型范围"列（徽章式 glob）。

### Q3 跨供应商模型分组暴露（两组模型），路径 vs key 区分

- **主机制：令牌绑定分组**。`api_keys.allowed_models` = 授权组名 glob（如 `team-*|gpt-4o`，`NULL` = 全部）。
  - 给 Codex CLI 发令牌 A（只见 `openai-*` 组）、给 Claude Code 发令牌 B（只见 `anthropic-*` 组）。
  - `/v1/models` 按令牌过滤返回；请求未授权组名 → 403。
- **辅机制：路径前缀**（可选）。`/openai/v1/chat/completions` 等价于路径分组别名，内部复用 routes 通配。缺点：不少 CLI 不支持自定义 path 前缀，仅作进阶用法，不作为主设计。
- **结论**：key 区分优先。理由：零客户端配置改动（只改 `OPENAI_API_KEY`），路径方案要求客户端改 base_url 路径，兼容性差。

### Q4 不同供应商提供同一模型 → 负载均衡/容错

- **建模**：routing 型分组。组 `gpt-4o` 的候选：

| candidate | channel | upstream_model | canonical | weight | priority |
|---|---|---|---|---|---|
| 1 | OpenAI 官方 | gpt-4o-2024-11-20 | gpt-4o | 1 | 100 |
| 2 | 中转站 A | gpt-4o | gpt-4o | 3 | 100 |
| 3 | 聚合站 B | gpt-4o | gpt-4o | 2 | 200 |

- **归一化**：`channel_models.canonical_model` 把各家命名（含日期后缀、别名）聚到规范名；分组按 canonical 聚合候选。
- **failover**：候选间按 2.3 节转移；priority 分层支持"便宜池耗尽才用官方"的分级策略（层内 LB，层间顺序）。
- **sticky**：同一会话粘住同一 connection（sticky-N=3）以保住上游 prompt cache 折扣。

### Q5 不同模型包装成自定义模型（MiMe Cheap）

- **建模**：wrapper 型分组。对外名 `cheap-coder`：
  - `group_candidates` 一行 role=`main` 指向 (channel, `gpt-4o-mini`)；
  - `config`：`{ "system_prompt": "你是极简代码助手…", "param_overrides": { "temperature": 0.2, "max_tokens": 4096 } }`。
- **执行**：命中 wrapper 组 → 注入/覆写 → **名称重写**为真实上游模型 → 复用第 3 级直通选路（wrapper 不单独实现选路）。
- **边界**：wrapper 的目标是"一个上游模型 + 静态变换"；需要多候选容错就把目标配成 routing 组（一层间接，仍禁嵌套 pipeline）。
- **记账**：model_in=`cheap-coder`，model_out=`gpt-4o-mini`，token 记在上游，成本按渠道实例价结算。

### Q6 多模型并行生成 + 评审模型整合（MiMe Costly）

- **建模**：pipeline 型分组。对外名 `wise-answer`：
  - `group_candidates`：role=`fanout` × N（N ≤ 4，并行生成）+ role=`judge` × 1（整合）；
  - `config`：`{ "fanout_timeout_ms": 120000, "judge_prompt": "…", "heartbeat_ms": 15000 }`。
- **编排（固定一层 DAG：1→N→1）**：
  1. fanout 并行发出 N 路上游请求（各自独立走 L1/L2/L3 与协议转换）；
  2. 全部完成（或超时截断）后拼装评审 prompt；
  3. judge 流式返回给客户端。**扇出期间客户端连接发 SSE 心跳帧保活**（`: ping\n\n` 注释行），避免代理/客户端超时。
- **约束**：**禁嵌套**——fanout/judge 的候选必须是真实上游模型或 routing/wrapper 组，不得再指向 pipeline 组（防成本爆炸与递归不可控）。
- **记账**：trace_id 串联；每路子请求一行 usage_history，`parent_id` 指向主请求行，`role` 标注 fanout/judge；成本聚合到 trace。

### Q7 模型能力/计费异构（模态、上下文、思考、缓存、阶梯计费）

- **挂载点**：`channel_models` 每行 = 一个 `(channel, upstream_model)` 的能力+计费快照：`modality / context_window / supports_thinking / supports_cache / pricing(JSON)`。
  - 阶梯计费放 `pricing.tiers[]`（按 token 量区间切换单价）。
- **三级解析**（同一字段的三种来源，优先级从高到低）：
  1. **渠道覆盖**（`pricing_source='override'`）：用户在渠道详情手动改价——中转站/自报价场景；
  2. **目录**（`pricing_source='catalog'`，P1 在线目录）：社区维护的价格表按渠道匹配规则下发；
  3. **内置**（`pricing_source='builtin'`）：发版内置的主流模型静态目录。
- **为什么挂渠道实例而非全局模型名**：即 Q10——同名模型在不同渠道价格/上下文不同，全局表表达不了。
- **能力过滤**（P1）：请求可带能力需求（如 vision），选路阶段过滤不满足的候选。

### Q8 上下游协议差异（Chat Completions / Responses / Messages）

- 沿用 DESIGN.md 的 **IR 枢纽**：入口协议（客户端说的）解码到 IR，出口协议（渠道说的）从 IR 编码。**禁止 N² 两两互译**。
- 渠道字段 `channels.protocol` 四选一：`openai-chat / openai-responses / anthropic-messages / gemini`。
- 四个入口（`/v1/chat/completions`、`/v1/responses`、`/v1/messages`、`/v1beta`）与渠道协议**任意组合**：Claude Code（Messages 入口）可以打到 OpenAI 渠道，Gemini 入口可以打到 Anthropic 渠道。
- SSE 转换遵循 DESIGN.md 七条铁律（事件边界、心跳、usage 帧、finish_reason 映射等），此处不重复。

### Q9 供应商模板 + 地区/套餐 endpoint

- **模板（template_id）**：内置供应商定义——协议、鉴权方式、默认 endpoint、默认模型目录、能力默认值。内置主流家 + 允许 `custom` 自建模板。
- **渠道 = 模板 × 变体**：`region`（us/eu/cn…）与 `plan`（official/pro/team/中转套餐）组合出不同的 `base_url` + 计费 + 模型目录。
  - 例：`anthropic` 模板 → 渠道 1「Anthropic 官方·US」、渠道 2「Anthropic 床垫·Pro 套餐」（不同 endpoint、额度语义、价格覆盖）。
- **UI 映射**：新建渠道 = 选模板 → 填变体（region/plan/base_url）→ 密钥池 → 模型目录（默认从模板带出，可改）。

### Q10 同一模型在不同供应商/不同服务下上下文、计费存在差异

- **数据层**：差异天然落在 `channel_models` 多行上（同 canonical、不同渠道，各自 context_window/pricing）。
- **运行时语义**：
  - **计费**：按实际使用的候选行结算（usage_history.cost 依据该行的 pricing）；
  - **上下文/能力对外报告**：`/v1/models` 与错误提示按"当前会话粘住的候选"动态报告，不做虚假的统一值；
  - **分组有效能力**：routing 组的 context_window 取候选交集的最小值用于预检（防止选了小上下文候选后请求被上游拒）——P1 细化。
- **UI 映射**：模型目录页「同名对比」抽屉——选定 canonical_model，跨渠道表格 diff 上下文/单价/缓存价/能力徽章，一眼看出"哪家便宜、哪家上下文大"。

---

## 4. 数据库设计（SQLite DDL v2）

### 4.1 ER 总览

```
api_keys ──< usage_history >── channels ──< connections
                                    │
routes ────────┐                    └──< channel_models
               ▼
          model_groups ──< group_candidates >── (channel, upstream_model)
```

### 4.2 DDL

```sql
PRAGMA journal_mode = WAL;

-- ============ 渠道层 ============
CREATE TABLE channels (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,                -- 'OpenAI 官方' / 'OpenAI 中转·Pro'
  template_id TEXT NOT NULL,                -- openai | anthropic | deepseek | gemini | custom
  protocol    TEXT NOT NULL,                -- openai-chat | openai-responses | anthropic-messages | gemini
  base_url    TEXT NOT NULL,
  auth_type   TEXT NOT NULL DEFAULT 'bearer', -- bearer | x-api-key | query-param
  region      TEXT,                         -- us | eu | cn（模板变体，Q9）
  plan        TEXT,                         -- official | pro | team（模板变体，Q9）
  enabled     INTEGER NOT NULL DEFAULT 1,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name)
);

CREATE TABLE connections (
  id             INTEGER PRIMARY KEY,
  channel_id     INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  api_key_enc    BLOB NOT NULL,             -- AES-256-GCM 密文，主密钥托管 OS 钥匙串
  weight         INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
  model_scope    TEXT,                      -- 可用模型 glob；NULL = 渠道全部（Q2）
  enabled        INTEGER NOT NULL DEFAULT 1,
  circuit_state  TEXT NOT NULL DEFAULT 'closed' CHECK (circuit_state IN ('closed','half_open')),
  cooldown_until TEXT,                      -- L2 终态冷却到期（NULL=正常）；终态永不自动复活
  stats          TEXT,                      -- JSON 滚动窗口：err_rate / p50 / p99
  UNIQUE(channel_id, name)
);

CREATE TABLE channel_models (
  id               INTEGER PRIMARY KEY,
  channel_id       INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  upstream_model   TEXT NOT NULL,           -- 渠道真实模型名
  canonical_model  TEXT NOT NULL,           -- 归一化名（跨渠道聚合键，Q4/Q10）
  context_window   INTEGER,
  modality         TEXT NOT NULL DEFAULT 'text',  -- text|vision|audio 组合（逗号分隔）
  supports_thinking INTEGER NOT NULL DEFAULT 0,
  supports_cache   INTEGER NOT NULL DEFAULT 0,
  pricing          TEXT,                    -- JSON {input, output, cache_hit, cache_write, tiers[]}
  pricing_source   TEXT NOT NULL DEFAULT 'builtin' CHECK (pricing_source IN ('builtin','catalog','override')),
  enabled          INTEGER NOT NULL DEFAULT 1,
  UNIQUE(channel_id, upstream_model)
);
CREATE INDEX idx_cm_canonical ON channel_models(canonical_model);

-- ============ 分组层 ============
CREATE TABLE model_groups (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,         -- 对外暴露的模型名（= 虚拟模型）
  type        TEXT NOT NULL CHECK (type IN ('routing','wrapper','pipeline')),
  config      TEXT NOT NULL DEFAULT '{}',
  -- routing : {"strategy":"weighted|cost_first|latency_first","sticky_n":3,"max_attempts":3}
  -- wrapper : {"system_prompt":"...","param_overrides":{"temperature":0.2}}
  -- pipeline: {"fanout_timeout_ms":120000,"judge_prompt":"...","heartbeat_ms":15000}
  description TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE group_candidates (
  id             INTEGER PRIMARY KEY,
  group_id       INTEGER NOT NULL REFERENCES model_groups(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'main' CHECK (role IN ('main','fanout','judge')),
  channel_id     INTEGER NOT NULL REFERENCES channels(id),
  upstream_model TEXT NOT NULL,
  weight         INTEGER NOT NULL DEFAULT 1,
  priority       INTEGER NOT NULL DEFAULT 100,  -- 层间顺序：priority 值小的先用尽（分层failover）
  enabled        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(group_id, role, channel_id, upstream_model)
);

-- ============ 令牌与路由 ============
CREATE TABLE api_keys (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  token_hash     TEXT NOT NULL UNIQUE,      -- SHA-256；明文仅创建时展示一次
  allowed_models TEXT,                      -- 授权分组名 glob：'team-*|gpt-4o'；NULL=全部（Q3）
  enabled        INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE routes (
  id            INTEGER PRIMARY KEY,
  model_pattern TEXT NOT NULL,              -- 通配：'claude-*'
  target_type   TEXT NOT NULL CHECK (target_type IN ('group','channel')),
  target_id     INTEGER NOT NULL,
  priority      INTEGER NOT NULL DEFAULT 100,
  enabled       INTEGER NOT NULL DEFAULT 1
);

-- ============ 记账 ============
CREATE TABLE usage_history (
  id             INTEGER PRIMARY KEY,
  ts             TEXT NOT NULL DEFAULT (datetime('now')),
  api_key_id     INTEGER REFERENCES api_keys(id),
  trace_id       TEXT NOT NULL,             -- 一次外部请求全程唯一
  parent_id      INTEGER REFERENCES usage_history(id),  -- pipeline 子请求（Q6）
  role           TEXT NOT NULL DEFAULT 'main' CHECK (role IN ('main','fanout','judge')),
  attempt        INTEGER NOT NULL DEFAULT 1, -- 同一逻辑调用的第 N 次尝试（failover 链）
  group_id       INTEGER REFERENCES model_groups(id),
  channel_id     INTEGER REFERENCES channels(id),
  connection_id  INTEGER REFERENCES connections(id),
  model_in       TEXT,                      -- 请求方写的模型名（分组名/直通名）
  model_out      TEXT,                      -- 实际上游模型名
  status         TEXT NOT NULL,             -- ok|l1_tripped|l2_cooldown|l3_locked|upstream_error|timeout|auth
  http_status    INTEGER,
  latency_ms     INTEGER,
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  tokens_cache_r INTEGER NOT NULL DEFAULT 0,
  tokens_cache_w INTEGER NOT NULL DEFAULT 0,
  cost           REAL NOT NULL DEFAULT 0    -- 按所用 channel_models.pricing 结算
);
CREATE INDEX idx_usage_ts ON usage_history(ts);
CREATE INDEX idx_usage_trace ON usage_history(trace_id);
CREATE INDEX idx_usage_key ON usage_history(api_key_id, ts);
```

### 4.3 相对 v1 的 diff

| 变更 | 说明 |
|---|---|
| 新增 `channels` | 供应商模板实例层（Q9）；endpoint/协议从 connection 上移 |
| 新增 `channel_models` | (channel, upstream_model) 能力/计费实例（Q7/Q10），含 canonical 归一化 |
| 新增 `model_groups` + `group_candidates` | **取代 `combos`**；三型统一建模，候选带 role/weight/priority |
| `connections` 增列 | `channel_id`（归属渠道）、`weight`（LB）、`model_scope`（Q2）、故障域状态列 |
| `api_keys` 增列 | `allowed_models` 组名 glob（Q3 令牌绑定） |
| `usage_history` 增列 | `channel_id / group_id / trace_id / parent_id / role / attempt`（trace 树记账） |
| **废弃** | `model_aliases`（被 canonical_model + routes 吸收）、`combos`（被 model_groups 吸收） |

---

## 5. UI/UX 设计

### 5.1 信息架构（页面清单）

| 页面 | 路由 | 核心职责 | 迭代来源 |
|---|---|---|---|
| 仪表盘 | `/`（index.vue） | 渠道健康总览、今日成本、异常告警 | 已有 |
| **渠道** | `/providers`（providers.vue） | 渠道 CRUD + 密钥池 + 模型目录 + 同名对比 | 升级 |
| **分组** | `/groups`（新增 groups.vue） | 三型分组编辑器 + 编排可视化 | **新增** |
| 令牌 | `/keys`（keys.vue） | 令牌管理 + 授权分组 | 增强 |
| 日志 | `/logs`（logs.vue） | trace 树展开 + attempt 链 | 增强 |
| 设置 | `/settings`（settings.vue） | 端口/代理/导入导出/接管 | 已有 |

### 5.2 渠道页（Q1/Q2/Q7/Q9/Q10 的主战场）

三段式详情（左侧渠道列表 + 右侧 Tab）：

1. **概览 Tab**：模板徽章（anthropic）、变体徽章（US · Pro）、协议、endpoint、启用开关。
2. **密钥池 Tab**（Q1/Q2）：表格每行 = connection。
   - 列：名称 / 权重（步进器）/ 模型范围（glob 徽章，hover 展开）/ 熔断状态灯 / 冷却到期 / 实时统计（err% / p50）。
   - 行内操作：**测试连通**、禁用、复位熔断（L1 半开可自动，L2 需人工点"已充值/换 key 后解除"）。
   - 状态灯语义：🟢 closed / 🟡 half_open / 🔴 open / ⚫ cooldown(L2) / ⚪ disabled。
3. **模型目录 Tab**（Q7/Q10）：表格每行 = channel_model。
   - 列：上游名 / canonical（可编辑归一化）/ 上下文 / 能力徽章（vision/thinking/cache）/ 单价（in/out/cache 三列）/ 来源标记（内置/目录/覆盖）。
   - 「同名对比」按钮 → 抽屉：选定 canonical_model，跨渠道 diff 表格（上下文、单价、缓存价、能力），底部提示最优项（"中转 A 便宜 60%，但 cache 单价更高"）。

新建渠道向导：选模板（卡片单选）→ 填变体（region/plan/base_url，模板带默认值）→ 贴 key（可一次贴多行批量建 connections）→ 模型目录确认（默认从模板带出）。

### 5.3 分组页（Q3–Q6 的主战场）

顶部：分组表格（名称 / 类型徽章 routing|wrapper|pipeline / 候选数 / 状态 / 引用令牌数）。

**routing 编辑器**（Q4）：
- 候选行 = 复合选择器 `[渠道 ▾] → [模型 ▾]`（模型列表来自该渠道 channel_models，按 canonical 分组显示）+ weight 步进器 + priority 输入 + 删除。
- 拖拽排序即调 priority；候选支持复制粘贴。
- 底部「解析预览」：模拟一次选路——展示命中的候选、被过滤的 connection 及原因（L1 熔断 / L2 冷却 / model_scope 不含 / 禁用），可诊断"为什么现在会走中转 B"。

**wrapper 编辑器**（Q5）：
- 目标选择器（单选：渠道→模型，或指向一个 routing 组实现"包一层+容错"）。
- system_prompt 多行编辑器（等宽字体）+ 参数覆写表单（temperature/max_tokens/top_p，仅显示覆写项）。
- 实时预览：左侧原始请求 JSON → 右侧变换后 JSON（diff 高亮注入与重写点）。

**pipeline 编辑器**（Q6）：
- 扇出多选（≤4，超出禁选并提示）+ judge 单选；judge_prompt 编辑器。
- **编排可视化**：1→N→1 的 SVG 迷你 DAG 实时预览（节点带渠道色）。
- 参数：fanout_timeout_ms / heartbeat_ms + 「预估单次成本」＝ Σ(候选单价 × 采样 tokens)。
- 嵌套守卫：候选选择器里 pipeline 型分组**置灰不可选**，旁注"pipeline 不可嵌套"。

### 5.4 令牌页（Q3）

- 表格：名称 / 令牌（打码，点击复制）/ 授权分组（glob 徽章）/ 请求数 / 近 7 日成本。
- 编辑抽屉：授权分组 = 分组多选 + glob 输入（二选一或混合）；「可见模型模拟」按钮 = 预览该令牌的 `/v1/models` 返回列表。

### 5.5 日志页（Q6 记账 + failover 可观测）

- 默认表格：时间 / 令牌 / model_in → model_out / 状态 / 延迟 / tokens / 成本。
- **trace 树展开**（行展开）：
  - 主请求行 → attempt 链（横向时间轴小条：attempt 1 在官方失败 L1 → attempt 2 中转成功）；
  - pipeline 请求 → fanout 并行块（N 行并列）+ judge 行，缩进于 parent 下，`role` 徽章着色（fanout=蓝 / judge=紫）。
- 顶部聚合条：本 trace 总成本 / 总 tokens / 总墙钟时间。
- 过滤器：状态（含 L1/L2/L3）、渠道、分组、令牌、时间窗。

### 5.6 视觉与组件约定

- 全量复用 @nuxt/ui v4 组件（UTable/UDataTable 视版本、UDrawer/USlideover、UBadge、UStepper 不引入新依赖）。
- 类型徽章色：routing=蓝、wrapper=琥珀、pipeline=紫；渠道色由模板派生，用于编排图节点与日志着色。
- 高危操作（L2 解除、删除渠道连带密钥）走 UModal 二次确认，明示影响面。

---

## 6. 路线图

| 阶段 | 内容 | 覆盖 |
|---|---|---|
| **P0** | channels+connections 密钥池（SWRR+三级故障域）、routing 型分组、三级名称解析、令牌绑定分组、channel_models 三级计费解析（builtin+override）、usage 记账与日志基础、IR 协议转换（已有设计） | Q1 Q2 Q3 Q4 Q7(基础) Q8 |
| **P1** | wrapper 型、pipeline 型（含心跳帧）、同名对比抽屉、能力过滤、cost_first 策略、sticky 指纹完善、解析预览 | Q5 Q6 Q10(可视化) |
| **P2** | pricing 在线目录（catalog）、订阅号计费语义、自定义模板市场 | Q7(增强) Q9(增强) |

---

## 7. 开放问题

| # | 问题 | 当前倾向 |
|---|---|---|
| 1 | sticky 会话指纹怎么算 | 请求前缀 N-token hash（保留 prompt cache 命中率），但多轮会话消息增长会漂移；备选 client 侧 session id 头（非标） |
| 2 | 订阅号（Claude Pro 等）计费语义 | 非按量付费，cost 记 0 + 单独"额度消耗"计数？还是折算虚拟价？待定 |
| 3 | pipeline 心跳帧兼容性 | SSE comment 行 `: ping` 理论全兼容，但个别 SDK 严格解析事件流需实测（openai-python / anthropic-sdk / gemini-sdk） |
| 4 | canonical 目录维护 | 内置目录随版本更新；目录(pricing catalog)上线前的空窗期依赖 override 手填 |
