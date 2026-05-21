# AI-PET-WORLD P8-H5 Renderer 显示 actor geometry

## 1. 阶段定位

本阶段让 ProceduralRendererView 只读 VisualState.actorGeometryProjections，并显示 actor geometry。

本阶段可以修改 Renderer 组件，但 Renderer 仍然不能生成 actor。

## 2. 输入

Renderer 只读取：

VisualState.actorGeometryProjections

## 3. 输出

如果 projection canProject === true 且 geometryProjection 存在：

- 绘制 interactionRadius
- 绘制 body

如果 projection canProject === false：

- 不绘制 actor geometry
- 只在 Actor Geometry Diagnostics 中显示状态

## 4. 空数组规则

如果 VisualState.actorGeometryProjections 是空数组：

- actor projections = 0
- 不显示管家
- 不显示宠物
- 不创建默认 actor
- 不创建默认 anchor

这是正确行为，不是 bug。

## 5. 未出生宠物规则

pet 未出生时：

- status = skipped_not_ready
- canProject = false
- Renderer 不能绘制宠物 actor

## 6. 继续禁止事项

1. Renderer 不能生成 actor。
2. Renderer 不能生成 actor projection。
3. Renderer 不能决定角色是否存在。
4. Renderer 不能填默认 anchor。
5. Renderer 不能生成 placement。
6. Renderer 不能修改 HomeMapState。
7. Renderer 不能读取 PNG。
8. Renderer 不能读取 WORLD_MAP_ASSETS。
9. Renderer 不能使用 backgroundImage / img / next/image。
10. Actor Geometry Diagnostics 不是最终玩家 UI。

## 7. 页面查看位置

/world
-> 几何 / 程序化视觉预览 v1
-> Actor Geometry Summary
-> Actor Geometry Diagnostics

Debug 查看位置：

/world-debug/visual-change-verification
-> Before / After
-> Actor Geometry Summary
-> Actor Geometry Diagnostics

## 8. 下一步

下一步进入：

P8-H6：Actor projection 数据接入 world snapshot

目标是让上游安全地把 butler runtime projection 接入 buildVisualState，而不是 Renderer 自己伪造 actor。
