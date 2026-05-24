> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P5 世界变化层收口说明

## 1. P5 的定位

P5 不是 Renderer。
P5 不是 UI。
P5 不是旧 construction flow 的替代品。
P5 是从“意图”到“安全变化结果”的中间世界变化层。

核心公式：

```text
EnvironmentState
+ IntentDecision
-> WorldChangePlan
-> WorldDiffProposal
-> validateMapDiffs
-> WorldEvolutionAuditReport
-> WorldEvolutionExecutionResult
-> WorldEngineChainAuditReport
```

## 2. P5 已完成模块

| 模块路径 | 职责 | 是否会修改 HomeMapState | 是否允许正式使用 |
| --- | --- | --- | --- |
| `src/world/world-evolution/` | 将 IntentDecision 转换为 WorldChangePlan，再转换为 WorldDiffProposal。 | 否，world-evolution 不 apply。 | 否，当前只作为计划与提案协议。 |
| `src/world/world-evolution-audit/` | 汇总 plan、proposal、validation，判断风险与 canApplySafely。 | 否，world-evolution-audit 不 apply。 | 否，当前只作为审计判断。 |
| `src/world/world-evolution-executor/` | 根据 audit 安全门生成 debug execution result。 | 只在 debug result 中返回派生 nextHomeMapState，不写回输入。 | 否，虽然内部可以 applyMapDiffs，但当前只生成 debug execution result。 |
| `src/world/world-engine-chain-audit/` | 汇总完整链路，输出 blockedAt、overallStatus、timeline。 | 否。 | 否，当前只用于调试判读。 |
| `src/world/debug-scenarios/` | 汇总环境、审计、意图、计划、提案、校验、执行与链路审计。 | 否，debug-scenarios 不写回正式世界。 | 否，只服务 `/world-debug/mapdiff`。 |

## 3. 完整链路说明

1. EnvironmentState
   说明：描述世界生态与材料状态。

2. ButlerIntentDecision
   说明：决定管家想不想行动，想做什么。

3. WorldChangePlan
   说明：把意图翻译成世界计划，但不生成最终变化。

4. WorldDiffProposal
   说明：把计划尝试翻译成 MapDiff 提案，但不写入世界。

5. validateMapDiffs
   说明：检查 MapDiff 是否合规，不写入世界。

6. WorldEvolutionAuditReport
   说明：评估风险，判断 canApplySafely。

7. WorldEvolutionExecutionResult
   说明：在 debug 场景里生成“如果执行会得到什么结果”。

8. WorldEngineChainAuditReport
   说明：汇总完整链路，告诉我们卡在哪一层。

## 4. Debug 页面如何判读

`/world-debug/mapdiff` 中重点看 World Engine Chain Audit：

- `summary.overallStatus`
- `summary.blockedAt`
- `summary.selectedIntentType`
- `summary.planType`
- `summary.proposalMapDiffCount`
- `summary.auditCanApplySafely`
- `summary.executionStatus`
- `timeline`
- `blockers`
- `warnings`
- `notes`

判读规则：

- `overallStatus = applied`：说明 debug 执行结果已生成，但不代表正式世界写入。
- `overallStatus = skipped`：说明当前没有可执行 MapDiff，通常是观察、休息、等待、no_diff。
- `overallStatus = blocked`：说明链路被阻塞，需要看 blockedAt。
- `blockedAt = intent`：说明管家当前不想行动或分数不足。
- `blockedAt = plan`：说明意图形成了，但计划被阻塞或跳过。
- `blockedAt = proposal`：说明计划想生成 diff，但 proposal 没生成有效 MapDiff。
- `blockedAt = validation`：说明 MapDiff 被 Validator 拒绝。
- `blockedAt = audit`：说明 Validator 不一定拒绝，但审计层认为不安全。
- `blockedAt = execution`：说明执行器安全门没有通过。

## 5. 当前 P5 v0 限制

1. 当前只有 plant_nature 初步生成 MapDiff。
2. build_structure / expand_area / reorganize_area 还没有真正接入 MapDiff 生成。
3. execution 只在 debug scenario 中生成结果。
4. 没有写回正式 HomeMapState。
5. 没有接 Renderer。
6. 没有接正式 /world。
7. 旧 construction flow 仍然存在。
8. 后续 P7 才决定如何把新链路接入正式 MVP 闭环。

## 6. 后续进入 P6 前的红线

P6 Renderer 重建前，不允许：

1. 让 Renderer 直接读取 proposal。
2. 让 Renderer 直接读取 audit。
3. 让 Renderer 直接读取 execution。
4. 让 UI 绕过 WorldState 展示不存在的世界变化。
5. 为了视觉效果新增贴图式假世界。
6. 绕过 Rule / Plan / Proposal / Validation / Audit。

## 7. 后续建议

P6 不应该马上做漂亮画面。

P6 应该先做 ProceduralRenderer v0：

- 只读取 WorldState
- 能显示 placement
- 能显示基础 geometry / footprint / collision / influence 调试层
- 能显示 terrain cell 状态
- 不能创造世界事实

P7 才考虑：

- 将 world-evolution execution 接入正式世界推进
- 或继续保留旧 construction flow 并逐步替换
