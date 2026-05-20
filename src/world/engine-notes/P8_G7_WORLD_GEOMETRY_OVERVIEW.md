# AI-PET-WORLD P8-G7 World Geometry Overview Debug

1. 本阶段只增强 ProceduralRendererView 的开发期可读诊断能力。
2. World Geometry Overview Debug 不是最终玩家 UI。
3. 它把 geometry_source 转成开发期可读的世界结构摘要。
4. 不读取 PNG。
5. 不读取 WORLD_MAP_ASSETS。
6. 不生成 placement。
7. 不修改 HomeMapState。
8. 不参与世界运行。
9. 它读取的是 Geometry Source Diagnostics 的只读结果。
10. 分类包括：
   - 树木结构
   - 房屋 / 建筑结构
   - 道路结构
   - 设施 / 小物结构
   - 矩形 fallback
   - 未知来源
11. 页面查看位置：
   - /world
   - 几何 / 程序化视觉预览 v1
   - World Geometry Overview Debug
12. Debug 查看位置：
   - /world-debug/visual-change-verification
   - Before / After 的 World Geometry Overview Debug
