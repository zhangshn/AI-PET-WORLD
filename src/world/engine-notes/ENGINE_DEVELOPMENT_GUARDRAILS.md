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
