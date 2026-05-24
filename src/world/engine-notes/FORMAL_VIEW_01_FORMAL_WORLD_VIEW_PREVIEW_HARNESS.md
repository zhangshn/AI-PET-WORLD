> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD FORMAL-VIEW-01 FormalWorldView preview harness

## 1. 阶段定位

本阶段只是 preview harness。

它用于开发期预览：

```text
FormalVisualModel -> FormalWorldView
```

的只读渲染效果。

本阶段不是正式 /world 接入，不是世界生成层，也不是 FormalVisualGenerator。

## 2. 本阶段新增内容

本阶段新增：

1. `src/app/world/components/formal-world-view/formal-world-view.preview.tsx`。

preview harness 内部包含一个最小 mock：

```ts
PREVIEW_FORMAL_VISUAL_MODEL
```

该 mock 只用于验证 FormalWorldView 的渲染壳层。

## 3. preview mock 边界

preview mock 必须带有 auditTags：

1. `preview_only`。
2. `not_world_fact`。
3. `not_persisted`。

preview mock 不是世界事实。

preview mock 不能进入正式数据流。

preview mock 不能写入 generator、world-loop、HomeMapState 或 Renderer。

preview mock 不能被当作 HomeMapState / WorldState / VisualState / FormalVisualModel 的正式来源。

## 4. 本阶段不做

本阶段不做：

1. 不接入 /world。
2. 不修改正式路由。
3. 不修改 FormalVisualGenerator。
4. 不修改 FormalVisualModel schema。
5. 不修改 world-loop。
6. 不修改 HomeMapState。
7. 不生成真实世界事实。
8. 不生成真实 placement。
9. 不生成真实 actor。
10. 不读取 PNG。
11. 不读取 WORLD_MAP_ASSETS。
12. 不默认接入 pet。

## 5. 下一步

下一步是 FORMAL-VIEW-02 或 /world 正式接入前检查，具体以后再定。

在正式决策前，不得擅自接入正式 /world。
