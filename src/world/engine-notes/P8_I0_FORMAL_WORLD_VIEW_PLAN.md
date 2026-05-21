# AI-PET-WORLD P8-I0 Formal World View 规划

## 1. 阶段定位

P8-I 是 Formal World View 阶段。

P8-I0 只做规划，不写组件，不改页面，不改 Renderer，不改运行时。

Formal World View 是未来玩家看到的主世界画面。

它和当前 Debug View 不同：

- Debug View 用来验证世界事实、几何链路、actor projection、audit、source、tags。
- Formal World View 用来给玩家呈现一个干净、自然、自主运行的世界。

## 2. 当前 Debug View 的定位

当前 /world 中的“几何 / 程序化视觉预览 v1”属于 Debug View。

它可以显示：

- 工程网格。
- footprint / collision / support / influence。
- Geometry Source Diagnostics。
- World Geometry Overview Debug。
- Actor Geometry Diagnostics。
- raw tags。
- raw sources。
- F / C / S / I。
- anchor source。
- debug reason。
- actor_projection_debug_only。
- notFinalArt / notFinalMovement。

这些内容不能作为最终玩家主视觉直接展示。

## 3. Formal World View 的目标

Formal World View 的目标是：

1. 展示干净的自主世界。
2. 保留几何 / 程序化生成路线。
3. 不回到 PNG 贴图主路径。
4. 只读取 VisualState / RenderableWorldSnapshot 中已经存在的事实。
5. 不生成 actor。
6. 不生成 placement。
7. 不修改 HomeMapState。
8. 不读取 proposal 当现实。
9. 不显示 Debug Diagnostics。
10. 不显示 raw tags / source labels / collision boxes / F-C-S-I。
11. 不显示紫微斗数原始术语。
12. 不让宠物说人话。
13. 管家作为第一生命可以显示。
14. 宠物仍然后置，不能默认伪造。

## 4. Formal World View 初期画面结构

Formal World View 初期建议分为四层：

### 4.1 Formal World Canvas

负责显示干净世界：

- 地面。
- 道路。
- 建筑。
- 树木。
- 设施。
- 环境氛围。
- 管家 actor 正式占位样式。

不能显示：

- Debug 网格。
- collision / support / influence 线框。
- raw tags。
- source diagnostics。
- audit internals。

### 4.2 Formal Actor Layer

负责显示已经存在于 VisualState.actorGeometryProjections 的 actor。

初期只显示 butler。

规则：

1. 只读 VisualState.actorGeometryProjections。
2. canProject === false 不显示。
3. pet 不默认显示。
4. actor 图形可以是正式几何占位。
5. actor 图形不是最终美术。
6. actor 图形不代表最终 autonomous movement。
7. 不能由 Formal World View 生成 actor。

### 4.3 Formal World HUD

负责显示玩家可理解的最小状态：

- 世界阶段。
- 管家状态摘要。
- 当前世界观察。
- 最近世界日志入口。
- 可选：是否有新事件。

不能显示：

- 内部工程字段。
- raw tags。
- source labels。
- F / C / S / I。
- 命理盘原始术语。

### 4.4 Formal Narrative / Log Entry

负责进入世界日志或观察叙事。

注意：

1. 宠物不能说人话。
2. 管家可以解释世界，但不能替宠物做决定。
3. 玩家观察世界，而不是直接控制世界。

## 5. Formal World View 与 Debug View 的路由边界

建议：

1. /world 保留为未来 Formal World View。
2. Debug 诊断迁移或集中到 /world-debug/*。
3. 当前 /world 中的 Debug View 未来需要拆分。
4. 不要把 Debug Diagnostics 直接留在最终 /world 主界面。
5. Formal View 与 Debug View 可以共享底层 RenderableWorldSnapshot，但不能共享展示策略。

## 6. Formal World View 的输入边界

Formal World View 可以读取：

- RenderableWorldSnapshot。
- VisualState。
- VisualPlacement。
- VisualActorGeometryProjection。
- VisualTerrainCell。
- VisualZone。
- VisualState tags 的非工程摘要结果。

Formal World View 不能读取：

- PNG。
- WORLD_MAP_ASSETS 作为正式主路径。
- proposal。
- unvalidated diff。
- raw audit internals。
- personality-core 原始命理结构。
- UI 临时状态伪造角色存在。

## 7. Formal World View 的显示原则

1. 显示“世界是什么”，不是显示“工程怎么验证”。
2. 显示玩家能理解的状态，不显示工程标签。
3. 显示管家自然存在，不显示 actor_projection_debug_only。
4. 显示世界对象，不显示 footprint/collision/support/influence。
5. 显示观察叙事，不暴露底层规则计算。
6. 保留自主世界观：玩家观察，管家管理，宠物自主。
7. 保持宠物后置原则：宠物不是默认资产。

## 8. P8-I 推荐阶段

### P8-I0：Formal World View 规划

只写本文档。

### P8-I1：FormalWorldView 组件骨架

新增 FormalWorldView 组件。

要求：

- 只读取 RenderableWorldSnapshot。
- 不读取 PNG。
- 不生成 placement。
- 不修改 HomeMapState。
- 不显示 Debug Diagnostics。
- 不显示 raw tags。
- 不接 pet。

### P8-I2：Formal World Canvas

新增干净画布层。

要求：

- 无 Debug 网格。
- 无 Geometry Diagnostics。
- 无 raw tags。
- 无 F / C / S / I。
- 用程序化形状显示世界对象。

### P8-I3：Formal Actor Presentation

显示 butler actor 正式几何占位。

要求：

- 只读 VisualState.actorGeometryProjections。
- canProject false 不显示。
- pet 不默认显示。
- 不生成 actor。
- 不填默认 anchor。

### P8-I4：Formal World HUD 最小版

显示玩家可理解状态：

- 世界状态。
- 管家状态摘要。
- 最近日志入口。
- 当前观察。

### P8-I5：/world 与 /world-debug 边界整理

目标：

- /world 默认走 Formal World View。
- /world-debug 保留 Debug View。
- Debug Diagnostics 不直接出现在玩家主视觉。

## 9. 继续禁止事项

1. 禁止把 Debug View 当最终玩家 UI。
2. 禁止把工程网格当最终世界效果。
3. 禁止把 actor Debug 占位当最终角色美术。
4. 禁止为了好看读取 PNG。
5. 禁止重新把 WORLD_MAP_ASSETS 作为正式主路径。
6. 禁止 Formal World View 生成 actor。
7. 禁止 Formal World View 生成 placement。
8. 禁止 Formal World View 修改 HomeMapState。
9. 禁止 UI 临时伪造宠物。
10. 禁止默认接入 pet actor。
11. 禁止让宠物通过事件文本说人话。
12. 禁止在正式世界主视觉显示紫微斗数原始术语。
13. 禁止显示 raw tags / source diagnostics / audit internals。
14. 禁止读取 proposal 当现实。
15. 禁止玩家直接控制管家或宠物。

## 10. 当前结论

P8-I0 只定义 Formal World View 的边界。

下一步进入：

P8-I1：FormalWorldView 组件骨架
