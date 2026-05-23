> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7 persistence / context / proposal 收口

## 1. P7.17 的定位

P7.17 是 P7 后半段的阶段性收口文档。

它收口范围包括：

1. P7.10 PersistedWorldLoopState schema。
2. P7.11 persistence adapter。
3. P7.12 `/world` 恢复 persisted state。
4. P7.13 手动保存按钮。
5. P7.14 自动保存策略评估。
6. P7.15 真实管家 / 宠物 runtime context 接入策略。
7. P7.16 长期建设 proposal 扩展策略。

P7.17 不写新代码，不新增 schema，不修改 `/world`，只明确当前阶段已经完成什么、仍然禁止什么、下一阶段应该从哪里开始。

## 2. 当前已完成能力

当前项目已经具备：

```text
create-world input
-> buildWorldFirstSceneModel
-> buildRuntimeWorldState
-> RuntimeWorldState.currentHomeMapState
-> 手动推进 Tick
-> buildWorldLoopStep
-> SafeApplyDecision
-> applyWorldLoopStep
-> RuntimeWorldState.currentRenderableSnapshot
-> ProceduralRendererView
```

并进一步具备：

1. `PersistedWorldLoopState` schema。
2. 裁剪后的 auditTrail summary。
3. persistence adapter。
4. `/world` 页面进入时恢复 persisted state。
5. `/world` 手动保存世界状态。
6. 恢复时重新派生 `RenderableWorldSnapshot`。
7. 自动保存策略评估文档。
8. 真实 context 接入边界文档。
9. 长期建设 proposal 扩展边界文档。

## 3. P7.10-P7.16 完成内容总表

| 阶段 | 内容 | 是否完成 | 结果 |
| --- | --- | --- | --- |
| P7.10 | PersistedWorldLoopState schema | 是 | 定义持久化核心事实、审计摘要与校验 helper。 |
| P7.11 | persistence adapter | 是 | 增加 storage adapter，只保存 PersistedWorldLoopState。 |
| P7.12 | `/world` 恢复 persisted state | 是 | 页面进入时按 worldId / ownerId 恢复，并重新派生 snapshot。 |
| P7.13 | 手动保存按钮 | 是 | 用户可点击保存当前裁剪后的世界状态。 |
| P7.14 | 自动保存策略评估 | 是 | 明确当前不实现自动保存。 |
| P7.15 | 真实管家 / 宠物 runtime context 接入策略 | 是 | 明确 context 只能作为 world-loop 输入。 |
| P7.16 | 长期建设 proposal 扩展策略 | 是 | 明确长期建设必须走 plan / proposal / validation / audit / SafeApply。 |
| P7.17 | 阶段收口 | 是 | 收口 persistence / context / proposal 的边界。 |

## 4. 当前持久化边界

当前持久化只保存：

1. `version`。
2. `worldId`。
3. `ownerId`。
4. `tickIndex`。
5. `currentHomeMapState`。
6. `lastAppliedTick` 摘要。
7. `auditTrailSummary`。
8. `savedAt`。
9. `tags`。

当前不保存：

1. 完整 `RuntimeWorldState`。
2. 完整 `WorldLoopStepResult`。
3. `currentRenderableSnapshot`。
4. `RenderableWorldSnapshot`。
5. `VisualState`。
6. `DrawCommand[]`。
7. Renderer viewport / hover / selected 状态。
8. debug scenario result。
9. construction debug result。
10. 真实管家 / 宠物 runtime context。

## 5. 当前恢复流程

当前 `/world` 恢复流程为：

```text
进入 /world
-> buildWorldFirstSceneModel
-> buildRuntimeWorldState fallback
-> loadPersistedWorldLoopState
-> validate persisted version / worldId / ownerId
-> 使用 persisted.currentHomeMapState
-> buildWorldLoopRenderableState
-> RuntimeWorldState.currentRenderableSnapshot
-> ProceduralRendererView
```

关键原则：

1. 恢复失败必须 fallback 到 `firstSceneModel`。
2. 恢复时不信任任何 Renderer 派生对象。
3. `RenderableWorldSnapshot` 必须从 `currentHomeMapState` 重新派生。
4. 恢复时不恢复完整 `lastStepResult`。
5. 恢复时不恢复完整 `auditTrail`。
6. 当前只支持本地 `localStorage` 手动保存 / 恢复。

## 6. 当前保存策略

当前只允许用户点击：

```text
手动保存世界状态
```

保存动作：

```text
RuntimeWorldState
-> buildPersistedWorldLoopState
-> JSON.stringify
-> storage.setItem(worldId scoped key)
```

