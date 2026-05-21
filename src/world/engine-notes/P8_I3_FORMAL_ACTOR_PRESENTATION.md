# AI-PET-WORLD P8-I3 Formal Actor Presentation

## 1. 阶段定位

本阶段增强 FormalWorldView 内部的 Formal Actor Presentation。

本阶段仍然不接入 /world 页面。
本阶段不替换 ProceduralRendererView。
本阶段不修改 Renderer Core。
本阶段不修改 world-loop。
本阶段不生成世界事实。

## 2. 输入

Formal Actor Presentation 只读取：

- RenderableWorldSnapshot
- VisualState
- VisualActorGeometryProjection
- ActorGeometryProjection 中已经存在的 body / interactionRadius / anchor

## 3. 本阶段新增能力

FormalWorldView 可以在 Formal World Canvas 中显示 butler actor projection 的正式几何占位样式。

显示内容：

- butler aura
- butler body
- butler head
- butler glow

## 4. 显示原则

Formal Actor Presentation 显示的是玩家可理解的管家存在感。

它不显示：

- actorId。
- raw tags。
- source。
- geometrySource。
- anchorSource。
- debug flags。
- Actor Geometry Diagnostics。
- collision / support / influence debug boxes。
- F / C / S / I。
- 紫微斗数原始术语。

## 5. 边界

Formal Actor Presentation 只读 VisualState.actorGeometryProjections。

它不能：

1. 生成 actor。
2. 生成 actor projection。
3. 填默认 anchor。
4. 生成 placement。
5. 修改 VisualState。
6. 修改 HomeMapState。
7. 默认显示 pet。
8. 读取 PNG。
9. 读取 WORLD_MAP_ASSETS。
10. 导入 actor-geometry builder。
11. 导入 actor-runtime-projection builder。

## 6. 宠物规则

本阶段不显示 pet actor。

宠物仍然后置，必须由生命关系事件接纳后进入主世界。

FormalWorldView 不能为了画面完整伪造宠物。

## 7. 当前不做

本阶段不做：

1. 接入 /world 页面。
2. 最终管家角色美术。
3. 管家动画。
4. 管家移动。
5. 管家行为系统。
6. 宠物 actor 接入。
7. Debug / Formal 路由切换。

## 8. 下一步

下一步进入：

P8-I4：Formal World HUD 最小版

目标是让 FormalWorldView 显示更玩家可读的世界状态、管家状态和最近日志入口。
