> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H1 Actor Geometry Projection 协议

## 1. 阶段定位

本阶段新增 actor-geometry 层。

Actor Geometry Projection 用来描述管家 / 宠物在几何视觉系统中的只读投影。

本阶段不接 Renderer。
本阶段不接 VisualState。
本阶段不生成 placement。
本阶段不修改 HomeMapState。

## 2. 为什么需要 actor geometry projection

管家 / 宠物不能由 Renderer 临时画出来。

角色必须先由世界状态或 runtime projection 给出：

- actorId
- actorKind
- anchor
- pose
- attentionDirection
- source

然后 actor-geometry 才能把它转换为：

- body
- interactionRadius
- tags

## 3. 当前支持的 actorKind

- butler
- pet

## 4. 当前支持的几何结构

管家：

- anchor
- body polygon
- interactionRadius polygon
- attentionDirection
- pose

宠物：

- anchor
- body polygon
- interactionRadius polygon
- attentionDirection
- pose

## 5. 当前不做的事情

本阶段不做：

1. 角色动画。
2. 角色移动。
3. 行为决策。
4. 管家任务系统改造。
5. 宠物自主行为改造。
6. VisualState schema 修改。
7. Renderer 显示 actor。
8. HomeMapState 写入 actor。
9. MapPlacement 生成。
10. PNG / 贴图角色显示。

## 6. 继续禁止事项

1. Actor Geometry 不能读取 PNG。
2. Actor Geometry 不能读取 WORLD_MAP_ASSETS。
3. Actor Geometry 不能使用 backgroundImage。
4. Actor Geometry 不能生成 placement。
5. Actor Geometry 不能修改 HomeMapState。
6. Actor Geometry 不能自己决定角色是否存在。
7. Actor Geometry 不能自己决定角色位置。
8. Actor Geometry 不能绕过 runtime state。
9. Actor Geometry 不能让宠物说人话。
10. Actor Geometry 不能让管家替宠物做决定。

## 7. 下一步

下一步进入：

P8-H2：Actor Runtime Projection 输入边界

目标是定义 actor projection 如何从已有世界状态 / runtime state 只读派生出来。
