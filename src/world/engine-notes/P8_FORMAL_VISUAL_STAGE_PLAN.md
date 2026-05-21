# AI-PET-WORLD P8.0 正式视觉阶段规划

## 1. P8.0 的定位

P8.0 是正式视觉阶段的开篇规划文档。

P7 已经完成：

```text
真实 runtime context 输入
-> intent context adapter
-> 手动 Tick
-> WorldChangePlan
-> WorldDiffProposal
-> MapDiff validation
-> Audit
-> Execution
-> SafeApply
-> HomeMapState 更新
-> Renderer 读取当前世界事实
```

P8 不继续扩展底层世界闭环，而是负责把已经存在的世界事实稳定显示出来。

根据定版文档，P8 的正式视觉方向不是贴图地图，而是根据点、线、面 / VisualState / DrawCommand / Geometry 程序化绘制世界。

## 2. 当前视觉状态

当前 `/world` 已经具备：

1. HomeMapState。
2. RenderableWorldSnapshot。
3. VisualState。
4. DrawCommand。
5. ProceduralRendererView。
6. 基础线框预览。
7. 初始世界数据可视化。
8. Tick 后 MapDiff 可以改变 HomeMapState。

当前目标不是让世界变成 PNG 拼贴画，而是让世界从规则与几何结构中被绘制出来。

## 3. P8 的核心目标

P8 的目标不是让 Renderer 生成世界，而是让 Renderer 忠实显示世界已经存在的事实。

核心目标：

1. 将 RenderableWorldSnapshot 中的 DrawCommand 稳定显示为几何辅助信息。
2. 将 VisualState 中的 placement 显示为程序化点、线、面对象。
3. 验证 P7.23 的 world change 在画面上可见。
4. 保持 Renderer 只读，不写世界。
5. 保持视觉增强不反向创造 placement。
6. 为管家 / 宠物几何占位和后续动画打基础。

## 4. P8 与 P7 的边界

P7 负责：

```text
世界事实如何生成
```

P8 负责：

```text
世界事实如何显示
```

P8 不能反向承担 P7 的职责。

禁止 P8 做：

1. 生成 MapDiff。
2. 修改 HomeMapState。
3. 修改 RuntimeWorldState。
4. 修改 intent decision。
5. 修改 proposal。
6. 绕过 SafeApply。
7. 把 debug scenario 当正式世界。
8. 为了好看临时补造不存在的对象。

## 5. 正式 Renderer 输入边界

正式视觉层只允许读取：

1. RenderableWorldSnapshot。
2. VisualState。
3. VisualPlacement。
4. DrawCommand。
5. Geometry 派生信息。
6. HomeMapState 中已经存在的 placement 派生结果。

正式视觉层不能读取：

1. IntentDecision。
2. WorldChangePlan。
3. WorldDiffProposal。
4. WorldEvolutionAuditReport。
5. WorldEvolutionExecutionResult。
6. SafeApplyDecision 内部判断过程。
7. Debug scenario result。
8. 未经采用的 proposal。
9. localStorage 原始 persisted JSON。
10. personality-core 原始盘面。
11. WORLD_MAP_ASSETS 作为正式显示主路径。

## 6. P8 分阶段路线

### P8.0：正式视觉阶段规划

只写规划文档，明确 P8 视觉边界。

### P8.1：贴图路线废弃与几何路线确认

明确 `WORLD_MAP_ASSETS / assetId / PNG` 路线不能作为正式 Renderer。正式路线转为几何 / 程序化绘制。

### P8.2：几何 / 程序化 Renderer 第一版

实现正式 Renderer v1。

要求：

1. 读取 RenderableWorldSnapshot。
2. 读取 VisualState / VisualPlacement / DrawCommand。
3. 按 layer 排序。
4. 按 placement anchor / scale / alpha 做程序化绘制。
5. 用程序化 CSS 形状表达 ground / path / structure / facility / nature / surface-decoration / actor。
6. 不读取 PNG 图片。
7. 不读取 WORLD_MAP_ASSETS。
8. 不做动画。
9. 不做复杂交互。
10. 不修改世界状态。

### P8.3：几何视觉变化验证

验证 P7.23 的变化能被看见：

1. plant_nature：新增自然细节。
2. build_path：新增路径。
3. clean_area：清理 surface-decoration。
4. repair_facility：设施状态变化。

验证必须基于 SafeApply 之后的 HomeMapState 派生 RenderableWorldSnapshot。

### P8.4：管家与宠物几何占位显示

P8.4 只考虑管家 / 宠物占位，但也必须是几何 / 程序化占位，不是 PNG 贴图。

### P8.5：视觉状态与世界状态收口

确认正式 Renderer 没有反向生成世界事实。

## 7. P8.2 第一版范围

正式 Renderer v1 只做最小可见版本：

