> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD CONSTRUCTION-03 MapDiff SafeApply 与 HomeMapState 更新协议

## 1. 阶段定位

CONSTRUCTION-03 把建设系统从“MapDiff 候选生成”推进到“MapDiff 安全验证与 HomeMapState 更新协议”。

当前链路：

```text
HomeMapState
+ ConstructionExecutionResult
+ MapDiff[] 候选
-> SafeApply validation
-> SafeApply result
-> next HomeMapState
```

CONSTRUCTION-03 不是 UI 阶段。
CONSTRUCTION-03 不是 world-loop 阶段。
CONSTRUCTION-03 不是宠物进入阶段。
CONSTRUCTION-03 不直接相信 MapDiff 候选。
CONSTRUCTION-03 只通过 SafeApply 验证后返回 nextHomeMapState。
CONSTRUCTION-03 不绕过 MapDiff。
CONSTRUCTION-03 不改 FormalWorldView。

## 2. 当前模块目标

| 项目 | 内容 |
|---|---|
| 当前模块目标 | 验证 ConstructionExecutionResult 中的 MapDiff 候选，并在通过后返回 nextHomeMapState |
| 输入 | HomeMapState、ConstructionExecutionResult、now |
| 输出 | ConstructionSafeApplyResult |
| 允许操作 | 当前只允许 update 已存在 placement |
| 拒绝操作 | add / remove / move 暂时拒绝 |
| 状态边界 | 返回新 HomeMapState，不修改输入对象 |

## 3. 已完成哪些

| 项目 | 说明 |
|---|---|
| ConstructionSafeApplyInput | 已定义 SafeApply 输入协议 |
| ConstructionSafeApplyResult | 已定义 nextHomeMapState、acceptedDiffIds、rejectedDiffs、messages、audit、tags |
| ConstructionSafeApplyRejectedDiff | 已定义拒绝 diff 的 reason 与 tags |
| ConstructionSafeApplyAudit | 已定义 stableSafeApplyFingerprint、sourcePlanId、accepted / rejected ids、warnings、tags |
| buildConstructionSafeApplyResult | 已实现验证并安全应用 accepted update diff |
| auditConstructionSafeApplyResult | 已实现覆盖率、identity、updatedAt、actor placement、禁止 token 与 stable fingerprint 审计 |

## 4. 未完成哪些

| 项目 | 原因 | 下一步 |
|---|---|---|
| world-loop 接入 | 本阶段只做协议层 | CONSTRUCTION-04 |
| 持久化策略 | 需要 world-loop 接入前后统一规划 | 后续阶段 |
| RenderableWorldSnapshot / FormalVisualModel 刷新链路 | 需要 HomeMapState 更新进入正式循环后再接 | 后续阶段 |
| LifeEvent / CompanionDecision | 宠物后置系统不是本阶段范围 | 后续生命事件模块 |

## 5. 本轮改哪些文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/world/construction/construction-schema.ts` | 修改 | 补齐 SafeApply 输入 / 输出 / audit 类型 |
| `src/world/construction/construction-safe-apply.ts` | 新增 | 验证并安全应用 MapDiff 候选 |
| `src/world/construction/construction-safe-apply-audit.ts` | 新增 | 审计 SafeApply 结果与边界 |
| `src/world/engine-notes/CONSTRUCTION_03_SAFE_APPLY_HOME_MAP_STATE.md` | 新增 | 记录本阶段目标、边界和验收 |
| `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md` | 修改 | 追加 CONSTRUCTION-03 完成记录 |
| `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md` | 修改 | 追加 CONSTRUCTION-03 红线 |

## 6. 本轮不改哪些文件

| 范围 | 说明 |
|---|---|
| `/world` UI | 不接入 |
| FormalWorldView | 不修改 |
| FormalVisualModel | 不修改 |
| renderer | 不修改 |
| runtime-context | 不接入 |
| world-loop | 不接入 |
| adoption / pet | 不接入 |
| generation / placement | 不修改 |
| map-state schema | 不修改 |

## 7. 完成后如何验证

| 验证项 | 命令 / 检查 |
|---|---|
| lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| build | `npm run build` |
| 边界检查 | SafeApply 只接受 ConstructionExecutionResult 中的候选 diff |
| 操作检查 | 当前只接受 update，拒绝 add / remove / move |
| 旧路线检查 | 不包含 pet_arrival / pet_rest / pet-bed / incubator / embryo 等 token |

## 8. 红线

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
11. SafeApply 当前拒绝 add / remove，后续开放必须增加严格规则。
12. SafeApply 必须保持 HomeMapState 的 worldId / ownerId / seed 不变。

## 9. 下一步

下一步进入：

```text
CONSTRUCTION-04：Construction World Loop 接入前协议
```
