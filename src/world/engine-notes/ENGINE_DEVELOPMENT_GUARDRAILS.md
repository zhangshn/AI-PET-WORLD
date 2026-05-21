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

## P8-G1 Shape Grammar 红线

1. 点线面图形生成基础层早于 Point / Line / Polygon 工程协议。
2. 树、房屋、道路必须优先拆解为点、线、面。
3. ShapeGrammar 不能读取 PNG。
4. ShapeGrammar 不能读取 WORLD_MAP_ASSETS。
5. ShapeGrammar 不能生成 placement。
6. ShapeGrammar 不能修改 HomeMapState。
7. ShapeGrammar 不能绕过 world rules。
8. ShapeGrammar 只描述结构，不决定世界是否发生变化。
9. 后续接入必须经过 Intent / Plan / Validate / Diff / WorldState。
10. Renderer 只能读取最终 WorldState / Geometry 派生结果。

## P8-G2 ShapeGrammar Adapter 红线

1. MapPlacement 进入 EntityGeometry 时，tree / house / road 应优先经过 ShapeGrammar。
2. ShapeGrammar projection 只能生成 footprint / collision / support / influence。
3. Adapter 不能生成 placement。
4. Adapter 不能修改 HomeMapState。
5. Adapter 不能读取 PNG。
6. Adapter 不能读取 WORLD_MAP_ASSETS。
7. Adapter 不能修改 Renderer。
8. Adapter 不能绕过 world rules。
9. fallback rectangle 逻辑必须保留，避免未映射对象中断。
10. 后续 geometry audit 必须能看出 geometry_source。

## P8-G3 Geometry Audit 红线

1. Geometry audit 只能读取 EntityGeometry 与规则校验结果。
2. Geometry audit 不能生成 placement。
3. Geometry audit 不能修改 HomeMapState。
4. Geometry audit 不能读取 PNG。
5. Geometry audit 不能读取 WORLD_MAP_ASSETS。
6. Geometry audit 不能修改 Renderer。
7. geometrySource 必须来自 EntityGeometry.tags。
8. shapeGrammarCount 只能统计 shape_grammar_* 来源。
9. fallback rectangle 必须可见，不能被伪装成 ShapeGrammar。
10. unknown source 必须保留，不能静默吞掉。

## P8-G4 Renderer Geometry Projection 红线

1. Renderer 读取 VisualPlacement.footprint / collision / support / influence 绘制。
2. Renderer 不能读取 PNG。
3. Renderer 不能读取 WORLD_MAP_ASSETS。
4. Renderer 不能生成 placement。
5. Renderer 不能修改 HomeMapState。
6. Renderer 不能读取 proposal 当作现实。
7. SVG geometry layer 是正式几何主绘制层。
8. CSS procedural fallback 只能作为临时可读层。
9. ground / path / zone / edge 不能继续用大量 CSS fallback 铺满遮挡几何层。
10. 后续视觉增强必须继续追溯到 Geometry / VisualState / WorldState。

## P8-G5 Geometry Visual Readability 红线

1. G5 只增强 Renderer 几何可读性，不修改世界生成。
2. geometry source 必须来自 VisualPlacement.tags / EntityGeometry.tags。
3. Renderer 不能重新推断世界事实。
4. Renderer 不能生成 placement。
5. Renderer 不能修改 HomeMapState。
6. Renderer 不能读取 PNG。
7. Renderer 不能读取 WORLD_MAP_ASSETS。
8. CSS fallback 只能作为辅助可读层。
9. ground / path / zone / edge 不能重新用 fallback 大量铺满。
10. tree / house / road 的视觉区分必须追溯到 ShapeGrammar / Geometry 来源。

## P8-G5.1 VisualState Geometry Tags 红线

1. VisualState 可以透传 EntityGeometry.tags，但不能生成新的世界事实。
2. VisualState 不能生成 placement。
3. VisualState 不能修改 HomeMapState。
4. geometry_source 必须来自 EntityGeometry.tags。
5. VisualPlacement.tags 必须保留 placement.tags / visual_rule / placement_layer。
6. tags 必须去重。
7. Renderer 的 geometry source 判断只能依赖 VisualPlacement.tags。
8. 本阶段不能修改 Renderer。
9. 本阶段不能读取 PNG。
10. 本阶段不能读取 WORLD_MAP_ASSETS。

## P8-G6 Geometry Source Diagnostics 红线

