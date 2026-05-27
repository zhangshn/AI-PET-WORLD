# AI-PET-WORLD V2.6｜正式像素主世界绘制算法

> 本文保留此前已写入的“画图算法”，并严格对齐《完整业务架构总图（强化版）》与《无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案》。

## 0. 文档定位

这不是世界生成算法，也不是 Debug 页面说明。

本文定义 AI-PET-WORLD 正式 `/world` 如何把世界事实转译成像素主世界画面。它只描述“世界事实如何被看见”，不描述“世界事实如何被写入”。

```txt
世界事实存在
→ WorldViewModel 转译事实
→ PixelWorldView 绘制世界
```

## 1. 正式绘制链路

正式像素主世界链路：

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

边界：

- PixelWorldView 不读取 runtime save。
- PixelWorldView 不推进 Tick。
- PixelWorldView 不写 HomeMapState。
- PixelWorldView 不生成宠物。
- PixelWorldView 不直接调用世界规则或 SafeApply。
- PixelWorldView 只读取 WorldViewModel。

## 2. Pixel Scene Composer 的定位

Pixel Scene Composer 是 `/world-debug` 的像素世界组合规则实验室。

它已经验证：

- 地面 tile
- 生态过渡
- 草簇
- 树
- 灌木
- 石头
- 花
- 蘑菇
- 小生态信号
- 痕迹融合
- 角色占位
- 图层关系

这些验证结果要沉淀为正式 mapper 和绘制规则。不能把 Pixel Scene Composer 的 Debug 页面、滑条、参数面板、SVG data-uri 原样搬进 `/world`。

## 3. WorldViewModel Mapper 分工

WorldViewModel 是世界事实到像素表现之间的正式中间层。

```txt
SpaceGrid → buildWorldViewTilesFromSpaceGrid → tiles
TraceField → mapTraceFieldToWorldViewTraces → traces
HomeMapState placements → buildWorldViewObjectsFromHomeMapState → objects
ButlerState / decision → buildWorldViewActors → actors
Resources / ecology / trace influence → buildWorldViewAtmosphere → atmosphere
```

### 3.1 tiles

tiles 来自 SpaceGrid、地貌、湿度、生态健康、空间压力、可通行性、移动成本和 TraceField 的只读投影。

tiles 不直接来自 Debug composer。

### 3.2 traces

traces 来自 TraceField、TraceLifecycle、TraceInfluence 和 TraceVisualProjection。

TraceField 是世界长期记忆事实，不是装饰层。

### 3.3 objects

objects 来自：

- HomeMapState placements
- 自然对象事实
- 建筑事实
- 生态对象规则生成的 derived visual only

derived visual only 不是正式世界事实。

### 3.4 actors

actors 来自 ButlerState、lastButlerRuntimeDecision、生命状态、正式 placement 或 fallback zone。

宠物不默认生成。宠物未来必须来自正式宠物事实。

### 3.5 atmosphere

atmosphere 来自资源、生态、时间线、世界阶段、湿度、地面健康和长期痕迹。

它不是简单滤镜，而是世界状态表现。

## 4. PixelWorldView 图层顺序

```txt
1. Tile Layer
2. Trace Layer
3. Object Layer
4. Sprite Layer
5. Atmosphere Layer
6. UI Overlay
```

### 4.1 Tile Layer

Tile Layer 绘制地面状态。

允许的 tile 表现包括：

- boundary
- built
- grass
- pressed_grass
- worn_grass
- exposed_soil
- ecology_transition
- recovery_growth

规则：

```txt
boundary → boundary
built → built
movement / spatial_use trace → pressed_grass / worn_grass / exposed_soil
ecology trace → ecology_transition / recovery_growth
otherwise → grass
```

pressed / worn / exposed 不是道路。它们来自 TraceField 和 SpaceGrid 的只读表现。

### 4.2 Trace Layer

Trace Layer 绘制痕迹表现。

