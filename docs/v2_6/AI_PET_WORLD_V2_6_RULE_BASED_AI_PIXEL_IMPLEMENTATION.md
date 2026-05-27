# AI-PET-WORLD V2.6｜无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案

## 0. 文档定位

本文档定义 AI-PET-WORLD V2.6 当前阶段的规则型 AI 自主世界与像素表现落地口径。

当前阶段不是训练一个大模型来学会生成世界，而是先建立可解释、可复现、可审计、可长期演化的规则型 AI 世界。

核心结论：

```txt
规则生成世界
痕迹沉淀历史
记忆影响判断
WorldViewModel 转译事实
PixelWorldView 表现世界
```

## 1. 当前阶段为什么不走大数据训练路线

当前没有足够的用户世界样本、长期 Tick 记录、行为结果、世界演化结果和用户反馈数据。直接训练模型会得到不可解释、不可控、不可验证的输出。

当前路线：

```txt
显式规则
+ 权重参数
+ 稳定随机种子
+ 长期运行日志
+ 痕迹统计
+ 用户反馈
= 可演化规则系统
```

## 2. 先有世界事实，不是先有画面

真实事实包括：

- HomeMapState
- SpaceGrid
- TraceField
- ButlerState
- WorldRuntimeSaveRecord
- Resources
- Events
- MemorySeed
- Timeline phase

正确路线：

```txt
世界事实存在
→ 规则判断这些事实如何表现
→ 生成 WorldViewModel
→ PixelWorldView 绘制
```

表现层不能生成新的世界事实，不能推进 Tick，不能写 runtime save，不能默认生成宠物。

## 3. Pixel Scene Composer 的定位

Pixel Scene Composer 是像素世界组合规则实验室。

它用于验证：

- 地面 tile
- 生态过渡
- 草簇
- 树、灌木、石头、花
- 蘑菇、小生态信号
- 痕迹视觉
- 图层关系

正式开发不能把 debug 页面、滑条、参数面板、SVG data-uri 原样搬进 `/world`。正确方式是把验证过的规则沉淀为正式 mapper 和 renderer。

## 4. 双链路架构：自主世界链与像素表现链

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
HomeMapState + SpaceGrid + TraceField + ButlerState
→ WorldViewModel
→ Tile Layer
→ Trace Layer
→ Object Layer
→ Sprite Layer
→ Atmosphere Layer
```

## 5. 无大数据阶段靠什么运行

当前阶段依靠六类资产：

- 世界种子
- 规则表
- 权重模型
- 痕迹系统
- 运行日志
- Smoke / 审计

## 6. WorldViewModel 的正式职责

WorldViewModel 是世界事实到像素表现之间的正式中间层。它不是 debug summary，也不是 UI 卡片模型。

最小字段：

- worldId
- tick
- canvas
- tiles
- objects
- traces
- actors
- atmosphere
- butlerExplanation
- pPhone

Mapper 分工：

- SpaceGrid → tiles
- TraceField → traces
- HomeMapState placements → objects
- ButlerState / decision → actors
- Resources / ecology / timeline → atmosphere

## 7. PixelWorldView 的正式职责

PixelWorldView 只负责读取 WorldViewModel 并绘制像素世界。

它不能：

- 读取 runtime save
- 调用 mapper
- 生成事实
- 推进 tick
- 写入 HomeMapState
- 默认生成宠物

图层顺序：

```txt
Tile Layer
Trace Layer
Object Layer
Sprite Layer
Atmosphere Layer
UI Overlay
```

## 8. 规则示例

Tile 规则：

- boundary → boundary
- built → built
- movement / spatial_use trace → pressed_grass / worn_grass / exposed_soil
- ecology trace → ecology_transition / recovery_growth
- otherwise → grass

Trace 规则：

- movement → pressed_grass / worn_grass
- spatial_use → waiting_spot / comfort_spot
- ecology → moss / mushroom / recovery_growth
- maintenance → maintained_area / repaired_ground
- attention → attention_glow

Butler 规则：

- 资源不足禁止建设 diff
- 地面健康低提升 maintain_home
- memory seed 影响动机但不能直接写事实

## 9. 当前开发下一步：WORLD-PIXEL-RULE-MAPPER-00

下一步是把 Pixel Scene Composer 验证过的视觉组合规则正式沉淀成 WorldViewModel mapper。

目标：

- SpaceGrid → tiles
- TraceField → traces
- HomeMapState placements → objects
- ButlerState / decision → actor sprite
- resources / ecology → atmosphere

PixelWorldView 只负责画：

- model.tiles
- model.traces
- model.objects
- model.actors
- model.atmosphere

## 10. 验收标准

必须证明：

- `/world` 只读
- PixelWorldView 是正式主世界
- WorldViewModel 不直接依赖 Debug composer
- PixelWorldView 使用 Canvas 或未来 PixiJS
- 不生成默认宠物
- 不写 runtime
- 不推进 tick

## 11. 长期演进：从规则系统到自学习系统

第一阶段：规则系统跑起来。  
第二阶段：日志和痕迹沉淀小样本。  
第三阶段：AI 辅助规则优化。  
第四阶段：人工审核 + 自动评估 + 安全发布。  
第五阶段：更强的个体化世界演化。

## 12. 给 Codex 的一句话执行口径

不要围绕页面壳、SVG、CSS 几何图或卡片调 UI。本阶段目标是把 Pixel Scene Composer 验证过的像素组合规则沉淀成正式 WorldViewModel mapper，让 PixelWorldView 只读模型并表现世界。

