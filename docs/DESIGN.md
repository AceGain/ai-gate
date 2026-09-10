# AI Gate 前端设计规范与设计系统 (DESIGN.md)

> **版本**：v1.0.0  
> **适用范围**：AI Gate Web 端（Nuxt 4）与桌面端（Tauri 2）全量 UI 界面  
> **设计哲学**：**Mira 风格** —— 高密度（Dense）、数据密集型（Data-Heavy）、极简利落、开发者工具质感（Developer-Centric）

---

## 1. 核心设计哲学与基调

AI Gate 是一款面向开发者与高级用户的 AI 网关产品，核心任务是高效率地聚合供应商、路由模型、分发密钥和监控调用。设计语言必须服务于**信息直达与操作效率**。

### 1.1 Mira 风格三大核心原则
1. **高信息密度优先与内容驱动（Compact & Content-Driven Density）**：
   - 杜绝无意义的装饰性留白与巨幅插画，追求紧凑、利落、直达的开发者工具质感；
   - **内容决定高度，梯度保障韵律**：杜绝一刀切式的僵化像素限制。列表与卡片的高度应由其承载的内容丰富度（图标尺寸、文本行数、标签与状态指标）自然决定，并通过统一的 4px/8px 间距阶梯（`py-2` ~ `py-3.5`、`gap-2.5` ~ `gap-3.5`）保持视觉节奏；
   - 控件尺寸遵循层级规律：常规快捷按钮默认 `xs`，模态框与重要表单控件采用 `sm`，操作图标采用 `size-4`。
2. **严谨结构与利落边界（Crisp Borders & Micro-surfaces）**：
   - 使用极细分割线（1px `border-default`）和微层级背景（`bg-elevated`）建立层次，而非大面积弥散阴影；
   - 圆角采用 **Small Radius (`0.25rem` / 4px)**，呈现严谨、专业的桌面原生软件质感，拒绝松垮的大圆角。
3. **沉浸双模与色彩节制（Semantic & Restrained Color）**：
   - 主界面遵循中性低饱和背景（暗色/浅色均走 Nuxt UI 语义 Token），高亮仅用于状态指标、Switch 开关、操作焦点；
   - 杜绝花哨的渐变与多色混杂，通过字体层级与 Badge 变体（`subtle`）清晰传达信息。

### 1.2 组件优先原则（Nuxt UI Component-First）
* **优先使用官方组件**：界面中的交互单元（如 `<UTabs>`, `<UButton>`, `<USwitch>`, `<UBadge>`, `<UDropdownMenu>`, `<UModal>` 等）必须 100% 优先采用 Nuxt UI 官方组件，**严禁**随意使用原生 HTML 标签手写替代（例如严禁用原生 `<button>` 拼接手写 Tab 切换条、手写 Switch 开关等）。
* **无障碍与规范保证**：Nuxt UI 组件内置 Reka UI 的无障碍支持（A11y、ARIA 属性、键盘导航与焦点管理），并具备完善的语义 Token 挂载机制；
* **样式定制收敛**：若需对组件视觉微调，必须通过官方提供的 `variant`、`color`、`size`、`ui` 属性配置或官方插槽（如 `#leading`、`#trailing`、`#list-trailing` 等）进行微调，不得跳过官方组件手写基础交互部件。

---

## 2. 基础设计 Tokens 与排版体系

### 2.1 基础配置与变量
* **全局字体**：统一采用 `Inter` 作为西文/数字主字体，系统字体作为后备（`--font-sans: 'Inter', system-ui, sans-serif;`）。
* **代码/标识字体**：API Key、Model ID、Endpoint URL、Provider Code 等技术标识与正文统一使用 **Inter** 字体。
* **圆角大小**：`--ui-radius: 0.25rem;`（即 `rounded-sm` / 4px）。
* **桌面端标题栏**：`--ui-header-height: 2rem;`（32px，Windows 11 原生高度，全宽拖拽区 `data-tauri-drag-region`）。

### 2.2 语义化颜色对照表（必须遵守）
**严禁**在页面中手写具象 Tailwind 颜色类（如 `bg-gray-100`, `text-slate-400`, `dark:bg-zinc-900`），必须严格使用 Nuxt UI v4 语义 Token：

