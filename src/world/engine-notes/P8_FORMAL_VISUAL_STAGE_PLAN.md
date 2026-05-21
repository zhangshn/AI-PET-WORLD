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

## 17. P8-H4 VisualState 接入 actor geometry projection 记录

P8-H4 已让 VisualState 可以携带 actor geometry projection。

新增：

VisualActorGeometryProjection
VisualState.actorGeometryProjections

VisualState builder 新增可选输入：

actorRuntimeGeometryProjections?: ActorRuntimeGeometryProjectionResult[]

本阶段规则：

1. actorRuntimeGeometryProjections 缺省时为空数组。
2. 现有 buildVisualState 调用不传 actorRuntimeGeometryProjections 时不受影响。
3. VisualActorGeometryProjection 不是 VisualPlacement。
4. Actor projection 不写入 HomeMapState。
5. Actor projection 不生成 MapPlacement。
6. canProject === false 时，geometryProjection 可以为空。
7. pet 未出生时，只能承载 skipped_not_ready。
8. 本阶段不接 Renderer。
9. 本阶段不修改 /world。
10. 本阶段不读取 PNG / WORLD_MAP_ASSETS。

下一步进入：

```text
P8-H5：Renderer 显示 actor geometry
```

## 18. P8-H5 Renderer 显示 actor geometry 记录

P8-H5 已让 Renderer 只读 VisualState.actorGeometryProjections。

本阶段新增：

1. Actor Geometry Summary。
2. Actor Geometry Diagnostics。
3. SVG actor geometry layer。
4. actor body 绘制。
5. actor interactionRadius 绘制。

规则：

1. Renderer 只读取 VisualState.actorGeometryProjections。
2. Renderer 不生成 actor。
3. Renderer 不生成 actor projection。
4. Renderer 不决定角色是否存在。
5. Renderer 不填默认 anchor。
6. canProject === false 时不绘制 actor geometry。
7. VisualState.actorGeometryProjections 空数组时不显示角色。
8. pet 未出生 skipped_not_ready 时不绘制宠物 actor。
9. 本阶段不修改 HomeMapState。
10. 本阶段不读取 PNG / WORLD_MAP_ASSETS。

下一步进入：

```text
P8-H6：Actor projection 数据接入 world snapshot
```

## 19. P8-H6 Actor projection 数据接入 world snapshot 记录

P8-H6 已让 world-loop renderable state 接入 butler actor projection。

当前链路：

```text
HomeMapState
-> world-loop renderable state
-> buildButlerRuntimeProjection
-> buildActorGeometryProjectionFromRuntime
-> buildVisualState(actorRuntimeGeometryProjections)
-> VisualState.actorGeometryProjections
-> Renderer 只读显示
```

本阶段规则：

1. 只接入 butler。
2. 不接入 pet。
3. butler anchor 从 HomeMapState 派生。
4. anchor 优先来自 actor_kind:butler placement。
5. 其次来自 visual_center zone。
6. 再次来自 temporary_shelter zone。
7. 最后 fallback 到 mapSize 中心。
8. 不生成 MapPlacement。
9. 不修改 HomeMapState。
10. 不写入 mapDiff。
11. 不修改 Renderer。
12. 不读取 PNG / WORLD_MAP_ASSETS。

下一步进入：

```text
P8-H7：Actor Geometry Display 可读性与 Debug 收口
```

## 20. P8-H7 Actor Geometry Display 可读性与 Debug 收口记录

P8-H7 已增强 Actor Geometry Diagnostics 可读性。

本阶段明确：

1. 当前 actor 图形是 Debug 几何占位。
2. 当前不是最终玩家 UI。
3. 当前不是最终角色美术。
4. 当前不代表最终 autonomous movement。
5. 当前只接入 butler。
6. 当前不接入 pet。
7. butler anchor source 会在 tags 中显示。
8. Renderer 只读 tags 展示 anchor source，不重新推断世界事实。
9. Renderer 不生成 actor。
10. Renderer 不填默认 anchor。
11. 不生成 MapPlacement。
12. 不修改 HomeMapState。
13. 不读取 PNG / WORLD_MAP_ASSETS。

下一步进入：

```text
P8-H8：Actor Geometry 阶段收口与 Formal World View 分离规划
```

## 21. P8-H8 Actor Geometry 阶段收口与 Formal World View 分离规划记录

P8-H8 已完成 Actor Geometry 阶段收口规划。

当前确认：

1. 当前 /world 的几何 / 程序化视觉预览 v1 是 Debug View / Dev View。
2. 当前大面积网格、线框、诊断面板不是最终玩家主视觉。
3. 当前 actor 图形是 Debug 几何占位。
4. 当前 actor 图形不是最终角色美术。
5. 当前 actor 图形不代表最终 autonomous movement。
6. Renderer 仍然只读 VisualState / RenderableWorldSnapshot。
7. Renderer 不生成 actor。
8. Renderer 不生成 placement。
9. pet 不作为默认 actor 接入。
10. Formal World View 必须单独规划。
11. Debug View 可以保留工程诊断。
12. Formal World View 不应直接显示 raw tags / source diagnostics / collision boxes / F-C-S-I。
13. Formal World View 仍然必须遵守不读取 PNG / WORLD_MAP_ASSETS 主路径。
14. Formal World View 不能伪造世界事实。
15. Formal World View 不能显示紫微斗数原始术语。

