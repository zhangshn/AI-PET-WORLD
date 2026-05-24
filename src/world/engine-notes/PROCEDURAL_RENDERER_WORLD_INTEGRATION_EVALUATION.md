> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P6.7 正式 /world 接入评估

## 1. 当前正式 /world 状态

- `/world/page.tsx` 只 re-export `world-route-page`。
- `world-route-page.tsx` 负责读取 create-world 输入与生成 `firstSceneModel`。
- `HomeMapRenderer` 当前是安全 placeholder。
- 正式 `/world` 当前没有真实 Renderer。
- 这不是 bug，而是为了阻止旧贴图假世界回流。

## 2. 为什么现在不能直接接入 debug wireframe

1. debug wireframe 是验证 DrawCommand 的工具，不是正式 Renderer。
2. 它使用内联 SVG 与 debug 样式，不适合正式体验。
3. 它显示的是调试线框，不是用户最终应该看到的世界。
4. 它目前没有交互层、镜头层、缩放层、性能策略。
5. 它还没有和正式 world page 的信息架构整合。
6. 它不能替代正式 ProceduralRenderer 组件。

## 3. 正式接入前必须满足的条件

1. P6.5 JSON debug 稳定。
2. P6.6 wireframe debug 稳定。
3. VisualState 不读取过程层数据。
4. DrawCommand 只来自 VisualState。
5. 正式 Renderer 组件只读取 RenderableWorldSnapshot。
6. 正式 Renderer 不直接读取 proposal / audit / execution。
7. 正式 Renderer 不生成世界事实。
8. HomeMapState 与 VisualState 的对应关系可追踪。
9. debug 页面能解释每一个视觉元素来自哪个 source。
10. 正式接入方案明确区分 debug visual 和 product visual。

## 4. 推荐正式接入方案

不要把 debug 页面搬进 `/world`。

应该新增正式组件：

```text
src/app/world/components/procedural-renderer/
  procedural-renderer-view.tsx
  procedural-renderer-view.styles.module.css
```

但注意：这个正式组件仍然只能读取：

- RenderableWorldSnapshot

不允许读取：

- IntentDecision
- WorldChangePlan
- WorldDiffProposal
- WorldEvolutionAuditReport
- WorldEvolutionExecutionResult
- WorldEngineChainAuditReport

## 5. 接入路径建议

1. P6.8：正式 ProceduralRenderer 组件设计文档
2. P6.9：正式组件 skeleton，不绘制复杂内容
3. P6.10：正式组件读取 RenderableWorldSnapshot，但只展示 summary
4. P6.11：正式组件显示基础线框
5. P6.12：替换 HomeMapRenderer placeholder
6. P6.13：再考虑视觉增强

P6.12 之前不替换 HomeMapRenderer。

## 6. 风险与禁止事项

1. 禁止直接把 debug wireframe 复制成正式体验。
2. 禁止为了视觉恢复贴图假世界。
3. 禁止 Renderer 直接读 proposal/audit/execution。
4. 禁止 Renderer 自己生成 placement。
5. 禁止 UI 绕过 WorldState。
6. 禁止在 P6.12 前替换 HomeMapRenderer placeholder。
7. 禁止把 wireframe 当 MVP 最终画面。
8. 禁止在没有性能策略前渲染过量 command。

## 7. 当前结论

当前结论：
正式 `/world` 暂不接入 ProceduralRenderer。
继续保留 HomeMapRenderer placeholder。
下一步应做 P6.8：正式 ProceduralRenderer 组件设计文档。
只有在 P6.8-P6.11 完成后，才评估 P6.12 替换 HomeMapRenderer。
