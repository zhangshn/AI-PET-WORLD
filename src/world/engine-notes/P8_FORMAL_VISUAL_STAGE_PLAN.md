# AI-PET-WORLD P8 正式视觉阶段总控计划

## 1. 文档定位

本文档是 P8 正式视觉阶段与后续世界生成、建设模块的总控计划。

当前最高依据：

1. `AI-PET-WORLD MVP完整计划书 v1.5`。
2. `AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3`。
3. `AI-PET-WORLD MVP整体架构设计文档 v1.0`。

若旧 README、旧 docs/mvp、旧测试报告与以上三份正式文档冲突，以三份正式文档为准。

## 2. 当前正式主线

当前正式主线不是前端手写世界画面，而是：

```text
世界事实
-> 渲染投影
-> RenderableWorldSnapshot / VisualState
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView 只读渲染
```

建设链路当前推进为：

```text
HomeMapState
+ 管家建设倾向
+ 资源状态
+ 世界阶段
-> ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> ConstructionExecutionResult
-> MapDiff[] 候选
-> SafeApply
-> nextHomeMapState
-> ConstructionWorldLoopProtocolResult
```

核心原则：

1. 世界内容必须由规则、状态、生成容器和可审计链路产生。
2. FormalVisualModel 是正式视觉模型容器。
3. FormalWorldView 只能只读 FormalVisualModel。
4. Debug View 与 Formal World View 必须分离。
5. CSS 只能控制表现，不能决定世界事实。
6. PNG / WORLD_MAP_ASSETS 只能作为表现资源，不能作为世界事实来源。
7. 当前正式 MVP 不包含旧默认宠物开局路线。
8. 宠物未来能力保留，但只能通过 LifeEvent / CompanionDecision / accept_companion 后置进入。
9. ConstructionWorldLoopProtocol 当前只是接入前协议，不能等同于已接入真实 world-loop。

## 3. 已完成阶段总表

| 阶段 | 状态 | 说明 |
|---|---:|---|
| P8-I-RESET | 已完成 | 作废旧 FormalWorldView 手写视觉路线。 |
| VISUAL-MODEL-00 | 已完成 | 定义 FormalVisualModel schema。 |
| VISUAL-MODEL-01 | 已完成 | 实现 FormalVisualGenerator 纯函数层。 |
| FORMAL-VIEW-00 | 已完成 | 新增 FormalWorldView 只读组件。 |
| FORMAL-VIEW-01 | 已完成 | 新增 preview harness，限定为开发预览。 |
| FORMAL-VIEW-02 | 已完成 | 完成 /world 正式接入前检查。 |
| FORMAL-VIEW-03 | 已完成 | /world 从真实 snapshot 构建 FormalVisualModel。 |
| FORMAL-VIEW-04 | 已完成 | 默认 Formal，Debug 保留，Both 用于开发对照。 |
| WORLD-GEN-00 | 已完成 | 审计世界生成链路和旧宠物默认风险。 |
| MVP-ALIGN-01 | 已完成 | 审计旧路线与默认宠物运行链路。 |
| WORLD-GEN-01A/B | 已完成 | 修正正式首屏旧文案，断开 /world 默认 pet runtime。 |
| MVP-ALIGN-02 | 已完成 | 移除正式链路中的旧路线 / 默认宠物 / pet_arrival / pet_rest。 |
| MVP-ALIGN-03 | 已完成 | 对齐文档体系，清理旧 README / legacy docs / 乱码计划文档。 |
| WORLD-GEN-02 | 已完成 | 建立 worldSeed + personality layout input schema，并接入 PlacementEngine。 |
| WORLD-GEN-03 | 已完成 | 建立多 seed / 多人格 / 多资源布局差异化验证与 debug audit。 |
| CONSTRUCTION-00 | 已完成 | 建立 ConstructionPlanner 输入协议与输入审计。 |
| CONSTRUCTION-01 | 已完成 | 建立 ConstructionPlanner 候选计划生成与候选审计。 |
| CONSTRUCTION-02 | 已完成 | 建立 ConstructionExecutor 与 MapDiff 候选生成协议。 |
| CONSTRUCTION-03 | 已完成 | 建立 MapDiff SafeApply 与 HomeMapState 更新协议。 |
| CONSTRUCTION-04 | 已完成 | 建立 Construction World Loop 接入前协议。 |

