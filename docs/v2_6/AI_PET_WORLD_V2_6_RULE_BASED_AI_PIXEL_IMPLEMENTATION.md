# AI-PET-WORLD V2.6｜无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案

> 规则资产库 + 参数模型 + 世界事实 + 痕迹反馈 + 小样本运行日志

> v1.0｜面向当前 MVP / V2.6 架构收敛


## 0. 文档定位

本文件用于明确 AI-PET-WORLD 在没有大量训练数据阶段的正确实现路线。当前阶段不是训练一个大模型来“学会生成世界”，而是先建立可解释、可复现、可审计、可长期演化的规则型 AI 世界。

本文件直接服务后续开发：WorldViewModel、PixelWorldView、规则资产库、痕迹反馈、自主世界 Tick、运行日志和 smoke 审计。

```txt
核心结论：
规则生成世界
痕迹沉淀历史
记忆影响判断
WorldViewModel 转译事实
PixelWorldView 表现世界
```

## 1. 当前阶段为什么不走大数据训练路线

我们现在没有足够的用户世界样本、长期 Tick 记录、行为结果、世界演化结果和用户反馈数据。此时直接训练模型，会得到不可解释、不可控、不可验证的输出，不适合 AI-PET-WORLD 的核心产品原则。

AI-PET-WORLD 的世界必须持续运行、长期记忆、可审计、可复现。早期最重要的不是“模型聪明”，而是世界规则能稳定运行，所有变化有来源、有边界、有历史。

```txt
当前路线：
显式规则
+ 权重参数
+ 稳定随机种子
+ 长期运行日志
+ 痕迹统计
+ 用户反馈
= 可演化的规则系统
```

### 1.1 大数据训练路线的问题

如果在当前阶段直接训练“世界生成模型”，会遇到几个问题：第一，没有足够样本；第二，输出难以解释；第三，容易绕过世界规则；第四，无法保证同一个世界可复现；第五，无法用 smoke 验证“是否写事实、是否推进 tick、是否生成宠物、是否越过 SafeApply”。

所以当前不能幻想“给 AI 一堆世界截图，让它自己学会生成世界”。我们要先把世界规则写成可运行资产，让系统在长期运行中沉淀自己的小样本数据。

### 1.2 当前可行路线

当前可行路线是“规则资产库 + 参数模型 + 世界事实 + 痕迹反馈 + 小样本运行日志”。这相当于先训练一个规则系统，而不是训练神经网络。

规则系统的优势是：可解释、可复现、可审计、可渐进扩展。后续当世界运行日志足够多，再让 AI 辅助优化权重、推荐规则、发现异常，而不是一开始就让 AI 黑箱生成世界。

## 2. 先有世界事实，不是先有画面

AI-PET-WORLD 的正式画面不是先手画出来，再假装它是世界。正式画面必须是世界事实的表现结果。

```txt
真实世界事实包括：
HomeMapState
SpaceGrid
TraceField
ButlerState
WorldRuntimeSaveRecord
Resources
Events
MemorySeed
```

```txt
错误路线：
先画一张漂亮地图
再假装它是世界
```

```txt
正确路线：
世界事实存在
→ 规则判断这些事实该怎么表现
→ 生成 WorldViewModel
→ PixelWorldView 画出来
```

### 2.1 世界事实的职责

HomeMapState 保存家园对象、区域、资源、已有变化。SpaceGrid 保存坐标、格子、可通行性、移动成本、占用和痕迹影响。TraceField 保存行为、生态、建设、关系和时间留下的长期影响。ButlerState / lastButlerRuntimeDecision 保存管家的当前判断与姿态。WorldRuntimeSaveRecord 负责把这些事实绑定到某个世界、某个 tick 和某次保存中。

这些事实共同定义“世界现在是什么”。PixelWorldView 只能读取这些事实，不能自己决定世界发生了什么。

### 2.2 表现层的职责

表现层只负责把事实转译成用户能看见的世界。它可以选择颜色、像素形状、图层顺序、光照氛围，但不能生成新的世界事实，不能推进 Tick，不能写 runtime save，不能默认生成宠物。

