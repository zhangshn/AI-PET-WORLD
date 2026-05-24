> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8 几何 Renderer 纠偏说明

## 1. 纠偏原因

P8.2 曾经实现过 `WORLD_MAP_ASSETS + backgroundImage` 的 PNG 贴图预览。

这只能算临时链路验证，不能作为正式 Renderer。它可以证明 HomeMapState 中的 placement 能进入视觉组件，但它不符合定版文档对 AI-PET-WORLD 世界本体的定义。

## 2. 定版文档准则

定版文档明确：

- 世界不是先画一张图片。
- 世界是先生成几何结构。
- Renderer 再根据几何结构绘制。
- 树不是 `tree.png`。
- 房屋不是 `house.png`。
- Renderer 不能绕过规则直接摆素材。

因此，正式视觉不能以 PNG 贴图作为世界对象本体。

## 3. 当前正式方向

正式方向：

```text
VisualState / DrawCommand / VisualPlacement / Geometry
-> 程序化绘制点、线、面
-> Renderer 显示结果
```

不是：

```text
assetId
-> PNG
-> backgroundImage
-> 贴图地图
```

## 4. P8.2 修复结果

ProceduralRendererView 已完成纠偏：

1. 移除 `WORLD_MAP_ASSETS` 读取。
2. 不再使用 `asset.path`。
3. 不再使用 `backgroundImage`。
4. 不再通过 PNG 图片显示正式世界对象。
5. 正式视觉改为程序化 CSS 几何绘制。
6. 线框 debug overlay 保留，用于查看 DrawCommand 和几何派生信息。

## 5. 后续原则

1. Renderer 只能读取 WorldState / VisualState / DrawCommand。
2. Renderer 不能读取 proposal。
3. Renderer 不能生成 placement。
4. Renderer 不能修改 HomeMapState。
5. PNG 素材可以作为未来参考或非正式调试资源，但不能作为正式世界本体。
6. 后续树、房屋、道路必须进入点线面结构拆解。
