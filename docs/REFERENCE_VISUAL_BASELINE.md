# AI-PET-WORLD 参考视觉基准与下一轮训练闭环

更新：2026-07-06

本文只定义当前 AI Painter 自然家园训练收口基准。目标是尽快产出第一张可人工验收的完整自然家园游戏地图，不再继续扩散新模块。

## 1. 基准结论

当前以项目已有最高局部候选图作为视觉基准：

```txt
F:\ai-pet-world\.runtime\ai-painter\natural-home-v91-current-mvp-quality-ready-generation\inference\natural-home-crop-v7-04-pond-grass-clean__v28-remix-road-tree\generated.png
```

该图是 256x192 局部自然家园图块，不是完整游戏地图。它只能作为视觉质感、颜色、纹理密度、道路清晰度、自然物件层级的参考标准，不能直接进入 `/world`。

## 2. 基准图要保留的视觉特征

| 维度 | 标准 |
|---|---|
| 草地 | 草叶密度丰富，有深浅层次，不是平铺色块，不出现明显网格。 |
| 道路 | 土路连续、可读、边缘自然，不能被草、花、石头污染到不可辨认。 |
| 石头 | 石块边缘清楚，有阴影和体积感，不像噪声点。 |
| 花草 | 点缀自然，不能密集成脏块，也不能破坏道路和主体层级。 |
| 物件 | 木箱、支架、树桩等小物件要有像素级细节，但不能抢走地图主结构。 |
| 色彩 | 绿色为主，但必须有土路、石头、花、木件等色彩变化，不能整张图单调发糊。 |
| 视角 | 保持俯视游戏地图视角，不能变成插画、照片或横版场景。 |
| 风格 | 像素/手绘游戏地图质感，边缘清楚，整体干净。 |

## 3. 当前没有达标的原因

| 问题 | 说明 | 处理方式 |
|---|---|---|
| 局部好看但完整图不稳 | 256x192 局部图能接近目标，但 1024x768 完整地图需要多个材料槽一致。 | 不再把局部图当成果；只用它做材料槽质量参考。 |
| 材料槽有网格感 | 当前失败集中在 grass-main、water-east、natural-boundary-west、entry-to-home-2。 | 先重训或重推这 4 个失败槽。 |
| 合成后像拼贴 | 单槽质量过关不代表完整地图自然。 | 材料包通过后必须再跑 Runtime Compositor 和完整图审核。 |
| 道路层级不稳定 | 草地、花草、阴影可能污染道路。 | 道路材料优先级高于装饰，训练和审核都必须检查道路可读性。 |
| 机器分数不能代表人工审美 | 机器曾通过但人工认为不够正式。 | 最终必须项目所有者人工确认。 |

## 4. 新训练架构

```txt
参考视觉基准
-> 失败槽清单
-> 材料槽训练 / 推理
-> 材料质量审核
-> Approved Material Pack
-> Runtime Compositor
-> 完整地图机器审核
-> 项目所有者人工验收
-> /world
```

训练不再以“多出一张候选图”为目标，而是以“失败槽修复 + 完整地图合成通过”为目标。

## 5. 只做这 4 个优先槽

| 优先级 | 槽位 | 当前问题 | 达标标准 |
|---:|---|---|---|
| 1 | grass-main | 大面积草地容易出现网格和重复纹理。 | 连续草地，无 64px / 128px 拼块感，细节接近基准图。 |
| 2 | water-east | 水体边缘和水面纹理容易割裂。 | 水面干净，岸线可读，无硬切重复块。 |
| 3 | natural-boundary-west | 自然边界容易变成硬边或杂乱噪声。 | 边界自然过渡，树草石层级清楚。 |
| 4 | entry-to-home-2 | 入口道路和地面衔接不稳定。 | 入口清楚，道路连续，地面不脏不糊。 |

## 6. 最短执行链路

当前优先使用已有脚本，不重造训练系统：

```txt
npm run train:game-map-material-slot-v46-grass
npm run train:game-map-material-slot-v46-road
npm run assemble:game-map-material-slot-v46-model-root
npm run run:game-map-material-slot-inference:v46-local
npm run judge:game-map-material-quality
npm run build:game-map-approved-material-pack
npm run write:game-map-composite-runtime-frame
```

如需一次跑完整链路，使用：

```txt
npm run full:game-map-material-slot-v46-runtime-frame
```

## 7. 本轮闭合标准

| 闸门 | 必须满足 |
|---|---|
| 材料质量 | 28/28 通过，不允许 `material_grid_artifact_suspected`。 |
| 完整尺寸 | Runtime Compositor 输出 1024x768 完整地图。 |
| 来源 | 完整图来自本地模型材料和结构合成，不是程序直绘，不是局部图放大。 |
| 视觉 | 草地、道路、石头、花草、水岸、入口层级接近参考图。 |
| 游戏结构 | 入口、中心、主路、可走区、碰撞区和画面一致。 |
| 人工验收 | 项目所有者明确认为可以作为第一版自然家园正式地图。 |

