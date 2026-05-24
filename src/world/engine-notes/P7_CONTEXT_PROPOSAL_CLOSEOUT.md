> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7.25 context + proposal 收口

## 1. P7.25 的定位

P7.25 是 P7 后段关于 runtime context 与长期建设 proposal 的阶段性收口文档。

收口范围包括：

1. P7.18 ButlerRuntimeContext schema。
2. P7.19 PetRuntimeContext schema。
3. P7.20 WorldLoop context adapter。
4. P7.21 `/world` 手动 Tick 使用真实 runtime context。
5. P7.22 WorldChangePlan 扩展 schema。
6. P7.23 WorldDiffProposal 扩展 v1。
7. P7.24 proposal debug 审计页。

P7.25 不写新代码，不修改 `/world`，不修改 Renderer，不扩展新的 MapDiff，只明确当前已完成能力、仍然禁止的边界，以及后续进入 P8 视觉阶段前需要注意什么。

## 2. 当前已经完成的 context 链路

当前真实 context 链路已经形成最小闭环：

```text
ButlerRuntimeContext
PetRuntimeContext
-> runtime-context adapter
-> ButlerIntentContext / PetIntentContext
-> buildWorldLoopStep
-> IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validation
-> audit
-> execution
-> SafeApply
```

`/world` 页面目前仍然只支持手动 Tick，但手动 Tick 已经会构建默认 ButlerRuntimeContext / PetRuntimeContext，并在校验通过后转成 intent context 传入 world-loop。

这意味着：

1. 管家与宠物 runtime context 不再只是策略文档。
2. context 已经可以影响正式 Tick 的意图输入。
3. context 仍然不能直接修改 HomeMapState。
4. context 仍然不能绕过 WorldChangePlan / WorldDiffProposal / SafeApply。
5. context 当前不写入 PersistedWorldLoopState。

## 3. 当前已经完成的 proposal 链路

当前 proposal 链路已经从单一 `plant_nature` 扩展到第一批长期建设动作：

```text
plant_nature
build_path
clean_area
repair_facility
```

这些 plan 现在可以生成 MapDiff：

1. `plant_nature`：新增自然细节 placement。
2. `build_path`：新增 path placement。
3. `clean_area`：移除可清理的 surface-decoration。
4. `repair_facility`：更新 facility 的 label / alpha / tags。

它们仍然必须经过：

```text
validateMapDiffs
-> WorldEvolutionAuditReport
-> WorldEvolutionExecutionResult
-> SafeApplyDecision
```

不允许 proposal 直接修改 HomeMapState。

## 4. 当前 debug 验证能力

P7.24 已新增：

```text
/world-debug/proposal-audit
```

该页面会批量审计：

1. plant_nature。
2. build_path。
3. clean_area。
4. repair_facility。

每个 scenario 都会显示：

1. plan type。
2. proposal type。
3. mapDiff count。
4. validation accepted / rejected count。
5. audit risk。
6. audit canApplySafely。
7. execution status。
8. SafeApply status。
9. appliedMapDiffCount。
10. warnings / blockers / notes。
11. MapDiff operation / placementId / reason。

这个 debug 页只用于审计链路，不代表正式 `/world` 页面，也不代表 Renderer 已进入正式美术阶段。

## 5. 当前仍然不是正式视觉阶段

当前 `/world` 已经能显示世界数据与线框预览，但仍然不是正式画面阶段。

当前阶段的准确定位是：

```text
世界数据可被 Renderer 读取
DrawCommand 可被线框预览显示
Tick 后的 MapDiff 可以改变 HomeMapState
但正式像素美术、贴图渲染、角色动画还未开始
```

所以当前不是纯数据阶段，但也不是最终画图阶段。

P8 才应开始处理：

1. 正式像素地图表现。
2. 草地 / 道路 / 建筑 / 自然物贴图显示。
3. 管家与宠物像素形象。
4. 动画状态。
5. 画面层级、镜头、缩放、交互反馈。

## 6. 当前已完成能力总表

| 阶段 | 内容 | 当前状态 |
| --- | --- | --- |
| P7.18 | ButlerRuntimeContext schema | 已完成 |
| P7.19 | PetRuntimeContext schema | 已完成 |
| P7.20 | Runtime context -> intent context adapter | 已完成 |
| P7.21 | `/world` 手动 Tick 使用真实 runtime context | 已完成 |
| P7.22 | WorldChangePlan 长期建设协议扩展 | 已完成 |
| P7.23 | WorldDiffProposal 第一批长期建设 MapDiff 扩展 | 已完成 |
| P7.24 | proposal debug 审计页 | 已完成 |
| P7.25 | context + proposal 收口 | 已完成 |

## 7. 当前仍未实现内容

当前仍未实现：

1. 自动 Tick。
2. 自动保存。
3. 后端持久化。
4. 云端同步。
5. 离线运行。
6. 多标签页冲突处理。
7. ButlerRuntimeContext 的真实动态更新。
8. PetRuntimeContext 的真实动态更新。
9. 宠物出生后的真实人格注入。
10. 多宠物 context 聚合。
11. build_shelter / build_structure / expand_area 等更复杂 proposal。
12. 正式 Renderer 贴图渲染。
13. 正式像素美术阶段。
14. 管家 / 宠物动画系统。

## 8. 继续开发红线

后续继续开发必须遵守：

1. context 只能作为 world-loop 输入，不能直接改 HomeMapState。
2. proposal 只能生成候选 MapDiff，不能直接写世界。
3. validate / audit / execution / SafeApply 仍然是正式写入前的必要链路。
4. Renderer 只能读取最终 HomeMapState / RenderableWorldSnapshot。
5. Renderer 不能读取 proposal 当作现实。
6. debug 页不能成为正式世界入口。
7. P8 视觉增强不能反向创造世界事实。
8. 自动 Tick 不能在未完成稳定策略前开启。
9. 自动保存不能在未完成失败恢复与多标签页策略前开启。
10. 持久化仍然不能保存完整 RuntimeWorldState 或 Renderer 派生对象。

## 9. 建议下一阶段路线

P7.25 后建议进入 P8，但 P8 仍然要分层推进。

建议路线：

### P8.0：正式视觉阶段规划

只写视觉阶段规划文档，明确线框 Renderer、正式 Renderer、贴图 Renderer 的边界。

### P8.1：World visual asset usage strategy

明确哪些 assetId 可以进入正式 Renderer，如何按 layer / category 显示。

### P8.2：正式 ProceduralRenderer 第一版

从 RenderableWorldSnapshot 读取 DrawCommand / placement，显示基础贴图，不做动画。

### P8.3：路径 / 自然物 / 设施可视变化验证

验证 P7.23 的 plant_nature / build_path / clean_area / repair_facility 在画面上能看见。

### P8.4：管家与宠物像素占位显示

先显示占位像素角色，不接复杂动画。

### P8.5：视觉收口

确认 Renderer 仍然只读世界事实，不反向生成世界。

## 10. 当前结论

P7 context + proposal 可以阶段性收口。

当前 AI-PET-WORLD 已经具备：

```text
真实 runtime context 输入
-> intent context adapter
-> 手动 Tick
-> WorldChangePlan
-> WorldDiffProposal
-> MapDiff validation
-> Audit
-> Execution
-> SafeApply
-> HomeMapState 更新
-> Renderer 读取当前世界事实
```

下一阶段可以进入 P8 视觉层，但 P8 的第一步应该仍然是规划和边界确认，不建议一上来直接追求漂亮画面。
