# AI-PET-WORLD VISUAL-MODEL-01 FormalVisualGenerator 纯函数

## 1. 阶段定位

本阶段实现 FormalVisualGenerator 纯函数。

输入：

```text
RenderableWorldSnapshot / VisualState
```

输出：

```text
FormalVisualModel
```

本阶段不是 UI。
本阶段不是 Renderer。
本阶段不是 FormalWorldView。
本阶段不修改世界事实。
本阶段不生成 placement。
本阶段不生成 actor。

## 2. 本阶段新增文件

新增：

1. `formal-visual-generator.ts`。
2. `formal-world-object-model-builder.ts`。
3. `formal-actor-model-builder.ts`。
4. `formal-canvas-model-builder.ts`。
5. `formal-environment-model-builder.ts`。
6. `formal-hud-summary-builder.ts`。

修改：

1. `formal-visual-model-gateway.ts` 导出 generator。

## 3. 生成链路

当前链路为：

```text
RenderableWorldSnapshot
-> buildFormalVisualModelFromSnapshot
-> buildFormalVisualModelInput
-> buildFormalWorldObjectModels
-> buildFormalActorModels
-> buildFormalCanvasModel
-> buildFormalEnvironmentModel
-> buildFormalHudSummary
-> FormalVisualModel
```

## 4. 世界对象规则

FormalWorldObjectModel 只从 VisualPlacement 派生。

规则：

1. 优先使用 placement.footprint 作为 geometry。
2. footprint 不存在时，只能从 anchor 派生 point geometry。
3. fallback point 必须写入 audit tag。
4. tags 只允许用于内部 styleToken / audit 判断。
5. 不使用 assetId 生成正式视觉对象。
6. 不读取 PNG。
7. 不读取 WORLD_MAP_ASSETS。
8. 不生成 placement。

## 5. Actor 规则

FormalActorModel 只从 VisualActorGeometryProjection 派生。

规则：

1. 只处理 canProject === true 的 projection。
2. 只处理 geometryProjection 存在的 projection。
3. 使用已经存在的 body / interactionRadius / anchor。
4. 不填默认 anchor。
5. 不生成 actor。
6. pet 不默认生成；只有 VisualState 已存在 pet projection 且 canProject 时才进入。
7. 不读取 PNG。
8. 不读取 WORLD_MAP_ASSETS。

## 6. Canvas / Environment / HUD 规则

Canvas：

1. 尺寸来自 VisualState.mapSize。
2. 不写固定布局。
3. 不读取 DOM。
4. 不读取图片。

Environment：

1. 只从 VisualState tags 派生 mood / atmosphere / styleToken。
2. timeLabel / weatherLabel 使用“未接入”，不伪造真实时间天气。
3. 不读取 WorldState。

HUD：

1. 只从 actorModels / objectModels 派生玩家可读摘要。
2. 不暴露 raw tags。
3. 不读取 eventLog。
4. pet 不存在时显示“宠物尚未进入主世界”，不能伪造宠物。

## 7. 本阶段不做

本阶段不做：

1. 不新增 FormalWorldView。
2. 不新增 React 组件。
3. 不新增 CSS。
4. 不接入 /world 页面。
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

## 8. 下一步

下一步进入：

```text
FORMAL-VIEW-00：FormalWorldView 只读 FormalVisualModel
```

目标是新增只读 FormalWorldView，让它只读取 FormalVisualModel 渲染玩家主视觉壳层。

FORMAL-VIEW-00 仍然不能：

1. 在组件内生成 FormalWorldVisualItem。
2. 在组件内生成 FormalActorVisualItem。
3. buildFormalWorldVisualItems。
4. buildFormalActorVisualItems。
5. 生成世界事实。
6. 生成 placement。
7. 生成 actor。
8. 填默认 anchor。
9. 读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
10. 默认显示 pet。
