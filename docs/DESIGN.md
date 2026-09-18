# AI Gate 前端设计规范 (DESIGN.md)

> 适用范围：AI Gate Web 端（Nuxt 4 + Nuxt UI v4）与桌面端（Tauri 2）全部 UI。
> 基调：高信息密度、数据密集、利落边界的开发者工具质感。

约定分三层：「必须」只用于**强制底线**（§1）与**项目强制基线**（§3 滚动职责），偏离需给出理由并记录；其余章节为**默认参考**，底线不破即可深思熟虑地偏离。§3 页面范式是项目选择而非框架要求（Nuxt 支持按页选择布局）。

## 1. 四条底线（强制）

1. **组件来源**：交互单元（按钮、开关、Tab、下拉、弹窗等）一律用 Nuxt UI 官方组件，不手写基础交互——自绘会丢失 Reka UI 的 A11y、键盘导航与焦点管理。视觉微调只走 `variant` / `color` / `size` / `ui` 属性或官方插槽。
2. **语义 Token**：颜色只用语义类，不写具象色与 `dark:` 变体（如 `bg-gray-100`、`text-blue-500`）。主题色 `primary`/`neutral` 允许用户自定义（`app/app.vue` 持久化），写死必然出错。例外仅限 §1.3 白名单。
3. **国际化**：用户可见文案一律 `t('...')`，`i18n/locales/` 下 zh-CN 与 en-US 双份同步。
4. **无障碍基线**：见 §1.2。纯图标按钮必须带 `aria-label`（需悬浮说明时补 `title`）；Nuxt UI 只保证控件级 A11y，页面整体无障碍由页面作者负责。

### 1.1 语义 Token 速查

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

完整语义集还有 `text-toned`、`text-inverted`、`bg-muted`、`bg-accented`、`bg-inverted`、`border-muted`、`border-accented`，按语义就近取用。

### 1.2 无障碍基线（强制）

Nuxt UI 已提供键盘导航、焦点管理与 ARIA 关联，页面只需正确使用。全部页面至少满足：

- **全键盘操作**：按组件语义用 Tab、方向键、Enter/Space（复合控件 roving tabindex，子项不要求独立 Tab 停靠点）；无键盘陷阱与不可达功能；
- **焦点可见**：保留默认焦点环，不得 `outline: none`、不得被固定层遮挡；仅 hover 显示的控件在 `focus-visible` 时同样可见；
- **标签与输入关联**：通过 `UForm` / `UFormField` 关联 label、错误与帮助文本，不手写旁置错误节点；
- **弹窗焦点管理**：焦点进入弹窗、Esc 关闭、关闭后回到触发元素；确认类弹窗的 Esc/关闭一律按「取消」，不得用 `dismissible=false` 屏蔽 Esc；
- **状态不只靠颜色**：启用/失效、成功/失败必须有文字或图标，不能只靠红绿；
- **对比度**：正文 ≥ 4.5:1，大号文本 ≥ 3:1；占位符与次要文本同样 4.5:1；
- **指针目标**：≥ 24×24 CSS px 或满足 WCAG 2.2 间距例外；默认尺寸（按钮 `sm` 28px、其余控件 `md`）已满足，开关 `xs` 为组件固有偏小尺寸（靠关联标签点击与空格键兜底），更小 `size` 需实测命中区域；
- **放大与重排**：200% 放大不丢内容；320 CSS px 等效宽度下重排、无横向滚动（二维内容除外，见 §6.1）。

依据：WCAG 2.2（1.4.1、1.4.3、1.4.10、2.1.1、2.4.3、2.4.7、2.5.7、2.5.8、3.3.2）。

### 1.3 具象色白名单（集中定义）

仅三类具象色，必须定义为 `app/assets/css/main.css` 专用 Token，组件只引用：

- **平台 chrome**：`--ui-titlebar-*`（Windows 11 基线，见 §6.2）；
- **模态遮罩**：`--ui-overlay`（`app.config.ts` modal overlay 引用）；
- **品牌色卡**：`--chip-light` / `--chip-dark`，由 `ColorSelect.vue` 按数据注入。

## 2. 全局配置是单源，页面不要重复（默认）

字体、圆角、标题栏、弹窗样式与页面骨架已集中配置，控件尺寸已统一为全局默认（按钮/徽章 `sm`、开关 `xs`，其余控件 Nuxt UI 内置 `md`）。新页面直接用默认值，不要重复覆盖：

