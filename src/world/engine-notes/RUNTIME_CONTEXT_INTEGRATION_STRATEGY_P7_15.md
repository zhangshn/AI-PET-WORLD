# AI-PET-WORLD P7.15 真实管家 / 宠物 runtime context 接入策略

## 1. P7.15 的定位

P7.15 是策略文档阶段，不直接接入真实管家或宠物 runtime 状态。

当前 `/world` 已经具备：

```text
create-world input
-> buildWorldFirstSceneModel
-> buildRuntimeWorldState
-> 手动 Tick
-> buildWorldLoopStep
-> SafeApplyDecision
-> applyWorldLoopStep
-> PersistedWorldLoopState
-> 手动保存 / 页面恢复
-> ProceduralRendererView
```

但是当前 `buildWorldLoopStep` 里的 `butlerIntentContext` 和 `petIntentContext` 仍然可以使用默认 v0 context。P7.15 的目标，是明确真实管家 / 宠物 runtime context 后续如何进入 world-loop，而不是现在直接把人格、宠物行为、关系系统全部塞进 Tick。

## 2. 当前 context 状态

当前 world-loop 已经支持在 `BuildWorldLoopStepInput` 中传入：

```text
butlerIntentContext?: ButlerIntentContext
petIntentContext?: PetIntentContext
```

如果没有传入，runtime builder 会使用默认 context。

当前默认 context 的作用是：

1. 让 P7 MVP 世界闭环可以独立运行。
2. 让手动 Tick 能经过完整 P5 chain。
3. 避免在宠物 / 管家真实 runtime 未完成前阻塞世界闭环。
4. 保持 world-loop 与 personality-core、pet behavior、butler runtime 的低耦合。

## 3. 为什么不能立即接真实 context

不能现在直接接真实管家 / 宠物 runtime context 的原因：

1. 管家人格 runtime 尚未形成正式状态协议。
2. 宠物行为 runtime 尚未与当前 P7 world-loop 稳定连接。
3. 真实 context 需要区分长期人格、短期状态、当前任务和最近事件。
4. 如果直接把 UI 状态塞进 world-loop，会污染世界事实层。
5. 如果直接从 personality-core 深层导入，会造成 world-loop 对人格算法的硬依赖。
6. 如果直接从 pet system 读取临时行为，可能导致 Tick 不可审计。
7. 持久化恢复时也需要同步恢复 context，否则 Tick 输入不一致。
8. 多宠物场景下需要明确聚合策略，不能只读取一个宠物。

## 4. 未来真实管家 context 应包含什么

未来正式 `ButlerIntentContext` 应该由独立 runtime 层提供，而不是由 `/world` 页面拼凑。

建议至少包含：

1. 管家当前 mood。
2. 管家当前 task。
3. 管家建设风格向量。
4. 管家对孵化器 / 宠物 / 家园的关注权重。
5. 管家最近观察到的世界事件。
6. 管家短期疲劳或专注状态。
7. 管家与玩家源头信息生成的人格倾向。
8. 管家对当前世界阶段的判断。
9. 管家是否处于保护性响应。
10. 可审计 tags。

注意：
管家 context 只影响意图评分，不允许直接生成 placement，也不允许直接修改 HomeMapState。

## 5. 未来真实宠物 context 应包含什么

未来正式 `PetIntentContext` 应由宠物 runtime / behavior 层提供。

建议至少包含：

1. 宠物 energy。
2. 宠物 hunger。
3. 宠物 mood。
4. 宠物 currentZoneType。
5. 宠物 recentAction。
6. 宠物当前 drive。
7. 宠物健康或恢复状态。
8. 宠物对环境的关系状态。
9. 宠物是否触发环境需求。
10. 可审计 tags。

多宠物阶段不能简单任选一只宠物。应先定义聚合策略，例如：

1. 最高需求宠物优先。
2. 当前孵化 / 幼年宠物优先。
3. 风险状态宠物优先。
4. 多宠物需求汇总为 household pet context。