下一步进入：

```text
P8-I0：Formal World View 规划
```

## 22. P8-I0 Formal World View 规划记录

P8-I0 已定义 Formal World View 的阶段边界。

当前确认：

1. Formal World View 是未来玩家主视觉。
2. Debug View 是工程验证视图。
3. /world 未来应走 Formal World View。
4. /world-debug 应保留 Debug Diagnostics。
5. Formal World View 只读取 RenderableWorldSnapshot / VisualState。
6. Formal World View 不读取 PNG。
7. Formal World View 不读取 WORLD_MAP_ASSETS 作为正式主路径。
8. Formal World View 不生成 actor。
9. Formal World View 不生成 placement。
10. Formal World View 不修改 HomeMapState。
11. Formal World View 不显示 raw tags / source diagnostics / collision boxes / F-C-S-I。
12. Formal World View 不显示紫微斗数原始术语。
13. Formal World View 不默认接入 pet。
14. 管家作为第一生命可以从 VisualState.actorGeometryProjections 显示。
15. 宠物仍然后置，必须由生命关系事件接纳后进入。

下一步进入：

```text
P8-I1：FormalWorldView 组件骨架
```

## 23. P8-I1 FormalWorldView 组件骨架记录

P8-I1 已新增 FormalWorldView 组件骨架。

本阶段新增：

1. formal-world-view.tsx。
2. formal-world-view.styles.module.css。
3. FormalWorldViewProps。
4. FormalWorldView。
5. Formal World Canvas 壳层。
6. Formal World HUD 骨架。
7. Formal Actor Summary 骨架。

本阶段规则：

1. 组件只读取 RenderableWorldSnapshot / VisualState。
2. 不接入 /world 页面。
3. 不替换 ProceduralRendererView。
4. 不显示 Debug Diagnostics。
5. 不显示 raw tags。
6. 不显示 source labels。
7. 不显示 collision boxes / F-C-S-I。
8. 不读取 PNG。
9. 不读取 WORLD_MAP_ASSETS。
10. 不生成 actor。
11. 不生成 placement。
12. 不修改 HomeMapState。
13. 不默认显示 pet。
14. 不显示紫微斗数原始术语。

下一步进入：

```text
P8-I2：Formal World Canvas
```

## 24. P8-I2 Formal World Canvas 记录

P8-I2 已增强 FormalWorldView 的 Formal World Canvas。

本阶段新增：

1. FormalWorldVisualItem。
2. FormalWorldVisualKind。
3. 从 VisualState.placements 派生干净程序化世界对象。
4. 地面 / 道路 / 建筑 / 树木 / 设施 / 小物 / 角色占位样式。
5. Formal Canvas 尺寸从 VisualState.mapSize 派生。

本阶段规则：

1. FormalWorldView 仍然只读取 RenderableWorldSnapshot / VisualState。
2. 不接入 /world 页面。
3. 不替换 ProceduralRendererView。
4. 不显示 Debug Diagnostics。
5. 不显示 raw tags。
6. 不显示 assetId。
7. 不显示 source labels。
8. 不显示 collision / support / influence debug boxes。
9. 不显示 F / C / S / I。
10. 不读取 PNG。
11. 不读取 WORLD_MAP_ASSETS。
12. 不生成 actor。
13. 不生成 placement。
14. 不修改 HomeMapState。
15. 不默认显示 pet。
16. 不显示紫微斗数原始术语。

下一步进入：

```text
P8-I3：Formal Actor Presentation
```

## 25. P8-I3 Formal Actor Presentation 记录

P8-I3 已增强 FormalWorldView 的 Formal Actor Presentation。

本阶段新增：

1. FormalActorVisualItem。
2. 从 VisualState.actorGeometryProjections 派生 butler actor visual。
3. butler aura。
4. butler head。
5. butler body。
6. butler glow。
7. Formal canvas 内显示 butler actor projection 的正式几何占位样式。

本阶段规则：

1. FormalWorldView 仍然只读取 RenderableWorldSnapshot / VisualState。
2. actor visual 只从 VisualState.actorGeometryProjections 派生。
3. 只显示 butler。
4. 不默认显示 pet。
5. canProject === false 不显示。
6. geometryProjection 不存在不显示。
7. 不接入 /world 页面。
8. 不替换 ProceduralRendererView。
9. 不显示 raw tags。
10. 不显示 source / geometrySource / anchorSource。
11. 不显示 Actor Geometry Diagnostics。
12. 不读取 PNG。
13. 不读取 WORLD_MAP_ASSETS。
14. 不生成 actor。
15. 不生成 placement。
16. 不填默认 anchor。
17. 不修改 HomeMapState。
18. 不显示紫微斗数原始术语。

下一步进入：

```text
P8-I4：Formal World HUD 最小版
```
