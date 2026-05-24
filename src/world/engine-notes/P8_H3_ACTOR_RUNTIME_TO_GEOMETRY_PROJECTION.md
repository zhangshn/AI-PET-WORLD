> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H3 Actor Runtime Projection -> Actor Geometry Projection

## 1. 阶段定位

本阶段把 ActorRuntimeProjectionResult 转换为 ActorGeometryProjection。

本阶段仍然不接 Renderer。
本阶段仍然不接 VisualState。
本阶段不修改 world-loop。
本阶段不修改 HomeMapState。
本阶段不生成 placement。

## 2. 输入与输出

输入：

- ActorRuntimeProjectionResult

输出：

- ActorRuntimeGeometryProjectionResult

如果 runtimeProjection.canProject === true：

- 生成 ActorGeometryProjection

如果 runtimeProjection.canProject === false：

- 不生成 ActorGeometryProjection
- status 标记为 skipped_not_ready 或 skipped_unknown

## 3. 未出生宠物规则

如果宠物尚未出生：

- runtimeProjection.presence = not_ready
- runtimeProjection.canProject = false
- H3 必须返回 skipped_not_ready
- H3 不能生成 geometryProjection

这符合 v1.3 宠物后置原则。

## 4. placeholder anchor 规则

如果 runtimeProjection 使用 deterministic placeholder anchor：

- geometrySource = deterministic_placeholder
- tags 必须保留 actor_anchor:deterministic_placeholder

placeholder 只用于输入边界验证。
placeholder 不是最终 autonomous movement。
placeholder 不能写回 HomeMapState。

## 5. 当前不做的事情

本阶段不做：

1. Renderer 显示 actor。
2. VisualState 接入 actor。
3. /world 页面变化。
4. Actor Debug Diagnostics。
5. 角色动画。
6. 路径移动。
7. 行为决策。
8. 管家任务系统改造。
9. 宠物系统改造。
10. HomeMapState 写入 actor。
11. MapPlacement 生成。

## 6. 下一步

下一步进入：

P8-H4：VisualState 接入 actor geometry projection

目标是让 VisualState 可以携带 actor geometry projection，但仍然不让 Renderer 生成 actor。
