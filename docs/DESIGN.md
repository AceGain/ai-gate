# AI Gate 前端设计规范 (DESIGN.md)

> 适用范围：AI Gate Web 端（Nuxt 4 + Nuxt UI v4）与桌面端（Tauri 2）全部 UI。
> 基调：高信息密度、数据密集、利落边界的开发者工具质感。

本文把约定分成三层，避免把项目选择误读成框架官方要求：

- **强制底线（§1，共 4 条）**：所有页面必须遵守，偏离必须给出明确理由并在评审中记录；
- **项目强制基线（§3 滚动职责）**：`#body` 不滚动、页面内容容器是唯一滚动源；已由 `app.config.ts` 全局落地；
- **默认参考（其余章节）**：尺寸、密度、页面范式与本项目约定。与内容冲突时可以偏离，前提是底线不破，且偏离是深思熟虑的结果。

文中「必须」只用于底线与项目强制基线；默认参考一律使用「默认」「建议」「项目约定」表述。Nuxt 本身支持按页选择布局与结构，§3 的页面范式是项目选择而非框架要求。

## 1. 四条底线（强制）

1. **组件来源**：交互单元（按钮、开关、Tab、下拉、弹窗等）一律使用 Nuxt UI 官方组件，不手写基础交互——自绘会丢失 Reka UI 的 A11y、键盘导航与焦点管理。视觉微调只走 `variant` / `color` / `size` / `ui` 属性或官方插槽。
2. **语义 Token**：颜色只用 Nuxt UI 语义类，不写具象色（`bg-gray-100`、`dark:bg-zinc-900`、`text-blue-500` 等）。语义 Token 自动适配明暗主题，不需要手写 `dark:` 变体。主题色 `primary`/`neutral` 允许用户自定义（见 `app/app.vue` 的持久化逻辑），写死颜色必然出错。唯一例外是平台 chrome、模态遮罩与品牌色卡，必须集中定义为专用 CSS Token（见 §1.3）。
3. **国际化**：用户可见文案一律 `t('...')`，`i18n/locales/zh-CN.json` 与 `en-US.json` 双份同步。
4. **无障碍基线**：见 §1.2。纯图标按钮必须带 `aria-label`（需要悬浮说明时补 `title`），但 `aria-label` 只是基线的一部分；Nuxt UI 只保证控件级 A11y，页面整体无障碍仍由页面作者负责。

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

完整语义集还包括 `text-toned`、`text-inverted`、`bg-muted`、`bg-accented`、`bg-inverted`、`border-muted`、`border-accented`，按语义就近取用（以 Nuxt UI 主题文档为准）。

### 1.2 无障碍基线（强制）

Nuxt UI 组件已提供键盘导航、焦点管理与 ARIA 关联，页面只需正确使用；页面级要求如下，全部页面至少满足：

- **全键盘操作**：所有功能均可通过键盘完成，按组件语义使用 Tab、方向键、Enter/Space；复合控件（Tabs、菜单、单选组等）采用 roving tabindex，Tab 进入控件后由方向键在子项间移动，不要求每个子项都成为独立 Tab 停靠点；无键盘陷阱与不可达功能；
- **焦点可见**：保留 Nuxt UI 默认焦点环，不得 `outline: none`，焦点元素不得被固定层完全遮挡；仅 hover 显示的控件必须在 `focus-visible` 时同样可见；
- **标签与输入关联**：表单控件优先通过 `UForm` / `UFormField` 关联 label、错误与帮助文本，不手写旁置错误节点；
- **弹窗焦点管理**：使用 `UModal` / `USlideover` / `UPopover`，焦点进入弹窗、Esc 可关闭、关闭后回到触发元素；确认类弹窗的 Esc/关闭一律按「取消」处理，不得用 `dismissible=false` 屏蔽 Esc；
- **状态不只靠颜色**：启用/失效、成功/失败等状态必须有文字或图标（如 `UBadge`、`UIcon`），不能只靠红绿区分；
- **对比度**：正文文本 ≥ 4.5:1；大号文本（≥24px 常规字重，或 ≥18.67px 粗体）≥ 3:1；占位符、次要文本同样适用 4.5:1 基线；
- **指针目标**：点击目标 ≥ 24×24 CSS px，或满足 WCAG 2.2 的间距例外；`size="xs"` 本身不违规，但要实测实际命中区域，必要时扩大热区；
- **放大与重排**：文字放大至 200% 不丢失内容或功能；适用内容在等效 320 CSS px 宽度下重排、无横向滚动（数据表/图表等二维内容除外，见 §6.1）。

