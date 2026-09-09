# AGENTS.md

AI 网关：聚合多供应商/多密钥，对外提供 OpenAI 兼容入口。

一套代码、两种发行形态：Web 端（Nuxt + Hono 原生支持）与桌面端（Tauri 壳）。

## 技术栈（约定，必须遵守）

- 全栈统一使用 TypeScript 作为主要编程语言，使用 **pnpm** 作为包管理器

- 前端：Nuxt 4 + Nuxt UI v4 + Tailwind CSS 4 + `@nuxtjs/i18n`（默认 zh-CN）

- 后端：Hono + Drizzle ORM + @libsql/client（SQLite）

- 桌面：Tauri 2（Rust）

## 常用命令

```bash
pnpm dev                # Nuxt dev，端口 9255（strictPort，Tauri 依赖此端口）；/api 经 devProxy 代理到 9256
pnpm dev:api            # Hono 后端 dev（tsx watch，端口 9256，AI_GATE_PORT 可覆盖）
pnpm dev:all            # 前后端同时启动（concurrently -k，供 tauri dev 使用）
pnpm tauri dev          # 桌面开发（自动执行 pnpm dev:all 同时拉起前端 9255 与后端 9256）
pnpm tauri build        # 桌面打包（自动执行 pnpm generate 产出到 dist/）
pnpm typecheck          # 唯一验证手段（无 lint / test），前端 vue-tsc + 后端 tsc，提交前必跑
pnpm db:generate        # 根据 server/src/schema/ 生成 Drizzle SQL 迁移文件
pnpm db:studio          # 启动 Drizzle Studio 可视化管理 SQLite 数据库
```

## 目录与结构

- `docs/` — 项目架构与设计规范单源（`docs/DESIGN.md` 页面设计规范、`docs/database-design.md` 数据库设计）

- `app/` — Nuxt 4 目录结构（pages/ components/ composables/ layouts/ utils/），非旧版根目录结构

- `shared/` — 前后端共用的纯 TS 模块（供应商类型/协议元数据/预置供应商），不得引入 Nuxt 或浏览器特有 API

- `server/` — Hono 后端（src/schema/ 单源 Schema、drizzle/ SQL 迁移、src/routes 管理 API、src/store.ts 持久化）；生产形态直接服务 `dist/`

- `src-tauri/` — Rust 侧；lib 名为 `ai_gate_lib`（Windows 下 lib/bin 命名冲突问题，勿改名）

## 前端 UI 与页面设计规范（强约定，必须遵守）

- **设计单源**：创建或修改任何页面/组件前，必须严格对照并遵循 `docs/DESIGN.md`。
- **组件优先**：优先使用 Nuxt UI 官方提供的组件（如 `<UTabs>`, `<UButton>`, `<USwitch>`, `<UBadge>` 等），严禁随意手写原生 HTML 标签拼凑基础交互组件。
- **风格定位**：统一遵循 **Mira 风格**（高密度 Dense、数据密集型 Data-Heavy、极简严谨、无冗余装饰）。
- **字体与圆角**：全站所有文字与技术标识（Key / Code / URL / ID）统一使用 **Inter**，严禁使用 `font-mono`；全局圆角为 **small**（`--ui-radius: 0.25rem` / `rounded-sm`）。
- **语义 Token**：100% 使用 Nuxt UI 语义类（如 `bg-default`, `bg-elevated`, `border-default`, `text-highlighted`, `text-muted`, `text-dimmed` 等），**严禁**硬编码具象 Tailwind 色阶（如 `bg-zinc-800`）。
- **页面架构**：所有页面根节点必须使用 `<UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">`，并在 `#header` 插槽挂载 `<AppNavbar>`。
- **三大范式**：页面布局严格在三大范式中归位（A卡片列表 / B配置详情 / C概览大盘），禁止自创松散排版。
- **状态闭环**：每个页面必须处理完整生命周期：加载骨架（Skeleton）、极简空态（`<UEmpty :title="t('common.empty')" variant="naked" />`，无图标与操作按钮）、操作反馈（`toast`）与删除二次确认（`useConfirmDialog`）。

## 注意事项

- `nuxt.config.ts` 中 `telemetry: false` 和 `TAURI_DEV_HOST` 相关配置是为 Tauri dev 流程服务的，勿删

- Tauri dev 在无 TTY 环境运行 `pnpm dev`，避免在 dev 流程中引入交互式提示

- i18n 文案：用户可见文本必须走 i18n（两个 locale 文件同步更新），不要硬编码中文或英文

- 不要查阅目录 `mine` 中的内容，更不可作为设计依据；