1. 地图容器。
2. 网格保留为 debug overlay。
3. ground / path / zone / structure / facility / nature / surface-decoration / actor 分层显示。
4. 根据 placement 的 anchor / scale / alpha 显示对象。
5. 根据 layer 和几何含义选择程序化形状。
6. 不做拖拽。
7. 不做点击编辑。
8. 不做动画。
9. 不做相机系统。
10. 不做美术重制。

目标是：

```text
先让世界像由规则和几何生成的世界
```

而不是：

```text
先让世界像一组贴图素材
```

## 8. P8.3 可视变化验收标准

P8.3 的验收标准：

1. plant_nature 生成的新自然细节能在几何 / 程序化视觉中看见。
2. build_path 生成的新路径能在几何 / 程序化视觉中看见。
3. clean_area 删除的 surface-decoration 能在画面上消失。
4. repair_facility 更新的 facility 至少能通过 label / alpha / tags 状态确认。
5. 所有变化仍然来自 SafeApply 之后的 HomeMapState。
6. Renderer 不读取 proposal。
7. Renderer 不生成 placement。
8. Renderer 不修改 HomeMapState。

## 9. 管家与宠物视觉原则

管家和宠物视觉进入 P8.4。

原则：

1. 管家是管理者，不是玩家手动操控角色。
2. 宠物是独立生命，不是按钮驱动对象。
3. 角色显示来自世界状态，不来自 UI 临时状态。
4. 宠物不能通过事件文本说人话。
5. 管家 / 宠物动画后续必须由 runtime state / behavior state 派生。
6. 初期只允许几何 / 程序化占位，不接复杂动画树。

## 10. 禁止事项

P8 禁止：

1. Renderer 生成 placement。
2. Renderer 修改 HomeMapState。
3. Renderer 直接应用 MapDiff。
4. Renderer 读取未采用 proposal。
5. Renderer 根据视觉需要伪造对象。
6. 正式 `/world` 使用 debug scenario 作为世界事实。
7. 正式 Renderer 深层导入 personality-core。
8. 视觉组件接管 world-loop。
9. 为了动画绕过 runtime state。
10. 以 WORLD_MAP_ASSETS + PNG 作为正式世界显示主路径。
11. 把树、房屋、道路理解为图片，而不是点、线、面与几何结构。

## 11. 当前结论

P8.0 锁定正式视觉阶段边界。

当前正式路线为：

```text
VisualState / DrawCommand / VisualPlacement / Geometry
-> 几何 / 程序化绘制
-> Renderer 显示当前世界事实
```

PNG 贴图路线已经纠偏，不再作为正式 Renderer 路线。

## 12. P8-G 几何视觉纠偏与收口记录

P8 原计划中 P8.1 / P8.2 曾经出现过 PNG / asset 贴图路线偏差。

根据定版文档，P8 已经纠偏为 Geometry / ShapeGrammar / VisualState 路线。

已完成补充阶段：

1. P8-GEOMETRY-REPAIR：纠偏正式 Renderer，不再使用 PNG / WORLD_MAP_ASSETS / backgroundImage。
2. P8-G1：新增 ShapeGrammar 点线面基础协议。
3. P8-G2：ShapeGrammar 接入 placement geometry adapter。
4. P8-G3：Geometry audit 显示 ShapeGrammar 来源。
5. P8-G4：Renderer 读取 geometry projection 并用 SVG 绘制。
6. P8-G4.1：修复中文乱码。
7. P8-G5：增强 geometry source 可读性。
8. P8-G5.1：VisualState 透传 EntityGeometry.tags。
9. P8-G6：新增 Geometry Source Diagnostics。
10. P8-G7：新增 World Geometry Overview。
11. P8-G7.1：明确 World Geometry Overview Debug 不是最终玩家 UI。

当前 P8-G 收口结论：

```text
HomeMapState
-> MapPlacement
-> ShapeGrammar
-> SpatialProjection
-> EntityGeometry
-> VisualState
-> VisualPlacement
-> Renderer SVG geometry layer
-> Debug diagnostics
```

当前页面验证位置：

- /world
- 几何 / 程序化视觉预览 v1
- World Geometry Overview Debug
- Geometry Source Diagnostics

当前 Debug 页面验证位置：

- /world-debug/visual-change-verification
- Before / After
- World Geometry Overview Debug
- Geometry Source Diagnostics

P8-G 之后继续禁止：

1. Renderer 读取 PNG 作为正式世界本体。
2. Renderer 读取 WORLD_MAP_ASSETS 作为正式显示主路径。
3. Renderer 使用 backgroundImage 作为正式世界对象绘制方式。
4. Renderer 生成 placement。
5. Renderer 修改 HomeMapState。
6. Renderer 读取 proposal 当作现实。
7. Renderer 为了视觉效果伪造世界对象。
8. Debug 诊断区被包装成最终玩家 UI。
9. 管家 / 宠物使用 UI 临时状态伪造存在。
10. 混淆世界事实层、几何派生层、Debug 展示层。

