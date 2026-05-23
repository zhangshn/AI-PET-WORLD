> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7 MVP 世界闭环设计

## 1. P7 的定位

P7 不是 Renderer 阶段。
P7 不是美术阶段。
P7 不是直接让 AI 随便改世界。
P7 是把 P5 的安全变化链路和 P6 的正式可视化链路连接起来，形成 MVP 世界闭环。

核心闭环：

```text
HomeMapState
-> EnvironmentState
-> IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validateMapDiffs
-> WorldEvolutionAuditReport
-> WorldEvolutionExecutionResult
-> NextHomeMapState
-> RenderableWorldSnapshot
-> ProceduralRendererView
```

## 2. 当前已有能力

| 模块 | 路径 | 当前状态 | 是否可直接用于正式闭环 | 备注 |
| --- | --- | --- | --- | --- |
| HomeMapState | `src/world/map-state/` | 已有世界事实协议 | 是 | 当前世界事实输入，P7 需要定义 runtime 中的 current / next 关系。 |
| EnvironmentState | `src/world/environment/` | 已可从 HomeMapState 派生 | 是 | 可作为意图与变化计划的环境输入。 |
| PlacementGeometryAuditReport | `src/world/geometry-audit/` | 已可批量审计 placement geometry 与规则 | 是 | 可解释当前 placement 的规则映射与几何状态。 |
| IntentDecision | `src/world/intent-system/` | 已可根据环境、宠物、管家、世界上下文评分 | 需要封装 | 正式闭环要提供稳定上下文，不能使用 debug preset。 |
| WorldChangePlan | `src/world/world-evolution/` | 已可由 IntentDecision 生成计划 | 是 | 仍然只是计划层，不直接修改世界。 |
| WorldDiffProposal | `src/world/world-evolution/` | 已可由计划生成提案 | 是 | 当前 v0 只有 plant_nature 初步生成 MapDiff。 |
| MapDiffValidationResult | `src/world/map-state/map-diff-validator.ts` | 已可校验 MapDiff | 是 | 只校验，不写入。 |
| WorldEvolutionAuditReport | `src/world/world-evolution-audit/` | 已可判断风险与 canApplySafely | 是 | 正式写入必须经过这一层。 |
| WorldEvolutionExecutionResult | `src/world/world-evolution-executor/` | 已可在受审计保护下生成执行结果 | 需要升级策略 | 当前仍带 debug-only 语义，需要 P7 safe apply 策略。 |
| WorldEngineChainAuditReport | `src/world/world-engine-chain-audit/` | 已可汇总完整链路 | 是 | 可作为 Tick audit trail 的基础。 |
| VisualState | `src/world/rendering/` | 已可从世界事实派生 | 是 | 不能读取 proposal / audit / execution。 |
| DrawCommand | `src/world/rendering/` | 已可从 VisualState 派生 | 是 | Renderer 只能消费命令，不反向生成世界事实。 |
| RenderableWorldSnapshot | `src/world/rendering/` | 已可统一封装 VisualState 和 DrawCommand | 是 | 正式 Renderer 当前唯一输入。 |
| ProceduralRendererView | `src/app/world/components/procedural-renderer/` | 已接收 snapshot 并显示 summary / 基础线框 | 是 | 当前不是最终美术，但可显示正式世界事实。 |
| WorldFirstSceneModel | `src/world/runtime/world-first-scene-model.ts` | 已生成第一幕和 renderableWorldSnapshot | 否 | 当前只生成第一幕，不负责多 Tick 推进。 |

WorldEvolutionExecutionResult 当前还需要从 debug-only 语义升级为正式 safe apply 策略。
WorldFirstSceneModel 当前只生成第一幕，不负责多 Tick 推进。

## 3. P7 MVP 世界闭环数据链路

1. 当前 HomeMapState 作为世界事实输入。
2. 根据 HomeMapState 派生 EnvironmentState。
3. 根据 HomeMapState 生成 PlacementGeometryAuditReport。
4. 根据环境、宠物、管家、世界上下文生成 IntentDecision。
5. 根据 IntentDecision 生成 WorldChangePlan。
6. 根据 WorldChangePlan 生成 WorldDiffProposal。
7. 对 proposal.mapDiffs 调用 validateMapDiffs。
8. 根据 validation 生成 WorldEvolutionAuditReport。
9. 如果 audit.canApplySafely === true，才允许进入 SafeApply。
10. SafeApply 输出 NextHomeMapState。
11. NextHomeMapState 再派生 RenderableWorldSnapshot。
12. ProceduralRendererView 只显示 NextHomeMapState 对应的 snapshot。

