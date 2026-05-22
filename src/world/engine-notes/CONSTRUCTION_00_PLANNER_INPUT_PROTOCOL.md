# CONSTRUCTION-00：ConstructionPlanner 输入协议

## 1. 模块定位

CONSTRUCTION-00 是世界建设系统的第一步。

本模块只定义：

```text
HomeMapState
+ 管家建设倾向
+ 资源状态
+ 世界阶段
-> ConstructionPlannerInput
```

本模块不执行建设，不生成 MapDiff，不修改 HomeMapState，不接入 UI，不接入宠物。

## 2. 最高依据

当前最高依据仍然是三份正式文档：

1. `AI-PET-WORLD MVP完整计划书 v1.5`。
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`。
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`。

核心要求：

1. 玩家不直接点击建造。
2. 家园变化来自管家判断、资源状态、天气、时间、事件和人格倾向。
3. 建设不能凭空发生，必须有土地、空间、材料、时间和管家意图。
4. ConstructionPlan 不能直接改前端页面。
5. 后续真正变化必须进入 MapDiff / HomeMapState。
6. 宠物后置，ConstructionPlanner 不默认生成宠物相关建设。

## 3. 本模块新增 / 修改文件

| 文件 | 作用 |
|---|---|
| `src/world/construction/construction-schema.ts` | 扩展 ConstructionPlanner 输入协议，并中性化建设项目类型。 |
| `src/world/construction/construction-planner-input-builder.ts` | 从 HomeMapState、管家建设倾向、资源快照和世界日数构建 planner input。 |
| `src/world/construction/construction-planner-input-audit.ts` | 审计 planner input 的稳定 fingerprint、intent 合法性和旧路线 token。 |
| `src/world/engine-notes/CONSTRUCTION_00_PLANNER_INPUT_PROTOCOL.md` | 记录本阶段目标、边界和验收标准。 |

## 4. 输入协议

`ConstructionPlannerInput` 包含：

1. `worldId`
2. `ownerId`
3. `seed`
4. `homeMapState`
5. `constructionStyle`
6. `resources`
7. `phase`
8. `intents`
9. `existingPlanIds`
10. `tags`

其中 `homeMapState` 是读取对象，不在 CONSTRUCTION-00 修改。

## 5. 管家建设意图

当前 builder 会生成以下 intent：

| intentId | 目标 | 目标区域 |
|---|---|---|
| `stabilize-temporary-shelter` | 稳定临时住所 | `temporary_shelter` |
| `improve-initial-care` | 改善初始照护点 | `initial_care` |
| `organize-storage-tools` | 整理工具储备区 | `storage_tools` |
| `maintain-natural-boundary` | 维护自然边界 | `natural_boundary` |
| `preserve-quiet-living` | 保留安静生活区 | `quiet_living` |
| `prepare-future-expansion` | 预留未来扩展判断 | `visual_center` |

这些 intent 只是 planner 输入，不是建设执行结果。

## 6. 阶段判断

`ConstructionPlannerPhaseInput` 当前包含：

1. `initial_stabilization`
2. `basic_living_support`
3. `resource_organization`
4. `boundary_maintenance`

阶段由资源状态、空间压力、维护压力和管家建设倾向共同推导。

## 7. Audit 规则

`auditConstructionPlannerInput()` 检查：

1. `worldId / ownerId / seed` 是否存在。
2. `intents` 是否为空。
3. intentId 是否重复。
4. urgency / patience / resourceSensitivity / spaceSensitivity 是否在 0 到 1。
5. 是否包含旧路线 token。
6. 是否生成稳定 input fingerprint。

禁止 token 包含：

```text
pet_arrival
pet_rest
pet-near-arrival-point
pet-bed
pet_actor
incubator
embryo
hatching
incubating
```

## 8. 本模块不做什么

CONSTRUCTION-00 禁止：

1. 不执行 ConstructionPlan。
2. 不生成 MapDiff。
3. 不修改 HomeMapState。
4. 不改 PlacementEngine。
5. 不改 FormalVisualModel。
6. 不改 FormalWorldView。
7. 不改 /world UI。
8. 不接入宠物。
9. 不恢复旧出生装置路线。
10. 不默认生成 pet actor / pet bed。
11. 不用 CSS / PNG 决定世界事实。
12. 不使用 `Math.random`。
13. 不使用 `Date.now`。
14. 不使用 `any`。

## 9. 验证入口

后续可通过以下方式构建 planner input：

```ts
import { buildConstructionPlannerInput } from "@/world/construction/construction-planner-input-builder"

const result = buildConstructionPlannerInput({
  homeMapState,
  constructionStyle,
  worldDay,
})
```

预期：

1. `result.input.intents.length > 0`。
2. `result.audit.warnings.length === 0`。
3. `result.audit.stableInputFingerprint` 稳定。
4. 不出现旧路线 token。
5. 不产生 MapDiff。
6. 不修改 HomeMapState。

## 10. 验收方式

必须运行：

```text
npm run lint
npx tsc --noEmit
npm run build
```

本轮通过 GitHub connector 修改远端仓库，无法在当前环境直接执行本地命令；需要用户或 Codex 在本地仓库运行以上三条命令。

## 11. 阶段结论

CONSTRUCTION-00 已建立 ConstructionPlanner 的输入协议和审计边界。

当前建设系统还没有真正执行地图变化。

下一步进入：

```text
CONSTRUCTION-01：ConstructionPlanner 候选计划生成
```

CONSTRUCTION-01 才开始把 planner input 转换为 ConstructionPlan 候选，但仍不能直接修改 HomeMapState；真正修改地图必须继续进入 ConstructionExecutor + MapDiff 阶段。