当前禁止：

1. 自动保存。
2. Tick 后自动保存。
3. setInterval 保存。
4. setTimeout 保存。
5. useEffect 自动保存。
6. 页面关闭前自动保存。
7. 高频写入 storage。

自动保存必须等后续策略、实验开关、失败恢复和多标签页冲突策略明确后再实现。

## 7. 当前真实 context 边界

真实管家 / 宠物 runtime context 未来可以进入 world-loop，但必须满足：

1. context 只能作为 `buildWorldLoopStep` 输入。
2. context 不能直接修改 `HomeMapState`。
3. context 不能直接生成 placement。
4. context 不能绕过 `IntentDecision`。
5. context 不能绕过 `WorldChangePlan`。
6. context 不能绕过 `WorldDiffProposal`。
7. context 不能绕过 `SafeApplyDecision`。
8. context 必须可审计。
9. context 必须可 fallback。
10. context 写入持久化前必须先有独立 schema。

当前不直接接真实管家 / 宠物 runtime context 代码。

## 8. 当前长期建设 proposal 边界

长期建设行为未来必须进入：

```text
IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validateMapDiffs
-> WorldEvolutionAuditReport
-> WorldEvolutionExecutionResult
-> SafeApplyDecision
-> RuntimeWorldState.currentHomeMapState
```

长期建设包括：

1. 建房子。
2. 扩建院子。
3. 铺路。
4. 种树。
5. 修复设施。
6. 清理区域。
7. 移动物体。
8. 重组空间。
9. 升级设施。

当前不扩展 proposal 代码。
当前不扩展 MapDiff。
当前不修改 world-evolution。
当前不让 construction flow 继续扩张。

## 9. 当前仍未实现内容

当前仍未实现：

1. 自动保存。
2. 后端持久化。
3. 多设备同步。
4. 多标签页冲突处理。
5. 真实 ButlerRuntimeContext schema。
6. 真实 PetRuntimeContext schema。
7. WorldLoop context adapter。
8. 手动 Tick 使用真实 context。
9. 长期建设 plan schema 扩展。
10. 长期建设 proposal builder 扩展。
11. proposal debug 页面。
12. 自动 Tick。
13. 离线运行。
14. 宠物行为真实驱动世界变化。
15. 管家人格真实驱动长期建设。

## 10. 下一阶段建议路线

建议后续路线：

### P7.18：ButlerRuntimeContext schema

定义管家 runtime context，但不接 `/world`。

### P7.19：PetRuntimeContext schema

定义宠物 runtime context，但不接 `/world`。

### P7.20：WorldLoop context adapter

把 ButlerRuntimeState / PetRuntimeState 转成 `ButlerIntentContext` / `PetIntentContext`。

### P7.21：/world 手动 Tick 使用真实 context

只在手动 Tick 中传入真实 context，不做自动 Tick。

### P7.22：WorldChangePlan 扩展 schema

扩展长期建设 plan 类型。

### P7.23：WorldDiffProposal 扩展 v1

支持第一批长期建设 proposal。

### P7.24：proposal debug 审计页

验证 proposal / validation / audit / SafeApply。

### P7.25：P7 后续收口

收口 context + proposal 扩展。

## 11. 继续开发前检查清单

- [ ] `/world` 没有自动 Tick。
- [ ] `/world` 没有自动保存。
- [ ] 保存内容不是完整 RuntimeWorldState。
- [ ] 保存内容不包含 RenderableWorldSnapshot。
- [ ] 恢复时重新派生 RenderableWorldSnapshot。
- [ ] Renderer 没有参与保存或恢复。
- [ ] context 没有直接修改 HomeMapState。
- [ ] context 没有绕过 Intent / Plan / Proposal / SafeApply。
- [ ] proposal 没有直接调用 applyMapDiffs。
- [ ] proposal 没有绕过 validation / audit。
- [ ] construction debug scenario 没有进入正式 Tick。
- [ ] rejected proposal 没有被当作世界事实。

## 12. 当前结论

P7.10-P7.17 可以阶段性收口。

AI-PET-WORLD 当前已经具备：

```text
手动 Tick
-> SafeApply 安全闭环
-> RuntimeWorldState
-> 手动保存 / 恢复
-> Renderer 显示当前世界事实
```

下一阶段不建议继续堆 UI。建议从 `ButlerRuntimeContext schema` 和 `PetRuntimeContext schema` 开始，把真实管家 / 宠物状态用协议方式接入 world-loop。
