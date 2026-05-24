> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H7 Actor Geometry Display 可读性与 Debug 收口

## 1. 阶段定位

本阶段不改变 actor projection 链路，只增强 Debug 可读性。

当前 /world 中看到的 actor 是 Debug 几何占位。

它不是最终玩家 UI。
它不是最终角色美术。
它不代表最终 autonomous movement。

## 2. 本阶段新增可读信息

Actor Geometry Diagnostics 新增显示：

- actorKind
- actorId
- status
- presence
- canProject
- source
- geometrySource
- anchor
- anchorSource
- debug flag
- notFinalArt flag
- notFinalMovement flag
- reason

## 3. anchor source

butler anchor source 由 world-loop renderable state 标记：

- actor_anchor_source:actor_kind_butler_placement
- actor_anchor_source:visual_center_zone
- actor_anchor_source:temporary_shelter_zone
- actor_anchor_source:map_center_fallback

## 4. 当前仍然不做

本阶段不做：

1. 最终管家美术。
2. 管家动画。
3. 管家路径移动。
4. 管家真实行为系统。
5. 宠物 actor 接入。
6. HomeMapState 写入 actor。
7. MapPlacement 生成。
8. Renderer 生成 actor。
9. PNG / WORLD_MAP_ASSETS 显示。

## 5. 页面查看位置

/world
-> 几何 / 程序化视觉预览 v1
-> Actor Geometry Diagnostics

Debug 页面：

/world-debug/visual-change-verification
-> Before / After
-> Actor Geometry Diagnostics

## 6. 下一步

下一步进入：

P8-H8：Actor Geometry 阶段收口与 Formal World View 分离规划

目标是正式区分 Debug View 与未来玩家主视觉 Formal World View。