下一阶段建议进入 P8-H：角色几何占位阶段。

## 13. P8-H 管家 / 宠物 actor 几何占位入口

P8-G 已完成几何视觉阶段收口。

P8-H 进入角色几何占位阶段。

P8-H 的目标不是最终角色美术，也不是角色动画，而是建立管家 / 宠物 actor 在几何视觉系统中的只读投影。

P8-H 必须遵守：

1. 角色显示来自世界状态或 actor runtime projection。
2. Renderer 不能生成 actor。
3. Renderer 不能生成 placement。
4. Renderer 不能修改 HomeMapState。
5. Renderer 不能用 UI 临时状态伪造角色存在。
6. 管家是管理者，不是玩家手动操控角色。
7. 宠物是独立生命，不是按钮驱动对象。
8. 宠物不能通过事件文本说人话。
9. 初期只允许几何 / 程序化 actor 占位。
10. 后续动画必须由 runtime state / behavior state 派生。
11. 不读取 PNG。
12. 不读取 WORLD_MAP_ASSETS。
13. 不使用 backgroundImage 作为正式角色显示。

P8-H 推荐阶段：

1. P8-H0：actor 几何占位规划。
2. P8-H1：Actor Geometry Projection 协议。
3. P8-H2：Actor Runtime Projection 输入边界。
4. P8-H3：VisualState 接入 actor projection。
5. P8-H4：Renderer 显示 actor geometry。
6. P8-H5：Actor Debug Diagnostics。

下一步进入：

```text
P8-H1：Actor Geometry Projection 协议
```

## 14. P8-H1 Actor Geometry Projection 协议记录

P8-H1 已新增 actor-geometry 层，用于描述管家 / 宠物在几何视觉系统中的只读投影。

Actor Geometry Projection 只描述：

1. actorId。
2. actorKind：butler / pet。
3. anchor。
4. body。
5. interactionRadius。
6. pose。
7. attentionDirection。
8. source。
9. tags。

P8-H1 不做：

1. Renderer 显示 actor。
2. VisualState 接入 actor。
3. 生成 placement。
4. 修改 HomeMapState。
5. 修改 world-loop。
6. 修改 runtime state。
7. 读取 PNG。
8. 读取 WORLD_MAP_ASSETS。
9. 使用 backgroundImage。
10. 角色动画。

下一步进入：

```text
P8-H2：Actor Runtime Projection 输入边界
```

## 15. P8-H2 Actor Runtime Projection 输入边界记录

P8-H2 已新增 actor-runtime-projection 层。

本阶段定义从世界状态 / runtime state 到 actor projection 的轻量输入边界。

Actor Runtime Projection Result 描述：

1. actorId。
2. actorKind。
3. worldId。
4. presence。
5. canProject。
6. anchor。
7. pose。
8. attentionDirection。
9. source。
10. scale。
11. reason。
12. tags。

本阶段不直接导入 ButlerRuntimeContext / PetState，避免过度耦合。

当前只提供 deterministic placeholder anchor：

1. butler：{ x: 6, y: 6 }。
2. pet：{ x: 7, y: 6 }。

placeholder 只用于输入边界验证，不代表最终 autonomous movement。

P8-H2 不做：

1. Renderer 显示 actor。
2. VisualState 接入 actor。
3. ActorGeometryProjection 串联。
4. 生成 placement。
5. 修改 HomeMapState。
6. 修改 world-loop。
7. 修改 runtime state。
8. 读取 PNG。
9. 读取 WORLD_MAP_ASSETS。
10. 使用 backgroundImage。
11. 角色动画。

下一步进入：

```text
P8-H3：Actor Runtime Projection -> Actor Geometry Projection 串联
```

## 16. P8-H3 Actor Runtime Projection -> Actor Geometry Projection 串联记录

P8-H3 已新增 actor runtime -> geometry adapter。

本阶段将 ActorRuntimeProjectionResult 转换为 ActorGeometryProjection。

规则：

1. runtimeProjection.canProject === true 时，才允许生成 ActorGeometryProjection。
2. runtimeProjection.canProject === false 时，不生成 geometryProjection。
3. pet 未出生时，presence = not_ready，结果必须是 skipped_not_ready。
4. deterministic placeholder anchor 必须通过 geometrySource / tags 保留可见。
5. adapter 不接 Renderer。
6. adapter 不接 VisualState。
7. adapter 不生成 placement。
8. adapter 不修改 HomeMapState。
9. adapter 不修改 runtime state。
10. adapter 不读取 PNG / WORLD_MAP_ASSETS。

下一步进入：

```text
P8-H4：VisualState 接入 actor geometry projection
```