## 4. Debug execution 和正式 safe apply 的区别

| 项目 | Debug Execution | 正式 Safe Apply |
| --- | --- | --- |
| 位置 | world-evolution-executor / debug scenario | P7 runtime world loop |
| 用途 | 验证如果执行会怎样 | 推进真实 HomeMapState |
| 是否写回正式状态 | 不写回 | 写入 runtime state |
| 是否允许页面调用 | 不允许正式页面调用 | 只能 runtime loop 调用 |
| 是否需要审计 | 需要 | 需要 |
| 是否可持久化 | 不持久化 | P7 后续阶段决定 localStorage / backend / state store |

## 5. HomeMapState 推进原则

1. HomeMapState 是世界事实。
2. NextHomeMapState 必须来自 MapDiff apply。
3. 不能由 Renderer 修改。
4. 不能由 UI 直接修改。
5. 不能由 IntentDecision 直接修改。
6. 不能由 WorldChangePlan 直接修改。
7. 不能由 WorldDiffProposal 直接修改。
8. 正式推进必须记录来源：
   - tickId
   - sourceIntent
   - planId
   - proposalId
   - auditId
   - appliedMapDiffCount
9. 推进失败必须保留 rejected / blocked 原因。
10. 所有推进都要能被 debug 页面解释。

## 6. 旧 construction flow 处理策略

当前旧 construction flow 仍然存在，用于初始世界生成和 debug 场景。
P7 不应该突然删除旧 construction flow。
应该采取三步策略：

1. 保留 initial generation。
2. 把后续变化逐步迁移到 world-evolution flow。
3. 最终让 construction flow 只负责出生/初始家园，不负责长期世界推进。

旧 construction flow 不能继续承担长期世界演化职责。

## 7. P7 分阶段路线

P7.0：MVP 世界闭环总设计文档。
只定义世界闭环目标、数据链路、分阶段边界和红线。

P7.1：WorldLoop schema。
只定义 RuntimeWorldState / WorldLoopStepResult / WorldLoopAuditTrail schema。

P7.2：SafeApply policy。
只定义 SafeApply 的规则，不接 UI。

P7.3：WorldLoop runtime builder。
把 P5 chain 包成 world loop builder，但不接正式页面。

P7.4：正式世界 state holder / local runtime。
在正式 /world 建立 local runtime state，但不自动 tick。

P7.5：Tick 推进按钮 debug。
增加 debug tick 按钮，手动推进一次。

P7.6：正式 /world 显示推进后状态。
让 Renderer 显示推进后的 HomeMapState。

P7.7：持久化策略。
决定 localStorage / backend / session state。

P7.8：旧 construction flow 收缩。
明确旧 construction flow 的长期边界。

P7.9：P7 收口。

## 8. P7 红线

1. Renderer 不能 apply MapDiff。
2. UI 不能绕过 SafeApply。
3. world-evolution executor 不能无审计写入。
4. 不能直接把 debug scenario 结果写进正式世界。
5. 不能让 IntentDecision 直接改 HomeMapState。
6. 不能让管家人格直接生成 placement。
7. 不能让视觉需求反向改变世界事实。
8. 不能用随机数制造不可审计变化。
9. 不能使用 Date.now() 作为不可控世界推进源。
10. 不能在没有 audit trail 的情况下推进世界。
11. 不能让旧 construction flow 继续无限承担长期演化。
12. 不能把 Renderer 当游戏逻辑层。

## 9. P7 MVP 最小可验收目标

P7 最小验收不是“世界很漂亮”。
P7 最小验收是：

1. 用户进入 /world 后有一个 RuntimeWorldState。
2. RuntimeWorldState 包含 currentHomeMapState。
3. 手动推进一次 Tick。
4. Tick 会经过完整 P5 chain。
5. 如果 audit.canApplySafely true，则生成 nextHomeMapState。
6. Renderer 显示 nextHomeMapState。
7. 页面能展示本次 Tick 的 audit trail。
8. 如果 blocked / skipped，要能说明原因。
9. 刷新前状态在本地 runtime 中一致。
10. 不出现 Renderer 直接修改世界。

## 10. 当前结论

P7 先做世界闭环设计，不直接写正式 runtime loop。
下一步进入 P7.1：WorldLoop schema。
P7.1 只定义类型，不接 UI，不执行 MapDiff，不修改 /world。