| 语义角色 | 标准类名 | 适用场景 | 反模式（禁止） |
| :--- | :--- | :--- | :--- |
| **主背景** | `bg-default` | 页面最底层承载面、输入框内部背景 | `bg-white dark:bg-black` |
| **提升层背景** | `bg-elevated` | 标题栏、卡片、侧边栏悬浮项、下拉菜单面板 | `bg-zinc-100 dark:bg-zinc-900` |
| **交互半透提升** | `bg-elevated/50` | 列表项 Hover 悬浮、微弱底色 | `hover:bg-gray-50` |
| **标准细边框** | `border-default` | 卡片边框、表格分割线、Tab 下划线 | `border-gray-200 dark:border-zinc-800` |
| **高亮强文本** | `text-highlighted` | 卡片标题、激活态 Tab、关键数字 | `text-black dark:text-white font-bold` |
| **默认正文** | `text-default` | 普通文字、表格单元格正文、按钮文字 | `text-gray-800 dark:text-gray-200` |
| **次要描述** | `text-muted` | 字段说明、副标题、未激活 Tab、输入框占位符 | `text-gray-500 dark:text-gray-400` |
| **极弱/装饰文本** | `text-dimmed` | 拖拽手柄、禁用状态文字、图标辅助 | `text-gray-300 dark:text-zinc-600` |
| **主品牌色** | `bg-primary` / `text-primary` | 激活指示条、开关开启态、主要操作按钮 | `bg-indigo-600 text-blue-500` |
| **危险/错误** | `text-error` / `bg-error` | 删除按钮 hover、错误 Badge、失败状态 | `text-red-500 hover:text-red-600` |

### 2.3 控件基准尺寸规范
在 `app.config.ts` 中已注入全局默认值，编写新页面时原则上不需要手动指定尺寸；若需覆盖，请遵循以下级别：
* 按钮（`<UButton>`）：默认 `size="xs"`（高密度快捷操作），模态框主操作按钮可使用 `size="sm"`。
* 表单控件（`<UInput>`, `<USelectMenu>`, `<USwitch>`）：统一 `size="sm"`。
* 状态徽标（`<UBadge>`）：列表与标签中统一使用 `size="xs"` 或 `size="sm"`，默认使用 `variant="subtle"`。
* 图标（`<UIcon>`）：常规操作图标统一 `class="size-4"`，微型图标 `class="size-3.5"`。

### 2.4 内容驱动的行高与卡片密度梯度（Density Hierarchy）

界面中的行高与卡片尺寸**严禁一刀切死板限制**，必须根据承载的内容复杂度与视觉主体自适应，划分为四个梯度：

| 密度层级 | 参考高度 (min-h) | 典型场景 | 核心元素组合 | 间距与留白 |
| :--- | :--- | :--- | :--- | :--- |
| **L1: 紧凑数据行 (Compact Row)** | `36px ~ 44px` | 数据表格、密钥列表、纯文本明细、请求流日志 | 单行正文、微徽标（`size="xs"`）、快捷操作图标 | `py-1.5 ~ py-2` |
| **L2: 标准条目/设置项 (Standard Item)** | `48px ~ 56px` | 偏好设置项、轻量开关列表、简易规则项 | 功能图标（`size-4` ~ `size-5`）、单行标题 + Switch 开关 | `py-2.5`、`gap-2.5` |
| **L3: 实体/特征卡片 (Entity Card)** | `64px ~ 80px` | 供应商卡片、虚拟模型卡片、规则路由条目 | 品牌/实体图标（`size-10` ~ `size-11`，40~44px）、主副两行信息（名称+描述）、状态标签、操作组 | `py-3 ~ py-3.5`、`gap-3` |
| **L4: 复合概览卡片 (Rich Composite)** | `80px+`（自适应） | 拓扑路由节点、指标监控卡片、模型降级链路 | 复杂多行信息、指标大字、迷你折线图、多状态指示器 | `p-4`、`gap-3.5` |

> **核心原则**：
> - **主体决定高度**：当存在 40px 的品牌图标或多行描述时，卡片必须提供舒适的上下边距（12px+），切忌为追求所谓的“绝对紧凑”而将内容硬挤在窄小高度内导致图标微缩变形；
> - **弹性下限与防抖**：使用 `min-h-[...]` 作为弹性下限而非固定 `h-[...]`，在文本长短不一或折行时保持平滑自适应；加载骨架屏高度必须与真实卡片严格对齐。

---

## 3. 页面标准结构与布局规范

