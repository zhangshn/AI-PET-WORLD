# World Engine Development Guardrails

当前阶段暂停贴图式 Renderer 迭代，项目重心转向“人格驱动规则世界模拟引擎”的底层协议建设。

## 当前优先层

当前阶段先建设：

- World Rule Layer
- Spatial Geometry Layer
- EntityGeometry / Footprint / Collision / Support / Influence

## 开发红线

1. Renderer 只能读取 WorldState，不能生成世界。
2. Intent 不能直接改世界，必须经过：Intent -> Plan -> Validator -> Diff -> WorldState。
3. 不允许为了视觉效果绕过规则。
4. 世界规则决定什么能发生。
5. 管家人格决定想不想发生。
6. 空间结构决定在哪里发生。

## 架构判断

世界不是贴图摆放。世界由规则、点线面、生态、意图和变化共同推导。任何新的视觉呈现都必须服从 WorldState 和规则层输出，不能反向塑造世界事实。

## P5 世界变化层补充红线

1. IntentDecision 仍然不能直接修改 HomeMapState。
2. WorldChangePlan 只是计划层。
3. WorldDiffProposal 只是提案层。
4. validateMapDiffs 只校验，不写入。
5. WorldEvolutionAuditReport 只判断风险与安全性。
6. WorldEvolutionExecutionResult 当前只用于 debug，不代表正式世界已经自动写入。
7. 正式写入必须等 P7 MVP 闭环阶段再决定。
8. Renderer 仍然不能读取 proposal 或 execution 直接画图，必须读取最终 WorldState。

## P6 Renderer 层补充红线

1. Renderer 只能读取最终 WorldState / HomeMapState / Geometry / Terrain。
2. Renderer 不能读取 WorldDiffProposal 当作现实。
3. Renderer 不能读取 WorldEvolutionAuditReport 当作现实。
4. Renderer 不能读取 WorldEvolutionExecutionResult 当作现实。
5. Renderer 不能为了视觉效果创造不存在的 placement。
6. Renderer 不能直接修改 HomeMapState。
7. Renderer 不能替代 WorldEngine。
8. P6 第一阶段只允许做 debug visual，不允许追求漂亮画面。

## P6.7 正式世界接入评估红线

1. 正式 /world 不能直接接 debug wireframe。
2. 正式 /world 不能直接使用 /world-debug/procedural-renderer 的页面组件。
3. 正式 /world 接入前，必须先有正式 ProceduralRenderer 组件设计。
4. 正式 ProceduralRenderer 只能读取 RenderableWorldSnapshot 或最终 VisualState。
5. 正式 ProceduralRenderer 不能读取 IntentDecision / WorldChangePlan / WorldDiffProposal / Audit / Execution。
6. 正式接入前必须通过 debug 页验证 VisualState 与 DrawCommand 稳定。
7. HomeMapRenderer placeholder 在正式接入前继续保留。
8. 不允许为了“看起来像世界”恢复旧贴图假世界。

## P6.8 正式 ProceduralRenderer 组件设计红线

1. P6.8 只允许写设计文档，不允许新增正式 Renderer 组件。
2. 正式 ProceduralRenderer 未来只能读取 RenderableWorldSnapshot。
3. 正式 ProceduralRenderer 不能读取 debug scenario。
4. 正式 ProceduralRenderer 不能读取 IntentDecision / WorldChangePlan / WorldDiffProposal / Audit / Execution。
5. 正式 ProceduralRenderer 不能从 assetId 推导贴图或假对象。
6. 正式 ProceduralRenderer 不能生成 placement 或修改 HomeMapState。
7. Debug wireframe 不能直接搬进正式 /world。
8. HomeMapRenderer placeholder 必须保留到 P6.12 之后再评估替换。

## P6.13 Renderer 视觉增强与收口红线

1. P6.13 只允许写收口文档，不允许写新视觉代码。
2. 正式 Renderer 当前只能读取 RenderableWorldSnapshot。
3. 后续视觉增强必须从 DrawCommand / VisualState 派生。
4. 视觉增强不能引入贴图假世界。
5. 视觉增强不能根据 assetId 直接加载素材。
6. 视觉增强不能创造不存在的 placement。
7. 视觉增强不能修改 HomeMapState。
8. P7 之前 Renderer 不能承担世界推进职责。
9. P7 之前 Renderer 不能接管 world-evolution execution。
10. 任何正式视觉元素都必须能追溯到 WorldState / VisualState / DrawCommand。