| 项 | 值 | 位置 |
| --- | --- | --- |
| 字体 | Inter；`--font-mono` 也映射为 Inter。代码/JSON 需对齐阅读时局部引入等宽字体，不改全局基线 | `app/assets/css/main.css` |
| 圆角 | 全局无圆角：`--ui-radius: 0rem`，`rounded-xs`~`rounded-3xl` 随之全部归零（`rounded-full` 不受影响）；代码中不写局部圆角类 | `app/assets/css/main.css` |
| 标题栏 | `--ui-header-height: 2rem`，全宽 `data-tauri-drag-region`；平台外观见 §6.2 | `app/assets/css/main.css` + `app/app.vue` |
| 控件默认尺寸 | 按钮与徽章全局默认 `sm`、开关 `xs`（sm 视觉上比 sm 按钮偏大），其余控件用 Nuxt UI 内置默认（`md`）；页面不传 `size` | `app/app.config.ts` `defaultVariants` |
| 弹窗 | 背景/边框/阴影/遮罩/宽度 | `app/app.config.ts` |
| 页面骨架 | `dashboardPanel` 的 `#body` 全局 `overflow-hidden min-h-0 p-0 gap-0`（滚动职责见 §3） | `app/app.config.ts` |

- 个别场景确需偏离默认 `size` 时就地传参（如紧凑图标按钮），并按 §1.2 实测指针目标；
- `ui` 覆盖前先看生成的 `.nuxt/ui/<component>.ts`，避免重复默认类；
- 应用入口已用 `<UApp>` 同步 Nuxt UI locale（`app/app.vue`），新页面无需重复包裹。

## 3. 页面结构

默认页面根为 `<UDashboardPanel>`，`#header` 挂 `<AppNavbar>`；全屏空白页等形态可不用 Panel，但必须满足 §1 底线：

```vue
<UDashboardPanel>
  <template #header>
    <AppNavbar>
      <template #right><!-- 页面级操作：新增 / 刷新 / 返回 --></template>
    </AppNavbar>
  </template>
  <template #body>
    <!-- 列表 p-4；详情 p-4 sm:p-6 + mx-auto max-w-5xl -->
    <div class="h-full overflow-y-auto p-4"><!-- ... --></div>
  </template>
</UDashboardPanel>
```

### 滚动职责（单一模式，项目强制基线）

`#body` 不滚动（全局 `overflow-hidden min-h-0`），**页面内容容器是唯一滚动源**，不形成嵌套滚动。验收标准是「页面只有一个滚动源」——嵌套滚动在放大、动态高度下才会暴露。加载 / 有数据 / 空态 / 不存在各分支必须包在同一个有高度约束的滚动容器里（外层 `h-full overflow-y-auto`，内部需居中再套 `min-h-full`），避免空态被裁切且无法滚动。

### UTabs 项目约定

- 默认用组件内容插槽（`items[].slot`），由 Nuxt UI 生成 `tabpanel` 与 ARIA 关联；`variant="link"`，`#list-trailing` 放当前 Tab 操作按钮，间距走 `ui.content`（如 `pt-6`），不依赖外层 `space-y-*`；
- 确需分离内容（跨 Tab 保持 DOM 等）才用 `:content="false"`，并自行补齐 `role="tabpanel"`、`id` / `aria-labelledby` / `aria-controls` 及方向键与 `tabindex` 处理（WAI-ARIA Tabs Pattern）；
- 页面级操作收敛到 Navbar `#right`（含详情页返回），不与侧栏折叠按钮抢位。

```vue
<UTabs
  v-model="activeTab" :items="tabs" variant="link" color="neutral" class="w-full"
  :ui="{ list: 'border-b border-default', indicator: '-bottom-px h-0.5 bg-primary', trigger: 'cursor-pointer', content: 'pt-6' }"
>
  <template #list-trailing><div class="ms-auto flex items-center"><!-- 当前 Tab 操作 --></div></template>
  <template #endpoints><!-- 与 items[].slot 对应 --></template>
</UTabs>
```

## 4. 布局与密度（默认参考）

高度与间距由内容驱动：4px/8px 阶梯（`gap-2.5`~`gap-3.5`、`py-2`~`py-3.5`），`min-h-*` 优于固定 `h-*`。

| 形态 | 典型内容 | 参考 |
| --- | --- | --- |
| 数据行 | 单行正文 + 微徽标 + 图标操作 | `py-1.5` ~ `py-2` |
| 设置项 | 图标 + 标题 + `USwitch` | `py-2.5` |
| 实体卡片 | 40~44px 品牌图标 + 主副两行 + 状态/操作组 | `min-h-[64px] py-3` |
| 复合卡片 | 多行指标 / 图表 / 多状态指示 | `p-4` 起，留给内容 |

参照页面（示例而非模板）：