```txt
movement trace → pressed_grass / worn_grass
spatial_use trace → waiting_spot / comfort_spot
ecology trace → moss / recovery_growth / mushroom signal
maintenance trace → maintained_area / repaired_ground
attention trace → attention_glow
```

Trace Layer 不能自己生成世界事件。它只是表现 TraceField。

### 4.3 Object Layer

Object Layer 绘制世界对象和生态对象。

对象包括：

- tree
- bush
- stone
- flower
- mushroom
- insect_signal
- structure / facility future

对象来源：

```txt
HomeMapState placements
+ ecology object rules
+ derived visual only
```

对象不能随机乱撒。必须受空间占用、生态规则、痕迹强度、湿度、健康、空间压力影响。

### 4.4 Sprite Layer

Sprite Layer 当前允许显示 butler。

规则：

- butler 来自 ButlerState / runtime decision / placement / zone / passable fallback。
- pet 不默认生成。
- pet 未来必须来自正式宠物事实。
- butler 位置不能来自 debug actor placeholder。

### 4.5 Atmosphere Layer

Atmosphere Layer 表现：

- 时间线阶段
- 世界阶段
- 生态健康
- 湿度
- 光照
- 季节感
- 长期状态

### 4.6 UI Overlay

UI Overlay 只允许保留：

- P-Phone 入口
- 管家一句话
- 必要轻状态

禁止用 Hero、状态卡、资源表、审计信息替代主世界。

## 5. 坐标与画图关系

坐标只负责：

- 对象在哪里
- 事件在哪里
- 痕迹在哪里
- 谁遮挡谁
- 是否重叠
- 是否可通行

坐标不负责：

- 为什么这里有树
- 为什么草变低
- 为什么区域变荒
- 为什么管家经过这里

结论：

```txt
没有坐标，世界无法稳定落位。
只有坐标，世界不会自己长出来。
```

完整像素图来自世界事实、世界规则、空间布局、生态分布、对象生成、痕迹沉淀、视觉表现和图层合成。

## 6. 与自主世界链路的隔离

自主世界链：

```txt
Butler motivation
→ Butler intent
→ World rule validation
→ SafeApply
→ Event / Trace / Resource / HomeMapState diff
→ MemorySeed
→ 下一轮 Tick
```

像素表现链：

```txt
HomeMapState
+ SpaceGrid
+ TraceField
+ ButlerState
→ WorldViewModel
→ PixelWorldView
```

表现链不能写事实。自主世界链不能直接画图。

## 7. 禁止事项

- 禁止正式 `/world` 使用 SVG 作为主视觉。
- 禁止使用 CSS 几何图层画世界对象、地块、痕迹或角色。
- 禁止把 `/world-debug/pixel-scene-composer` 原样搬到 `/world`。
- 禁止把 `buildSceneSvg` 或 `data:image/svg+xml` 作为正式主画面输出。
- 禁止正式 `/world` 使用 `WorldPainterReadonlyPreview`。
- 禁止正式 `/world` 使用 `FormalWorldView`。
- 禁止正式 `/world` 使用 `ProceduralRendererView`。
- 禁止正式 `/world` 直接依赖 `scene-composer-gateway`。
- 禁止新增宠物事实。
- 禁止独立移动通道、roadGraph、pathGraph。
- 禁止用 Hero、状态卡、资源表和审计面板替代主世界。
- 禁止在未建立 WorldViewModel → PixelWorldView 前宣称正式像素主世界完成。

## 8. 下一步落地模块

下一步模块：

```txt
WORLD-PIXEL-RULE-MAPPER-00
```

目标：

- 清理 WorldViewModel 对 scene-composer / procedural-painter 的直接依赖。
- 建立正式 tile mapper。
- 建立正式 trace mapper。
- 建立正式 object mapper。
- 建立正式 actor mapper。
- 建立正式 atmosphere mapper。
- 让 PixelWorldView 只读 WorldViewModel 绘制。
- 保证 `/world` 不再回到 SVG、Debug composer 或卡片仪表盘。
