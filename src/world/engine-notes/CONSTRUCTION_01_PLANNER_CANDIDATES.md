> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# CONSTRUCTION-01：ConstructionPlanner 候选计划生成

## 1. 模块定位

CONSTRUCTION-01 是建设系统从“输入协议”进入“候选计划生成”的阶段。

本模块只做：

```text
ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> ConstructionPlanCandidateAudit
```

本模块不执行建设，不生成 MapDiff，不修改 HomeMapState，不接入 UI，不接入宠物。

## 2. 最高依据

当前最高依据仍然是三份正式文档：

1. `AI-PET-WORLD MVP完整计划书 v1.5`。
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`。
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`。

本模块落实的正式要求：

1. 玩家不直接点击建造。
2. 家园变化来自管家判断、资源状态、世界阶段和人格倾向。
3. 建设计划不能直接改前端页面。
4. 真正地图变化必须进入后续 MapDiff / HomeMapState。
5. 宠物后置，候选计划不能默认生成宠物相关内容。

## 3. 本模块新增 / 修改文件

| 文件 | 作用 |
|---|---|
| `src/world/construction/construction-schema.ts` | 新增 `ConstructionPlanCandidateResult` 与 `ConstructionPlanCandidateAudit`。 |
| `src/world/construction/construction-planner.ts` | 从单一 MVP plan 升级为 planner input 驱动的候选计划生成器，并保留兼容入口。 |
| `src/world/construction/construction-plan-candidate-audit.ts` | 审计候选计划输出、stable fingerprint、重复 plan id、旧路线 token 与 MapDiff 边界。 |
| `src/world/engine-notes/CONSTRUCTION_01_PLANNER_CANDIDATES.md` | 记录本阶段目标、边界和验收方式。 |

## 4. 候选计划生成入口

正式入口：

```ts
import { buildConstructionPlanCandidates } from "@/world/construction/construction-planner"

const result = buildConstructionPlanCandidates(plannerInput)
```

输出：

1. `plans: ConstructionPlan[]`
2. `audit: ConstructionPlanCandidateAudit`
3. `tags: string[]`

## 5. 当前支持的候选计划

| intent goal | projectType | targetZoneType 来源 | 说明 |
|---|---|---|---|
| `stabilize_temporary_shelter` | `stabilize_temporary_shelter` | intent | 稳定临时住所。 |
| `improve_initial_care` | `improve_initial_care` | intent | 改善初始照护点，不代表宠物进入。 |
| `organize_storage_tools` | `organize_storage_area` | intent | 整理工具储备区。 |
| `maintain_natural_boundary` | `maintain_natural_boundary` | intent | 维护自然边界。 |
| `preserve_quiet_living` | `preserve_quiet_living` | intent | 保留安静生活区。 |
| `prepare_future_expansion` | `prepare_future_expansion` | intent | 预留未来扩展判断，不直接生成新对象。 |

## 6. 候选计划优先级

候选计划 priority 由以下因素计算：

1. intent urgency。
2. resourceSensitivity。
3. spaceSensitivity。
4. phase boost。
5. developmentPressure。
6. plan basePriority。

priority 被限制在 0 到 100。

## 7. 去重规则

候选 plan id 使用：

```text
candidate-${goal-derived-id-prefix}
```

如果 `plannerInput.existingPlanIds` 已经包含该 id，则跳过该 intent，并记录到：

```text
skippedIntentIds
```

## 8. Audit 规则

`auditConstructionPlanCandidates()` 检查：

1. plan id / title / reason / stages 是否存在。
2. plan id 是否重复。
3. priority 是否在 0 到 100。
4. stage 是否携带 mapDiffIds。
5. stage progress 是否从 0 开始。
6. stage 是否错误标记 completed。
7. accepted intent 是否存在于 planner input。
8. 是否包含旧路线 token。
9. 是否生成 stable output fingerprint。

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

## 9. 本模块不做什么

CONSTRUCTION-01 禁止：

1. 不执行 ConstructionPlan。
2. 不生成 MapDiff。
3. 不修改 HomeMapState。
4. 不改 PlacementEngine。
5. 不改 FormalVisualModel。
6. 不改 FormalWorldView。
7. 不改 `/world` UI。
8. 不接入宠物。
9. 不恢复旧出生装置路线。
10. 不默认生成 pet actor / pet bed。
11. 不用 CSS / PNG 决定世界事实。
12. 不使用 `Math.random`。
13. 不使用 `Date.now`。
14. 不使用 `any`。

## 10. 验证方式

必须运行：

```text
npm run lint
npx tsc --noEmit
npm run build
```

同时检查：

1. `buildConstructionPlanCandidates()` 只输出 `ConstructionPlan[]`。
2. `ConstructionPlanCandidateAudit.warnings.length` 预期为 0。
3. stage 的 `mapDiffIds` 为空。
4. stage 的 `progress` 为 0。
5. stage 的 `completed` 为 false。
6. 没有修改 HomeMapState。
7. 没有生成 MapDiff。
8. 没有接入 UI。
9. 没有接入宠物。

## 11. 阶段结论

CONSTRUCTION-01 已建立 ConstructionPlanner 候选计划生成层。

当前建设系统链路推进到：

```text
HomeMapState
+ 管家建设倾向
+ 资源状态
+ 世界阶段
-> ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> CandidateAudit
```

下一步进入：

```text
CONSTRUCTION-02：ConstructionExecutor + MapDiff 协议
```

CONSTRUCTION-02 才开始定义候选计划如何进入执行与 MapDiff，但仍必须遵守 MapDiff / HomeMapState / FormalVisualModel First 的边界。