依据：WCAG 2.2（1.4.1、1.4.3、1.4.10、2.1.1、2.4.3、2.4.7、2.5.7、2.5.8、3.3.2）。

### 1.3 具象色白名单（集中定义）

只允许以下三类具象色，且必须定义在 `app/assets/css/main.css` 的专用 Token 中，组件只引用 Token：

- **平台 chrome**：窗口标题栏控件的系统观感，`--ui-titlebar-*`（Windows 11 基线，见 §6.2）；
- **模态遮罩**：全屏遮罩的系统观感，`--ui-overlay`（`app.config.ts` 的 modal overlay 引用）；
- **品牌色卡**：颜色选择器展示的品牌色阶，`--chip-light` / `--chip-dark` 由 `ColorSelect.vue` 按数据注入。

除这三类外，组件中禁止出现具象色与 `dark:` 颜色变体。

## 2. 全局配置是单源，页面不要重复（默认）

字体、圆角、标题栏、控件默认尺寸、弹窗样式与页面骨架都已集中配置，新页面直接使用默认值，不要在每个文件里重复覆盖：

| 项 | 值 | 位置 |
| --- | --- | --- |
| 字体 | Inter；`--font-mono` 也映射为 Inter（无等宽字体）。代码/JSON/日志如需对齐阅读，按任务在局部引入等宽字体，不改全局基线 | `app/assets/css/main.css` |
| 圆角 | 全局无圆角：`--ui-radius: 0rem`，Nuxt UI 派生的 `rounded-xs`~`rounded-3xl` 随之全部归零（`rounded-full` 不受影响）；禁止再为圆角做任何局部覆盖 | `app/assets/css/main.css` |
| 标题栏 | `--ui-header-height: 2rem`，全宽 `data-tauri-drag-region`；平台外观见 §6.2 | `app/assets/css/main.css` + `app/app.vue` |
| 控件默认尺寸 | 按钮/徽标/Tab `xs`，输入/选择/开关/复选 `sm` | `app/app.config.ts` |
| 弹窗 | 背景/边框/阴影/遮罩/宽度（圆角已全局归零，见上） | `app/app.config.ts` |
| 页面骨架 | `dashboardPanel` 的 `#body` 全局为 `overflow-hidden min-h-0 p-0 gap-0`（滚动职责见 §3），页面无需重复传 `ui` | `app/app.config.ts` |

- 调整全局默认优先改 `app.config.ts` 的 `defaultVariants`，页面只在偏离默认时传参（例如模态框主操作按钮 `size="sm"`）；
- 覆盖要就地可读，不要为"统一"牺牲表单可用性；`ui` 覆盖前先看生成的 `.nuxt/ui/<component>.ts`，避免重复默认类；
- 应用入口已使用 `<UApp>` 并同步 Nuxt UI locale（`app/app.vue`），新页面无需重复包裹。

## 3. 页面结构

默认页面根为 `<UDashboardPanel>`，`#header` 挂 `<AppNavbar>`（这是项目约定；Nuxt 支持按页选择布局，全屏空白页等形态可不用 Panel，但必须满足 §1 底线）：