## 8. 当前总进度

| 模块 | 状态 | 完成度 |
|---|---:|---:|
| 小模型局部视觉能力 | 已证明 | 95% |
| 参考视觉基准 | 已固定 | 100% |
| 失败槽定位 | 已完成 | 100% |
| 失败槽重训 / 重推 | 已完成一轮 | 100% |
| 材料质量 28/28 | 已完成一轮机器通过 | 100% |
| 完整 RuntimeFrame 合成 | 已完成一轮候选 | 100% |
| 人工最终验收 | 待确认 | 0% |

## 9. 2026-07-06 首轮执行结果

| 项目 | 结果 |
|---|---|
| 训练 | grass 和 road 均完成 96 epoch。 |
| 推理 | 38 个材料槽完成本地模型推理。 |
| 材料质量 | Material Quality 机器通过，无失败槽。 |
| 材料包 | Approved Material Pack 已生成候选。 |
| 合成图 | 已生成 1024x768 完整 RuntimeFrame 候选。 |
| 机器审核 | Formal VisualJudge 通过。 |
| 人工初看 | 未达到参考图质感，不能算正式闭合。 |

当前候选图：

```txt
F:\ai-pet-world\.runtime\game-map-runtime-compositor\world-d0znz8\0\game-map-composite-game-map-frame-home-map-structure-world-d0znz8-0-natural-home-0-composite-output.png
```

人工初看问题：

| 问题 | 说明 | 下一步 |
|---|---|---|
| 道路重复格感 | 主路大面积出现规则纹理，和参考图自然土路差距明显。 | 道路材料需要改成自然土路纹理，不允许规则砖格。 |
| 水岸硬切 | 水体与陆地交界像高反差硬切边界。 | 水岸和边界槽需要更柔和的过渡。 |
| 草地偏糊 | 草地通过机器网格检查，但整体不如参考图有草叶细节。 | 草地需要补清晰草叶和花草点缀样本。 |
| 物件贴片感 | 石头、草丛、花草和小物件局部像贴片。 | 对象视觉单元需要单独审核边缘、阴影和比例。 |

## 10. 自动复盘档案

最新训练运行档案已经从“只保存结果”升级为“保存结果 + 保存复盘”。

```txt
.runtime/ai-painter/training-run-archive/latest.json
.runtime/ai-painter/training-run-archive/<runId>/reports/visual-delta-review.json
```

当前复盘固定 4 个优先问题：

| 优先问题 | 说明 | 下一轮处理 |
|---|---|---|
| 道路自然度不足 | 道路仍有重复块和规则网格感。 | 提高土路曲线、草边侵入、破碎边缘和非均匀颗粒样本权重。 |
| 水岸过渡偏硬 | 水体、岸线和草地融合不够自然。 | 增加浅滩、石块、草簇遮挡和岸线局部一致性约束。 |
| 草地细节偏糊 | 大面积草地缺少像素级草叶、野花和明暗节奏。 | 补充高频草叶、野花点缀和低频草地明暗分区。 |
| 物件贴片感 | 树、石头、花和设施与地表接触不够自然。 | 增加脚底阴影、草丛遮挡、透明边缘和环境色统一。 |

训练档案检查命令：

```txt
npm run check:ai-painter-training-run-archive
```

没有复盘报告的训练档案不算完整训练档案。

## 11. 下一步

立即执行失败槽优先训练链路。训练后只看两个结果：

1. 材料槽是否 28/28 通过。
2. 完整 1024x768 地图是否达到参考图同级质感并通过人工验收。
## 2026-07-06 v47 安全闭环补充

本轮不是继续扩大新模块，而是针对参考图基准做收口验证。v47 全量合并版中 shoreline 和 rock_object 存在风险，其中 shoreline 在完整地图中触发水岸过度覆盖，rock_object 训练损失偏高，因此本轮采用安全合并模型根目录 `.runtime/ai-painter/natural-home-local-detail-v47-visual-delta-safe-combined`，只接入 road、water、grass、grass_object、tree_object 的 v47 修复结果，其余高风险项保留底座。

遮罩修正后，东侧水岸从大面积铺层改为沿水体边缘的窄过渡带。Formal VisualJudge 已新增真实水岸遮罩占比 `shorelineMaskRatio`，用于区分“结构真的过宽”和“草地颜色被启发式误判”。本轮通过时 `shorelineMaskRatio=0.0513`，可以作为后续完整地图结构检查的参考阈值。

本轮成功候选图仍必须由项目所有者人工复核。参考图基准要求不仅是机器通过，还要人工确认草地细节、道路自然度、水岸过渡、物件落地融合接近参考图质感。