## 4. 已废弃路线

以下路线已作废，不能恢复：

1. 在 FormalWorldView 组件内生成 FormalWorldVisualItem。
2. 在 FormalWorldView 组件内生成 FormalActorVisualItem。
3. 在组件内写 buildFormalWorldVisualItems。
4. 在组件内写 buildFormalActorVisualItems。
5. 由前端组件决定树、房子、道路、设施、管家或宠物如何存在。
6. 用 PNG / WORLD_MAP_ASSETS 反向决定世界对象是否存在。
7. 默认生成宠物、宠物床、宠物抵达区、宠物休息区。

## 5. Formal 视觉链路现状

当前已建立的正式视觉链路：

```text
HomeMapState / WorldState
-> placements / MapDiff
-> VisualState / RenderableWorldSnapshot
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView
```

边界：

1. HomeMapState 保存世界事实。
2. MapDiff 保存世界变化。
3. VisualState / RenderableWorldSnapshot 保存可渲染投影。
4. FormalVisualModel 保存正式玩家主视觉模型。
5. FormalWorldView 只负责渲染 FormalVisualModel。
6. Debug Renderer 只用于工程对照，不是最终玩家 UI。
7. ConstructionWorldLoopProtocolResult 当前只是接入前协议输出，不等同于 runtime 已经接入。

## 6. 世界生成与建设链路现状

当前已具备：

1. worldSeed。
2. WorldLayoutGenerationInput。
3. WorldLayoutPersonalityInput。
4. WorldLayoutResourceInput。
5. WorldLayoutPhaseInput。
6. WorldLayoutVariantInput。
7. InitialHomeGenerator。
8. HomeMapState。
9. Scene Recipe。
10. PlacementEngine。
11. Placement rules / layout rules。
12. RenderableWorldSnapshot。
13. FormalVisualModel。
14. FormalWorldView。
15. WorldLayoutVariationScenario。
16. WorldLayoutVariationAudit。
17. ConstructionPlannerInput。
18. ButlerConstructionIntentInput。
19. ConstructionPlannerInputAudit。
20. ConstructionPlanCandidateResult。
21. ConstructionPlanCandidateAudit。
22. ConstructionExecutionInput。
23. ConstructionExecutionResult。
24. ConstructionExecutionAudit。
25. MapDiff candidate generation。
26. ConstructionSafeApplyInput。
27. ConstructionSafeApplyResult。
28. ConstructionSafeApplyAudit。
29. ConstructionWorldLoopProtocolInput。
30. ConstructionWorldLoopProtocolResult。
31. ConstructionWorldLoopAudit。

当前已完成中性化：

1. `pet_arrival` 已移除。
2. `pet_rest` 已移除。
3. 初始世界不再默认生成 pet actor。
4. 初始世界不再默认生成 pet bed。
5. 初始世界不再默认生成 pet 专属设施。
6. 初始区域改为 entry_area / initial_care / temporary_shelter / quiet_living / storage_tools / natural_boundary。
7. ConstructionPlanner 输入协议不生成宠物相关建设意图。
8. ConstructionPlan 候选不生成宠物相关建设计划。
9. ConstructionExecutor 不生成宠物相关 MapDiff。
10. SafeApply 不接受宠物相关 MapDiff。
11. World loop pre-integration protocol 不接入宠物系统。

WORLD-GEN-02 已完成：

1. 由 stable seed 派生 layout variant。
2. 由管家建设人格映射 structure / care / protection / aesthetic / quiet / adaptability 布局倾向。
3. 由初始资源映射 material / care / natural / ground / space 布局约束。
4. PlacementEngine 开始读取 layout input 影响路径、住所、自然边界、安静生活区和装饰。

WORLD-GEN-03 已完成：

