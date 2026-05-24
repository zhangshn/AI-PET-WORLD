> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P6.8 正式 ProceduralRenderer 组件设计

## 1. 设计目标

正式 ProceduralRenderer 不是 debug wireframe。
正式 ProceduralRenderer 不是贴图式 Renderer。
正式 ProceduralRenderer 是 WorldState / VisualState 的正式展示层。

核心链路：

```text
HomeMapState
+ EnvironmentState
+ PlacementGeometryAudit
-> VisualState
-> DrawCommand[]
-> RenderableWorldSnapshot
-> ProceduralRendererView
```

Renderer 只能展示已经存在的世界事实，不能生成世界事实。

## 2. 推荐组件位置

未来正式组件位置：

```text
src/app/world/components/procedural-renderer/
  procedural-renderer-view.tsx
  procedural-renderer-view.styles.module.css
```

本轮不创建这些文件。

## 3. 正式组件输入协议

正式组件未来只允许输入：

```ts
type ProceduralRendererViewProps = {
  snapshot: RenderableWorldSnapshot
}
```

或者：

```ts
type ProceduralRendererViewProps = {
  visualState: VisualState
  drawCommands: DrawCommand[]
}
```

推荐使用第一种：

```ts
snapshot: RenderableWorldSnapshot
```

原因：

1. 输入更集中。
2. 可以保证 VisualState 与 DrawCommand 属于同一个派生结果。
3. 方便后续做性能缓存。
4. 方便调试 source 和 tags。

## 4. 正式组件禁止读取的数据

正式组件必须禁止读取：

1. IntentDecision
2. WorldChangePlan
3. WorldDiffProposal
4. WorldEvolutionAuditReport
5. WorldEvolutionExecutionResult
6. WorldEngineChainAuditReport
7. debug scenario result
8. construction debug scenario result
9. localStorage create-world raw input
10. asset registry 中的贴图资源

这些不是最终世界事实，或者会导致 Renderer 反向参与世界生成。

## 5. 正式组件和 debug wireframe 的区别

| 项目 | debug wireframe | 正式 ProceduralRenderer |
| --- | --- | --- |
| 用途 | 验证 DrawCommand | 产品世界展示层 |
| 位置 | `/world-debug/procedural-renderer` | `/app/world/components/procedural-renderer` |
| 样式 | inline style / currentColor | 独立 CSS module，但不能制造世界事实 |
| 数据 | RenderableWorldSnapshot | RenderableWorldSnapshot |
| 允许范围 | 可展示 summary / JSON / SVG | 只展示最终产品需要的层 |
| 是否可直接替换 HomeMapRenderer | 不可以 | P6.12 后才评估 |

## 6. P6.9 skeleton 阶段设计

P6.9 只能做 skeleton。

`procedural-renderer-view.tsx` 只能：

1. 接收 snapshot。
2. 展示 worldId。
3. 展示 drawCommandCount。
4. 展示 placementCount。
5. 展示 terrainCellCount。
6. 显示 “ProceduralRenderer 正式组件骨架已接入，但尚未绘制世界。”

P6.9 禁止：

1. SVG。
2. Canvas。
3. PixiJS。
4. 复杂视觉。
5. 替换 HomeMapRenderer。
6. 接 /world。

## 7. P6.10 summary 阶段设计

P6.10 可以：

1. 让正式组件读取 RenderableWorldSnapshot。
2. 展示 VisualState summary。
3. 展示 DrawCommand summary。
4. 仍然不画地图。
5. 仍然不替换 HomeMapRenderer。

## 8. P6.11 基础线框阶段设计

P6.11 才可以在正式组件里显示基础线框，但必须：

1. 仍然只读 DrawCommand。
2. 不加载图片。
3. 不根据 assetId 画贴图。
4. 不自动生成对象。
5. 不修改 HomeMapState。
6. 不追求最终美术。
7. 必须保留 debug/source 可追踪能力。

## 9. P6.12 替换 HomeMapRenderer 的前提

只有满足以下条件才允许替换：

1. P6.9-P6.11 通过 lint / tsc / build。
2. `/world-debug/procedural-renderer` 能稳定解释 VisualState 与 DrawCommand。
3. 正式 ProceduralRendererView 只读取 RenderableWorldSnapshot。
4. 正式组件没有读取过程层数据。
5. 正式组件没有生成世界事实。
6. HomeMapRenderer placeholder 的替换方案已经明确。
7. 页面 fallback 状态明确。
8. 性能风险可控。

## 10. 后续路线

1. P6.9：正式组件 skeleton
2. P6.10：正式组件 summary
3. P6.11：正式组件基础线框
4. P6.12：评估替换 HomeMapRenderer placeholder
5. P6.13：视觉增强策略文档
6. P7：MVP 世界闭环

## 11. 当前结论

当前不创建正式组件。
当前不修改 `/world`。
当前不替换 HomeMapRenderer。
下一步进入 P6.9：正式 ProceduralRenderer 组件 skeleton。
