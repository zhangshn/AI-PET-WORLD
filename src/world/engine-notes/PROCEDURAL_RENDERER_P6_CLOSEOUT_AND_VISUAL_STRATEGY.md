# AI-PET-WORLD P6 ProceduralRenderer 收口与视觉增强策略

## 1. P6 完成内容

| 阶段 | 内容 | 是否已完成 | 备注 |
| --- | --- | --- | --- |
| P6.0 | 删除旧错误 Renderer / 贴图假世界内容 | 是 | 旧贴图式假世界内容已清理，正式世界不再依赖旧 Renderer 造景。 |
| P6.1 | ProceduralRenderer v0 前置设计文档 | 是 | 已明确 Renderer 只能显示世界事实，不能创造世界事实。 |
| P6.2 | renderer schema | 是 | 已定义 VisualState、VisualPlacement、VisualTerrainCell、DrawCommand、RenderableWorldSnapshot。 |
| P6.3 | VisualState builder | 是 | 已从 HomeMapState、EnvironmentState、PlacementGeometryAuditReport 派生 VisualState。 |
| P6.4 | DrawCommand builder | 是 | 已从 VisualState 派生 DrawCommand[] 与 RenderableWorldSnapshot。 |
| P6.5 | debug JSON 展示 | 是 | /world-debug/procedural-renderer 可展示 VisualState、DrawCommand 与 snapshot JSON。 |
| P6.6 | debug 线框预览 | 是 | debug 页面可用 SVG 线框验证 DrawCommand，但不代表正式美术。 |
| P6.7 | 正式 /world 接入评估文档 | 是 | 已明确不能直接把 debug wireframe 搬进正式 /world。 |
| P6.8 | 正式组件设计文档 | 是 | 已明确正式组件只读取 RenderableWorldSnapshot。 |
| P6.9 | 正式组件 skeleton | 是 | 已新增 ProceduralRendererView 骨架。 |
| P6.10 | 正式组件 summary | 是 | 已展示基础 summary、规则 summary、DrawCommand summary、sources / tags。 |
| P6.11 | 正式组件基础线框 | 是 | 已在正式组件内显示基础 DrawCommand 线框，不加载图片或贴图。 |
| P6.12 | 正式 /world 安全接入 | 是 | 正式 /world 已通过 WorldFirstSceneModel 读取 RenderableWorldSnapshot 并交给 ProceduralRendererView。 |

## 2. 当前正式 Renderer 状态

当前正式 `/world` 已经不再使用旧 HomeMapRenderer placeholder。
正式 `/world` 使用 ProceduralRendererView。
ProceduralRendererView 只接收 RenderableWorldSnapshot。
RenderableWorldSnapshot 来自 world-first-scene-model runtime。
页面不直接 build VisualState。
页面不直接 build DrawCommand。
页面不读取 debug scenario。
页面不读取 proposal / audit / execution。

当前正式 Renderer 展示：

1. summary
2. placement rule summary
3. draw command summary
4. sources / tags
5. 基础线框

当前正式 Renderer 仍然不是最终美术。它只是把已经存在的世界事实转成可见的基础表达。

## 3. Renderer 数据链路

```text
HomeMapState
-> EnvironmentState
-> PlacementGeometryAuditReport
-> VisualState
-> DrawCommand[]
-> RenderableWorldSnapshot
-> ProceduralRendererView
```

Renderer 只能处在最后一层。
Renderer 不能反向影响前面的状态。
Renderer 不能生成世界事实。

## 4. 允许的视觉增强

允许增强：

1. DrawCommand 样式映射表。
2. 不同 layer 的可视优先级。
3. 镜头缩放 / 平移。
4. command 数量裁剪与分页。
5. label 显示策略。
6. terrain / zone / placement / geometry 的显示开关。
7. debug source tooltip。
8. 基础交互：hover / selected command。
9. 性能优化：memo / virtualization / command filtering。
10. 在不改变世界事实的前提下，优化线条粗细、间距、排版。

这些增强必须只作用于 DrawCommand / VisualState 表达，不允许创造新对象。

## 5. 禁止的视觉增强

禁止：

1. 为了好看新增不存在的树、房子、道路、水池。
2. 根据 assetId 直接加载贴图。
3. 用贴图覆盖 DrawCommand 事实。
4. Renderer 自己补全世界缺失对象。
5. Renderer 直接调用 world-evolution。
6. Renderer 直接调用 MapDiff apply。
7. Renderer 读取 proposal / audit / execution。
8. Renderer 修改 HomeMapState。
9. Renderer 生成 placement。
10. 把 debug wireframe 当最终美术。
11. 在没有 WorldState 依据时画世界对象。
12. 绕过 Rule / Geometry / Environment / VisualState / DrawCommand。

## 6. 后续视觉增强路线

P6.14：Renderer style token 文档

P6.15：DrawCommand display policy

P6.16：Renderer interaction policy

P6.17：Renderer performance policy

P6.18：Product visual direction document

P7：MVP 世界闭环

不要马上进入复杂美术。先做 policy，再做视觉。

## 7. P7 之前 Renderer 不能承担的职责

P7 之前 Renderer 不能：

1. 推进世界时间。
2. 执行 world-evolution execution。
3. 保存 HomeMapState。
4. 应用 MapDiff。
5. 决定管家意图。
6. 决定宠物行为。
7. 生成生态变化。
8. 生成新 placement。
9. 承担游戏逻辑。
10. 承担 AI 决策。

## 8. P6 收口结论

P6 已完成：

1. 从世界事实到 VisualState。
2. 从 VisualState 到 DrawCommand。
3. 从 DrawCommand 到 debug JSON / debug wireframe。
4. 从 RenderableWorldSnapshot 到正式 ProceduralRendererView。
5. 正式 /world 已经安全接入 ProceduralRendererView。

P6 未完成：

1. 最终美术。
2. 复杂交互。
3. 性能策略。
4. P7 的世界推进闭环。
5. world-evolution execution 正式写入。
6. 多 Tick 世界演化渲染。

当前结论：
P6 可以收口。
下一阶段不是继续做漂亮画面，而是进入 P7 MVP 世界闭环设计。
P7 需要决定 world-evolution execution 如何安全写入 HomeMapState，以及 Renderer 如何显示已写入后的世界。

## 9. P7 开始前检查清单

- [ ] 正式 /world 没有引用 debug wireframe。
- [ ] 正式 /world 没有引用 debug scenario。
- [ ] Renderer 只读取 RenderableWorldSnapshot。
- [ ] Runtime model 负责生成 snapshot。
- [ ] VisualState 可追溯到 HomeMapState。
- [ ] DrawCommand 可追溯到 VisualState。
- [ ] 没有恢复贴图假世界。
- [ ] 没有 assetId 贴图加载。
- [ ] 没有 Renderer 修改 HomeMapState。
- [ ] 没有 Renderer 执行 MapDiff。
- [ ] 没有 Renderer 调用 world-evolution。
- [ ] P7 方案必须先写文档再写代码。