1. 定义多 seed / 多人格 / 多资源对照场景。
2. 对同一场景重复生成 placement fingerprint，验证稳定复现。
3. 对不同场景进行 variant、关键坐标、metrics 与 fingerprint 对比。
4. 输出可复用 debug audit，不靠肉眼猜测布局差异。
5. 保持 audit 工具只读生成层与 PlacementEngine，不接入 UI。

CONSTRUCTION-00 已完成：

1. 扩展 ConstructionPlanner 输入协议。
2. 从 HomeMapState、管家建设倾向、资源快照和世界日数构建 planner input。
3. 生成建设意图输入，但不生成 MapDiff。
4. 通过 input audit 检查稳定 fingerprint、intent 合法性和旧路线 token。
5. 保持 ConstructionPlanner 输入协议不修改 HomeMapState、不接入 UI、不接入宠物。

CONSTRUCTION-01 已完成：

1. 新增 ConstructionPlanCandidateResult。
2. 新增 ConstructionPlanCandidateAudit。
3. 从 ConstructionPlannerInput 生成多个 ConstructionPlan 候选。
4. 根据已有计划 id 跳过重复候选。
5. 候选计划 priority 由 intent、资源敏感度、空间敏感度、阶段加成和发展压力共同计算。
6. 候选 audit 检查 stable output fingerprint、重复 plan id、stage 边界和旧路线 token。
7. 保持候选计划不生成 MapDiff、不修改 HomeMapState、不接入 UI、不接入宠物。

CONSTRUCTION-02 已完成：

1. 新增 ConstructionExecutionAudit。
2. 补齐 ConstructionExecutionResult.audit。
3. 新增 ConstructionMapDiffCandidate / ConstructionExecutionBuildResult 协议容器。
4. 实现 buildConstructionExecutionResult。
5. Executor 根据 selected ConstructionPlan 生成 MapDiff 候选。
6. MapDiff 候选只 update 已有 placement，不直接应用到 HomeMapState。
7. Execution audit 检查重复 diff id、placement 引用、createdAt、candidate tag、nextPlan id 与旧路线 token。
8. 保持 Executor 不接 UI、不接宠物、不绕过 HomeMapState / MapDiff / FormalVisualModel 链路。

CONSTRUCTION-03 已完成：

1. 新增 ConstructionSafeApplyInput。
2. 新增 ConstructionSafeApplyResult。
3. 新增 ConstructionSafeApplyRejectedDiff。
4. 新增 ConstructionSafeApplyAudit。
5. 实现 buildConstructionSafeApplyResult。
6. SafeApply 当前只接受 update 已存在 placement。
7. SafeApply 当前拒绝 add / remove / move。
8. SafeApply 返回新的 nextHomeMapState，不修改输入 HomeMapState 原对象。
9. SafeApply 会追加 accepted MapDiff 到 HomeMapState.mapDiffs。
10. SafeApply 会在已有 constructionPlans 中更新对应 plan summary，但不会强行新增 plan。
11. 新增 SafeApply audit 检查 diff 覆盖率、HomeMapState identity、updatedAt、actor placement、禁止 token 与 stable fingerprint。

CONSTRUCTION-04 已完成：

1. 新增 ConstructionWorldLoopProtocolInput。
2. 新增 ConstructionWorldLoopProtocolResult。
3. 新增 ConstructionWorldLoopAudit。
4. 实现 buildConstructionWorldLoopProtocolResult。
5. 协议按 planner input -> candidates -> selected plan -> executor -> safeApply 编排。
6. selected plan 优先使用 preferredPlanId，否则按 priority 选择。
7. 协议输出 nextHomeMapState，但只来自 SafeApply。
8. 协议 audit 检查 HomeMapState identity、selected plan lineage、execution / safeApply lineage、nested warning 与禁止 token。
9. 保持协议不接真实 world-loop、不接 UI、不接宠物。

仍未完成：

1. 真实 world-loop 接入。
2. 持久化策略。
3. RenderableWorldSnapshot / FormalVisualModel 刷新链路接入。
4. LifeEvent / CompanionDecision。

