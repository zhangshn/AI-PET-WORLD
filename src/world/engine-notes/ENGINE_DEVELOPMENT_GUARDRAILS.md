# AI-PET-WORLD World Engine Development Guardrails

## 1. 文档定位

本文档是 AI-PET-WORLD 世界引擎、生成层、渲染层、视觉模型层和前端呈现层的开发红线。

当前最高依据：

1. `AI-PET-WORLD MVP完整计划书 v1.5`
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`

若旧 README、旧 docs/mvp、旧测试报告与以上三份正式文档冲突，以三份正式文档为准。

## 2. 最高原则

1. 世界事实先于画面。
2. 规则生成先于渲染。
3. 布局由 seed、人格、资源、事件和规则共同生成，不能固定模板化。
4. 自动生成内容必须进入结构化容器。
5. FormalVisualModel 是正式视觉模型容器。
6. FormalWorldView 只读渲染，不生成模型，不生成世界事实。
7. Debug View 与 Formal World View 分离。
8. 宠物后置，petState 必须可选。
9. 当前正式 MVP 不再使用旧孵化器 / 胚胎 / 默认宠物开局路线。
10. 旧文档只能作为历史参考，不能作为当前实现依据。

## 3. 当前正式 MVP 红线

当前正式 MVP 禁止：

1. 重新引入旧孵化器作为正式设定。
2. 重新引入 embryo / hatching / incubating 默认路线。
3. 初始世界默认生成 pet actor。
4. 初始世界默认生成 pet bed。
5. 初始世界默认生成 pet_arrival / pet_rest。
6. 初始世界默认构造 PetRuntimeContext。
7. 用 CSS 隐藏旧事实来替代清理正式链路。
8. 把宠物素材定义当作初始世界事实。
9. 让旧 docs/mvp 或旧测试报告覆盖三份正式文档。

当前正式 MVP 允许开局出现：

1. 管家。
2. 第一片家园。
3. 基础资源。
4. 初始入口区。
5. 初始照护区。
6. 临时住所。
7. 安静生活区。
8. 工具储备区。
9. 自然边界。
10. 世界状态。

宠物未来能力保留，但只能通过：

```text
LifeEvent
-> CompanionDecision
-> accept_companion
```

后置进入。

## 4. 世界事实红线

世界事实只能来自：

1. HomeMapState。
2. WorldState。
3. MapDiff。
4. EventLog。
5. placements。
6. validated world-loop / SafeApply 输出。

禁止：

1. Renderer 生成世界事实。
2. FormalWorldView 生成世界事实。
3. UI 状态伪造世界对象。
4. proposal / unvalidated diff 被当作现实。
5. debug scenario result 被当作正式世界事实。
6. assetId / PNG 反向决定世界对象是否存在。

## 5. 非固定布局红线

必须满足：

```text
同一 seed + 同一状态
-> 稳定可复现

