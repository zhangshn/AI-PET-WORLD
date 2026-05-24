> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: historical archive. This document is kept for historical design context only and is no longer the highest authority for AI-PET-WORLD V2.0 MVP development. Future work follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md` and the four V2.0 product documents.

# AI-PET-WORLD 世界时间与资源规则

1. 世界显示使用 24 小时制。
2. 真实命理时间不被游戏时间加速。
3. 管家性格映射使用玩家真实出生时间。
4. 宠物性格映射使用真实抵达 / 分配时刻。
5. 世界生态、资源、昼夜、天气、宠物作息、管家建设使用 AI-PET-WORLD 加速世界时间。
6. AI 纪元作为未来世界历史纪年保留，不替代真实命理时间。
7. 资源不是无限刷新。
8. 资源有来源、位置、恢复速度、消耗方式和循环逻辑。
9. 建设不能凭空发生。
10. 玩家不直接点击建造。
11. 管家基于资源、宠物需求、天气、时间、空间和事件自主建设。
12. 正式 UI 不显示紫微斗数术语。
13. 调试页可以显示内部命理映射，正式世界页只显示结果。

## 旧后台命名技术债

当前产品 UI 已切换为小镇宠物领养中心、临时领养抵达点、宠物抵达家园。

后台历史命名仍可能保留部分旧系统字段和方法，后续统一迁移方向为：

- `AdoptionCenterSystem`
- `AdoptionArrivalState`
- `PetArrivalState`
- `buildAdoptionState`

本阶段不一刀切删除后台历史系统，避免破坏保存 / 恢复和世界运行链路。