## 7. 宠物后置与旧路线清理现状

当前正式 MVP 规则：

1. 不再使用旧默认生命初始路线。
2. 开局不默认出现宠物。
3. 开局不默认出现 pet actor。
4. 开局不默认出现 pet bed。
5. 开局不出现 pet_arrival / pet_rest 初始区域。
6. 宠物未来能力保留。
7. 宠物只能通过 LifeEvent / CompanionDecision / accept_companion 后置进入。

## 8. 当前遗留问题

| 问题 | 状态 | 处理方式 |
|---|---:|---|
| 旧 README / legacy docs 误导 | 已处理 | MVP-ALIGN-03 已标记或清理。 |
| P8 总控文档乱码 | 已处理 | 已重写为 UTF-8 中文。 |
| worldSeed + 人格布局输入 | 已处理 | WORLD-GEN-02 已建立 schema 并接入 PlacementEngine。 |
| 布局差异是否足够可观察 | 已处理 | WORLD-GEN-03 已建立差异化 audit 工具。 |
| ConstructionPlanner 输入协议 | 已处理 | CONSTRUCTION-00 已建立 planner input 与 audit。 |
| ConstructionPlanner 候选计划生成 | 已处理 | CONSTRUCTION-01 已建立候选计划生成与 audit。 |
| ConstructionExecutor / MapDiff 候选 | 已处理 | CONSTRUCTION-02 已建立 executor 与 MapDiff 候选协议。 |
| SafeApply / MapDiff 应用 | 已处理 | CONSTRUCTION-03 已建立 SafeApply 协议。 |
| Construction world loop pre-integration | 已处理 | CONSTRUCTION-04 已建立接入前协议。 |
| 真实 world-loop 接入 | 未完成 | 后续 CONSTRUCTION-05。 |
| 持久化策略 | 未完成 | 后续 Persistence 模块。 |
| RenderableWorldSnapshot / FormalVisualModel 刷新链路 | 未完成 | 后续视觉刷新链路。 |
| LifeEvent / CompanionDecision | 未完成 | 后续 LIFE-EVENT 模块。 |

## 9. 下一大模块计划

CONSTRUCTION-04 完成后，进入：

```text
CONSTRUCTION-05：Construction Runtime 接入与持久化前协议
```

CONSTRUCTION-05 目标：

1. 定义建设协议如何被 runtime 调用。
2. 明确 runtime 只调用已审计的 construction world loop protocol。
3. 明确持久化前的输入 / 输出 / rollback 边界。
4. 不做 UI。
5. 不接入宠物。
6. 不绕过 HomeMapState / MapDiff / FormalVisualModel 链路。

## 10. 当前最终结论

P8 Formal 视觉链路已完成并保留。

当前不再回到前端手写世界内容路线。

当前不再回到旧默认宠物开局路线。

WORLD-GEN-02 已把世界生成从固定 recipe 推进到 `seed + personality + resources + phase + variant + placement rules` 的输入协议。

WORLD-GEN-03 已把布局差异化从肉眼判断推进到稳定 fingerprint 与 pair audit。

CONSTRUCTION-00 已把建设系统推进到 `HomeMapState + 管家建设倾向 + 资源状态 + 世界阶段 -> ConstructionPlannerInput`。

CONSTRUCTION-01 已把建设系统推进到 `ConstructionPlannerInput -> ConstructionPlan[] 候选 -> CandidateAudit`。

CONSTRUCTION-02 已把建设系统推进到 `selected ConstructionPlan -> ConstructionExecutionResult -> MapDiff[] 候选`。

CONSTRUCTION-03 已把建设系统推进到 `MapDiff[] 候选 -> SafeApply -> nextHomeMapState`。

CONSTRUCTION-04 已把建设系统推进到完整接入前协议：`planner -> candidates -> executor -> safeApply -> protocol audit`。

后续开发必须围绕规则生成、结构化世界事实、FormalVisualModel First、宠物后置和非固定布局差异化继续推进。

## CONSTRUCTION-05 Runtime Boundary + Persistence Proposal + Visual Refresh Pre-Integration 记录

