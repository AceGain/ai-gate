# AI Gate 前端设计规范 (DESIGN.md)

> 适用范围：AI Gate Web 端（Nuxt 4 + Nuxt UI v4）与桌面端（Tauri 2）全部 UI。
> 基调：高信息密度、数据密集、利落边界的开发者工具质感。

本文只强制 **四条底线**；其余尺寸、密度、页面形态均为**默认参考**。当默认值与实际内容冲突时，以内容与可用性为准，可以偏离——前提是底线不破，且偏离是深思熟虑的结果而非随手写。

## 1. 四条底线

1. **组件来源**：交互单元（按钮、开关、Tab、下拉、弹窗等）一律使用 Nuxt UI 官方组件，不手写基础交互——自绘会丢失 Reka UI 的 A11y、键盘导航与焦点管理。视觉微调只走 `variant` / `color` / `size` / `ui` 属性或官方插槽。
2. **语义 Token**：颜色只用 Nuxt UI 语义类，禁止具象色（`bg-gray-100`、`dark:bg-zinc-900`、`text-blue-500` 等）。语义 Token 自动适配明暗主题，不需要手写 `dark:` 变体。主题色 `primary`/`neutral` 允许用户自定义（见 `app/app.vue` 的持久化逻辑），写死颜色必然出错。
3. **国际化**：用户可见文案一律 `t('...')`，`i18n/locales/zh-CN.json` 与 `en-US.json` 双份同步。
4. **无障碍**：纯图标按钮必须带 `aria-label`（需要悬浮说明时补 `title`）。

### 语义 Token 速查

| Token | 用途 |
| --- | --- |
| `bg-default` | 页面最底层、输入框底色 |
| `bg-elevated` / `bg-elevated/50` | 标题栏、卡片、悬浮面板 / 列表 hover |
| `border-default` | 边框、分割线、Tab 下划线 |
| `text-highlighted` | 标题、激活项、关键数字 |
| `text-default` | 正文 |
| `text-muted` | 说明、次要文本、未激活项 |
| `text-dimmed` | 占位符、禁用、装饰性元素 |
| `primary` / `secondary` / `success` / `info` / `warning` / `error` / `neutral` | 品牌、状态、操作反馈与中性 chrome |

完整语义集还包括 `text-toned`、`text-inverted`、`bg-muted`、`bg-accented`、`bg-inverted`、`border-muted`、`border-accented`，按语义就近取用（以 Nuxt UI 主题文档为准）。

## 2. 全局配置是单源，页面不要重复

字体、圆角、标题栏、控件默认尺寸、弹窗样式都已集中配置，新页面直接使用默认值，不要在每个文件里重复覆盖：

| 项 | 值 | 位置 |
| --- | --- | --- |
| 字体 | Inter；`--font-mono` 也映射为 Inter（无等宽字体） | `app/assets/css/main.css` |
| 圆角 | `--ui-radius: 0.25rem` 为基准，Nuxt UI 依此派生 `rounded-sm`=4px、`rounded-md`=6px；页面卡片/容器统一 `rounded-sm`，组件内部圆角交给 Nuxt UI | `app/assets/css/main.css` |
| 标题栏 | `--ui-header-height: 2rem`，全宽 `data-tauri-drag-region` | `app/assets/css/main.css` + `app/app.vue` |
| 控件默认尺寸 | 按钮/徽标/Tab `xs`，输入/选择/开关/复选 `sm` | `app/app.config.ts` |
| 弹窗 | 背景/边框/圆角/阴影/遮罩/宽度 | `app/app.config.ts` |

- 调整全局默认优先改 `app.config.ts` 的 `defaultVariants`，页面只在偏离默认时传参（例如模态框主操作按钮 `size="sm"`）；
- 覆盖要就地可读，不要为"统一"牺牲表单可用性；`ui` 覆盖前先看生成的 `.nuxt/ui/<component>.ts`，避免重复默认类。

## 3. 页面结构

页面根必须为 `<UDashboardPanel>`，`#header` 挂 `<AppNavbar>`：

