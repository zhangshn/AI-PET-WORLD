> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P7.14 WorldLoop 自动保存策略评估

## 1. P7.14 的定位

P7.14 只是自动保存策略评估，不实现自动保存。
当前只允许手动保存。

当前 `/world` 可以通过用户点击“手动保存世界状态”把裁剪后的 `PersistedWorldLoopState` 写入本地 storage。自动保存仍然需要更完整的版本、频率、失败恢复和多标签页策略后才能进入实现。

## 2. 为什么不能立刻自动保存

1. Tick 还处于 debug 手动阶段。
2. persistence schema 刚接入，需要观察稳定性。
3. 自动保存可能把错误状态固化。
4. 未来会接入宠物/管家真实 runtime context。
5. 需要版本迁移策略。
6. 需要保存频率策略。
7. 需要失败恢复策略。

## 3. 当前允许的保存方式

当前只允许用户点击“手动保存世界状态”。

保存内容必须来自 `PersistedWorldLoopState`。
不保存 `RenderableWorldSnapshot` / `VisualState` / `DrawCommand`。

当前保存动作只记录核心世界事实和裁剪后的审计摘要，Renderer 派生对象必须在恢复时从 `HomeMapState` 重新派生。

## 4. 未来自动保存触发条件

未来可以评估以下触发条件：

1. SafeApply `allow_apply` 后。
2. 手动 Tick 完成后。
3. N 次 Tick 后。
4. 用户离开页面前。
5. 显式开启自动保存后。

当前都不实现。

## 5. 自动保存风险

1. localStorage 容量限制。
2. 旧 schema 污染。
3. 错误世界状态固化。
4. 高频写入性能问题。
5. 多标签页冲突。
6. 多世界 key 管理复杂。
7. 用户误以为已正式云端保存。

## 6. 推荐路线

P7.14：策略文档
P7.15：真实管家 / 宠物 runtime context 接入策略
P7.16：长期建设 proposal 扩展策略
P7.17：P7 persistence 收口
P7.18：自动保存实验开关
P7.19：自动保存实现

## 7. 当前结论

当前不实现自动保存。
当前只保留手动保存。
自动保存必须等 persistence schema、adapter、恢复流程和手动保存都稳定后再进入。
