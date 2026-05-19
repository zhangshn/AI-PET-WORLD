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

## P7 MVP 世界闭环红线

1. P7 不能绕过 Intent -> Plan -> Proposal -> Validation -> Audit -> Execution。
2. 正式写入 HomeMapState 必须经过 audit.canApplySafely。
3. 正式写入不能直接使用 debug scenario。
4. Renderer 仍然不能执行 MapDiff。
5. Renderer 仍然不能修改 HomeMapState。
6. world-evolution execution 不能无条件自动写入。
7. 旧 construction flow 不能被突然硬删，必须有迁移策略。
8. 多 Tick 推进必须保持可审计。
9. 所有正式世界变化必须能追溯到 MapDiff。
10. P7 第一阶段只允许设计，不允许直接写 runtime loop 代码。

## P7.7 WorldLoop 持久化红线

1. P7.7 只允许写持久化策略文档，不允许写持久化代码。
2. 不能直接把完整 RuntimeWorldState 无裁剪写入 localStorage。
3. 不能持久化 debug scenario 结果。
4. 不能持久化 Renderer 派生对象作为唯一世界事实。
5. 持久化的核心事实必须是 HomeMapState 或可恢复 HomeMapState 的安全快照。
6. auditTrail 必须有裁剪策略。
7. 世界状态必须按 worldId / ownerId 隔离。
8. 恢复状态必须校验版本与 worldId。
9. 持久化失败必须能 fallback 到 firstSceneModel。
10. Renderer 不能参与持久化决策。

## P7.8 旧 construction flow 收缩红线

1. P7.8 只允许写收缩文档，不允许删除或重写 construction flow。
2. construction flow 继续保留初始世界生成职责。
3. construction flow 可以继续服务 debug scenario。
4. construction flow 不再扩展为长期世界推进系统。
5. 长期世界变化必须进入 world-loop / world-evolution / SafeApply 链路。
6. /world 正式 Tick 不能直接调用 construction debug scenario。
7. Renderer 不能读取 construction debug result 当作正式世界事实。
8. 后续新增建设行为必须优先进入 WorldChangePlan / WorldDiffProposal。
9. construction flow 的后续职责是收缩，不是扩张。
10. 删除旧逻辑前必须先完成替代链路与迁移文档。

## P7.9 MVP 世界闭环收口红线

1. P7.9 只允许写收口文档，不允许写新代码。
2. 当前 MVP 闭环只支持手动 Tick，不支持自动 Tick。
3. 当前 RuntimeWorldState 只存在 React memory state，不做持久化。
4. Renderer 仍然只能读取 RenderableWorldSnapshot。
5. Renderer 不能执行 world-loop。
6. UI 不能绕过 buildWorldLoopStep / applyWorldLoopStep。
7. SafeApplyDecision 仍然是正式采用 nextHomeMapState 的唯一开关。
8. construction flow 继续收缩为 initial generation / debug support。
9. P7.10 之前不允许新增 persistence schema。
10. P7.10 之前不允许写 localStorage adapter。

## P7.11-P7.14 WorldLoop 持久化接入红线

1. persistence adapter 只能保存 PersistedWorldLoopState，不允许保存完整 RuntimeWorldState。
2. /world 恢复 persisted state 时必须重新派生 RenderableWorldSnapshot。
3. /world 恢复失败必须 fallback 到 firstSceneModel。
4. 手动保存必须由用户点击触发。
5. 禁止自动保存。
6. 禁止 Tick 后自动写 localStorage。
7. 禁止持久化 RenderableWorldSnapshot / VisualState / DrawCommand。
8. 禁止 Renderer 参与保存或恢复。
9. 禁止跳过 worldId / ownerId 校验。
10. P7.14 只评估自动保存，不实现自动保存。

## P7.15 真实管家 / 宠物 runtime context 红线

1. P7.15 只允许写策略文档，不直接接真实 context 代码。
2. 管家 / 宠物 runtime context 只能作为 world-loop 输入，不能直接修改 HomeMapState。
3. context 不能直接生成 placement。
4. context 不能绕过 IntentDecision / WorldChangePlan / WorldDiffProposal。
5. context 不能绕过 SafeApply。
6. /world 页面不能直接拼复杂人格算法。
7. world-loop 不能深层依赖 personality-core。
8. Renderer 状态不能作为 intent context。
9. debug scenario result 不能作为正式 context。
10. 在没有 schema 前不能把 context 写入持久化。