## 3. Pixel Scene Composer 的定位

昨天完成的 Pixel Scene Composer 不是浪费，也不是正式 /world 本体。它是“像素世界组合规则实验室”。

它验证的是：地面 tile、生态过渡、草簇、树、灌木、石头、花、蘑菇、小生态信号、痕迹、角色占位、图层关系，能否被组合成一个像素世界画面。

正式开发不能把 debug 页面、滑条、参数面板、SVG data-uri 原样搬进 /world。正确方式是把它验证过的组合规则沉淀成正式 mapper 和 renderer。

### 3.1 Pixel Scene Composer 已验证的规则资产

```txt
已验证元素：
地面 tile
生态过渡
草簇
树
灌木
石头
花
蘑菇
小生态信号
痕迹融合
角色占位
图层关系
```

这些不是“画面素材堆叠”，而是规则资产。比如湿度、生态健康、空间压力、痕迹强度，会共同影响地面、植被、对象密度和痕迹表现。

### 3.2 不把实验室搬进正式世界

Pixel Scene Composer 继续保留在 /world-debug，它服务开发验证。正式 /world 必须读取 WorldViewModel，并由 PixelWorldView 绘制。

```txt
禁止：
/world 引用 buildSceneSvg
/world 输出 data:image/svg+xml
/world 引用 WorldPainterReadonlyPreview
/world 搬入 Pixel Scene Composer 滑条和 debug summary
/world 用 SVG / CSS 几何图层作为主世界
```

## 4. 双链路架构：自主世界链与像素表现链

AI-PET-WORLD 当前必须拆成两条链：自主世界链负责“世界如何自己变化”，像素表现链负责“世界如何被看见”。这两条链不能混在一起。

### 4.1 自主世界链

```txt
Butler motivation
→ Butler intent
→ World rule validation
→ SafeApply
→ Event / Trace / Resource / HomeMapState diff
→ MemorySeed
→ 下一轮 Tick
```

这是“世界自己活起来”的链路。管家的动机不能直接改世界，必须先变成意图，再经过世界规则验证，再通过 SafeApply 或已允许路径进入事件、痕迹、资源或 HomeMapState diff。

### 4.2 像素表现链

```txt
HomeMapState
+ SpaceGrid
+ TraceField
+ ButlerState
→ WorldViewModel
→ Tile Layer
→ Trace Layer
→ Object Layer
→ Sprite Layer
→ Atmosphere Layer
```

这是“世界被看见”的链路。它只读事实，不改变事实。PixelWorldView 不应该自己判断管家为何行动，也不应该生成新对象或宠物。

### 4.3 两条链的隔离红线

自主世界链可以产生事实变化，但必须经过规则验证。像素表现链可以改变画面表现，但不能写事实。

```txt
表现层不能写世界事实。
表现层不能推进 tick。
表现层不能默认生成宠物。
自主世界链不能直接画图。
Debug 页面不能替代正式 /world。
```

## 5. 无大数据阶段靠什么运行

当前阶段我们靠六类资产运行世界：世界种子、规则表、权重模型、痕迹系统、运行日志、Smoke / 审计。

### 5.1 世界种子

世界种子保证同一个世界可复现，不乱跳。自然对象、tile 变体、对象尺度、草簇密度都可以由稳定 hash 派生，而不是使用 Math.random。

```txt
worldSeed + tick + regionId + objectId
→ 稳定随机
```

### 5.2 规则表

规则表是当前阶段的“训练集替代品”。每类世界行为和表现都应该逐渐沉淀为规则表。

```txt
规则表示例：
biomeRules
tileRules
traceRules
objectRules
butlerIntentRules
ecologyRules
memoryRules
worldRuleValidationRules
```

### 5.3 权重模型

当前阶段不训练神经网络，而是使用可解释的权重公式。权重可以先手动设置，后续根据运行日志、用户反馈、世界结果慢慢校准。

