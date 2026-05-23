> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# WORLD-GEN-03：布局差异化验证与 debug audit

## 1. 模块定位

WORLD-GEN-03 是世界生成链路进入 Construction 之前的布局差异化验证模块。

本模块不做 UI，不改 FormalWorldView，不接入宠物，不修改正式渲染链路。

本模块只验证 WORLD-GEN-02 已建立的：

```text
worldSeed
+ ButlerConstructionStyle
+ resources
+ phase
+ layout variant
+ PlacementEngine
-> placements
```

是否真正能产生稳定且可观察差异的初始家园布局。

## 2. 最高依据

当前最高依据仍然是三份正式文档：

1. `AI-PET-WORLD MVP完整计划书 v1.5`。
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`。
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`。

本模块落实的核心要求：

1. 世界不是前端画出来的。
2. 布局不能是固定模板。
3. 同一 seed + 同一状态必须稳定复现。
4. 不同 seed / 管家人格 / 资源状态必须产生可观察差异。
5. 所有对象必须能追溯到 HomeMapState / placements / MapDiff。
6. FormalWorldView 只能只读 FormalVisualModel。
7. 宠物后置，初始世界不能默认生成宠物。

## 3. 本模块已新增文件

| 文件 | 作用 |
|---|---|
| `src/world/generation/world-layout-variation-scenarios.ts` | 定义 WORLD-GEN-03 多 seed / 多人格 / 多资源对照场景。 |
| `src/world/generation/world-layout-variation-audit.ts` | 复用 PlacementEngine 生成 placements，并输出稳定性与差异化 audit。 |
| `src/world/engine-notes/WORLD_GEN_03_LAYOUT_VARIATION_AUDIT.md` | 记录本阶段目标、边界、验证方式与验收标准。 |

## 4. 对照场景

WORLD-GEN-03 当前定义 6 组固定场景：

| 场景 id | 目的 |
|---|---|
| `structured_direct_baseline` | 验证高结构倾向是否形成更直接路径与更有序储物。 |
| `adaptive_curved_path` | 验证高适应倾向是否影响路径 waypoint 与路径风格。 |
| `protective_dense_boundary` | 验证高保护倾向与高自然增长是否形成更强自然边界。 |
| `aesthetic_soft_boundary` | 验证高美感倾向是否影响装饰数量与边界柔化。 |
| `quiet_nature_retreat` | 验证高安静倾向是否影响安静生活区偏移与留白。 |
| `compact_resource_pressure` | 验证高空间压力与材料准备是否影响承托区紧凑度与资源邻近。 |

所有场景使用固定 `now = 0`，不使用 `Math.random`，不使用 `Date.now`。

## 5. 审计输出

`buildWorldLayoutVariationAudit()` 会输出：

1. `scenarioCount`：参与审计的场景数量。
2. `stableScenarioCount`：重复生成 fingerprint 一致的场景数量。
3. `pairCount`：场景两两对比数量。
4. `passedPairCount`：通过可观察差异判断的对比数量。
5. `scenarios`：每个场景的 seed、variant、metrics、fingerprint 与 warnings。
6. `pairs`：每两个场景之间的 variant、坐标、metrics 差异。
7. `warnings`：稳定性失败、差异不足、PlacementRules warning 的汇总。

## 6. 稳定性验证

同一场景会连续执行两次：

```text
buildScenarioPlacements(scenario)
buildScenarioPlacements(scenario)
```

然后比较 placement fingerprint。

fingerprint 由 placement 的以下字段稳定组成：

1. `id`
2. `assetId`
3. `layer`
4. `x`
5. `y`
6. `scale`
7. `alpha`
8. `tags`

若两次 fingerprint 不一致，说明该布局仍存在非确定性因素。

## 7. 差异化验证

不同场景之间会比较：

1. variant 差异：`pathStyle`、`shelterBias`、`natureBias`、`quietAreaBias`。
2. 关键坐标差异：临时住所、储物箱、管家。
3. metrics 差异：路径长度、自然物数量、地表装饰数量、承托区数量、紧凑度。
4. placement fingerprint 是否相同。

通过标准：

```text
observableDifferenceScore >= 4
且 fingerprint 不相同
```

## 8. 本模块不做什么

WORLD-GEN-03 禁止：

1. 不做 UI。
2. 不改 `/world`。
3. 不改 FormalWorldView。
4. 不改 FormalVisualModel。
5. 不改 Renderer。
6. 不接入宠物。
7. 不恢复旧出生装置路线。
8. 不默认生成 pet actor。
9. 不默认生成 pet bed。
10. 不恢复 `pet_arrival` / `pet_rest`。
11. 不使用 `Math.random`。
12. 不使用 `Date.now`。
13. 不使用 `any`。
14. 不通过 CSS / PNG 决定世界事实。

## 9. 验收方式

代码层验证入口：

```ts
import {
  assertWorldLayoutVariationAuditPassed,
  buildWorldLayoutVariationAudit,
  summarizeWorldLayoutVariationAudit,
} from "@/world/generation/world-layout-variation-audit"

const audit = buildWorldLayoutVariationAudit()
const passed = assertWorldLayoutVariationAuditPassed(audit)
const summary = summarizeWorldLayoutVariationAudit(audit)
```

必须继续运行：

```text
npm run lint
npx tsc --noEmit
npm run build
```

本次 ChatGPT 通过 GitHub connector 修改远端仓库，无法在当前环境直接执行仓库本地命令；需要用户或 Codex 在本地仓库运行以上三条命令。

## 10. 阶段结论

WORLD-GEN-03 已把“不同 seed / 管家人格 / 资源状态是否真的改变布局”从肉眼判断推进为可复用 audit 工具。

当前结论：

1. 布局差异验证入口已建立。
2. 同一 input 稳定复现的 fingerprint 检查已建立。
3. 不同 input 可观察差异评分已建立。
4. 审计仍只读取生成层和 PlacementEngine，不接入 UI。
5. 后续 ConstructionPlanner 可以使用该 audit 作为非固定布局验收基线。