不同人格 / seed / 资源 / 事件状态
-> 布局可观察差异
```

禁止：

1. 每个玩家使用同一固定地图。
2. 前端组件固定摆放房子、树、道路、设施、管家。
3. 为了视觉好看绕过 PlacementEngine。
4. 刷新后无规则随机变化。
5. layout recipe 直接成为最终固定画面。

## 6. Renderer / FormalVisualModel / FormalWorldView 红线

Renderer 可以读取 VisualState / RenderableWorldSnapshot / VisualPlacement / DrawCommand / EntityGeometry。

Renderer 不能：

1. 生成 placement。
2. 生成 actor。
3. 修改 HomeMapState。
4. 修改 WorldState。
5. 读取 proposal 当现实。
6. 读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
7. 为了视觉效果伪造对象。
8. 参与 world-loop / persistence / construction / placement 决策。

FormalVisualModel 必须来自：

```text
VisualState / RenderableWorldSnapshot
```

FormalVisualModel 不能：

1. 生成不存在的世界对象。
2. 生成 placement。
3. 修改 HomeMapState / WorldState / VisualState。
4. 读取 proposal 当现实。
5. 伪造 actor 或 pet。
6. 绕过 petState 可选规则。

FormalWorldView 只能只读 FormalVisualModel。

FormalWorldView 禁止：

1. 生成 FormalWorldVisualItem。
2. 生成 FormalActorVisualItem。
3. buildFormalWorldVisualItems。
4. buildFormalActorVisualItems。
5. 决定树、房子、道路、设施、管家、宠物怎么存在。
6. 生成 actor / placement。
7. 填默认 anchor。
8. 修改 VisualState / HomeMapState。
9. 读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
10. 显示 raw tags / source diagnostics / audit internals。
11. 在 petState 不存在时显示默认宠物。

## 7. Debug View 红线

Debug View 可以显示工程信息，但不能伪装成最终玩家 UI。

Debug View 可以显示 grid、raw tags、diagnostics、source labels、collision、support、influence、actor debug flags、anchorSource、reason strings。

正式 /world 不能默认显示以上内容。

## 8. PNG / WORLD_MAP_ASSETS 红线

PNG / WORLD_MAP_ASSETS 可以作为表现资源候选，但不能作为世界事实来源。

正确关系：

```text
世界对象先进入 HomeMapState / placements
-> VisualState
-> FormalVisualModel
-> Renderer 选择表现资源
```

禁止：

1. 因为有 tree.png 就让树存在。
2. 因为有 house.png 就让房子存在。
3. 因为有 pet.png 就让宠物存在。
4. 用 backgroundImage 作为正式世界对象主路径。
5. 用 assetId 反推对象存在。
6. 绕过 FormalVisualModel 直接贴图做正式世界。

## 9. 已完成阶段红线记录

| 阶段 | 当前结论 |
|---|---|
| P8-I-RESET | 旧 FormalWorldView 手写路线已作废，禁止恢复。 |
| VISUAL-MODEL-00 | FormalVisualModel schema 已完成。 |
| VISUAL-MODEL-01 | FormalVisualGenerator 纯函数层已完成。 |
| FORMAL-VIEW-00 | FormalWorldView 只读组件已完成。 |
| FORMAL-VIEW-01 | preview mock 只能用于开发预览，不能进入正式数据流。 |
| FORMAL-VIEW-02 | /world 正式接入前检查已完成。 |
| FORMAL-VIEW-03 | /world 已从真实 snapshot 构建 FormalVisualModel。 |
| FORMAL-VIEW-04 | 默认 Formal，Debug 保留，Both 用于开发对照。 |
| WORLD-GEN-00 | 世界生成链路审计已完成。 |
| MVP-ALIGN-01 | 旧孵化器 / 默认宠物链路审计已完成。 |
| WORLD-GEN-01A/B | 正式首屏旧文案清理与默认 pet runtime 断开已完成。 |
| MVP-ALIGN-02 | 正式链路中的旧孵化器 / 默认宠物 / pet_arrival / pet_rest 已清理。 |
| MVP-ALIGN-03 | 当前文档体系对齐模块，禁止修改运行时代码。 |

## 10. MVP-ALIGN-03 文档体系红线

MVP-ALIGN-03 只处理文档体系：

1. 允许修复乱码计划文档。
2. 允许清理 README 中的旧设定。
3. 允许给旧 docs/mvp 加 legacy 声明。
4. 允许给旧测试报告加 historical 声明。
5. 允许新增模块完成文档。

MVP-ALIGN-03 禁止：

1. 修改 placement-engine。
2. 修改 initial-home-generator。
3. 修改 initial-home-scene-recipe。
4. 修改 HomeMapState schema。
5. 修改 runtime-context schema。
6. 修改 WorldEngine。
7. 删除宠物未来能力。
8. 新增 UI。
9. 新增 mock。
10. 读取 PNG / WORLD_MAP_ASSETS。
11. 破坏 FormalVisualModel / FormalWorldView。

## 11. 每轮开发必须回答

每轮开发开始前必须打印并确认：

1. 当前阶段。
2. 本轮做什么。
3. 本轮不做什么。
4. 允许修改文件。
5. 禁止修改文件。
6. 是否固定布局。
7. 是否组件生成模型。
8. 是否生成世界事实。
9. 是否生成 placement。
10. 是否生成 actor。
11. 是否读取 PNG / WORLD_MAP_ASSETS。
12. 是否接入 pet。
13. 完成后去哪里看。
14. 如何验证。

## 12. 验收门槛

每轮必须通过：

```text
npm run lint
npx tsc --noEmit
npm run build
```

如果本轮只改文档，也仍然需要确认：

1. 文档为 UTF-8。
2. 文档无乱码。
3. 文档无旧路线冲突描述。
4. legacy / historical 文档不能被当作当前最高依据。

## 13. 当前下一大模块

MVP-ALIGN-03 完成后，进入：

```text
WORLD-GEN-02：worldSeed + personality layout input schema
```

WORLD-GEN-02 目标是继续推进自动生成世界规则，让不同 seed / 管家人格 / 资源状态产生稳定且可观察的布局差异。