```txt
score = personalityWeight
      + resourceWeight
      + traceWeight
      + memoryWeight
      + riskPenalty
```

### 5.4 痕迹系统

痕迹是世界的长期数据。它记录哪里被走过、哪里被照料、哪里荒废、哪里恢复、哪里被管家关注。痕迹不仅影响画面，还影响下一轮行为、移动成本、熟悉度和学习。

```txt
如果某区域被反复经过 5 次：
  traceStrength + 10
  grassVisual = pressed_grass
  movementCost - 1
  butlerFamiliarity + 1
```

### 5.5 运行日志

每次 runtime tick 都应该产生可审计的原因记录：为什么管家选择等待，为什么没有建设，为什么生成某个 trace，为什么某块地变成 pressed_grass。

这些运行日志就是未来小样本数据和规则优化依据。

### 5.6 Smoke / 审计

Smoke 的作用是卡住红线，不是单纯验证“能不能跑”。必须验证 /world 是否只读、是否写 save、是否推进 tick、是否默认生成宠物、是否绕过 SafeApply、是否把 debug painter 搬进正式页。

## 6. WorldViewModel 的正式职责

WorldViewModel 是世界事实到像素表现之间的正式中间层。它不是 debug summary，也不是 UI 卡片模型。它必须能完整表达 Tile、Trace、Object、Actor、Atmosphere。

```txt
WorldRuntimeSaveRecord
+ HomeMapState
+ SpaceGrid
+ TraceField
+ ButlerState
→ WorldViewModel
```

### 6.1 WorldViewModel 最小字段

```txt
worldId
tick
canvas
tiles[]
objects[]
traces[]
actors[]
atmosphere
butlerExplanation
pPhone
```

其中 tiles 来自空间与地貌，objects 来自世界对象事实，traces 来自 TraceField，actors 来自管家和未来已入场生命，atmosphere 来自资源、生态、时间线和世界阶段。

### 6.2 Mapper 分工

```txt
SpaceGrid → buildWorldViewTilesFromSpaceGrid → tiles
TraceField → mapTraceFieldToWorldViewTraces → traces
HomeMapState placements → buildWorldViewObjectsFromHomeMapState → objects
ButlerState / decision → buildWorldViewActors → actors
Resources / ecology / trace influence → buildWorldViewAtmosphere → atmosphere
```

## 7. PixelWorldView 的正式职责

PixelWorldView 只负责读取 WorldViewModel 并绘制像素世界。它不能读取 runtime save，不能调用 mapper，不能生成事实，不能推进 tick。

PixelWorldCanvas 可以使用 canvas 或未来 PixiJS。当前阶段 canvas 足够，但图层绘制必须继承 Pixel Scene Composer 验证过的组合规则，而不是退化为简单色块网格。

### 7.1 图层顺序

```txt
1. Tile Layer：地面 tile、地貌、湿度、生态健康、空间压力
2. Trace Layer：踩踏、裸土、草地压低、维护痕迹、恢复痕迹、等待点
3. Object Layer：树、草、石头、花、蘑菇、小生态、建筑、未来设施
4. Sprite Layer：管家主体；宠物未来入场后再显示
5. Atmosphere Layer：光照、天气、世界阶段、生态氛围
6. UI Overlay：P-Phone、管家一句话、必要状态
```

### 7.2 视觉质量要求

正式 PixelWorldView 不能只是稀疏网格和低配 fillRect。它应该继承 Pixel Scene Composer 验证过的整体感：地面有变化、生态有层次、对象有密度、痕迹能融合、管家能作为生命主体存在。

这不是要求截图完全一样，而是要求规则密度和世界整体感一致。

## 8. 规则示例

下面是当前阶段可以直接落成代码的规则示例。这些规则不需要大数据训练，只需要明确输入、输出、边界和审计。

### 8.1 Tile 规则

```txt
if cell.regionKind == boundary:
  tileKind = boundary
elif cell.terrainKind == built:
  tileKind = built
elif traceStrength >= 72 and traceSource in [movement, spatial_use]:
  tileKind = worn_grass or exposed_soil
elif traceStrength >= 44:
  tileKind = pressed_grass
elif ecologyTraceActive:
  tileKind = ecology_transition or recovery_growth
else:
  tileKind = grass
```

