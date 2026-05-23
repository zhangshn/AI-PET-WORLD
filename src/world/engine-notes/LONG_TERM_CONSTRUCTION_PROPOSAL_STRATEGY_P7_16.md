> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7.16 长期建设 proposal 扩展策略

## 1. P7.16 的定位

P7.16 是长期建设 proposal 的策略阶段，不直接扩展 `WorldDiffProposal` 代码。

当前 P7 MVP 世界闭环已经具备：

```text
RuntimeWorldState
-> buildWorldLoopStep
-> IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validateMapDiffs
-> WorldEvolutionAuditReport
-> WorldEvolutionExecutionResult
-> SafeApplyDecision
-> RuntimeWorldState
-> RenderableWorldSnapshot
```

但是当前长期建设行为还没有完整展开。P7.16 的目标是明确未来建房、铺路、种树、修复设施、清理区域、移动物体、重组空间等长期建设行为，应该如何进入 `WorldChangePlan -> WorldDiffProposal -> MapDiff -> SafeApply`，而不是继续扩张旧 construction flow。

## 2. 当前 proposal 状态

当前 proposal 层的核心职责是：

1. 把 `WorldChangePlan` 转换成可校验的 `MapDiff`。
2. 不直接写入 `HomeMapState`。
3. 不直接执行世界变化。
4. 把变化留给 validation / audit / execution / SafeApply。
5. 为 Renderer 提供可追溯的世界事实来源。

当前阶段 proposal 可以先覆盖少量行为。长期建设行为必须分批扩展，不能一次性把所有建筑逻辑塞进 proposal builder。

## 3. 长期建设行为应该覆盖什么

未来长期建设 proposal 可以逐步覆盖：

1. 建房子。
2. 扩建院子。
3. 增加道路。
4. 铺设路径。
5. 种树。
6. 增加草地或自然区域。
7. 修复设施。
8. 清理杂乱区域。
9. 移动物体。
10. 移除破损或废弃物。
11. 增加孵化器周边保护设施。
12. 调整宠物活动区。
13. 增加水源或生态点。
14. 重组空间分区。
15. 升级已有设施。

这些行为必须都能表达为一个或多个 `MapDiff`，并且每个 `MapDiff` 都必须能通过 validator / audit。

## 4. 行为进入 proposal 的标准链路

后续任何长期建设行为都应该走：

```text
ButlerIntentContext / PetIntentContext / WorldIntentContext
-> IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validateMapDiffs
-> WorldEvolutionAuditReport
-> WorldEvolutionExecutionResult
-> SafeApplyDecision
-> RuntimeWorldState.currentHomeMapState
```

其中：

1. IntentDecision 只决定“想不想做”。
2. WorldChangePlan 只决定“计划做什么”。
3. WorldDiffProposal 只决定“候选 MapDiff 是什么”。
4. validateMapDiffs 只决定“结构是否合法”。
5. WorldEvolutionAuditReport 只决定“风险是否可接受”。
6. Execution 只产生执行结果。
7. SafeApplyDecision 才决定是否采用 nextHomeMapState。

## 5. WorldChangePlan 扩展建议

未来可以逐步增加或细化 plan 类型，例如：

1. `build_shelter`：建造基础住所或房屋。
2. `expand_home_area`：扩建家园可用区域。
3. `plant_nature`：种植自然物。
4. `build_path`：铺路或连接区域。
5. `repair_facility`：修复已有设施。
6. `clean_area`：清理阻塞或废弃物。
7. `move_object`：移动已有 placement。
8. `remove_object`：移除无效 placement。
9. `upgrade_facility`：升级已有设施。
10. `rebalance_zones`：重新组织空间分区。

注意：
plan 类型不是 UI 文案，也不是 Renderer 指令。它只是意图到 MapDiff 之间的计划协议。

## 6. WorldDiffProposal 扩展建议

每个 proposal 都应该包含：

1. proposal id。
2. 来源 plan id。
3. 来源 intent type。
4. mapDiffs。
5. proposal reason。
6. risk hints。
7. tags。

扩展 proposal 时需要遵守：

