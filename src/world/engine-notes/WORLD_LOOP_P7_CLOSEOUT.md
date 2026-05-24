> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7 MVP 世界闭环收口

## 1. P7 收口范围

P7 的目标不是最终游戏循环。
P7 的目标不是自动运行世界。
P7 的目标不是持久化。
P7 的目标是让 MVP 世界闭环第一次安全跑通：

```text
HomeMapState
-> EnvironmentState
-> IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validateMapDiffs
-> WorldEvolutionAuditReport
-> WorldEvolutionExecutionResult
-> SafeApplyDecision
-> RuntimeWorldState
-> RenderableWorldSnapshot
-> ProceduralRendererView
```

## 2. P7 完成内容总表

| 阶段 | 内容 | 是否完成 | 结果 |
| --- | --- | --- | --- |
| P7.0 | MVP 世界闭环总设计文档 | 是 | 明确 P7 数据链路、红线与阶段路线。 |
| P7.1 | WorldLoop schema | 是 | 定义 RuntimeWorldState、WorldLoopStepResult、WorldLoopAuditTrail 等协议。 |
| P7.2 | SafeApply policy | 是 | 定义正式采用 nextHomeMapState 前的 runtime-level 安全门。 |
| P7.3 | WorldLoop runtime builder | 是 | 将 P5 chain 与 P6 snapshot 派生封装成一次 world loop step。 |
| P7.4 | 正式世界 state holder / local runtime | 是 | /world 建立 RuntimeWorldState，但不自动 Tick。 |
| P7.5 | Tick 推进按钮 debug | 是 | /world 支持手动 Tick 并更新 runtimeState。 |
| P7.6 | Tick 后状态可视确认与审计摘要增强 | 是 | /world 展示 delta、stage、blockers、warnings、notes。 |
| P7.7 | WorldLoop 持久化策略文档 | 是 | 明确持久化边界，当前不实现 storage。 |
| P7.8 | 旧 construction flow 收缩文档 | 是 | 明确 construction flow 收缩为 initial generation / debug support。 |
| P7.9 | P7 收口文档 | 是 | 汇总 P7.0-P7.9 当前状态与后续路线。 |

## 3. 当前正式 /world 数据链路

当前正式 /world 链路为：

```text
create-world input
-> buildWorldFirstSceneModel
-> buildRuntimeWorldState
-> RuntimeWorldState.currentHomeMapState
-> 手动推进 Tick
-> buildWorldLoopStep
-> buildButlerIntentDecision
-> buildWorldChangePlan
-> buildWorldDiffProposal
-> validateMapDiffs
-> buildWorldEvolutionAuditReport
-> buildWorldEvolutionExecution
-> buildSafeApplyDecision
-> applyWorldLoopStep
-> RuntimeWorldState.currentRenderableSnapshot
-> ProceduralRendererView
```

说明：

1. /world 页面只持有 RuntimeWorldState。
2. /world 页面不直接 applyMapDiffs。
3. /world 页面不直接调用 world-evolution executor。
4. /world 页面不修改 HomeMapState。
5. Renderer 不修改 HomeMapState。
6. Tick 只能手动触发。

## 4. SafeApply 当前作用

SafeApplyDecision 当前是正式采用 nextHomeMapState 的唯一开关。

allow_apply 条件：

1. proposal 有 MapDiff。
2. validation 没有 rejectedDiffs。
3. audit.summary.canApplySafely === true。
4. execution.status === "applied"。
5. execution.appliedMapDiffCount 与 proposal.mapDiffs.length 一致。
6. nextHomeMapState.worldId 与 previousHomeMapState.worldId 一致。
7. nextHomeMapState.ownerId 与 previousHomeMapState.ownerId 一致。

如果不满足，则 RuntimeWorldState 继续使用 previousHomeMapState。

## 5. 当前 Renderer 状态

当前 Renderer：

1. 只读取 RuntimeWorldState.currentRenderableSnapshot。
2. currentRenderableSnapshot 来自 RenderableWorldSnapshot。
3. RenderableWorldSnapshot 从 currentHomeMapState 派生。
4. Renderer 不读取 proposal / audit / execution。
5. Renderer 不执行 MapDiff。
6. Renderer 不修改 HomeMapState。
7. Renderer 不是最终美术。
8. Renderer 当前用于 MVP 世界事实可视化。