1. Diagnostics 只能读取 VisualPlacement.tags。
2. Diagnostics 不能读取 PNG。
3. Diagnostics 不能读取 WORLD_MAP_ASSETS。
4. Diagnostics 不能生成 placement。
5. Diagnostics 不能修改 HomeMapState。
6. Diagnostics 不能重新推断世界事实。
7. Diagnostics 不能读取 proposal 当作现实。
8. Diagnostics 只用于页面审计，不参与世界运行。
9. 每个 source 分组必须保留 unknown。
10. 每个 source 分组必须能看出 footprint / collision / support / influence 是否存在。

## P8-G7 World Geometry Overview Debug 红线

1. Overview Debug 只能读取 Geometry Source Diagnostics 的只读结果。
2. Overview Debug 不是最终玩家 UI。
3. Overview Debug 不能读取 PNG。
4. Overview Debug 不能读取 WORLD_MAP_ASSETS。
5. Overview Debug 不能生成 placement。
6. Overview Debug 不能修改 HomeMapState。
7. Overview Debug 不能重新推断世界事实。
8. Overview Debug 不参与世界运行。
9. Overview Debug 只能把 geometry_source 翻译成开发期可读摘要。
10. fallback 和 unknown 必须保留显示。
11. 开发期可读表达不能掩盖底层 Geometry / ShapeGrammar 来源。

## P8-G8 Geometry Visual Stage Closeout 红线

1. P8-G8 只做文档收口，不新增运行时功能。
2. P8-G 收口后，正式 Renderer 仍然只能读取 WorldState / VisualState / Geometry 派生结果。
3. Renderer 不能读取 PNG 作为正式世界本体。
4. Renderer 不能读取 WORLD_MAP_ASSETS 作为正式显示主路径。
5. Renderer 不能使用 backgroundImage 作为正式世界对象绘制方式。
6. Renderer 不能生成 placement。
7. Renderer 不能修改 HomeMapState。
8. Renderer 不能读取 proposal 当作现实。
9. World Geometry Overview Debug / Geometry Source Diagnostics 仍然是开发期 Debug 诊断区，不是最终玩家 UI。
10. 下一阶段 P8-H 角色占位仍必须来自世界状态与几何链路，不得用 UI 临时状态伪造存在。

## P8-H0 Actor Geometry Placeholder Plan 红线

1. P8-H0 只做规划文档，不新增运行时功能。
2. 管家 / 宠物显示必须来自世界状态或 actor runtime projection。
3. Renderer 不能生成 actor。
4. Renderer 不能生成 placement。
5. Renderer 不能修改 HomeMapState。
6. Renderer 不能用 UI 临时状态伪造角色存在。
7. 管家是管理者，不是玩家手动操控角色。
8. 宠物是独立生命，不是按钮驱动对象。
9. 宠物不能通过事件文本说人话。
10. Actor geometry 不能读取 PNG。
11. Actor geometry 不能读取 WORLD_MAP_ASSETS。
12. Actor geometry 不能使用 backgroundImage / img / next/image 作为正式角色显示。
13. Actor projection 不能写回 placement。
14. Actor Debug Diagnostics 不是最终玩家 UI。
15. 后续动画必须由 runtime state / behavior state 派生。

## P8-H1 Actor Geometry Projection Protocol 红线

1. Actor Geometry Projection 是只读几何投影，不是 MapPlacement。
2. Actor Geometry 不能写回 HomeMapState。
3. Actor Geometry 不能生成 placement。
4. Actor Geometry 不能自己决定角色是否存在。
5. Actor Geometry 不能自己决定角色位置，anchor 必须来自输入。
6. Actor Geometry builder 必须 deterministic。
7. Actor Geometry 不能读取 PNG。
8. Actor Geometry 不能读取 WORLD_MAP_ASSETS。
9. Actor Geometry 不能导入 map-assets。
10. Actor Geometry 不能导入 Renderer。
11. Actor Geometry 不能导入 HomeMapState。
12. Actor Geometry 不能修改 runtime。
13. 管家 / 宠物后续显示必须来自世界状态或 actor runtime projection。
14. 宠物不能通过事件文本说人话。
15. 管家不能替宠物做决定。

## P8-H2 Actor Runtime Projection Input Boundary 红线