CONSTRUCTION-05 已完成建设 Runtime 调用边界、持久化前协议与视觉刷新前协议。

当前链路推进为：

```text
HomeMapState
+ 管家建设倾向
+ 资源状态
+ 世界阶段
-> ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> ConstructionExecutionResult
-> MapDiff[] 候选
-> SafeApply
-> nextHomeMapState
-> ConstructionWorldLoopProtocolResult
-> ConstructionRuntimeCycleResult
-> PersistenceProposal
-> VisualRefreshSignal
```

本阶段完成：

1. 新增 ConstructionRuntimeCycleInput。
2. 新增 ConstructionRuntimeCycleResult。
3. 新增 ConstructionRuntimeCycleAudit。
4. 新增 ConstructionPersistenceProposal。
5. 新增 ConstructionVisualRefreshSignal。
6. 实现 buildConstructionRuntimeCycleResult。
7. 实现 buildConstructionPersistenceProposal。
8. 实现 buildConstructionVisualRefreshSignal。
9. 实现 auditConstructionRuntimeCycle。
10. RuntimeCycle 调用 ConstructionWorldLoopProtocol，不跳过 SafeApply。
11. PersistenceProposal 只作为 proposal_only 提案，不写 storage。
12. VisualRefreshSignal 只作为 signal_only 信号，不修改 FormalVisualModel / Renderer / UI。

仍未完成：

1. 真实 world-loop 接入。
2. 真实 persistence 写入。
3. RenderableWorldSnapshot / FormalVisualModel 刷新实现。
4. LifeEvent / CompanionDecision。
5. 宠物后置进入正式链路。

下一步进入：

```text
CONSTRUCTION-06：正式 Runtime Adapter 与 World Loop Bridge 审计
```

## CONSTRUCTION-FINAL-01 Construction Usable Runtime Vertical Slice 记录

CONSTRUCTION-FINAL-01 已完成建设系统可运行纵向闭环。

当前链路收口为：

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
-> ConstructionWorldLoopProtocolResult
-> ConstructionRuntimeCycleResult
-> PersistenceProposal
-> VisualRefreshSignal
-> MemoryPersistenceMock
-> VisualRefreshBridge
-> FullPipelineAudit
-> PipelineReport
```

本阶段完成：

1. Construction Runtime Adapter。
2. Construction Debug Harness。
3. Construction Memory Persistence Mock。
4. Construction Visual Refresh Bridge。
5. Construction Full Pipeline Audit。
6. Construction Pipeline Report。
7. 阶段文档与 Guardrails 收口。

本阶段仍然不做：

1. 不接真实 world-loop。
2. 不写真实 storage。
3. 不刷新 UI。
4. 不修改 FormalVisualModel。
5. 不修改 Renderer。
6. 不接宠物。
7. 不恢复旧默认宠物开局路线。

下一步建议进入：

```text
CONSTRUCTION-FINAL-02：Runtime Bridge 接入前一致性检查
```

## REMAINING CORE CLOSURE 剩余核心闭环收口记录

本阶段已完成 AI-PET-WORLD 剩余核心闭环的一次性工程收口。

本次新增与补强：

1. `runConstructionRuntimeVerticalSlice` 统一入口。
2. Construction Runtime Bridge 与 bridge audit / report。
3. Persistence Adapter dry-run 与 persistence audit。
4. Snapshot Refresh Request 与 FormalVisual refresh precheck。
5. LifeEvent / CompanionDecision 后置候选协议。
6. MVP Core Debug Runner / Audit / Report。
7. Memory Persistence Mock 支持 `memory_commit` / `memory_preview` / `disabled`。
8. Construction Pipeline Report 新增人类可读 sections。
9. `REMAINING_CORE_CLOSURE_REPORT.md` 收口文档。

当前工程闭环为：

```text
HomeMapState
+ 管家建设倾向
+ 资源状态
+ 世界阶段
-> ConstructionPlannerInput
-> ConstructionPlan[] 候选
-> ConstructionExecutionResult
-> MapDiff[] 候选
-> SafeApply
-> nextHomeMapState
-> ConstructionWorldLoopProtocolResult
-> ConstructionRuntimeCycleResult
-> PersistenceProposal
-> VisualRefreshSignal
-> RuntimeAdapter / VerticalSlice
-> RuntimeBridge
-> PersistenceAdapterDryRun
-> SnapshotRefreshRequest
-> LifeEventCandidate / CompanionDecisionCandidate
-> MVP Core Audit
-> MVP Core Report
```

当前仍未完成：

1. 真正 UI 展示建设变化。
2. 真正数据库持久化。
3. 真正 world-loop scheduler。
4. 真正宠物后置进入。
5. 线上用户数据接入。
6. integration tests。

下一步不建议继续堆薄协议，应进入：

```text
MVP-CORE-TEST-00：核心闭环 integration tests
```

或根据产品优先级进入 persistence adapter 实现、world-loop scheduler、UI preview 接入前审计。

## MVP FULL IMPLEMENTATION PASS 记录

本阶段完成 MVP 全量一次性实现 pass。

本次新增 / 接通：

1. `/world` 只读接入 MVP Core dry-run 展示面板。
2. `MvpPresentationModel`。
3. `MvpPPhoneData`。
4. `MvpWorldLogEntry`。
5. `MvpButlerExplanation`。
6. MVP Core Report sections 在页面可见。
7. Persistence dry-run / Snapshot refresh request / LifeEvent candidate 在 MVP 面板中可读展示。

当前 MVP 闭环：

```text
CreateWorldInput
-> WorldCreationRuntime
-> InitialHomeMapState
-> RenderableWorldSnapshot
-> FormalVisualModel
-> FormalWorldView