## 6. 当前 RuntimeWorldState 状态

RuntimeWorldState 当前包含：

1. worldId。
2. ownerId。
3. tickIndex。
4. currentHomeMapState。
5. currentRenderableSnapshot。
6. lastStepResult。
7. auditTrail。
8. tags。

当前 RuntimeWorldState 只存在 React memory state。
刷新页面会回到 firstSceneModel。
这是当前安全设计，不是 bug。

## 7. 当前 construction flow 边界

construction flow 当前保留：

1. initial generation。
2. initial home layout。
3. create-world 后第一幕辅助。
4. construction debug scenario。
5. mapdiff debug 输入。

construction flow 不再承担：

1. 长期世界推进。
2. 正式 Tick。
3. SafeApply。
4. RuntimeWorldState 修改。
5. Renderer 数据源。
6. 持久化恢复。

后续建设能力应该进入：

```text
IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validation
-> audit
-> SafeApply
-> RuntimeWorldState
```

## 8. 当前没有实现的内容

P7 当前没有实现：

1. 自动 Tick。
2. 离线运行。
3. localStorage 持久化。
4. backend persistence。
5. sessionStorage 临时恢复。
6. 持久化 schema。
7. persistence adapter。
8. 多宠物 runtime context。
9. 管家真实人格 runtime context。
10. 宠物行为与 Tick 的真实连接。
11. 长期建设行为完整 proposal。
12. 复杂视觉增强。
13. 性能策略。
14. 完整审计日志归档。
15. construction flow 删除。

## 9. P7 当前最小验收标准

当前 P7 最小验收标准：

1. 用户进入 /world 后生成 RuntimeWorldState。
2. RuntimeWorldState 有 currentHomeMapState。
3. 用户可以手动点击 Tick。
4. Tick 经过完整 world-loop step。
5. Tick 经过 SafeApplyDecision。
6. RuntimeWorldState 根据 step result 更新。
7. Renderer 显示 currentRenderableSnapshot。
8. 页面显示 Tick 审计摘要。
9. 页面显示阶段链路。
10. 页面显示 blockers / warnings / notes。
11. 没有自动 Tick。
12. 没有持久化。
13. Renderer 没有修改世界。
14. UI 没有直接 apply MapDiff。

## 10. P7 后续路线

P7.10：PersistedWorldLoopState schema

P7.11：persistence adapter，不接 UI

P7.12：/world 恢复 persisted state

P7.13：手动保存按钮

P7.14：自动保存策略评估

P7.15：真实管家 / 宠物 runtime context 接入策略

P7.16：长期建设 proposal 扩展策略

P7.17：P7 persistence 收口

## 11. 继续开发前检查清单

- [ ] /world 没有自动 Tick。
- [ ] /world 没有 localStorage 写入。
- [ ] /world 没有 sessionStorage 写入。
- [ ] Renderer 没有执行 MapDiff。
- [ ] Renderer 没有修改 HomeMapState。
- [ ] UI 没有直接调用 applyMapDiffs。
- [ ] UI 没有直接调用 buildWorldEvolutionExecution。
- [ ] Tick 只能通过 buildWorldLoopStep。
- [ ] RuntimeState 更新只能通过 applyWorldLoopStep。
- [ ] SafeApplyDecision 是采用 nextHomeMapState 的唯一开关。
- [ ] construction debug scenario 没有进入正式 /world Tick。
- [ ] 持久化 schema 尚未开始实现。
- [ ] P7.10 前不写持久化代码。

## 12. 当前结论

P7.0-P7.9 可以收口。
AI-PET-WORLD 已经具备 MVP 世界闭环 v0：

```text
手动 Tick
-> 安全链路
-> RuntimeWorldState
-> Renderer 显示当前世界事实
```

下一阶段进入 P7.10：
PersistedWorldLoopState schema。

P7.10 仍然不直接写 localStorage adapter。
先定义持久化 schema，再写 adapter，再接 /world 恢复。