### 8.2 Trace 规则

```txt
movement trace → pressed_grass / worn_grass
spatial_use trace → waiting_spot / comfort_spot
ecology trace → moss / mushroom / recovery_growth
maintenance trace → maintained_area / repaired_ground
attention trace → attention_glow
```

### 8.3 Butler 规则

```txt
if materialReadiness < 10:
  forbid construction diff
  allow wait / observe / weak trace

if groundHealth < 40:
  increase maintain_home score
  increase repaired_ground / maintained_area proposal probability

if traceMemorySeedCount > 0:
  memory bias may affect motivation
  but cannot directly write world facts
```

## 9. 当前开发下一步：WORLD-PIXEL-RULE-MAPPER-00

下一步不是继续调页面，也不是继续讨论 SVG，而是把 Pixel Scene Composer 验证过的视觉组合规则正式沉淀成 WorldViewModel 的 mapper。

```txt
目标：
SpaceGrid → tiles
TraceField → trace visuals
HomeMapState placements → objects
ButlerState / decision → actor sprite
resources / ecology → atmosphere

PixelWorldView 只负责画：
model.tiles
model.traces
model.objects
model.actors
model.atmosphere
```

### 9.1 本模块必须完成

清理 WorldViewModel 对 scene-composer / procedural-painter 的直接依赖；建立正式 tile mapper、object mapper、trace mapper、actor mapper、atmosphere mapper；增强 PixelWorldCanvas 视觉规则；更新 smoke，禁止 /world 正式链路直接引用 buildSceneSvg、WorldPainterReadonlyPreview、FormalWorldView、scene-composer-gateway。

### 9.2 本模块禁止事项

```txt
不改 runtime tick 行为
不改 Trace lifecycle 核心
不改 Butler motivation 核心
不改 SafeApply
不做宠物入场
不接 LLM
不恢复 SVG
不恢复 CSS 几何图层
不把 /world-debug 页面搬进 /world
```

## 10. 验收标准

完成后必须能够证明：/world 只读，PixelWorldView 是正式主世界，WorldViewModel 不直接依赖 Debug composer，PixelWorldView 使用 canvas 或未来 PixiJS 绘制，画面继承 Pixel Scene Composer 的组合规则，不生成默认宠物，不写 runtime，不推进 tick。

### 10.1 必跑命令

```txt
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:runtime
npm run smoke:space
npm run smoke:trace
npm run smoke:trace-tick
npm run smoke:trace-influence
npm run smoke:butler-trace-motivation
npm run smoke:butler-memory-seed-consume
npm run smoke:butler-memory-bias-surface
npm run smoke:butler-natural-explanation
npm run smoke:world-surface-copy-cn
npm run smoke:world-pixel-primary
npm run smoke:world-pixel-viewmodel-primary
npm run smoke:trace-visual
npm run smoke:formal-trace-surface
```

### 10.2 Smoke 必须卡住的红线

```txt
/world 只读
不写 save
不推进 tick
不生成宠物
不绕过 SafeApply
不引用 buildSceneSvg
不引用 WorldPainterReadonlyPreview
不引用 FormalWorldView
不直接依赖 scene-composer-gateway
不把 Debug painter 搬进正式页
```

## 11. 长期演进：从规则系统到自学习系统

当前阶段不是训练大模型，但不是永远不学习。正确路线是先让规则系统运行，积累 tick 日志、痕迹统计、用户反馈、世界变化结果。未来可以让 AI 辅助分析这些小样本数据，推荐权重调整、发现异常规则、生成候选事件，但最终仍必须经过世界规则验证。

```txt
第一阶段：规则系统跑起来
第二阶段：日志和痕迹沉淀小样本
第三阶段：AI 辅助规则优化
第四阶段：人工审核 + 自动评估 + 安全发布
第五阶段：更强的个体化世界演化
```