所有页面根结构必须使用 Nuxt UI Dashboard 的 `<UDashboardPanel>`，并在 `#header` 插槽接入 `<AppNavbar>`。

```vue
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
    <template #header>
      <AppNavbar>
        <template #right>
          <!-- 页面级右侧主操作，如新增、刷新、导出 -->
          <UButton icon="i-lucide-plus" variant="ghost">{{ t('common.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <!-- 内容承载区：必须自带滚动与统一内边距 -->
      <div class="h-full overflow-y-auto p-4">
        <!-- 页面具体内容 -->
      </div>
    </template>
  </UDashboardPanel>
</template>
```

---

## 4. 三大标准页面范式（Page Archetypes）

在 AI Gate 中新增页面时，必须选择以下三种范式之一进行构建，禁止自创杂乱排版。

### 范式 A：卡片与条目列表页（Card / Item List Archetype）
* **适用场景**：供应商列表（Providers）、预设路由规则列表、虚拟模型卡片列表等。
* **设计逻辑**：
  - 一行一条独立卡片，通过统一间距（`gap-2.5` ~ `gap-3`）平铺；
  - **高度由层级自适应**：遵循 Section 2.4 密度梯度。轻量条目采用 L2（~48-56px），具有品牌实体的卡片采用 L3（~64-80px，40px 品牌图标 + 双行信息与可选徽章）；
  - **模块清晰对齐**：左侧为主体区（拖拽手柄/品牌图标），中部为弹性信息区（标题、描述、标签），右侧为状态控制与操作组。
* **代码规范结构（以 L3 实体卡片为例）**：
```vue
<div class="flex flex-col gap-2.5">
  <div
    v-for="item in list"
    :key="item.id"
    class="flex min-h-[64px] select-none items-center gap-3 rounded-sm border border-default bg-default px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-elevated/50"
  >
    <!-- 1. 拖拽手柄（可选） -->
    <div class="drag-handle -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-dimmed hover:bg-elevated hover:text-default">
      <UIcon name="i-lucide-grip-vertical" class="size-4" />
    </div>

    <!-- 2. 供应商/品牌图标（size-10 / 40px） -->
    <ProviderIcon :icon="item.icon" :name="item.name" size="md" />

    <!-- 3. 信息区 -->
    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
      <span class="truncate text-sm font-medium" :class="item.enabled ? 'text-highlighted' : 'text-dimmed'">
        {{ item.name }}
      </span>
      <p v-if="item.description" class="truncate text-xs text-muted">{{ item.description }}</p>
    </div>

    <!-- 4. 状态开关 -->
    <USwitch v-model="item.enabled" class="shrink-0" />

    <!-- 5. 操作组 -->
    <div class="flex items-center gap-1 shrink-0">
      <UButton icon="i-lucide-settings-2" variant="ghost" color="neutral" class="text-muted hover:text-default" />
      <UButton icon="i-lucide-trash-2" variant="ghost" color="error" class="text-muted hover:text-error" />
    </div>
  </div>
</div>
```

---

### 范式 B：分栏/标签页配置详情页（Master-Detail Archetype）
* **适用场景**：供应商详情（`providers/[id].vue`）、网关全局设置、日志详情查看。
* **视觉特征**：
  - 顶部导航区（返回按钮置于 Navbar 右侧 `#right` 插槽，避免与左侧侧栏折叠按钮冲突；面包屑居中；当前标题无多余徽章；快捷全局开关）；
  - 下划线 Tab 栏：**优先使用 `<UTabs>` 组件**（`variant="link"`、`color="neutral"`、`:content="false"`，自带激活指示条与无障碍键盘导航；Tab 项通过 `items` 传入 `icon` 与 `badge`；右侧操作按钮通过 `#list-trailing` 插槽同轴对齐）；
  - 内容分组卡片，区块边界清晰。
