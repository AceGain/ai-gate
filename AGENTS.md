# AGENTS.md

AI 网关：聚合多供应商/多密钥，对外提供 OpenAI 兼容入口。

一套代码、两种发行形态：Web 端（Nuxt + Hono 原生支持）与桌面端（Tauri 壳）。

## 技术栈（约定，必须遵守）

- 全栈统一使用 TypeScript 作为主要编程语言，使用 **pnpm** 作为包管理器
- 前端：Nuxt 4 + Nuxt UI v4 + Tailwind CSS 4 + `@nuxtjs/i18n`（默认 zh-CN）
- 后端：Hono，承载网关数据面 + 管理 API + 服务 Nuxt 静态资源；尚未落地，新增后端时遵循此约定
- 桌面：Tauri 2（`src-tauri/`，Rust 壳，目前仅 opener 插件）

## 常用命令

```bash
pnpm dev                # Nuxt dev，端口 1420（strictPort，Tauri 依赖此端口）
pnpm tauri dev          # 桌面开发（自动执行 pnpm dev 作为 beforeDevCommand）
pnpm tauri build        # 桌面打包（自动执行 pnpm generate 产出到 dist/）
pnpm typecheck          # 唯一验证手段（无 lint / test），提交前必跑
```

## 目录与结构

- `app/` — Nuxt 4 目录结构（pages/ components/ composables/ layouts/ utils/），非旧版根目录结构
- `src-tauri/` — Rust 侧；lib 名为 `ai_gate_lib`（Windows 下 lib/bin 命名冲突问题，勿改名）

## 注意事项

- `nuxt.config.ts` 中 `telemetry: false` 和 `TAURI_DEV_HOST` 相关配置是为 Tauri dev 流程服务的，勿删
- Tauri dev 在无 TTY 环境运行 `pnpm dev`，避免在 dev 流程中引入交互式提示
- i18n 文案：用户可见文本必须走 i18n（两个 locale 文件同步更新），不要硬编码中文或英文
- 不要查阅目录 `mine` 中的内容，更不可作为设计依据；