1. 不直接修改 HomeMapState。
2. 不直接读取 Renderer。
3. 不从视觉需求反推世界对象。
4. 不为了好看新增无来源 placement。
5. 每个新增 placement 都要能解释来源。
6. 每个 move / remove / update 都要能定位目标。
7. 每个 MapDiff 都必须可验证。

## 7. MapDiff 设计原则

长期建设行为最终必须落到 MapDiff。

建议原则：

1. `add_placement` 用于新增建筑、树、道路节点、设施等。
2. `remove_placement` 用于清除废弃物或撤销无效对象。
3. `update_placement` 用于升级、修复、状态变化。
4. `move_placement` 用于重新布置空间。
5. 多步骤建设可以拆成多个 MapDiff。
6. 每个 MapDiff 必须带有可追溯 reason / source tags。
7. MapDiff 不应该携带 Renderer 样式细节。
8. MapDiff 不应该携带不可审计随机结果。

## 8. 验证与审计要求

每类长期建设 proposal 都必须考虑：

1. 空间是否足够。
2. 是否越界。
3. 是否碰撞。
4. 是否破坏基础设施。
5. 是否影响孵化器安全。
6. 是否与宠物活动区冲突。
7. 是否资源不足。
8. 是否重复建设。
9. 是否会造成不可恢复状态。
10. 是否能被 Renderer 从 HomeMapState 重新显示。

不满足条件时，proposal 可以生成 rejected / blocked 结果，但不能强行写入。

## 9. 与 construction flow 的边界

长期建设 proposal 不能回到旧 construction flow 扩张。

旧 construction flow 保留：

1. 初始世界生成。
2. 初始家园布局。
3. debug scenario。
4. 测试辅助。

长期建设必须进入：

```text
WorldChangePlan
-> WorldDiffProposal
-> validation
-> audit
-> SafeApply
```

不能让 construction flow 成为第二套长期世界引擎。

## 10. 与 Renderer 的边界

Renderer 只能显示最终世界事实。

长期建设 proposal 不能要求 Renderer：

1. 补画不存在的对象。
2. 根据 assetId 直接生成真实 placement。
3. 绕过 HomeMapState 显示新建筑。
4. 把 rejected proposal 当作现实。
5. 把 audit / execution 中间结果当作现实。
6. 修改 HomeMapState。

Renderer 应该只读取：

```text
RuntimeWorldState.currentRenderableSnapshot
```

而这个 snapshot 必须来自已经采用的 `currentHomeMapState`。

## 11. 分阶段扩展路线

建议路线：

### P7.16：长期建设 proposal 扩展策略

只写策略文档，不写 proposal 代码。

### P7.17：P7 persistence / context / proposal 收口

收口 P7.10-P7.16 的边界。

### P7.18：ButlerRuntimeContext schema

定义管家 runtime context。

### P7.19：PetRuntimeContext schema

定义宠物 runtime context。

### P7.20：WorldLoop context adapter

把真实 runtime context 转成 IntentContext。

### P7.21：WorldChangePlan 扩展 schema

开始扩展 plan 类型，但不直接写 proposal。

### P7.22：WorldDiffProposal 扩展 v1

支持第一批长期建设 proposal，例如 `plant_nature` / `build_path` / `clean_area`。

### P7.23：长期建设 proposal debug 审计

用 debug 页面验证 proposal / validation / audit。

## 12. 禁止事项

1. 禁止 proposal 直接修改 HomeMapState。
2. 禁止 proposal 直接调用 applyMapDiffs。
3. 禁止 proposal 绕过 validation。
4. 禁止 proposal 绕过 audit。
5. 禁止 proposal 绕过 SafeApply。
6. 禁止为了视觉效果生成无来源 placement。
7. 禁止 Renderer 参与 proposal 生成。
8. 禁止 construction debug scenario 进入正式 Tick。
9. 禁止把 rejected proposal 当作世界事实。
10. 禁止一次性扩展所有长期建设行为。

## 13. 当前结论

P7.16 只锁定长期建设 proposal 的扩展方向。

当前不写代码。
当前不修改 world-evolution。
当前不修改 world-loop。
当前不修改 Renderer。
当前不扩展 MapDiff。

下一步进入 P7.17：P7 persistence / context / proposal 收口。
