# AI-PET-WORLD P8.1 World visual asset usage strategy

## 1. P8.1 的定位

P8.1 是正式视觉阶段的素材使用策略文档。

P8.0 已经锁定：

```text
P7 负责世界事实如何生成
P8 负责世界事实如何显示
```

P8.1 的目标是明确：

1. WorldMapAssetRegistry 中的 asset 如何被正式 Renderer 使用。
2. WorldMapAssetCategory 与 MapPlacementLayer 如何对应。
3. HomeMapState.placements 如何进入正式视觉。
4. DrawCommand / VisualState / RenderableWorldSnapshot 与贴图显示的边界。
5. P8.2 正式 ProceduralRenderer 第一版应该读取什么、不读取什么。

P8.1 只写策略，不写代码，不修改 Renderer，不新增图片，不新增 CSS。

## 2. 当前已有素材协议

当前世界素材由 WorldMapAssetRegistry 管理。

已存在的 asset category 包括：

```text
ground
path
edge
zone
structure
facility
nature
surface_decoration
actor
```

这些 category 是素材注册表层的分类。

当前 HomeMapState 中的 MapPlacementLayer 包括：

```text
ground
path
edge
zone
structure
facility
nature
surface-decoration
actor
atmosphere
```

注意：

```text
asset category: surface_decoration
placement layer: surface-decoration
```

这两个名字不完全一样，正式 Renderer 必须通过明确映射处理，不能靠字符串直接相等判断。

## 3. category 与 layer 映射规则

正式 Renderer 使用素材时必须遵守：

| WorldMapAssetCategory | MapPlacementLayer | 说明 |
| --- | --- | --- |
| ground | ground | 地面 tile。 |
| path | path | 道路 tile。 |
| edge | edge | 地形边缘。 |
| zone | zone | 区域痕迹或区域底纹。 |
| structure | structure | 建筑、住所、抵达点等。 |
| facility | facility | 食盆、水盆、床、灯、储物箱等。 |
| nature | nature | 树、灌木等自然物。 |
| surface_decoration | surface-decoration | 草丛、小石头、落叶、小花等表面装饰。 |
| actor | actor | 管家、宠物等角色。 |

`atmosphere` layer 当前没有对应的 WorldMapAssetCategory，P8.2 不作为正式贴图显示重点。

## 4. 正式 Renderer 的素材读取来源

正式 Renderer v1 只能从以下来源获取视觉信息：

1. RenderableWorldSnapshot。
2. VisualState。
3. VisualPlacement。
4. HomeMapState 中已经存在的 placement 派生结果。
5. WorldMapAssetRegistry 中已经注册的 asset path。

正式 Renderer 不能从以下来源获取正式世界对象：

1. WorldChangePlan。
2. WorldDiffProposal。
3. WorldEvolutionAuditReport。
4. WorldEvolutionExecutionResult。
5. SafeApplyDecision 的内部过程。
6. proposal debug 页面。
7. debug scenario result。
8. 未注册素材路径。
9. 临时硬编码图片路径。

## 5. placement 到贴图的显示规则

正式 Renderer v1 显示 placement 时应遵守：

1. 使用 placement.assetId 查询 WorldMapAssetRegistry。
2. assetId 未注册时，不渲染贴图，可显示 debug fallback。
3. 使用 placement.layer 决定层级排序。
4. 使用 placement.x / placement.y 决定世界坐标。
5. 使用 placement.scale 决定缩放。
6. 使用 placement.alpha 决定透明度。
7. 使用 asset.anchor 决定图片锚点。
8. 使用 asset.baseSize 决定基础渲染尺寸。
9. 使用 placement.label 作为 debug label，不作为正式 UI 必显示内容。
10. 使用 placement.tags 做调试追踪，不作为生成世界事实的依据。

Renderer 不能根据 assetId 或 tags 自动创建不存在的 placement。

## 6. anchor 使用规则

当前 WorldMapAssetAnchor 包括：

```text
top-left
bottom-center
center
```

P8.2 使用规则：

1. `top-left`：适合 ground / path / edge 这类 tile。
2. `bottom-center`：适合 structure / facility / nature / actor。
3. `center`：适合中心点装饰或未来特效。

坐标原则：

1. placement.x / placement.y 是世界 tile 坐标。
2. tileSize 来自 HomeMapState.mapSize.tileSize。
3. 像素坐标由 tile 坐标乘以 tileSize 派生。
4. anchor 只影响图片绘制偏移，不改变世界事实坐标。

## 7. layer 排序策略

正式 Renderer v1 的推荐绘制顺序：

```text
ground
edge
zone
path
nature
structure
facility
surface-decoration
actor
atmosphere
label/debug overlay
```

说明：

