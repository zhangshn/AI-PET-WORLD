# AI-PET-WORLD World Engine Development Guardrails

## 1. 文档定位

本文档是 AI-PET-WORLD 世界引擎、生成层、建设层、渲染层、视觉模型层和前端呈现层的开发红线。

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
9. 当前正式 MVP 不再使用旧默认宠物开局路线。
10. 旧文档只能作为历史参考，不能作为当前实现依据。

## 3. 当前正式 MVP 红线

当前正式 MVP 禁止：

1. 重新引入旧默认生命初始路线。
2. 初始世界默认生成 pet actor。
3. 初始世界默认生成 pet bed。
4. 初始世界默认生成 pet_arrival / pet_rest。
5. 初始世界默认构造 PetRuntimeContext。
6. 用 CSS 隐藏旧事实来替代清理正式链路。
7. 把宠物素材定义当作初始世界事实。
8. 让旧 docs/mvp 或旧测试报告覆盖三份正式文档。

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
5. debug scenario result 被当作正式玩家世界。
6. assetId / PNG 反向决定世界对象是否存在。
7. ConstructionExecutionResult 未经 SafeApply 就被当作已应用世界事实。

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
| MVP-ALIGN-01 | 旧路线 / 默认宠物链路审计已完成。 |
| WORLD-GEN-01A/B | 正式首屏旧文案清理与默认 pet runtime 断开已完成。 |
| MVP-ALIGN-02 | 正式链路中的旧路线 / 默认宠物 / pet_arrival / pet_rest 已清理。 |
| MVP-ALIGN-03 | 文档体系对齐模块已完成。 |
| WORLD-GEN-02 | worldSeed + personality layout input schema 已完成。 |
| WORLD-GEN-03 | 布局差异化验证与 debug audit 已完成。 |
| CONSTRUCTION-00 | ConstructionPlanner 输入协议与输入审计已完成。 |
| CONSTRUCTION-01 | ConstructionPlanner 候选计划生成与候选审计已完成。 |
| CONSTRUCTION-02 | ConstructionExecutor 与 MapDiff 候选生成协议已完成。 |

## 10. WORLD-GEN-02 布局输入红线

WORLD-GEN-02 已建立布局输入协议。

红线：

1. layout input 不能包含旧默认生命初始路线。
2. layout input 不能包含 pet_arrival / pet_rest。
3. layout input 不能默认生成 pet。
4. layout input 只能影响世界布局候选、路径、住所、边界、安静区和装饰倾向。
5. recipe 只能作为候选结构，不能成为固定最终画面。
6. 所有布局差异必须由 seed、personality、resources、phase、variant 和规则稳定推导。
7. 禁止 Math.random / Date.now / any 参与布局事实。
8. 禁止 UI / CSS 决定布局事实。
9. PlacementEngine 读取 layout input 后，仍必须通过 PlacementRules 验证。

## 11. WORLD-GEN-03 差异化审计红线

WORLD-GEN-03 已建立布局差异化验证工具。

红线：

1. scenario 只能作为 debug audit 输入，不能被当作正式玩家世界。
2. audit 只能读取 generation / PlacementEngine 输出，不能改 HomeMapState。
3. audit 不能接入 `/world`。
4. audit 不能改 FormalWorldView。
5. audit 不能生成 UI。
6. audit 不能生成宠物。
7. audit 必须验证同一 input repeated fingerprint 一致。
8. audit 必须验证不同 input 有 variant / 坐标 / metrics / fingerprint 差异。
9. audit 禁止 Math.random / Date.now / any。
10. audit warning 不能被隐藏成通过。

## 12. CONSTRUCTION-00 输入协议红线

CONSTRUCTION-00 已建立 ConstructionPlanner 输入协议。

红线：

