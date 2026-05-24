> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# CONSTRUCTION-04：Construction World Loop 接入前协议

## 1. 阶段定位

CONSTRUCTION-04 把建设系统从独立模块推进到 world-loop 接入前的协议编排层。

当前链路：

```text
HomeMapState
+ 管家建设倾向
+ 资源状态
+ 世界阶段
-> ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> selected ConstructionPlan
-> ConstructionExecutionResult
-> MapDiff[] 候选
-> SafeApply
-> nextHomeMapState
```

本阶段不是 UI 阶段。
本阶段不是正式 world-loop 接入阶段。
本阶段不是宠物进入阶段。
本阶段不修改 `/world`。
本阶段不修改 FormalWorldView。
本阶段只建立建设循环接入前协议。

## 2. 当前模块目标

| 项目 | 内容 |
|---|---|
| 当前模块目标 | 串联 planner input、candidate、executor、safeApply，形成建设循环协议输出 |
| 输入 | HomeMapState、管家建设倾向、worldDay、now、可选 preferredPlanId |
| 输出 | ConstructionWorldLoopProtocolResult |
| 世界状态变化 | 只通过 SafeApply 返回 nextHomeMapState |
| 边界 | 不接真实 world-loop、不接 UI、不接宠物 |

## 3. 已完成哪些

| 已完成项 | 文件 | 说明 |
|---|---|---|
| ConstructionWorldLoopProtocolInput | `construction-schema.ts` | 定义建设循环协议输入。 |
| ConstructionWorldLoopProtocolResult | `construction-schema.ts` | 定义建设循环协议输出。 |
| ConstructionWorldLoopAudit | `construction-schema.ts` | 定义协议级审计结构。 |
| buildConstructionWorldLoopProtocolResult | `construction-world-loop-protocol.ts` | 串联 planner、candidate、executor、safeApply。 |
| auditConstructionWorldLoopProtocol | `construction-world-loop-audit.ts` | 审计协议输出、lineage、warning、禁止 token。 |

## 4. 未完成哪些

| 未完成项 | 原因 | 下一步 |
|---|---|---|
| 真实 world-loop 接入 | 本阶段只是接入前协议 | CONSTRUCTION-05 或 world-loop 模块 |
| 持久化策略 | 需要单独设计保存时机和失败回滚 | 后续 Persistence 模块 |
| RenderableWorldSnapshot 刷新 | 本阶段不接渲染链路 | 后续视觉刷新链路 |
| FormalVisualModel 刷新 | 本阶段不改 FormalVisualModel | 后续视觉刷新链路 |
| TownAdoptionPrecheck / ButlerAdoptionIntent | 宠物后置系统不是本阶段范围 | 后续小镇领养观察模块 |

## 5. 本轮改哪些文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/world/construction/construction-schema.ts` | 修改 | 新增 construction world loop protocol 类型。 |
| `src/world/construction/construction-world-loop-protocol.ts` | 新增 | 建设循环接入前协议编排层。 |
| `src/world/construction/construction-world-loop-audit.ts` | 新增 | 建设循环协议审计。 |
| `src/world/engine-notes/CONSTRUCTION_04_WORLD_LOOP_PRE_INTEGRATION.md` | 新增 | 阶段文档。 |
| `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md` | 修改 | 标记 CONSTRUCTION-04 完成。 |
| `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md` | 修改 | 加入 CONSTRUCTION-04 红线。 |

## 6. 本轮不改哪些文件

| 禁止范围 | 说明 |
|---|---|
| `/world` UI | 不接入。 |
| FormalWorldView | 不修改。 |
| FormalVisualModel | 不修改。 |
| renderer | 不修改。 |
| runtime-context | 不接入。 |
| world-loop | 不接真实 loop。 |
| map-state schema | 不修改。 |
| generation / placement | 不修改。 |
| pet / adoption | 不接入。 |

## 7. 完成后如何验证

| 验证项 | 命令 / 检查 |
|---|---|
| lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| build | `npm run build` |
| 边界检查 | changed files 不应包含 UI、world-loop、pet、map-state。 |
| 链路检查 | nextHomeMapState 必须来自 SafeApply。 |
| 旧路线检查 | 不包含 pet_arrival / pet_rest / pet-bed 等 token 的正式生成逻辑。 |

## 8. 红线

1. World loop protocol 只能作为接入前协议，不能自动注册到真实 world-loop。
2. 只能通过 planner -> observation -> executor -> safeApply 生成 nextHomeMapState。
3. 不能跳过 SafeApply。
4. 不能直接修改输入 HomeMapState。
5. 不能接 UI。
6. 不能接 FormalWorldView。
7. 不能读取 PNG / WORLD_MAP_ASSETS 决定世界事实。
8. 不能生成宠物、pet actor、pet bed。
9. 不能包含 pet_arrival / pet_rest。
10. 不能使用 Math.random / Date.now / any。
11. 输出必须经过 protocol audit。

## 9. 下一步

下一步进入：

```text
CONSTRUCTION-05：Construction Runtime 接入与持久化前协议
```

该阶段才讨论如何把协议接入 runtime 或 world-loop，但仍必须保持 UI、FormalWorldView、宠物后置边界。
