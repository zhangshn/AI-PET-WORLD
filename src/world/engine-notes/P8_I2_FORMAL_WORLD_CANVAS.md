# AI-PET-WORLD P8-I2 Formal World Canvas

## 1. 阶段定位

本阶段增强 FormalWorldView 组件内部的 Formal World Canvas。

本阶段仍然不接入 /world 页面。
本阶段不替换 ProceduralRendererView。
本阶段不修改 Renderer Core。
本阶段不修改 world-loop。
本阶段不生成世界事实。

## 2. 输入

FormalWorldView 仍然只读取：

- RenderableWorldSnapshot
- VisualState
- VisualPlacement
- VisualActorGeometryProjection

## 3. 本阶段新增能力

Formal World Canvas 现在可以从 VisualState.placements 派生干净的程序化世界对象：

- 地面。
- 道路。
- 建筑。
- 树木。
- 设施。
- 小物。
- 角色占位。

## 4. 显示原则

Formal World Canvas 显示的是玩家可理解的世界对象。

它不显示：

- raw tags。
- assetId。
- source labels。
- Geometry Source Diagnostics。
- Actor Geometry Diagnostics。
- collision boxes。
- support boxes。
- influence boxes。
- F / C / S / I。
- actor debug flags。
- 紫微斗数原始术语。

## 5. 边界

Formal World Canvas 只读 VisualState.placements。

它不能：

1. 生成 placement。
2. 生成 actor。
3. 填默认 anchor。
4. 修改 VisualState。
5. 修改 HomeMapState。
6. 读取 PNG。
7. 读取 WORLD_MAP_ASSETS。
8. 导入 map-assets。
9. 读取 proposal 当现实。
10. 伪造宠物存在。

## 6. 当前不做

本阶段不做：

1. 接入 /world 页面。
2. 正式 actor projection 绘制。
3. 最终角色美术。
4. 动画。
5. 路径移动。
6. Debug / Formal 路由切换。
7. 宠物 actor 接入。

## 7. 下一步

下一步进入：

P8-I3：Formal Actor Presentation

目标是让 FormalWorldView 用更正式的几何样式显示 butler actor projection，但仍然不接 pet，不生成 actor。
