# AI-PET-WORLD P8.0 正式视觉阶段规划

## 1. P8.0 的定位

P8.0 是正式视觉阶段的开篇规划文档。

当前 P7 已经完成：

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

P8 不再继续扩张底层世界闭环，而是开始把已经存在的世界事实稳定显示出来。

P8.0 只做规划，不写视觉代码，不替换 Renderer，不修改 `/world`。

## 2. 当前视觉状态

当前 `/world` 已经不是纯数据阶段。

当前已具备：

1. HomeMapState。
2. RenderableWorldSnapshot。
3. VisualState。
4. DrawCommand。
5. ProceduralRendererView。
6. 基础线框预览。
7. 初始世界数据可视化。
8. Tick 后 MapDiff 可以改变 HomeMapState。

但当前仍然不是正式画面阶段。

当前显示更接近：

```text
世界数据 X 光片
```

还不是：

```text
正式像素地图
草地 / 道路 / 房子 / 树 / 孵化器 / 管家 / 宠物
```

## 3. P8 的核心目标

P8 的目标不是让 Renderer 生成世界，而是让 Renderer 忠实显示世界已经存在的事实。

核心目标：

1. 将 RenderableWorldSnapshot 中的 DrawCommand 稳定显示为正式视觉。
2. 将 HomeMapState 中的 placement 转换为可见贴图。
3. 验证 P7.23 的 world change 在画面上可见。
4. 保持 Renderer 只读，不写世界。
5. 保持视觉增强不反向创造 placement。
6. 为管家 / 宠物像素占位和后续动画打基础。

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

正式视觉层只能读取：

1. RenderableWorldSnapshot。
2. VisualState。
3. DrawCommand。
4. HomeMapState 中已经存在的 placement 派生结果。
5. 已注册的 WorldMapAsset。

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

## 6. P8 分阶段路线

### P8.0：正式视觉阶段规划

只写规划文档，明确 P8 视觉边界。

### P8.1：World visual asset usage strategy

明确 assetId、asset category、MapPlacementLayer、DrawCommand 之间如何对应。

### P8.2：正式 ProceduralRenderer 第一版

实现正式 Renderer v1。

要求：

1. 读取 RenderableWorldSnapshot。
2. 显示已注册 asset 图片。
3. 按 layer 排序。
4. 不做动画。
5. 不做复杂交互。
6. 不修改世界状态。

### P8.3：路径 / 自然物 / 设施可视变化验证

验证 P7.23 的变化能被看见：

1. plant_nature：新增自然细节。
2. build_path：新增路径。
3. clean_area：清理 surface-decoration。
4. repair_facility：设施状态变化。

### P8.4：管家与宠物像素占位显示

先显示占位角色，不接复杂行为动画。

### P8.5：视觉状态与世界状态收口

确认正式 Renderer 没有反向生成世界事实。

## 7. P8.1 前置检查

进入 P8.1 前需要确认：

1. WorldMapAssetRegistry 已有基础 asset。
2. MapPlacement.layer 与 asset category 对齐。
3. DrawCommand 已能表达基础视觉元素。
4. ProceduralRendererView 当前线框只用于 debug / 过渡。
5. 正式 Renderer 不能读取 proposal。
6. P7.23 的 proposal debug 页可用于验证 MapDiff 链路。
7. `/world` 仍然只读取 RuntimeWorldState.currentRenderableSnapshot。

## 8. P8.2 正式 Renderer 第一版范围

正式 Renderer v1 只做最小可见版本：

1. 地图容器。
2. 网格可保留为 debug overlay。
3. ground / path / zone / structure / facility / nature / surface-decoration / actor 分层显示。
4. 根据 assetId 加载已注册图片。
5. 根据 placement 的 x / y / scale / alpha 显示对象。
6. 不做拖拽。
7. 不做点击编辑。
8. 不做动画。
9. 不做相机系统。
10. 不做美术重制。

这一步的目标是：

```text
先让世界像世界
```

不是立刻做到最终美术。

## 9. P8.3 可视变化验收标准

P8.3 的验收标准：

1. 手动 Tick 后，MapDiff History 增加。
2. plant_nature 生成的新自然细节能在画面上看到。
3. build_path 生成的新路径能在画面上看到。
4. clean_area 删除的 surface-decoration 能在画面上消失。
5. repair_facility 更新的 facility 至少能通过 label / alpha / tags 状态确认。
6. 所有变化仍然来自 SafeApply 之后的 HomeMapState。
7. Renderer 不读取 proposal。

## 10. 管家与宠物视觉原则

管家和宠物视觉进入 P8.4。

原则：

1. 管家是管理者，不是玩家手动操控角色。
2. 宠物是独立生命，不是按钮驱动对象。
3. 角色显示来自世界状态，不来自 UI 临时状态。
4. 宠物不能通过事件文本说人话。
5. 管家 / 宠物动画后续必须由 runtime state / behavior state 派生。
6. 初期只允许占位显示，不接复杂动画树。

## 11. 禁止事项

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
10. 在 P8.0 直接写正式视觉代码。

## 12. 当前结论

P8.0 只锁定正式视觉阶段边界。

当前不写代码。
当前不修改 `/world`。
当前不替换 Renderer。
当前不新增图片。
当前不新增 CSS。

下一步进入 P8.1：World visual asset usage strategy。