- 名称层级：分组/小节标题 `font-semibold text-highlighted`；行内实体名常规字重不加粗，不与标题争层级（见 `ModelGroup.vue`）；
- 列表页 `app/pages/providers/index.vue`：左图标 / 中弹性信息 / 右开关与操作，hover `ring-primary/40 bg-elevated/50`；
- 详情页 `app/pages/providers/[id].vue`：Navbar 面包屑 + `UTabs` 分栏；
- 仪表盘尚未建设：届时按 KPI 网格 + 图表 + 日志流组织。

## 5. 状态反馈与表单

### 5.1 状态反馈

- **加载**：统一 `AppLoading`（居中旋转图标 + 文案），不做与内容同构的骨架屏；
- **空态**：默认 `<UEmpty variant="naked" />` 极简呈现（操作入口在 Navbar），区分首次使用 / 搜索无结果 / 请求失败三类文案；
- **持续错误**：失败必须保留可操作的重试入口（`UEmpty` / `UAlert`），不能只弹一次 Toast；
- **结果**：成功 / 失败用 `useToast()`（全局右下角，3 秒）；
- **表单弹窗**：保存失败不关弹窗、不重置输入；提交期间 `loading` 禁用交互防重复提交；未保存修改在关闭 / 离开前提示或提供放弃入口；
- **二次确认**：破坏性操作用 `useConfirmDialog()` / `<ConfirmRemoveModal>`，禁止 `window.confirm`；
- **弹窗宽度**：表单弹窗 `sm:max-w-md` ~ `sm:max-w-lg`，样式继承全局配置。

### 5.2 表单

- 用 `UForm` + `UFormField`（`name` + schema 或自定义校验）组织，错误就近关联到输入；字段校验失败就地展示，不用 Toast 代替；
- 校验库不强制，但错误展示与关联必须走 `UFormField`。

## 6. 响应式与平台差异

### 6.1 Web 重排（强制底线验收）

- 200% 放大不丢失内容/功能；320 CSS px 等效宽度下重排、无横向滚动（数据表 / 图表除外，但须提供滚动容器）；
- 窄窗口策略：侧栏折叠为图标（`AppSidebar` 按 1024px 断点）；Navbar 操作可换行或收入「更多」；Tab 栏可横向滚动；长文本截断留 `title`；数据表整体横滚优于压缩列；
- Tauri 最小窗口尺寸（`minWidth` / `minHeight`）不能替代上述要求。

### 6.2 桌面窗口（Tauri）

- **标题栏**：全宽 `data-tauri-drag-region`，交互控件不带拖拽区；32px 是 Windows 11 常规基线，其他平台 / 高缩放按内容调整；
- **窗口状态**：最大化 / 还原图标随状态更新（`useWindowControls`）；系统菜单保持默认不自绘；关闭按钮关当前窗口，与「退出应用」的关系引入托盘 / 多窗口时再定义；
- **文字缩放**：依赖 CSS px + 系统 DPI，不用固定像素锁死布局。

### 6.3 Tauri 拖拽排序

- 统一 `useSortable`，手柄挂 `.drag-handle`；`forceFallback: true` 是跨 Web / 桌面的已验证策略（`tauri.conf.json` 已设 `dragDropEnabled: false`，保留 fallback 仅为两端行为一致）；
- **仅拖拽排序（项目决定，A11y 例外）**：不渲染上移 / 下移按钮或菜单。该选择不满足 WCAG 2.2 §2.5.7 / §2.1.1，属有意识接受的一致性缺口；未来面向 AA 合规应优先恢复行内排序菜单。手柄对辅助技术隐藏（`aria-hidden`）。

## 7. 提交前检查

- [ ] 颜色全部语义 Token（具象色仅限 §1.3 白名单，且经专用 Token）；
- [ ] 交互控件来自 Nuxt UI，微调走官方属性/插槽；
- [ ] 尺寸与圆角走全局默认：不传 `size`、不写局部 `rounded-*`（`rounded-full` 除外）；
- [ ] 文案全部 i18n，中英双份同步；
- [ ] 图标按钮有 `aria-label`；页面键盘可达、焦点可见；
- [ ] 页面只有一个滚动源（`#body` 不滚动）；加载 / 数据 / 空态 / 不存在各分支都有滚动出口；
- [ ] Tab 内容优先走组件内容插槽；分离时 `tabpanel` / ARIA 关联齐全；
- [ ] 排序仅走拖拽手柄（项目接受的例外，见 §6.3）；
- [ ] 加载统一 `AppLoading`（不做骨架屏）；空态三类（首次 / 无结果 / 失败）与重试入口齐全；
- [ ] 表单错误就近展示，保存失败保留输入，防重复提交；
- [ ] 320px 等效宽度 + 200% 放大可用（二维内容例外）；
- [ ] `pnpm typecheck` 通过。
