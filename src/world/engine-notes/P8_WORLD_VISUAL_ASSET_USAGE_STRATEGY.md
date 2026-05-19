# AI-PET-WORLD P8.1 贴图素材路线废弃说明

## 1. 文件状态

本文件原本描述 `WORLD_MAP_ASSETS` / `assetId` / PNG 贴图路线。

根据《AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.1》，该路线不能作为正式 Renderer。它只能被视为 P8 早期的临时链路验证思路，不能继续作为正式视觉方向扩展。

## 2. 废弃原因

定版文档明确：

1. AI-PET-WORLD 的世界不是一张预先画好的地图。
2. 世界对象不应先被理解成贴图，而应先被理解成几何结构。
3. 世界不是先画一张图片，世界是先生成几何结构，Renderer 再根据几何结构把它画出来。
4. 树不是 `tree.png`。
5. 房屋不是 `house.png`。
6. Renderer 不能绕过规则直接摆素材。

因此，正式 Renderer 不再以 `assetId -> PNG` 作为核心路径。

## 3. 当前边界

`map-assets` 可以作为历史资源库、非正式调试资源或未来视觉参考保留。

但正式 Renderer 不应：

1. 读取 `WORLD_MAP_ASSETS` 作为世界显示主路径。
2. 使用 `asset.path` 决定正式视觉。
3. 使用 PNG 图片作为世界对象本体。
4. 通过 `backgroundImage` 拼出正式世界。
5. 把素材库当成规则世界事实来源。

## 4. 正式路线

正式路线迁移到：

```text
P8_GEOMETRY_RENDERER_REPAIR.md
```

P8.2 之后以几何 / 程序化绘制为准：

```text
VisualState / DrawCommand / VisualPlacement / Geometry
-> 程序化绘制点、线、面
-> Renderer 显示结果
```

而不是：

```text
assetId
-> PNG
-> backgroundImage
-> 贴图地图
```

## 5. 后续结论

P8.1 不再作为正式贴图路线文档。

后续 P8 视觉实现必须回到定版文档要求的几何结构路线。PNG 素材可以保留，但只能作为历史资源库、非正式调试资源或未来视觉参考，不能作为正式世界本体。
