> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G7.1 World Geometry Overview Debug 定位修复

1. 本阶段不新增功能，只修复 P8-G7 的命名与定位。
2. World Geometry Overview Debug 是开发期 Debug 诊断区。
3. 它不是最终玩家 UI。
4. 它只把 geometry_source 翻译成开发期可读的世界结构摘要。
5. 它不参与世界运行。
6. 它不生成 placement。
7. 它不修改 HomeMapState。
8. 它不读取 PNG。
9. 它不读取 WORLD_MAP_ASSETS。
10. 页面查看位置：
    - /world
    - 几何 / 程序化视觉预览 v1
    - World Geometry Overview Debug
11. Debug 查看位置：
    - /world-debug/visual-change-verification
    - Before / After 的 World Geometry Overview Debug