```vue
<UDashboardPanel>
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

### 滚动职责（单一模式，项目强制基线）

`#body` 不滚动，只负责填满高度与裁切（全局配置 `overflow-hidden min-h-0`）；**页面内容容器是唯一的滚动源**，负责留白与滚动。不要在 `#body` 与内容容器之间形成嵌套滚动。

- 验收标准是「页面只有一个滚动源」，不能只以「窗口不出现滚动条」为准——嵌套滚动在放大、动态高度下才会暴露；
- **所有状态（加载 / 有数据 / 空态 / 不存在）都必须包在同一个有高度约束的滚动容器里**：外层 `h-full overflow-y-auto`，内部需要居中时再套 `min-h-full`，避免空态分支在内容超出可用高度时被裁切且无法滚动。

### UTabs 项目约定

- **默认使用组件内容插槽**：`items[].slot` 指定每个 Tab 所需的内容插槽，由 Nuxt UI 生成 `tabpanel`、`aria-controls`、`aria-labelledby` 与键盘焦点关系；
- `variant="link"`、`#list-trailing` 放置当前 Tab 操作按钮等外观/布局约定不变；
- 内容与 Tab 栏之间的间距由 `ui.content`（如 `pt-6`）提供，不再依赖外层 `space-y-*`；
- **确需分离内容**（内容必须放在 Tabs 之外、需跨 Tab 保持 DOM 等）时才用 `:content="false"`，此时必须自行补齐：面板容器 `role="tabpanel"`、`id` 与 `aria-labelledby` 指向对应 trigger，trigger 侧维护 `aria-controls`，并按 WAI-ARIA Tabs Pattern 处理方向键与 `tabindex`。

```vue
<UTabs
  v-model="activeTab"
  :items="tabs"
  variant="link"
  color="neutral"
  class="w-full"
  :ui="{ list: 'border-b border-default', indicator: '-bottom-px h-0.5 bg-primary', trigger: 'cursor-pointer', content: 'pt-6' }"
>
  <template #list-trailing>
    <div class="ms-auto flex items-center"><!-- 当前 Tab 的新增等操作 --></div>
  </template>
  <template #endpoints><!-- 与 items[].slot 对应 --></template>
</UTabs>
```

- 页面级操作默认收敛到 Navbar `#right`（含详情页返回），避免与侧栏折叠按钮抢位；这是项目约定，可因页面内容调整。

## 4. 布局与密度（默认参考）

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

## 5. 状态反馈与表单

### 5.1 状态反馈

- **加载**：`USkeleton` 骨架必须与真实内容同尺寸，避免加载完成时跳动；
- **空态**：默认 `<UEmpty variant="naked" />` 极简呈现，无图标无按钮（操作入口在 Navbar）；确需引导时按需扩展，并区分首次使用、搜索无结果、请求失败三类场景的文案与操作；
- **持续错误**：请求失败必须保留可操作的重试入口（`UEmpty` / `UAlert` 带重试按钮），不能只弹一次 Toast 就丢失上下文；
- **结果**：操作成功/失败用 `useToast()` 提示（全局右下角显示，持续时间 3 秒）；
- **保存失败**：弹窗不关闭、表单输入不重置，允许修正后重试；
- **防重复提交**：提交期间 `loading` 绑定按钮并禁用交互；
- **未保存修改**：关闭弹窗/离开页面前提示（路由守卫或 `beforeunload`），或提供显式放弃入口；
- **二次确认**：删除等破坏性操作使用 `useConfirmDialog()` / `<ConfirmRemoveModal>`，禁止 `window.confirm`；
- **弹窗**：样式继承全局配置；表单弹窗宽度控制在 `sm:max-w-md` ~ `sm:max-w-lg`。

### 5.2 表单

- 默认通过 `UForm` + `UFormField`（`name` + schema 或自定义校验）组织，错误信息由组件就近关联到输入，不手写错误节点；
- 字段校验失败就地展示，不用 Toast 代替字段错误；
- 校验库不作强制，可选任意 schema 方案，但错误展示与关联必须走 `UFormField`。

