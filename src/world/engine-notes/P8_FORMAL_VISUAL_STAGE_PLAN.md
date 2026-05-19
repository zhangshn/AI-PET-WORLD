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