1. ground 最底层。
2. path 应显示在 ground / zone 之上。
3. nature、structure、facility 是主要世界对象。
4. surface-decoration 是轻量装饰，不能遮挡核心 actor。
5. actor 在主要对象上方。
6. debug overlay 和 label 只在 debug 模式显示。

P8.2 第一版可以先实现固定排序，不需要复杂 z-index 系统。

## 8. DrawCommand 与贴图显示的关系

当前 DrawCommand 主要服务线框和 debug 可视化。

正式贴图显示可以读取 VisualState.placements，而不是把每个 DrawCommand 都转换成图片。

P8.2 的基本分工：

```text
VisualState.terrainCells / zones / placements -> 正式视觉元素
DrawCommand -> debug overlay / labels / 几何辅助线
```

正式 Renderer 不应该把 DrawCommand 当成新的世界事实。
DrawCommand 只是从 VisualState 派生出的绘制命令。

## 9. P7.23 可视变化与素材关系

P7.23 当前已支持 4 类 proposal 生成 MapDiff：

| plan type | MapDiff 行为 | 视觉表现 |
| --- | --- | --- |
| plant_nature | add surfaceFlowerPatch01 | 新增小花 / 自然细节。 |
| build_path | add pathDirtHorizontal01 | 新增泥土路径。 |
| clean_area | remove surface-decoration | 清理落叶 / 杂物消失。 |
| repair_facility | update facility | 设施 label / alpha / tags 更新。 |

P8.3 必须验证这些变化是否能在正式视觉中看见。

## 10. P8.2 正式 Renderer v1 的最小素材范围

P8.2 第一版只需要覆盖当前已有核心素材：

1. groundGrassBase01。
2. groundGrassBase02。
3. groundDirtBase01。
4. pathDirtHorizontal01。
5. pathDirtVertical01。
6. zoneInitialEmptyLandTrace01。
7. buildingTempShelter01。
8. buildingTempShelterCanvasTent01。
9. facilityFoodBowlFull01。
10. facilityWaterBowlFull01。
11. facilityPetBedNeat01。
12. facilityStorageBoxClosed01。
13. facilityLampOn01。
14. natureTreeSmall01。
15. natureBushRoundLow01。
16. surfaceGrassTuftLow01。
17. surfaceStoneSmall01。
18. surfaceFlowerPatch01。
19. surfaceFallenLeaf01。
20. butlerBodyStandard01。
21. petPartBodyRound01。
22. petPoseSkeletonIdleFront01。

P8.2 不要求补齐全部美术资源。
P8.2 只要求已注册资源能被稳定显示。

## 11. 缺失素材处理规则

正式 Renderer v1 遇到缺失素材时：

1. 不允许报错导致页面崩溃。
2. 不允许自动创建替代 placement。
3. 可以显示 debug fallback 方块。
4. 可以显示 assetId label。
5. 必须保留 world fact 不变。
6. 必须在 debug 信息中标记 missing asset。

缺失素材是视觉问题，不是世界事实问题。

## 12. P8.2 不做的事情

P8.2 不做：

1. 不做动画。
2. 不做拖拽。
3. 不做地图编辑器。
4. 不做相机系统。
5. 不做缩放交互。
6. 不做粒子特效。
7. 不做自动 Tick。
8. 不做自动保存。
9. 不做宠物行为动画。
10. 不做管家任务动画。

P8.2 的目标只有：

```text
让已存在的世界 placement 以贴图方式显示出来
```

## 13. 验收标准

P8.2 完成后，至少应满足：

1. `/world` 能显示正式贴图版本的世界对象。
2. Renderer 仍然只读取 RenderableWorldSnapshot / VisualState。
3. 已注册 assetId 能正确显示图片。
4. layer 排序稳定。
5. anchor 显示不严重错位。
6. 缺失 asset 不会导致页面崩溃。
7. debug overlay 可以保留但不能替代正式显示。
8. P7.23 的 build_path / plant_nature 变化能在视觉上看见。
9. clean_area 删除对象后，画面对象能消失。
10. repair_facility 更新后，至少能在 debug 信息中确认变化。

## 14. 禁止事项

P8.1 及后续视觉接入禁止：

1. Renderer 生成 placement。
2. Renderer 修改 HomeMapState。
3. Renderer 直接 apply MapDiff。
4. Renderer 读取 proposal 当作现实。
5. Renderer 为了视觉效果伪造世界对象。
6. 未注册 assetId 硬塞进画面。
7. layer 与 asset category 不匹配仍强行当正式贴图显示。
8. Debug scenario 进入正式 `/world`。
9. 正式 Renderer 深层依赖 world-evolution。
10. 正式 Renderer 深层依赖 personality-core。

## 15. 当前结论

P8.1 只锁定正式视觉素材使用策略。

当前不写代码。
当前不修改 Renderer。
当前不修改 `/world`。
当前不新增图片。
当前不新增 CSS。

下一步进入 P8.2：正式 ProceduralRenderer 第一版。
