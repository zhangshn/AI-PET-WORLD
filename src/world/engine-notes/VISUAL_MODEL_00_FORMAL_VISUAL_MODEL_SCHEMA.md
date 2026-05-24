> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD VISUAL-MODEL-00 FormalVisualModel schema

## 1. 阶段定位

本阶段定义 FormalVisualModel 正式视觉模型协议。

本阶段只定义 schema。
本阶段不实现 FormalVisualGenerator。
本阶段不实现 FormalWorldView。
本阶段不接入 /world 页面。
本阶段不生成世界事实。

## 2. 为什么先做 FormalVisualModel

根据 MVP v1.5、规则世界引擎 v1.3 和整体架构 v1.0，正式视觉路线必须是：

```text
HomeMapState / WorldState
-> placements / MapDiff
-> VisualState / RenderableWorldSnapshot
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView 只读渲染
```

旧 P8-I0 / I1 / I2 / I3 的问题是让 React 组件直接生成正式视觉对象。

VISUAL-MODEL-00 用 schema 把职责重新拆开：

1. VisualState / RenderableWorldSnapshot 仍然是渲染投影输入。
2. FormalVisualGenerator 后续负责纯函数转换。
3. FormalVisualModel 承载玩家主视觉需要的正式视觉语义。
4. FormalWorldView 未来只能只读 FormalVisualModel 渲染。

## 3. 本阶段新增协议

本阶段新增：

1. FormalVisualModelVersion。
2. FormalVisualModelSource。
3. FormalVisualTraceSource。
4. FormalVisualLayer。
5. FormalWorldObjectKind。
6. FormalActorKind。
7. FormalVisualStyleToken。
8. FormalCanvasMood。
9. FormalAtmosphereTone。
10. FormalActorPoseToken。
11. FormalPetStatusToken。
12. FormalVisualSourceTrace。
13. FormalVisualAuditSummary。
14. FormalCanvasModel。
15. FormalWorldObjectModel。
16. FormalActorModel。
17. FormalEnvironmentModel。
18. FormalHudSummary。
19. FormalVisualModel。
20. FormalVisualModelInput。
21. FORMAL_VISUAL_MODEL_VERSION。

## 4. FormalVisualModel 的职责

FormalVisualModel 只承载正式视觉模型。

它可以表达：

1. 画布信息。
2. 世界对象视觉语义。
3. actor 视觉语义。
4. 环境视觉语义。
5. 玩家可读 HUD 摘要。
6. 审计来源。

它不能：

1. 生成世界事实。
2. 生成 placement。
3. 生成 actor。
4. 修改 HomeMapState。
5. 修改 VisualState。
6. 读取 PNG。
7. 读取 WORLD_MAP_ASSETS。
8. 默认接入 pet。

## 5. 本阶段不做

本阶段不做：

1. 不实现 FormalVisualGenerator。
2. 不实现 FormalWorldView。
3. 不新增 React 组件。
4. 不修改 /world 页面。
5. 不修改 ProceduralRendererView。
6. 不修改 renderer-schema.ts。
7. 不修改 renderer-gateway.ts。
8. 不修改 world-loop。
9. 不修改 actor-geometry。
10. 不修改 actor-runtime-projection。
11. 不修改 HomeMapState。
12. 不生成 actor。
13. 不生成 placement。
14. 不填默认 anchor。
15. 不读取 PNG。
16. 不读取 WORLD_MAP_ASSETS。
17. 不默认接入 pet。
18. 不写固定布局。

## 6. 下一步

下一步进入：

```text
VISUAL-MODEL-01：FormalVisualGenerator 纯函数
```

目标是从 VisualState / RenderableWorldSnapshot 纯函数生成 FormalVisualModel。