HomeMapState
-> MVP Core Debug Runner
-> Construction Runtime Bridge
-> PersistenceAdapterDryRun
-> SnapshotRefreshRequest
-> LifeEventCandidate / CompanionDecisionCandidate
-> MvpPresentationModel
-> /world MVP Core panel
```

本阶段仍不做：

1. 不写真实数据库。
2. 不注册真实 world-loop scheduler。
3. 不让 UI / CSS / PNG 决定世界事实。
4. 不让 FormalWorldView 生成世界事实。
5. 不默认生成宠物。
6. 不生成 pet actor / pet bed / pet_arrival / pet_rest。

下一步建议进入：

```text
MVP-CORE-TEST-00：MVP core integration tests
```

或进入 persistence adapter / scheduler / snapshot refresh adapter 的产品化实现。

## MVP REQUIRED FULL COMPLETION 记录

本阶段已补齐 MVP 必交付完整闭环的硬性文件与入口。

本次完成：

1. Butler MVP 输入与人格映射。
2. MVP Initial World Builder。
3. MVP World Runtime Tick。
4. MVP Persistence Dry Run。
5. MVP Visual Refresh / Formal Visual Refresh。
6. MVP World Log / Butler Explanation / P-Phone。
7. LifeEvent / CompanionDecision 后置候选入口。
8. MVP Core Pipeline 总入口。
9. MVP Smoke Scenarios / Smoke Audit。
10. /world MVP 只读 ViewModel。
11. MVP_FULL_IMPLEMENTATION_REPORT.md。

当前完整链路：

```text
BirthInput
-> ButlerMvpProfile
-> worldSeed
-> InitialHomeGenerator
-> HomeMapState
-> MvpWorldRuntimeTick
-> Construction vertical slice
-> MapDiff / SafeApply
-> nextHomeMapState
-> MvpPersistenceDryRun
-> MvpVisualRefresh
-> MvpFormalVisualRefresh
-> FormalVisualModel
-> MvpWorldLog / ButlerExplanation / PPhoneData
-> LifeEventCandidate / CompanionDecisionCandidate
-> AiPetWorldMvpAudit
-> AiPetWorldMvpReport
-> MvpWorldViewModel
```

当前仍不是线上真实产品：真实数据库、真实 scheduler、宠物正式进入、线上用户数据仍需后续产品化。
