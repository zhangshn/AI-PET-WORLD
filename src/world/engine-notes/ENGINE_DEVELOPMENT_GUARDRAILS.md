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
