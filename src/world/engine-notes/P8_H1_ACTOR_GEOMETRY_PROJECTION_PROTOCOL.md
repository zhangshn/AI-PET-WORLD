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
