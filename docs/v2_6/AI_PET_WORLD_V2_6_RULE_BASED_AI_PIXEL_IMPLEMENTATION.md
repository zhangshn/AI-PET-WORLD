# AI-PET-WORLD V2.6｜无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案

## 0. 文档定位

本文档定义 AI-PET-WORLD V2.6 当前阶段的规则型 AI 自主世界与像素表现落地口径。

当前阶段不训练大模型，不把 LLM 当作世界事实生成器，不让 UI 反向制造世界。当前目标是用规则资产库、参数模型、世界事实、痕迹反馈和小样本运行日志，把自主世界先稳定跑起来，并把正式 `/world` 收敛到 PixelWorldView。

下一阶段模块名称必须是：

```txt
WORLD-PIXEL-RULE-MAPPER-00
```

不再使用旧的 ViewModel 像素映射模块名作为下一阶段口径。

## 1. 当前阶段为什么不走大数据训练路线

当前项目的关键风险不是模型规模不够，而是世界事实、规则边界、读写边界和表现链路还需要继续稳定。

因此当前阶段不训练大模型，原因是：

- 世界事实 schema 仍在演进。
- 痕迹、空间、生态、管家 motivation 的规则资产仍需沉淀。
- 训练数据规模不足，不适合直接进入大数据训练。
- 先训练模型会放大错误业务口径。
- 当前更需要可审计、可回放、可解释的规则系统。

当前 AI 能力主要体现为规则型自主系统，而不是大模型生成世界事实。

## 2. 先有世界事实，不是先有画面

正式表现链必须遵守：

```txt
HomeMapState + SpaceGrid + TraceField + ButlerState
→ WorldViewModel
→ PixelWorldView
```

画面只能读取 WorldViewModel。PixelWorldView 不读取 runtime save，不推进 Tick，不写 HomeMapState，不生成 TraceField，不生成宠物，不生成 placement。

先有世界事实，再有空间结构、痕迹、对象、管家状态和像素表现。不能先画出一个看起来丰富的画面，再把画面反推成世界事实。

## 3. Pixel Scene Composer 的定位

Pixel Scene Composer 是 `/world-debug` 的规则实验室。它可以验证：

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

但它不是正式 `/world`。不能把 Pixel Scene Composer 的页面、滑条、参数面板、summary、debug 卡片或 SVG 输出原样搬进正式 `/world`。

正确做法是把验证过的规则沉淀为正式 mapper / renderer：

```txt
Pixel Scene Composer 规则验证
→ WorldViewModel mapper
→ PixelWorldView canvas renderer
```

## 4. 双链路架构：自主世界链与像素表现链

自主世界链负责事实：

```txt
WorldRuntimeSaveRecord
→ HomeMapState
→ Runtime Tick
→ MapDiff / Audit / SafeApply
→ TraceField / TraceInfluenceSummary / TraceMemorySeedField
```

像素表现链负责读取：

```txt
HomeMapState + SpaceGrid + TraceField + ButlerState
→ WorldViewModel
→ PixelWorldView
→ Tile / Trace / Object / Sprite / Atmosphere
```

两条链路不能混淆。表现链不能写事实，自主世界链不能依赖 UI 才能推进。

## 5. 无大数据阶段靠什么运行

当前阶段依靠：

- 规则资产库：空间、生态、痕迹、管家、像素表现规则。
- 参数模型：movementCost、familiarity、traceStrength、careReadiness、spacePressure 等。
- 世界事实：HomeMapState、WorldRuntimeSaveRecord、placements、resources、zones。
- 痕迹反馈：TraceField、Trace effects、TraceVisualProjection、TraceMemorySeedField。
- 小样本运行日志：用于观察规则是否稳定，不用于当前阶段训练大模型。

规则输出必须可解释、可审计、可回放。

## 6. WorldViewModel 的正式职责

WorldViewModel 是正式像素表现的数据合同。它负责把世界事实和规则派生结果整理为 PixelWorldView 可读结构。

WorldViewModel 应包含：

- tiles：来自 SpaceGrid 和 trace influence。
- traces：来自 TraceField / TraceVisualProjection。
- objects：来自 HomeMapState placements。
- actors：来自管家事实或安全 fallback；宠物必须来自已有事实。
- atmosphere：来自世界状态派生。
- pPhone：玩家可读的轻量关系入口。
- butlerExplanation：管家状态解释。

