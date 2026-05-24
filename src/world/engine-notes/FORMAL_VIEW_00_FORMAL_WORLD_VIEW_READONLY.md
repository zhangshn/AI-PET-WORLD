> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD FORMAL-VIEW-00 FormalWorldView 只读 FormalVisualModel

## 1. 阶段定位

本阶段新增 FormalWorldView 只读渲染组件。

FormalWorldView 是玩家主视觉壳层，但本阶段不接入 /world 页面，不替换 Debug Renderer。

本阶段不是世界生成层，不是 FormalVisualGenerator，也不生成 FormalVisualModel。

## 2. 输入

FormalWorldView 只能接收：

```ts
model: FormalVisualModel
```

组件只能读取并渲染：

1. `model.canvas`。
2. `model.objects`。
3. `model.actors`。
4. `model.environment`。
5. `model.hudSummary`。

## 3. 渲染原则

FormalWorldView 只能根据 FormalVisualModel 已存在的 geometry 渲染：

1. point。
2. line。
3. polygon。
4. multiPolygon。

CSS 只能控制显示风格，不能决定对象是否存在。

组件可以做 layer 显示排序，但排序只用于显示层级，不能改变世界内容。

## 4. 本阶段不做

本阶段不做：

1. 不接入 /world 页面。
2. 不生成 FormalVisualModel。
3. 不调用 FormalVisualGenerator。
4. 不生成世界事实。
5. 不生成 placement。
6. 不生成 actor。
7. 不填默认 anchor。
8. 不读取 PNG。
9. 不读取 WORLD_MAP_ASSETS。
10. 不默认显示 pet。

## 5. 红线

FormalWorldView 不能：

1. import FormalVisualGenerator。
2. 调用 `buildFormalVisualModel`。
3. 定义 FormalWorldVisualItem。
4. 定义 FormalActorVisualItem。
5. 写 `buildFormalWorldVisualItems`。
6. 写 `buildFormalActorVisualItems`。
7. 写树 / 房子 / 道路 / 管家的专属结构模型。
8. 显示 raw tags / source diagnostics / audit internals。
9. 使用 `img` / `next/image`。
10. 使用 `backgroundImage`。

## 6. 下一步

下一步进入：

```text
FORMAL-VIEW-01：FormalWorldView preview harness
```