```vue
<UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
  <template #header>
    <AppNavbar>
      <template #right><!-- 页面级操作：新增 / 刷新 / 返回 --></template>
    </AppNavbar>
  </template>
  <template #body>
    <!-- 内容区自带滚动与内边距：列表 p-4；详情 p-4 sm:p-6 + mx-auto max-w-5xl -->
    <div class="h-full overflow-y-auto p-4"><!-- ... --></div>
  </template>
</UDashboardPanel>
```

- `UDashboardPanel` 的 `#body` 默认自带 `overflow-y-auto p-4 sm:p-6 gap-4`；项目统一覆盖为 `p-0 gap-0`，由页面内容容器负责留白与滚动，列表/详情各取所需。
- 页面级操作统一收敛到 Navbar `#right`（含详情页返回），避免与侧栏折叠按钮抢位。

## 4. 布局与密度

高度与间距由内容驱动，不设死值：用 4px/8px 阶梯（`gap-2.5`~`gap-3.5`、`py-2`~`py-3.5`）保持节奏，用 `min-h-*` 而非固定 `h-*`。常见参考：

| 形态 | 典型内容 | 参考 |
| --- | --- | --- |
| 数据行 | 单行正文 + 微徽标 + 图标操作 | `py-1.5` ~ `py-2` |
| 设置项 | 图标 + 标题 + `USwitch` | `py-2.5` |
| 实体卡片 | 40~44px 品牌图标 + 主副两行 + 状态/操作组 | `min-h-[64px] py-3` |
| 复合卡片 | 多行指标 / 图表 / 多状态指示 | `p-4` 起，留给内容 |

现有页面可直接参照（是示例而非模板）：

- 列表页：`app/pages/providers/index.vue`（左图标 / 中弹性信息 / 右开关与操作，hover 用 `border-primary/40 bg-elevated/50`）；
- 详情页：`app/pages/providers/[id].vue`（Navbar 面包屑 + `UTabs` 分栏）；
- 仪表盘：尚未建设，建设时按 KPI 网格 + 图表 + 日志流组织。

### UTabs 项目约定

下划线 Tab 沿用统一的 `ui` 覆盖，操作按钮经 `#list-trailing` 与 Tab 同行：

```vue
<UTabs
  v-model="activeTab"
  :items="tabs"
  variant="link"
  color="neutral"
  :content="false"
  class="w-full"
  :ui="{ list: 'border-b border-default', indicator: '-bottom-px h-0.5 bg-primary', trigger: 'cursor-pointer' }"
>
  <template #list-trailing>
    <div class="ms-auto flex items-center"><!-- 当前 Tab 的新增等操作 --></div>
  </template>
</UTabs>
```

## 5. 状态反馈

- **加载**：`USkeleton` 骨架必须与真实内容同尺寸，避免加载完成时跳动；
- **空态**：默认 `<UEmpty variant="naked" />` 极简呈现，无图标无按钮（操作入口在 Navbar）；确需引导时按需扩展；
- **结果**：操作成功/失败用 `useToast()` 提示（全局右下角显示，持续时间 3 秒）；
- **二次确认**：删除等破坏性操作使用 `useConfirmDialog()` / `<ConfirmRemoveModal>`，禁止 `window.confirm`；
- **弹窗**：样式继承全局配置；表单弹窗宽度控制在 `sm:max-w-md` ~ `sm:max-w-lg`。

## 6. 桌面端（Tauri）

- 滚动发生在页面内容容器（`#body` 内）内部，不要让整个窗口出现滚动条；
- 拖拽排序统一 `useSortable` + `forceFallback: true`（WebView2 会拦截原生 HTML5 drag），手柄挂 `.drag-handle`。

## 7. 提交前检查

- [ ] 颜色全部为语义 Token，无具象色；
- [ ] 交互控件来自 Nuxt UI，微调走官方属性/插槽；
- [ ] 文案全部 i18n，中英双份同步；
- [ ] 图标按钮有 `aria-label`；
- [ ] 加载 / 空态 / 成功失败反馈齐全，骨架与内容等高；
- [ ] 页面在 Tauri 窗口内滚动正常；
- [ ] `pnpm typecheck` 通过。
