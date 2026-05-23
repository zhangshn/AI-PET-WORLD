> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H2 Actor Runtime Projection 输入边界

## 1. 阶段定位

本阶段新增 actor-runtime-projection 层。

它负责定义从世界状态 / runtime state 到 actor projection 的轻量输入边界。

本阶段不接 Renderer。
本阶段不接 VisualState。
本阶段不修改 world-loop。
本阶段不修改 HomeMapState。
本阶段不生成 placement。

## 2. 为什么需要输入边界

管家 / 宠物不能由 Renderer 临时画出来。

角色必须先由 runtime projection 说明：

- actor 是否 present
- actorId
- actorKind
- worldId
- anchor
- pose
- attentionDirection
- source
- reason
- tags

然后后续阶段才允许进入 ActorGeometryProjection。

## 3. 当前输入策略

为了避免过度耦合，本阶段不直接导入 ButlerRuntimeContext / PetState。

本阶段使用 lightweight input：

- BuildButlerRuntimeProjectionInput
- BuildPetRuntimeProjectionInput

后续再由 adapter 把真实 runtime state 转换成这些轻量 input。

## 4. 当前 placeholder 策略

如果输入没有 anchor：

- butler 默认 anchor: { x: 6, y: 6 }
- pet 默认 anchor: { x: 7, y: 6 }

这是 deterministic placeholder，只用于输入边界验证。

它不是最终 autonomous movement。
它不能写回 HomeMapState。
它不能当成 Renderer 生成角色位置。

## 5. 当前 pet 出生门槛

如果 pet isBorn === false：

- presence = not_ready
- canProject = false
- reason = 宠物尚未出生，不应进入 actor 几何显示

这符合“胚胎没有宠物人格，宠物出生后才进入宠物系统”的产品原则。

## 6. 当前不做的事情

本阶段不做：

1. Renderer 显示 actor。
2. VisualState 接入 actor。
3. ActorGeometryProjection 串联。
4. 角色动画。
5. 路径移动。
6. 行为决策。
7. 管家任务系统改造。
8. 宠物系统改造。
9. HomeMapState 写入 actor。
10. MapPlacement 生成。

## 7. 下一步

下一步进入：

P8-H3：Actor Runtime Projection -> Actor Geometry Projection 串联

目标是把 ActorRuntimeProjectionResult 转换为 ActorGeometryProjection，但仍然不接 Renderer。