1. Actor Runtime Projection 只能定义轻量输入边界，不接 Renderer。
2. Actor Runtime Projection 不能接 VisualState。
3. Actor Runtime Projection 不能修改 world-loop。
4. Actor Runtime Projection 不能修改 HomeMapState。
5. Actor Runtime Projection 不能生成 placement。
6. Actor Runtime Projection 不能导入 ButlerRuntimeContext。
7. Actor Runtime Projection 不能导入 PetState。
8. Actor Runtime Projection 不能读取 PNG。
9. Actor Runtime Projection 不能读取 WORLD_MAP_ASSETS。
10. Actor Runtime Projection 不能导入 map-assets。
11. Actor Runtime Projection 不能导入 Renderer。
12. projection 必须 deterministic。
13. anchor 缺省时只能使用 deterministic placeholder anchor，并必须通过 reason / tags 可识别。
14. pet isBorn === false 时 presence 必须是 not_ready，canProject 必须是 false。
15. placeholder 不能代表最终 autonomous movement，不能写回 HomeMapState。

## P8-H3 Actor Runtime To Geometry Projection 红线

1. H3 只允许把 ActorRuntimeProjectionResult 转换为 ActorGeometryProjection。
2. H3 不接 Renderer。
3. H3 不接 VisualState。
4. H3 不能修改 world-loop。
5. H3 不能修改 HomeMapState。
6. H3 不能生成 placement。
7. runtimeProjection.canProject === false 时绝不能生成 geometryProjection。
8. pet 未出生 not_ready 时必须返回 skipped_not_ready。
9. deterministic placeholder anchor 必须通过 geometrySource / tags 保持可见。
10. placeholder 不能代表最终 autonomous movement。
11. H3 不能读取 PNG。
12. H3 不能读取 WORLD_MAP_ASSETS。
13. H3 不能导入 map-assets。
14. H3 不能导入 Renderer / HomeMapState / ButlerRuntimeContext / PetState。
15. H3 不能修改 runtime state。

## P8-H4 VisualState Actor Geometry Projection 红线

1. VisualState 只能承载 actor geometry projection，不能生成 actor。
2. VisualState 不能生成 placement。
3. VisualState 不能修改 HomeMapState。
4. VisualActorGeometryProjection 不是 VisualPlacement。
5. VisualActorGeometryProjection 不是 MapPlacement。
6. actorRuntimeGeometryProjections 缺省时必须为空数组。
7. canProject === false 时不能强行补 geometryProjection。
8. pet 未出生 skipped_not_ready 只能被承载，不能被显示层伪装成 present。
9. 本阶段不能修改 Renderer 组件。
10. 本阶段不能修改 /world 页面。
11. 本阶段不能修改 world-loop / runtime state。
12. 本阶段不能读取 PNG。
13. 本阶段不能读取 WORLD_MAP_ASSETS。
14. 本阶段不能使用 backgroundImage / img / next/image。
15. Renderer 后续只能只读 VisualState.actorGeometryProjections。

## P8-H5 Renderer Actor Geometry Display 红线

1. Renderer 只能读取 VisualState.actorGeometryProjections。
2. Renderer 不能生成 actor。
3. Renderer 不能生成 actor projection。
4. Renderer 不能决定角色是否存在。
5. Renderer 不能填默认 anchor。
6. Renderer 不能生成 placement。
7. Renderer 不能修改 HomeMapState。
8. Renderer 不能读取 PNG。
9. Renderer 不能读取 WORLD_MAP_ASSETS。
10. Renderer 不能使用 backgroundImage / img / next/image。
11. VisualState.actorGeometryProjections 为空时必须显示 0，不能伪造管家或宠物。
12. canProject === false 时不能绘制 actor geometry。
13. pet 未出生 skipped_not_ready 时不能绘制宠物 actor。
14. Actor Geometry Diagnostics 不是最终玩家 UI。
15. 后续 actor 数据必须由上游 world snapshot / VisualState 输入，不能由 Renderer 构造。

## P8-H6 Actor Projection World Snapshot Integration 红线

1. world-loop renderable state 可以派生只读 butler actor projection。
2. 本阶段只能接入 butler，不能接入 pet 默认 actor。
3. pet 不是开局默认资产，不能为了画面完整而伪造。
4. actor projection 必须从 HomeMapState 派生 anchor。
5. actor projection 不能生成 MapPlacement。
6. actor projection 不能修改 HomeMapState。
7. actor projection 不能写入 mapDiff。
8. Renderer 仍然不能生成 actor。
9. Renderer 仍然不能决定角色是否存在。
10. Renderer 仍然不能填默认 anchor。
11. 不能读取 PNG。
12. 不能读取 WORLD_MAP_ASSETS。
13. 不能使用 backgroundImage / img / next/image。
14. 管家 projection v0 不是最终管家行为系统。
15. butler anchor 不代表最终 autonomous movement。