## 6. context 进入 world-loop 的原则

真实 context 进入 world-loop 必须遵守：

1. context 是输入，不是执行器。
2. context 不能直接改 HomeMapState。
3. context 不能直接生成 MapDiff。
4. context 不能绕过 IntentDecision。
5. context 不能绕过 WorldChangePlan。
6. context 不能绕过 SafeApply。
7. context 必须可审计。
8. context 必须可 fallback。
9. context 必须能在持久化恢复后重新构建。
10. context 的来源必须清晰标记。

正确链路应为：

```text
ButlerRuntimeState / PetRuntimeState
-> ButlerIntentContext / PetIntentContext
-> buildWorldLoopStep
-> buildButlerIntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validation
-> audit
-> SafeApply
-> RuntimeWorldState
```

## 7. 不应该进入 context 的内容

以下内容不应该直接进入 intent context：

1. 完整 PersonalityProfile 原始盘面。
2. 紫微斗数术语或完整星盘结构。
3. UI hover / selected / viewport 状态。
4. Renderer DrawCommand。
5. VisualState。
6. WorldDiffProposal 历史完整对象。
7. 完整 WorldLoopStepResult。
8. 未裁剪的 auditTrail。
9. debug scenario result。
10. construction debug result。

原因：这些内容要么过重，要么属于调试/展示层，要么会让 context 反向污染世界事实。

## 8. 持久化与 context 的关系

当前 P7.11-P7.14 已经完成 `PersistedWorldLoopState` 手动保存与恢复。

但是当前持久化只保存核心世界事实：

```text
currentHomeMapState
裁剪后的 audit summary
last applied tick summary
tickIndex
worldId / ownerId
```

未来如果接真实 context，需要独立决定：

1. 是否持久化 ButlerRuntimeState。
2. 是否持久化 PetRuntimeState。
3. 是否只在进入页面时重新派生 context。
4. 是否把 context summary 写进 tick audit。
5. context 版本如何迁移。
6. context 恢复失败如何 fallback 到默认 context。

在没有明确策略前，不应该把真实 context 偷偷塞进 `PersistedWorldLoopState`。

## 9. 分阶段接入路线

建议路线：

### P7.15：真实管家 / 宠物 runtime context 接入策略

只写策略文档，明确 context 边界。

### P7.16：长期建设 proposal 扩展策略

决定建房、铺路、种树、清理、重组空间等行为如何从 intent 进入 proposal。

### P7.17：P7 persistence 收口

收口 P7.10-P7.16 的持久化、context、proposal 边界。

### P7.18：ButlerRuntimeContext schema

只定义管家 runtime context 协议，不接 UI。

### P7.19：PetRuntimeContext schema

只定义宠物 runtime context 协议，不接 UI。

### P7.20：WorldLoop context adapter

把 ButlerRuntimeState / PetRuntimeState 转换成 IntentContext。

### P7.21：/world 手动 Tick 使用真实 context

在手动 Tick 中传入真实 context，但仍然不自动 Tick。

## 10. 禁止事项

1. 禁止 `/world` 页面直接拼复杂人格算法。
2. 禁止 world-loop 深层导入 personality-core。
3. 禁止宠物行为直接修改 HomeMapState。
4. 禁止管家人格直接生成 placement。
5. 禁止 context 绕过 SafeApply。
6. 禁止 context 绕过 WorldChangePlan / WorldDiffProposal。
7. 禁止把 debug scenario result 当作真实 context。
8. 禁止把 Renderer 状态当作 context。
9. 禁止把完整星盘或完整人格档案塞进 Tick。
10. 禁止在没有 schema 的情况下把 context 写入持久化。

## 11. 当前结论

P7.15 只锁定真实管家 / 宠物 runtime context 的接入边界。

当前不写代码。
当前不修改 `/world`。
当前不修改 world-loop。
当前不修改 personality-core。
当前不修改 pet system。

下一步进入 P7.16：长期建设 proposal 扩展策略。
