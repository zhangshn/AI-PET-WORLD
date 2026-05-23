> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H4 VisualState 接入 actor geometry projection

## 1. 阶段定位

本阶段让 VisualState 可以携带 actor geometry projection。

本阶段仍然不修改 Renderer 组件。
本阶段仍然不显示 actor。
本阶段不修改 world-loop。
本阶段不修改 HomeMapState。
本阶段不生成 placement。

## 2. 输入

VisualState builder 新增可选输入：

actorRuntimeGeometryProjections?: ActorRuntimeGeometryProjectionResult[]

缺省时为空数组，不影响现有视觉链路。

## 3. 输出

VisualState 新增：

actorGeometryProjections: VisualActorGeometryProjection[]

VisualActorGeometryProjection 包含：

- actorId
- actorKind
- status
- presence
- source
- geometrySource
- canProject
- geometryProjection?
- reason
- tags

## 4. 关键边界

VisualActorGeometryProjection 不是 VisualPlacement。

Actor projection 不能写入 HomeMapState。
Actor projection 不能生成 MapPlacement。
Actor projection 不能让 Renderer 临时伪造角色。

## 5. 未出生宠物规则

如果 pet 未出生：

- H3 输出 skipped_not_ready
- H4 只能把 skipped_not_ready 承载到 VisualState
- H4 不能强行生成 geometryProjection

## 6. 当前不做的事情

本阶段不做：

1. Renderer 显示 actor。
2. /world 页面变化。
3. Actor Debug Diagnostics。
4. 角色动画。
5. 路径移动。
6. 行为决策。
7. 管家任务系统改造。
8. 宠物系统改造。
9. HomeMapState 写入 actor。
10. MapPlacement 生成。

## 7. 下一步

下一步进入：

P8-H5：Renderer 显示 actor geometry

目标是让 Renderer 只读 VisualState.actorGeometryProjections 并显示几何 actor 占位。
