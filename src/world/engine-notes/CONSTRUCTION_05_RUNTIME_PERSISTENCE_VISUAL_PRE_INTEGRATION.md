# AI-PET-WORLD CONSTRUCTION-05 Runtime Boundary + Persistence Proposal + Visual Refresh Pre-Integration

## 1. 阶段定位

CONSTRUCTION-05 是建设链路进入真实 runtime / persistence / visual refresh 前的大模块边界。

本阶段包含三件事：

| 子模块 | 说明 |
|---|---|
| Runtime Boundary | 定义 runtime 如何调用建设链路，但不注册真实 world-loop |
| Persistence Proposal | 生成持久化提案，但不真实写 storage |
| Visual Refresh Signal | 生成视觉刷新前信号，但不修改 FormalVisualModel / Renderer / UI |

本阶段不是 UI 阶段。
本阶段不是真实 persistence 阶段。
本阶段不是真实 world-loop 自动运行阶段。
本阶段不是宠物进入阶段。
本阶段不改 FormalWorldView。
本阶段不绕过 SafeApply。
本阶段不把 proposal / signal 当成已完成事实。

## 2. 当前模块目标

| 项目 | 内容 |
|---|---|
| 当前模块目标 | 将 ConstructionWorldLoopProtocolResult 包装为 runtime cycle 边界输出 |
| 输入 | ConstructionRuntimeCycleInput |
| 输出 | ConstructionRuntimeCycleResult |
| 持久化 | 只生成 ConstructionPersistenceProposal |
| 视觉刷新 | 只生成 ConstructionVisualRefreshSignal |
| 核心边界 | 不写 storage，不刷新 UI，不接真实 world-loop |

## 3. 已完成哪些

| 已完成项 | 文件 | 说明 |
|---|---|---|
| Runtime cycle 类型 | `construction-schema.ts` | 新增 runReason、persistenceMode、visualRefreshMode、cycle input/result/audit |
| Persistence proposal 类型 | `construction-schema.ts` | 新增 ConstructionPersistenceProposal |
| Visual refresh signal 类型 | `construction-schema.ts` | 新增 ConstructionVisualRefreshSignal |
| Runtime cycle 入口 | `construction-runtime-cycle.ts` | 新增 buildConstructionRuntimeCycleResult |
| Persistence proposal builder | `construction-persistence-proposal.ts` | 根据 C04 协议结果生成 proposal_only 提案 |
| Visual refresh signal builder | `construction-visual-refresh-signal.ts` | 根据 accepted diff 推导 changedPlacementIds |
| Runtime cycle audit | `construction-runtime-cycle-audit.ts` | 审计 identity、mode、proposal/signal、diff lineage、禁止 token 与 stable fingerprint |

## 4. 未完成哪些

| 未完成项 | 原因 | 下一步 |
|---|---|---|
| 真实 world-loop 接入 | 本阶段只定义 runtime boundary | CONSTRUCTION-06 |
| 真实 persistence 写入 | 本阶段只生成 proposal | 后续 persistence 实现 |
| RenderableWorldSnapshot / FormalVisualModel 刷新实现 | 本阶段只生成 signal | 后续视觉刷新链路 |
| LifeEvent / CompanionDecision | 本阶段不接宠物 | 后续宠物后置模块 |
| 宠物后置进入正式链路 | 本阶段不接 adoption / LifeEvent | 后续生命关系阶段 |

## 5. 本轮改哪些文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/world/construction/construction-schema.ts` | 修改 | 补齐 runtime cycle / persistence proposal / visual refresh signal / audit 类型 |
| `src/world/construction/construction-runtime-cycle.ts` | 新增 | 串联 C04 输出并生成 runtime cycle result |
| `src/world/construction/construction-runtime-cycle-audit.ts` | 新增 | 审计 runtime cycle 输出边界 |
| `src/world/construction/construction-persistence-proposal.ts` | 新增 | 生成持久化前提案 |
| `src/world/construction/construction-visual-refresh-signal.ts` | 新增 | 生成视觉刷新前信号 |
| `src/world/engine-notes/CONSTRUCTION_05_RUNTIME_PERSISTENCE_VISUAL_PRE_INTEGRATION.md` | 新增 | 记录阶段目标、边界和验收 |
| `src/world/engine-notes/P8_FORMAL_VISUAL_STAGE_PLAN.md` | 修改 | 标记 CONSTRUCTION-05 完成 |
| `src/world/engine-notes/ENGINE_DEVELOPMENT_GUARDRAILS.md` | 修改 | 追加 CONSTRUCTION-05 红线 |

## 6. 本轮不改哪些文件

| 范围 | 说明 |
|---|---|
| `/world` UI | 不接入 |
| FormalWorldView | 不修改 |
| FormalVisualModel | 不修改 |
| Renderer | 不修改 |
| runtime-context | 不接入 |
| world-loop | 不接真实 loop |
| map-state schema | 不修改 |
| generation / placement | 不修改 |
| pet / adoption | 不接入 |

## 7. 完成后如何验证

| 验证项 | 命令 / 检查 |
|---|---|
| lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| build | `npm run build` |
| 边界检查 | changed files 不应包含 UI、world-loop、FormalVisualModel、renderer、pet |
| 链路检查 | RuntimeCycle 必须调用 ConstructionWorldLoopProtocol |
| SafeApply 检查 | RuntimeCycle 不得重新应用 MapDiff |
| proposal 检查 | PersistenceProposal 只允许 proposal_only / disabled |
| signal 检查 | VisualRefreshSignal 只允许 signal_only / disabled |

## 8. 红线

1. RuntimeCycle 只能作为 runtime 调用边界，不能自动注册真实 world-loop。
2. RuntimeCycle 不能直接写 storage。
3. RuntimeCycle 不能直接刷新 UI。
4. RuntimeCycle 不能修改 FormalVisualModel。
5. RuntimeCycle 不能修改 Renderer。
6. RuntimeCycle 不能生成宠物、pet actor、pet bed。
7. RuntimeCycle 不能包含 pet_arrival / pet_rest。
8. RuntimeCycle 不能恢复旧默认宠物开局路线。
9. RuntimeCycle 不能使用 Math.random / Date.now / any。
10. RuntimeCycle 必须调用 ConstructionWorldLoopProtocol。
11. RuntimeCycle 不能跳过 SafeApply。
12. PersistenceProposal 只是提案，不是已持久化事实。
13. VisualRefreshSignal 只是信号，不是 UI model。
14. RuntimeCycle 输出必须经过 audit。

## 9. 下一步

下一步进入：

```text
CONSTRUCTION-06：正式 Runtime Adapter 与 World Loop Bridge 审计
```
