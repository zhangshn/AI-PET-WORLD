# AI-PET-WORLD P8-G7 World Geometry Overview

1. 本阶段只增强 ProceduralRendererView 的产品可读诊断能力。
2. World Geometry Overview 把 geometry_source 转成世界结构摘要。
3. 不读取 PNG。
4. 不读取 WORLD_MAP_ASSETS。
5. 不生成 placement。
6. 不修改 HomeMapState。
7. 不参与世界运行。
8. 它读取的是 Geometry Source Diagnostics 的只读结果。
9. 分类包括：
   - 树木结构
   - 房屋 / 建筑结构
   - 道路结构
   - 设施 / 小物结构
   - 矩形 fallback
   - 未知来源
10. 页面查看位置：
   - /world
   - 几何 / 程序化视觉预览 v1
   - World Geometry Overview
11. Debug 查看位置：
   - /world-debug/visual-change-verification
   - Before / After 的 World Geometry Overview