1. Planner input 只能读取 HomeMapState，不能修改 HomeMapState。
2. Planner input 只能生成建设意图输入，不能生成 MapDiff。
3. Planner input 不能接入 `/world`。
4. Planner input 不能接入 FormalWorldView。
5. Planner input 不能生成 UI。
6. Planner input 不能生成宠物、pet actor、pet bed。
7. Planner input 不能包含 pet_arrival / pet_rest。
8. Planner input 不能恢复旧默认宠物开局路线。
9. Planner input 必须保留 stable fingerprint audit。
10. Planner input 禁止 Math.random / Date.now / any。

## 13. CONSTRUCTION-01 候选计划红线

CONSTRUCTION-01 已建立 ConstructionPlanner 候选计划生成。

红线：

1. 候选计划只能读取 ConstructionPlannerInput。
2. 候选计划不能修改 HomeMapState。
3. 候选计划不能生成 MapDiff。
4. 候选计划不能接入 `/world`。
5. 候选计划不能接入 FormalWorldView。
6. 候选计划不能生成 UI。
7. 候选计划不能生成宠物、pet actor、pet bed。
8. 候选计划不能包含 pet_arrival / pet_rest。
9. 候选计划不能恢复旧默认宠物开局路线。
10. 候选计划必须保留 stable output fingerprint audit。
11. 候选计划 stage 的 mapDiffIds 必须为空。
12. 候选计划 stage 的 progress 必须从 0 开始。
13. 候选计划 stage 不能预先 completed。
14. 候选计划禁止 Math.random / Date.now / any。

## 14. CONSTRUCTION-02 执行候选红线

CONSTRUCTION-02 已建立 ConstructionExecutor 与 MapDiff 候选生成协议。

红线：

1. Executor 可以生成 MapDiff 候选，但不能直接修改 HomeMapState。
2. Executor 不能接 UI。
3. Executor 不能接 FormalWorldView。
4. Executor 不能读取 PNG / WORLD_MAP_ASSETS 决定世界事实。
5. Executor 不能生成宠物、pet actor、pet bed。
6. Executor 不能包含 pet_arrival / pet_rest。
7. Executor 不能恢复旧默认宠物开局路线。
8. Executor 不能使用 Math.random / Date.now / any。
9. Executor 输出必须经过 audit。
10. MapDiff 候选必须等待后续 SafeApply 阶段验证后才能应用。
11. ConstructionExecutionResult 不能被直接当作 HomeMapState。
12. `nextPlan` 是执行候选输出，不等同于已持久化状态。

## 15. 每轮开发必须回答

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

## 16. 验收门槛

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

## 17. 当前下一大模块

CONSTRUCTION-02 完成后，进入：

```text
CONSTRUCTION-03：MapDiff SafeApply 与 HomeMapState 更新协议
```

CONSTRUCTION-03 目标是定义 MapDiff SafeApply 输入协议，验证 MapDiff 候选是否可应用，并通过安全应用协议更新 HomeMapState；该阶段仍不做 UI，不接入宠物，不绕过 HomeMapState / MapDiff / FormalVisualModel 链路。

## CONSTRUCTION-03 红线

CONSTRUCTION-03 已建立 MapDiff SafeApply 与 HomeMapState 更新协议。

红线：

1. SafeApply 可以返回 nextHomeMapState，但必须来自 MapDiff 验证。
2. SafeApply 不能接 UI。
3. SafeApply 不能接 FormalWorldView。
4. SafeApply 不能读取 PNG / WORLD_MAP_ASSETS 决定世界事实。
5. SafeApply 不能生成宠物、pet actor、pet bed。
6. SafeApply 不能包含 pet_arrival / pet_rest。
7. SafeApply 不能恢复旧默认宠物开局路线。
8. SafeApply 不能使用 Math.random / Date.now / any。
9. SafeApply 输出必须经过 audit。
10. SafeApply 不能接受未经 ConstructionExecutionResult / audit 产生的 MapDiff。
11. SafeApply 拒绝 add / remove，除非后续阶段明确开放并增加严格规则。
12. SafeApply 必须保持 HomeMapState 的 worldId / ownerId / seed 不变。
