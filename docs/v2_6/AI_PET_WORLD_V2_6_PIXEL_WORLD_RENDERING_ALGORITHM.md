# AI-PET-WORLD V2.6｜正式像素主世界绘制算法

## 1. 文档定位

这不是世界生成算法，而是世界事实到像素表现的只读转译算法。

## 2. 正式绘制链路

```txt
WorldRuntimeSaveRecord
+ HomeMapState
+ SpaceGrid
+ TraceField
+ ButlerState
→ WorldViewModel
→ PixelWorldView
→ Canvas / future PixiJS
```

PixelWorldView 不生成事实，不推进 Tick，不写 HomeMapState。

## 3. WorldViewModel Mapper 分工

- SpaceGrid → buildWorldViewTilesFromSpaceGrid → tiles
- TraceField → mapTraceFieldToWorldViewTraces → traces
- HomeMapState placements → buildWorldViewObjectsFromHomeMapState → objects
- ButlerState / decision → buildWorldViewActors → actors
- Resources / ecology / timeline → buildWorldViewAtmosphere → atmosphere

## 4. PixelWorldView 图层顺序

1. Tile Layer
2. Trace Layer
3. Object Layer
4. Sprite Layer
5. Atmosphere Layer
6. UI Overlay

## 5. Tile Layer 算法

Tile 类型：

- boundary
- built
- grass
- pressed_grass
- worn_grass
- exposed_soil
- ecology_transition
- recovery_growth

pressed / worn / exposed 不是道路。它们来自 TraceField 和 SpaceGrid 的只读表现。

## 6. Trace Layer 算法

- movement trace → pressed_grass / worn_grass
- spatial_use trace → waiting_spot / comfort_spot
- ecology trace → moss / recovery_growth / mushroom signal
- maintenance trace → maintained_area / repaired_ground
- attention trace → attention_glow

## 7. Object Layer 算法

对象包括：

- tree
- bush
- stone
- flower
- mushroom
- insect_signal
- future structure / facility

对象来源：

- HomeMapState placements
- ecology object rules
- derived visual only

Derived visual only 不等于世界事实。

## 8. Sprite Layer 算法

当前允许 butler。

pet 不默认生成，未来必须来自正式宠物事实。

Butler 位置来自 ButlerState / placement / zone / passable fallback，不来自 debug actor placeholder。

## 9. 禁止事项

- PixelWorldView 不读取 runtime save。
- PixelWorldView 不推进 Tick。
- PixelWorldView 不写 HomeMapState。
- PixelWorldView 不生成宠物。
- `/world` 不使用 buildSceneSvg。
- `/world` 不使用 WorldPainterReadonlyPreview。
- `/world` 不使用 Debug composer。
- `/world` 不使用 SVG / CSS 几何图层作为主视觉。
- scene-composer-gateway 不得作为正式 `/world` 直接依赖。

## 10. 下一步

下一步是 WORLD-PIXEL-RULE-MAPPER-00。

目标是清理 WorldViewModel 对 scene-composer / procedural-painter 的直接依赖，建立正式 mapper：

- tile mapper
- trace mapper
- object mapper
- actor mapper
- atmosphere mapper