## 6. 响应式与平台差异

### 6.1 Web 重排（强制底线验收）

- 文字放大 200% 不丢失内容/功能；适用内容在等效 320 CSS px 宽度下重排、不出现横向滚动（数据表、图表等二维内容除外，但必须提供滚动容器）；
- 窄窗口默认策略：侧栏折叠为图标模式（`AppSidebar` 已按 1024px 断点处理）；Navbar 操作组允许换行或收入「更多」；Tab 栏允许横向滚动；长文本截断并保留 `title`；数据表优先整体横向滚动而非压缩列；
- 桌面窗口的最小尺寸（Tauri `minWidth` / `minHeight`）不能替代上述 Web 重排要求。

### 6.2 桌面窗口（Tauri）

- **标题栏**：全宽 `data-tauri-drag-region` 拖拽区，交互控件不带拖拽区；32px（`--ui-header-height: 2rem`）是 Windows 11 常规基线，其他平台或高缩放下按内容调整，不作所有平台的固定答案；
- **窗口状态**：最大化/还原必须有区分图标并随窗口状态更新（`useWindowControls`）；活动/非活动窗口在引入平台定制时需有视觉区分；
- **系统菜单**：保持系统默认（右键标题栏），不自绘替代；
- **文字缩放**：依赖 CSS px + 系统 DPI，不用固定像素锁死布局；
- **关闭与退出**：关闭按钮关闭当前窗口；「关闭窗口」与「退出应用」的关系在引入托盘/多窗口时单独定义，当前单窗口形态下两者等价。

### 6.3 Tauri 拖拽排序

- 统一 `useSortable`，手柄挂 `.drag-handle`；
- `forceFallback: true` 是本项目跨 Web/桌面的已验证策略，保留即可；但要明确真实条件：**Tauri 内部拖放处理器启用时会替换 WebView2 的拖放实现并拦截 HTML5 drag**，而本项目 `tauri.conf.json` 已设 `dragDropEnabled: false`，因此保留 fallback 是为了两端行为一致，不是因为当前配置仍会被拦截；
- **排序仅保留拖拽（项目决定，A11y 例外）**：列表只提供 `.drag-handle` 拖拽排序，不额外渲染上移/下移按钮或菜单。该选择不满足 WCAG 2.2 §2.5.7（拖拽需单击替代）与 2.1.1（键盘可操作），属于有意识接受的一致性缺口；如未来面向 AA 合规或键盘用户，应优先恢复行内排序菜单（上移/下移），而不是新增常驻按钮。拖拽手柄对辅助技术隐藏（`aria-hidden`），避免暴露不可操作控件。

## 7. 提交前检查

- [ ] 颜色全部为语义 Token（具象色仅限 §1.3 白名单，且经专用 Token）；
- [ ] 交互控件来自 Nuxt UI，微调走官方属性/插槽；
- [ ] 文案全部 i18n，中英双份同步；
- [ ] 图标按钮有 `aria-label`；页面键盘可达、焦点可见；
- [ ] 页面只有一个滚动源（`#body` 不滚动，内容容器滚动）；加载/数据/空态/不存在各分支都有滚动出口；
- [ ] Tab 内容优先走组件内容插槽；分离时 `tabpanel` / ARIA 关联齐全；
- [ ] 排序仅通过拖拽手柄触发，未渲染重复的排序控件（一致性缺口见 §6.3，属于项目接受的例外）；
- [ ] 加载 / 空态（首次、搜索无结果、请求失败三类）/ 成功失败反馈齐全，失败保留重试入口；骨架与内容等高；
- [ ] 表单错误就近展示，保存失败保留输入，防重复提交；
- [ ] 320px 等效宽度 + 200% 放大可用（二维内容例外）；
- [ ] `pnpm typecheck` 通过。
