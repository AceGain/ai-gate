# 品牌图标

`@ai-gate/brand-icons` 是框架无关的内部包，维护 LobeHub PNG 资源、品牌目录和持久化 ID 别名。Vue 组件、首字母回退、自定义图片上传和 HTTP 图片地址由应用维护。

## 使用

应用声明 `"@ai-gate/brand-icons": "workspace:*"`。需要图片 URL 时导入包入口；仅需品牌列表时使用不引入图片的目录入口：

```ts
import { resolveBrandIcon } from '@ai-gate/brand-icons'
import { brandIconOptions } from '@ai-gate/brand-icons/catalog'

const imageUrl = resolveBrandIcon('openai', true)
```

资源由应用构建工具打包，无运行时 CDN 请求。有彩色变体时优先使用彩色资源；彩色与单色品牌都支持亮色、暗色资源。生成时比较彩色资源内容，相同的亮暗资源仅引用一份。缺少暗色资源时回退亮色资源。未知 ID 返回空串，交由应用展示回退内容。

## 数据来源

- PNG 依赖使用精确版本，由仓库的 pnpm 锁文件记录完整性信息。
- `metadata/brands.json` 是上游品牌元数据的规范化快照。
- `upstream.json` 记录资源版本、元数据版本、固定 Git 提交、来源 URL 和 SHA-256。
- `LICENSE.lobehub` 保留对应上游提交的 MIT 许可。
- 历史 ID 别名独立维护。上游删除或重命名品牌时，先处理已保存配置的兼容性，再接受更新。

普通安装、生成、检查和应用构建只读取已安装的固定依赖与仓库快照。只有显式执行更新命令时访问网络；更新工具读取 JSON，不安装或执行上游 React 组件包。

## 更新

在仓库根目录执行，版本号替换为本次明确选择的上游发行版本。静态资源包与元数据包独立发布，版本号不要求相同。

```sh
pnpm --filter @ai-gate/brand-icons add --save-exact @lobehub/icons-static-png@<资源精确版本>
pnpm update:brand-icons --metadata-version <元数据精确版本>
pnpm generate:brand-icons
pnpm check:brand-icons
pnpm test:brand-icons
pnpm build:web
```

只刷新当前固定版本的元数据时可运行 `pnpm update:brand-icons`。更新工具会从 npm 发行信息找到固定 Git 提交，再读取该提交的元数据及许可证；校验全部完成后才改写快照。

更新发现已有品牌被删除时会失败。确认上游移除后，可为更新命令追加 `--allow-removals`；此参数只允许更新元数据快照，不会跳过后续的持久化 ID 兼容性检查。品牌重命名时，为旧品牌 ID 增加指向新品牌的别名，同时将原有历史别名直接指向新品牌。资源依赖、锁文件、元数据、来源记录、别名和生成结果应在同一次变更中审查，重点核对新增、移除以及明暗主题下的显示变化。

## 本地与 CI 检查

```sh
pnpm install --frozen-lockfile
pnpm check:brand-icons
pnpm test:brand-icons
pnpm build:web
```

`pnpm generate:brand-icons` 更新生成文件；`pnpm check:brand-icons` 验证元数据和资源的完整性以及生成结果是否同步，检查模式不会改写文件。

生成和检查还会从 Git 基准提交读取已提交的品牌目录与别名。默认基准是 `HEAD`，因此删除或重新生成工作区中的目录文件不能绕过历史 ID 检查。旧品牌 ID 和旧别名必须继续可解析；历史别名也不能被改指向无关品牌。

可以指定基准提交，检查已经提交的更新是否兼容此前版本：

```sh
pnpm check:brand-icons --base-ref <基准提交或引用>
```

未指定 `--base-ref` 时可通过环境变量 `BRAND_ICONS_BASE_REF` 提供基准。CI 完整拉取 Git 历史，在 PR 中使用目标分支的基准 SHA，在推送中使用推送前的 SHA，首次推送没有上一提交时使用 `HEAD`。这样，即使 PR 已包含重新生成的目录，CI 仍会对照更新前的品牌 ID 和别名。

基准引用无效、尚未拉取，或基准包的目录及别名文件不完整时，检查会失败；先拉取对应提交再重试。只有内部包在该有效基准提交中完全不存在时，才按首次引入处理。兼容性回归测试使用临时 Git 仓库，覆盖删除后重新生成、别名移除与改指向、合法品牌重命名及无效基准等更新流程。
