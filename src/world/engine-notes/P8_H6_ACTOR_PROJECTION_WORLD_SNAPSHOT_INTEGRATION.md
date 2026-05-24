> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H6 Actor projection 数据接入 world snapshot

## 1. 阶段定位

本阶段让 world-loop renderable state 安全接入 butler actor projection。

本阶段让 /world 可以通过 VisualState.actorGeometryProjections 看到管家几何占位。

本阶段仍然不让 Renderer 生成 actor。

## 2. 当前链路

当前链路为：

HomeMapState
-> world-loop renderable state
-> buildButlerRuntimeProjection
-> buildActorGeometryProjectionFromRuntime
-> buildVisualState actorRuntimeGeometryProjections
-> VisualState.actorGeometryProjections
-> Renderer 只读显示

## 3. 管家规则

本阶段只接入 butler。

原因：

1. v1.3 主线是管家先行。
2. 管家是玩家生命信息映射出的第一生命。
3. /world 可以显示管家 actor geometry。
4. 这不是 Renderer 伪造角色，而是 world snapshot 派生的 actor projection。

## 4. 宠物规则

本阶段不接入 pet。

原因：

1. v1.3 明确宠物后置。
2. 宠物不是开局默认资产。
3. 宠物必须在生命关系事件被接纳后再进入主循环。
4. Renderer 不能为了画面完整而伪造宠物。

## 5. anchor 策略

butler anchor 从 HomeMapState 派生：

优先级：

1. 已存在的 actor_kind:butler actor placement。
2. visual_center zone 中心。
3. temporary_shelter zone 中心。
4. mapSize 中心。

anchor 不写回 HomeMapState。
anchor 不生成 placement。
anchor 不代表最终 autonomous movement。

## 6. 当前不做的事情

本阶段不做：

1. 宠物 actor 接入。
2. 真实管家行为系统接入。
3. 路径移动。
4. 动画。
5. 行为决策改造。
6. HomeMapState 写入 actor。
7. MapPlacement 生成。
8. Renderer 生成 actor。
9. PNG / WORLD_MAP_ASSETS 显示。

## 7. 页面查看位置

/world
-> 几何 / 程序化视觉预览 v1
-> actor projections
-> actor projected
-> actor butler
-> Actor Geometry Diagnostics

Debug 页面：

/world-debug/visual-change-verification
-> Before / After
-> Actor Geometry Summary
-> Actor Geometry Diagnostics

## 8. 下一步

下一步进入：

P8-H7：Actor Geometry Display 可读性与 Debug 收口

目标是让管家 actor geometry 的来源、anchor、projection 状态更容易审计。