WorldViewModel 不写 runtime，不推进 tick，不生成世界事实，不默认生成宠物。

## 7. PixelWorldView 的正式职责

PixelWorldView 只负责画：

- `model.tiles`
- `model.traces`
- `model.objects`
- `model.actors`
- `model.atmosphere`

PixelWorldView 不读取 runtime save，不读取 raw TraceFact，不调用 runAndPersistOneRuntimeTick，不调用 buildSceneSvg，不显示 Debug JSON。

PixelWorldView 可以使用 Canvas 绘制像素层。CSS 只负责外壳布局、尺寸和页面排版，不能承担“画世界对象”的职责。

## 8. 规则示例

Tile 规则示例：

- boundary region → boundary tile。
- built terrain → built tile。
- soil terrain → soil tile。
- movement / spatial_use trace 强度高 → worn_grass 或 exposed_soil。
- traceStrength 中等 → pressed_grass。
- ecology_change trace → ecology_transition 或 recovery_growth。

Object 规则示例：

- tree / 树 placement → tree object。
- bush / 灌木 placement → bush object。
- stone / 石头 placement → stone object。
- flower / 花 placement → flower object。
- mushroom / 蘑菇 placement → mushroom object。
- facility / incubator 历史对象只能作为已有 placement 读取，不能恢复旧孵化路线。

Sprite 规则示例：

- 管家可以用已有 actor placement 或安全 zone center fallback 显示。
- 宠物只有在 HomeMapState 已有明确 pet actor placement 时显示。
- 不允许默认 pet。

Trace 规则示例：

- visualKind=flattened_grass → 地面压低痕迹。
- visualKind=exposed_soil → 裸土痕迹。
- visualKind=worn_ground → 磨损地面。
- visualKind=waiting_spot → 等待位置。
- visualKind=attention_glow → 关注点。

## 9. 当前开发下一步：WORLD-PIXEL-RULE-MAPPER-00

下一阶段必须进入：

```txt
WORLD-PIXEL-RULE-MAPPER-00
```

目标是把 Pixel Scene Composer 验证过的组合规则继续沉淀到正式 WorldViewModel mapper 和 PixelWorldView renderer。

该阶段不是：

- 训练大模型。
- 把 Debug 页面搬进 `/world`。
- 恢复 SVG / CSS 几何主视觉。
- 恢复 FormalWorldView / ProceduralRendererView 作为正式主视觉。
- 新增宠物事实。
- 新增 road/path/movement channel 母架构。

## 10. 验收标准

验收标准：

- `/world` 使用 `readWorldRuntimeForView`。
- `/world` 使用 `buildWorldViewModelForPixelWorld`。
- `/world` 渲染 `PixelWorldView`。
- PixelWorldView 使用 Canvas 绘制像素世界。
- PixelWorldView 不使用 SVG、data:image/svg+xml、next/image 承载 SVG。
- WorldViewModel 输出 tiles、traces、objects、actors、atmosphere。
- tiles 来自 SpaceGrid / HomeMapState 事实。
- objects 来自 HomeMapState placements。
- traces 来自 TraceField / TraceVisualProjection。
- actors 至少包含管家；宠物不默认出现。
- 读取 `/world` 不改变 runtime save tick 或 hash。
- 不新增独立移动通道或旧 road/path 图结构。
- 不接 LLM。

## 11. 长期演进：从规则系统到自学习系统

长期演进方向是从规则系统走向自学习系统，但顺序必须谨慎：

```txt
规则资产库
→ 稳定运行日志
→ 小样本评估
→ 可解释参数更新
→ 记忆消费
→ 世界学习
→ 未来可选训练阶段
```

大数据训练不是当前阶段方案。未来即使引入训练，也不能绕过世界事实、runtime、SafeApply 和审计链路。

## 12. 给 Codex 的一句话执行口径

当前阶段不要训练模型，不要让 UI 造事实，不要把 Debug composer 搬进 `/world`；请把 Pixel Scene Composer 验证过的规则沉淀为 `WORLD-PIXEL-RULE-MAPPER-00` 的正式 WorldViewModel mapper 与 PixelWorldView Canvas renderer。