* **Tab 栏规范实现**：
```vue
<UTabs
  v-model="activeTab"
  :items="tabs"
  variant="link"
  color="neutral"
  :content="false"
  class="w-full"
  :ui="{
    list: 'border-b border-default',
    indicator: '-bottom-px h-0.5 bg-primary',
    trigger: 'cursor-pointer'
  }"
>
  <!-- Tab 栏右侧上下文操作按钮（通过 #list-trailing 插槽与 Tab 切换项同行对齐） -->
  <template #list-trailing>
    <div class="ms-auto flex items-center">
      <UButton icon="i-lucide-plus" variant="ghost" size="xs" @click="openCreate">
        {{ t('common.add') }}
      </UButton>
    </div>
  </template>
</UTabs>
```
* **Tabs 数据项定义规范（`TabsItem[]`）**：
```ts
import type { TabsItem } from '@nuxt/ui'

const tabs = computed<TabsItem[]>(() => [
  {
    value: 'endpoints',
    label: t('providerEndpoints.title'),
    icon: 'i-lucide-route',
    badge: endpoints.value.length > 0 ? {
      label: String(endpoints.value.length),
      color: 'neutral',
      variant: 'subtle',
      size: 'xs'
    } : undefined
  },
  {
    value: 'keys',
    label: t('providerKeys.title'),
    icon: 'i-lucide-key',
    badge: keys.value.length > 0 ? {
      label: String(keys.value.length),
      color: 'neutral',
      variant: 'subtle',
      size: 'xs'
    } : undefined
  }
])
```

---

### 范式 C：监控与概览仪表盘页（Dashboard / Metric Archetype）
* **适用场景**：首页总览（`index.vue`）、调用量监控大盘。
* **视觉特征**：
  - 顶部 KPI 指标卡片网格（网格间距 `gap-3`，紧凑卡片，左侧大数字，右侧小微图标，下部环比/状态）；
  - 中部实时图表与调用速率（QPS / 延迟 / 成功率）；
  - 底部快速日志或请求流。

---

## 5. 状态反馈与交互规范

### 5.1 空状态（Empty State）
空状态严格遵循 Mira 极简哲学，**不要图标**，也**无需在空态区放置引导动作按钮**（页面操作入口统一收敛在顶部 `<AppNavbar>` 的 `#right` 插槽），纯净呈现：
```vue
<div class="flex min-h-full items-center justify-center p-4">
  <UEmpty
    :title="t('common.empty')"
    variant="naked"
  />
</div>
```

### 5.2 弹窗与抽屉（Modal & Slideover）
* **宽度控制**：严禁无限制全屏或过宽弹窗。表单模态框统一使用 `class="sm:max-w-md"` 或 `sm:max-w-lg`。
* **背景、阴影与层级**：弹窗属于最高层级浮窗，背景必须为 `bg-default`（严禁使用与浅色遮罩混淆的 `bg-elevated`），圆角为 `rounded-sm`，搭配外边框 `border border-default` 与明确的立体投影（`shadow-xl`）；遮罩层统一采用半透明暗色遮罩（`bg-black/40 backdrop-blur-xs`），确保产生清晰的纵深与聚焦效果。
* **破坏性二次确认**：
  - 严禁调用原生 `window.confirm()`；
  - 必须使用内置组合式函数 `useConfirmDialog()` 或 `<ConfirmRemoveModal>`。

---

## 6. AI 页面生成验收清单（Checklist）

在编写或审查任何新页面代码时，必须逐一验证以下 8 项：

- [ ] **1. 布局基座**：是否以 `<UDashboardPanel>` 为根且正确挂载 `<AppNavbar>`？
- [ ] **2. 风格对齐**：是否属于三大范式（A卡片列表/B配置详情/C概览大盘）之一？
- [ ] **3. 颜色 Token**：是否 100% 采用语义 Token（`border-default`, `bg-elevated`, `text-muted` 等），有无写死具象色？
- [ ] **4. 密度适配与层级合理**：是否依据密度梯度（L1~L4）合理配置控件与容器尺寸？操作按钮优先使用 `size="xs"`，关键表单控件使用 `size="sm"`，品牌主体图标（40~44px）与常规操作图标（`size-4`）层级分明，避免机械追求紧凑而挤压内容视觉主体。
- [ ] **5. 圆角与字体**：全局圆角是否统一为 small (`rounded-sm`)？全站字体统一使用 Inter（严禁使用 `font-mono`）？
- [ ] **6. 状态覆盖**：是否完整处理了数据加载中骨架、极简空态（`<UEmpty :title="t('common.empty')" variant="naked" />`，无图标与操作按钮）和操作后 `toast` 提示？
- [ ] **7. 国际化同步**：页面上所有文字是否均使用 `t('...')` 并且在 `i18n/locales/zh-CN.json` 与 `en-US.json` 双语添加？
- [ ] **8. 桌面端可用性**：是否适配 Tauri 窗口高度（无不可控溢出滚动条，内部区域滚动良好）？