## P8-H7 Actor Geometry Debug Readability Closeout 红线

1. H7 只增强 Actor Geometry Debug 可读性，不改变 actor projection 链路。
2. 当前 actor 图形必须标记为 Debug 几何占位。
3. 当前 actor 图形不是最终玩家 UI。
4. 当前 actor 图形不是最终角色美术。
5. 当前 actor 图形不代表最终 autonomous movement。
6. 本阶段只接入 butler，不接入 pet。
7. Renderer 只能读取 VisualState.actorGeometryProjections 与 tags。
8. Renderer 不能重新推断世界事实。
9. Renderer 不能生成 actor。
10. Renderer 不能填默认 anchor。
11. 本阶段不能生成 MapPlacement。
12. 本阶段不能修改 HomeMapState。
13. 本阶段不能写入 mapDiff。
14. 本阶段不能读取 PNG / WORLD_MAP_ASSETS。
15. 本阶段不能使用 backgroundImage / img / next/image。

## P8-H8 Actor Geometry Closeout / Formal World View Separation 红线

1. H8 只做 Actor Geometry 阶段收口与 Formal World View 分离规划，不新增运行时功能。
2. 当前 /world 的几何 / 程序化视觉预览 v1 必须被视为 Debug View / Dev View。
3. 当前大面积网格、线框、诊断面板不能被当作最终玩家主视觉。
4. 当前 actor Debug 占位不能被当作最终角色美术。
5. 当前 actor Debug 占位不能被当作最终 autonomous movement。
6. Debug View 可以保留 raw geometry / raw tags / diagnostics / audit data。
7. Formal World View 不能直接显示 raw tags / source diagnostics / collision boxes / F-C-S-I。
8. Formal World View 不能把 Debug reason / anchor source 原始 tag 暴露给最终玩家主视觉。
9. Formal World View 仍然只能读取 VisualState / RenderableWorldSnapshot 中已经存在的事实。
10. Formal World View 不能生成 actor。
11. Formal World View 不能生成 placement。
12. Formal World View 不能修改 HomeMapState。
13. Formal World View 不能读取 proposal 当现实。
14. Formal World View 不能读取 PNG / WORLD_MAP_ASSETS 作为正式主路径。
15. pet 不能作为默认 actor 接入，必须继续遵守生命关系事件后置原则。

## P8-I0 Formal World View Plan 红线

1. P8-I0 只做 Formal World View 规划，不新增组件、不改页面、不改 Renderer、不改运行时。
2. Formal World View 是未来玩家主视觉，Debug View 是工程验证视图。
3. /world 未来应走 Formal World View，/world-debug 应保留 Debug Diagnostics。
4. Formal World View 只能读取 RenderableWorldSnapshot / VisualState 中已经存在的事实。
5. Formal World View 不能读取 PNG。
6. Formal World View 不能读取 WORLD_MAP_ASSETS 作为正式主路径。
7. Formal World View 不能生成 actor。
8. Formal World View 不能生成 placement。
9. Formal World View 不能修改 HomeMapState。
10. Formal World View 不能读取 proposal 当现实。
11. Formal World View 不能显示 raw tags / source diagnostics / audit internals。
12. Formal World View 不能显示 collision boxes / F-C-S-I / actor debug flags。
13. Formal World View 不能显示紫微斗数原始术语。
14. Formal World View 不能默认接入 pet actor。
15. Formal World View 不能让玩家直接控制管家或宠物。

## P8-I1 FormalWorldView Component Shell 红线

1. P8-I1 只新增 FormalWorldView 组件骨架，不接入 /world 页面。
2. FormalWorldView 只能读取 props.snapshot。
3. FormalWorldView 只能读取 RenderableWorldSnapshot / VisualState 派生数据。
4. FormalWorldView 不能读取 PNG。
5. FormalWorldView 不能读取 WORLD_MAP_ASSETS。
6. FormalWorldView 不能导入 map-assets。
7. FormalWorldView 不能导入 actor-geometry builder。
8. FormalWorldView 不能导入 actor-runtime-projection builder。
9. FormalWorldView 不能导入 world-loop / HomeMapState。
10. FormalWorldView 不能生成 actor。
11. FormalWorldView 不能生成 placement。
12. FormalWorldView 不能填默认 anchor。
13. FormalWorldView 不能修改 VisualState。
14. FormalWorldView 不能显示 raw tags / source diagnostics / F-C-S-I。
15. FormalWorldView 不能默认显示 pet 或显示紫微斗数原始术语。
