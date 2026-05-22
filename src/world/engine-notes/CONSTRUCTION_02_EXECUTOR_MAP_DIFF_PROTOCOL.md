# AI-PET-WORLD CONSTRUCTION-02 ConstructionExecutor + MapDiff 协议

## 1. 阶段定位

CONSTRUCTION-02 把建设系统从“候选计划”推进到“执行协议 + MapDiff 候选生成”。

当前链路：

```text
ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> selected ConstructionPlan
-> ConstructionExecutionInput
-> ConstructionExecutionResult
-> MapDiff[] 候选
```

本阶段不是 UI 阶段。
本阶段不是 world-loop 阶段。
本阶段不是宠物进入阶段。
本阶段不直接修改 HomeMapState。
本阶段只生成 MapDiff 候选。

## 2. 模块目标

| 项目 | 内容 |
|---|---|
| 当前模块目标 | 定义 ConstructionExecutor 输入、输出、审计协议，并从 ConstructionPlan 生成 MapDiff 候选 |
| 输入 | HomeMapState、ConstructionPlan、now |
| 输出 | ConstructionExecutionResult |
| MapDiff 策略 | 优先 update 已存在 placement，不凭空新增世界对象 |
| 状态边界 | 只推进 nextPlan 的候选状态，不应用到 HomeMapState |

## 3. 已完成哪些

| 项目 | 说明 |
|---|---|
| ConstructionExecutionInput | 已包含 homeMapState、plan、now |
| ConstructionExecutionResult | 已包含 nextPlan、mapDiffs、messages、audit、tags |
| ConstructionExecutionAudit | 已包含 stableExecutionFingerprint、planId、mapDiffIds、warnings、tags |
| ConstructionExecutor | 已新增 buildConstructionExecutionResult |
| MapDiff 候选 | 已根据计划阶段和目标区域生成 update 类型候选 |
| Audit | 已检查重复 id、placement 引用、createdAt、tags、plan id、旧路线 token |

## 4. 未完成哪些

| 项目 | 原因 | 下一步 |
|---|---|---|
| SafeApply | 本阶段只生成候选，不应用 | CONSTRUCTION-03 |
| HomeMapState 更新 | 需要 MapDiff 验证与安全应用协议 | CONSTRUCTION-03 |
| world-loop 接入 | 需要 SafeApply 后再接 | 后续阶段 |
| LifeEvent / CompanionDecision | 宠物后置系统不是本阶段范围 | 后续 LIFE-EVENT 模块 |

## 5. 本轮改哪些文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/world/construction/construction-schema.ts` | 修改 | 补齐 executor / audit / MapDiff 候选类型 |
| `src/world/construction/construction-executor.ts` | 修改 | 实现只读 ConstructionExecutionResult 生成 |
| `src/world/construction/construction-execution-audit.ts` | 新增 | 审计执行结果和 MapDiff 候选 |
| `src/world/engine-notes/CONSTRUCTION_02_EXECUTOR_MAP_DIFF_PROTOCOL.md` | 新增 | 记录本阶段目标、边界和验收 |
| `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md` | 修改 | 追加 CONSTRUCTION-02 完成记录 |
| `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md` | 修改 | 追加 CONSTRUCTION-02 红线 |

## 6. 本轮不改哪些文件

| 范围 | 说明 |
|---|---|
| `/world` UI | 不接入 |
| FormalWorldView | 不修改 |
| FormalVisualModel | 不修改 |
| renderer | 不修改 |
| world-loop | 不接入 |
| map-state schema | 不修改 |
| generation / placement | 不修改 |
| pet / adoption | 不接入 |

## 7. 完成后如何验证

| 验证项 | 命令 / 检查 |
|---|---|
| lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| build | `npm run build` |
| 边界检查 | MapDiff 只作为候选输出，不直接应用 HomeMapState |
| 旧路线检查 | 不包含 pet_arrival / pet_rest / pet-bed / incubator / embryo 等 token |

## 8. 红线

1. Executor 可以生成 MapDiff 候选，但不能直接修改 HomeMapState。
2. Executor 不能接 UI。
3. Executor 不能接 FormalWorldView。
4. Executor 不能读取 PNG / WORLD_MAP_ASSETS 决定世界事实。
5. Executor 不能生成宠物、pet actor、pet bed。
6. Executor 不能包含 pet_arrival / pet_rest。
7. Executor 不能恢复旧出生装置路线。
8. Executor 不能使用 Math.random / Date.now / any。
9. Executor 输出必须经过 audit。
10. MapDiff 候选必须等待后续 SafeApply 阶段验证后才能应用。

## 9. 下一步

下一步进入：

```text
CONSTRUCTION-03：MapDiff SafeApply 与 HomeMapState 更新协议
```
