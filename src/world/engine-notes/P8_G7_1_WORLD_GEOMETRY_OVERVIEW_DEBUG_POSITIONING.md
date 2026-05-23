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
