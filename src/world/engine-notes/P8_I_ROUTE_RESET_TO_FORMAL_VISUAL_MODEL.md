> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-I 路线回滚到 FormalVisualModel 记录

## 1. 阶段定位

本阶段是 P8-I 旧 FormalWorldView 手写视觉路线的删除与回滚记录。

本阶段不新增正式视觉模型代码。
本阶段不实现 FormalVisualModel。
本阶段不实现 FormalVisualGenerator。
本阶段不新增新的 FormalWorldView。
本阶段不修改 /world 页面。

## 2. 回滚原因

P8-I0 / P8-I1 / P8-I2 / P8-I3 的旧路线让 FormalWorldView 组件承担了正式视觉模型生成职责。

旧路线的问题：

1. FormalWorldView 内定义了 FormalWorldVisualItem。
2. FormalWorldView 内定义了 FormalActorVisualItem。
3. FormalWorldView 内实现了 buildFormalWorldVisualItems。
4. FormalWorldView 内实现了 buildFormalActorVisualItems。
5. FormalWorldView 在组件内决定地面、道路、建筑、树木、设施、管家如何显示。
6. 这违反 MVP v1.4 与规则世界引擎 v1.2。

正确路线：

1. 正式视觉模型必须来自 src/world/formal-visual-model/。
2. FormalVisualModel / FormalVisualGenerator 先于 FormalWorldView。
3. FormalWorldView 只能只读 FormalVisualModel 渲染。
4. FormalWorldView 不能生成正式视觉模型。

## 3. 本次删除内容

已删除：

1. src/app/world/components/formal-world-view/formal-world-view.tsx。
2. src/app/world/components/formal-world-view/formal-world-view.styles.module.css。
3. src/app/world/components/formal-world-view/ 空目录。
4. src/world/engine-notes/P8_I0_FORMAL_WORLD_VIEW_PLAN.md。
5. src/world/engine-notes/P8_I1_FORMAL_WORLD_VIEW_COMPONENT_SHELL.md。
6. src/world/engine-notes/P8_I2_FORMAL_WORLD_CANVAS.md。
7. src/world/engine-notes/P8_I3_FORMAL_ACTOR_PRESENTATION.md。

## 4. 本次保留内容

保留：

1. P8-H Debug Geometry / Actor Projection 链路。
2. VisualState / RenderableWorldSnapshot。
3. Renderer Debug View。
4. world-loop actor projection debug 接入。
5. ShapeGrammar / EntityGeometry / VisualState 几何链路。
6. Actor geometry projection debug 链路。

## 5. 本次不做

本阶段不做：

1. 不实现 FormalVisualModel schema。
2. 不实现 FormalVisualGenerator。
3. 不新增新的 FormalWorldView。
4. 不接入 /world 页面。
5. 不修改 ProceduralRendererView。
6. 不修改 P8-H actor geometry 链路。
7. 不修改 world-loop。
8. 不修改 rendering schema / builder。
9. 不修改 actor-geometry。
10. 不修改 actor-runtime-projection。
11. 不读取 PNG。
12. 不读取 WORLD_MAP_ASSETS。
13. 不生成 actor。
14. 不生成 placement。
15. 不修改 HomeMapState。

## 6. 后续正确入口

下一步重新进入：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```

目标是先在 `src/world/formal-visual-model/` 建立正式视觉模型协议，再让未来 FormalWorldView 只读该模型渲染。