## P7.16 长期建设 proposal 扩展红线

1. P7.16 只允许写策略文档，不直接扩展 proposal 代码。
2. 长期建设必须进入 WorldChangePlan / WorldDiffProposal / validation / audit / SafeApply 链路。
3. proposal 不能直接修改 HomeMapState。
4. proposal 不能直接调用 applyMapDiffs。
5. proposal 不能绕过 validation / audit / SafeApply。
6. 禁止为了视觉效果生成无来源 placement。
7. Renderer 不能参与 proposal 生成。
8. construction debug scenario 不能进入正式 Tick。
9. rejected proposal 不能被当作世界事实。
10. 长期建设能力必须分阶段扩展，不能一次性塞入所有行为。

## P7.17 persistence / context / proposal 收口红线

1. P7.17 只允许写收口文档，不新增代码。
2. 当前保存只能保存 PersistedWorldLoopState，不能保存完整 RuntimeWorldState。
3. 当前恢复必须从 HomeMapState 重新派生 RenderableWorldSnapshot。
4. 当前仍然禁止自动保存。
5. 当前仍然禁止自动 Tick。
6. 真实 context 在没有 schema 前不能写入持久化。
7. 长期建设 proposal 在没有扩展 schema 前不能进入正式 Tick。
8. Renderer 不能参与 context、proposal、保存或恢复。
9. construction debug scenario 不能进入正式 Tick。
10. 下一阶段必须先做 ButlerRuntimeContext / PetRuntimeContext schema，再接真实 context。

## P7.25 context + proposal 收口红线

1. P7.25 只允许写收口文档，不新增运行时代码。
2. context 只能作为 world-loop 输入，不能直接修改 HomeMapState。
3. context 不能绕过 IntentDecision / WorldChangePlan / WorldDiffProposal / SafeApply。
4. proposal 只能生成候选 MapDiff，不能直接写入世界。
5. build_path / clean_area / repair_facility / plant_nature 仍然必须经过 validation / audit / execution / SafeApply。
6. proposal debug 页面只能用于审计，不得作为正式 /world 入口。
7. Renderer 只能读取最终世界事实，不能读取 proposal 当作现实。
8. P8 视觉增强不能为了好看创造不存在的 placement。
9. 自动 Tick 与自动保存仍然禁止。
10. 进入 P8 前必须确认 Renderer 仍然只读 RenderableWorldSnapshot / VisualState / DrawCommand。

## P8.0 正式视觉阶段规划红线

1. P8.0 只允许写规划文档，不写视觉代码。
2. P8 负责显示世界事实，不负责生成世界事实。
3. 正式 Renderer 只能读取 RenderableWorldSnapshot / VisualState / DrawCommand。
4. 正式 Renderer 不能读取 IntentDecision / WorldChangePlan / WorldDiffProposal / Audit / Execution。
5. 正式 Renderer 不能生成 placement。
6. 正式 Renderer 不能修改 HomeMapState。
7. 正式 Renderer 不能为了视觉效果伪造对象。
8. debug renderer / debug scenario 不能直接变成正式世界事实。
9. P8 第一阶段不做动画、不做拖拽、不做编辑器。
10. P8 视觉增强必须能追溯到已采用的 HomeMapState。
## P8 Geometry Renderer 纠偏红线

1. 定版文档优先于 P8.1 / P8.2 临时贴图实现。
2. 正式 Renderer 不能以 WORLD_MAP_ASSETS + backgroundImage 作为世界显示主路径。
3. 正式 Renderer 不能把 PNG 贴图当作世界对象本体。
4. 世界对象必须先被理解成点、线、面与几何结构。
5. 树不是 tree.png，房屋不是 house.png，道路不是 path.png。
6. Renderer 只能根据 WorldState / VisualState / DrawCommand / Geometry 绘制。
7. Renderer 不能绕过规则直接摆素材。
8. Renderer 不能生成 placement。
9. Renderer 不能修改 HomeMapState。
10. 贴图资源只能作为非正式调试资源或未来视觉参考，不得作为正式世界本体。
11. 后续树 / 房屋 / 道路必须进入几何拆解协议。
12. P8.2 PNG 贴图版只能作为历史临时验证，不能继续扩展。
