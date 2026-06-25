# AI-PET-WORLD 当前进度表

版本：v1.4
状态：实时进度文档
更新日期：2026-06-25

本文档只记录当前进度。项目入口看 [README](../README.md)，业务定义看 [业务说明](./BUSINESS_SPEC.md)，执行顺序看 [唯一执行计划表](./EXECUTION_PLAN.md)。

## 当前阶段

```txt
当前主线：自然家园小模型训练 + 自然家园 VisualJudge + ApprovedFrame 闭环
当前阶段：阶段 E，自然家园泛化训练与 VisualJudge 增强
上一历史闭环：V91 曾写入受控 MVP ApprovedFrame，但因属于 256x192 crop 局部候选，当前已被主页面闸门阻断
本轮最新结果：V95 已完成失败修复数据集、训练、候选生成、质量筛选、VJ-1/VJ-2，但 48 张候选仍全部被 VJ 阻断
当前限制：V92/V93/V94/V95 都不能进入 /world，不能写 ApprovedFrame，不代表正式世界图
```

## 总体进度表

| 模块 | 状态 | 完成度 | 当前说明 |
|---|---|---:|---|
| 业务主线定义 | 完成 | 100% | 自主世界、管家自主、世界事实优先已冻结 |
| 文档入口整理 | 完成 | 100% | README、业务说明、执行计划、架构、目录、进度表已分离 |
| 正式展示闸门 | 已收紧 | 100% | `/world` 只允许完整主世界 ApprovedFrame / RuntimeFrame，局部/crop/候选图全部阻断 |
| 本地训练工程 | 可运行 | 95% | PyTorch、CUDA、训练、推理、资源记录已接通 |
| 训练结果归档 | 已接通 | 90% | 训练图、失败图、时间戳、资源账本进入归档链路 |
| 自然家园数据清洗 | 进行中 | 90% | V95 形成 200 个失败修复训练样本，含 185 训练 / 15 验证 |
| 自然家园小模型训练 | 进行中 | 84% | V91 可出受控 MVP 图；V95 已继续训练但泛化仍未过 VJ |
| 自然家园质量筛选 | 进行中 | 85% | V95 41/48 过训练筛选，但 VJ-1/VJ-2 全部阻断 |
| VisualJudge VJ-0 | 完成 | 100% | 文件、来源、事实、runtime gate 已建 |
| VisualJudge VJ-1 | 进行中 | 73% | 能阻断失败图；V95 泛化候选仍 0/48 通过 |
| VisualJudge VJ-2 | 进行中 | 52% | MVP 最小语义/风格闸门已接入，但完整判断仍需增强 |
| ApprovedFrame | 历史首张归档 | 65% | V91 旧受控 MVP 帧保留归档；因是 256x192 crop 局部图，已不允许作为主世界展示 |
| `/world` 正式展示 | 闸门收紧，当前无可展示帧 | 55% | 主页面只展示完整世界帧；当前 V92/V93/V94/V95 均未通过，不展示训练图 |
| VisualUnit v0 | 暂停 | 25% | schema、registry、状态帧、运行时帧、样例已建；judge 后置 |
| 人物 / 管家视觉单元 | 未开始 | 0% | 后置 |
| 设施 / 建筑视觉单元 | 未开始 | 0% | 后置 |
| 动态状态帧 | 未开始 | 0% | 后置 |
| Runtime 动态合成 | 未开始 | 0% | 后置 |

## 训练分线进度

| 分线 | 职责 | 当前状态 | 完成度 | 下一步 |
|---|---|---:|---:|---|
| 完整自然家园训练线 | 生成完整自然家园主世界候选图 | 当前主线 | 84% | V96 扩充干净多布局自然样本，并继续训练完整主世界候选 |
| 完整自然家园 VisualJudge | 审核完整候选是否能成为 ApprovedFrame | 当前主线 | 63% | 强化 VJ-1/VJ-2，至少让完整候选出现稳定通过 |
| ApprovedFrame 主世界闸门 | 只让完整、当前事实匹配的图进 `/world` | 已收紧 | 70% | 等待新的完整候选通过后写入 |
| 局部视觉单元训练线 | 树、水、草、石、人物、建筑、状态帧 | 后置 | 25% | 暂不抢主线，只保留入口和数据契约 |
| Runtime 合成线 | 把完整构图能力、局部单元和动态状态组合成游戏画面 | 后置 | 0% | 等自然家园 ApprovedFrame 达标后再启动 |

## 页面与归档进度

| 页面 / 模块 | 当前状态 | 说明 |
|---|---|---|
| `/world` | 已阻断历史局部图 | 当前没有合格完整主世界 ApprovedFrame，不展示训练图 |
| `/ai-painter-progress` | 需整理入口 | 下一步拆成“完整训练入口”和“局部训练入口” |
| `/ai-painter-progress/generated-results` | 已作为归档页 | 所有训练后输出、候选、失败、时间戳、耗时、资源账本都应集中查看 |
| 完整训练详情页 | 需补清晰入口 | 显示自然家园完整训练、候选、VJ、ApprovedFrame 状态 |
| 局部训练详情页 | 后置入口 | 显示 VisualUnit / 局部资产训练，不进入 `/world` |

## 当前小模型链路进度

| 阶段 | 状态 | 输出 |
|---|---|---|
| V90 当前 MVP 自然内容过滤 | 完成 | `.runtime/ai-painter/natural-home-v90-current-mvp-natural-only-filter` |
| V91 质量可训练数据集 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-dataset` |
| V91 本地训练 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-training` |
| V91 候选生成 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-generation` |
| V91 VJ-1 / VJ-2 审核 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-vj1-review`、`.runtime/ai-painter/natural-home-v91-current-mvp-vj2-review` |
| V91 ApprovedFrame 候选绑定 | 完成 | `.runtime/ai-painter/natural-home-v91-approved-frame-candidate-binding` |
| V91 第一张 ApprovedFrame 写入 | 完成 | `data/world-approved-frames/owner-d0znz8/world-d0znz8` |
| V92 泛化候选生成 | 完成但失败归档 | `.runtime/ai-painter/natural-home-v92-current-mvp-generalization-sweep-generation` |
| V92 泛化 VJ-1 / VJ-2 | 完成，0/48 通过 | `.runtime/ai-painter/natural-home-v92-current-mvp-generalization-vj1-review`、`.runtime/ai-painter/natural-home-v92-current-mvp-generalization-vj2-review` |
| V93 干净泛化数据集 | 完成 | `.runtime/ai-painter/natural-home-v93-clean-generalization-dataset` |
| V93 干净泛化训练 | 完成 | `.runtime/ai-painter/natural-home-v93-clean-generalization-training` |
| V93 干净泛化 VJ-1 / VJ-2 | 完成，0/48 通过 | `.runtime/ai-painter/natural-home-v93-clean-generalization-vj1-review`、`.runtime/ai-painter/natural-home-v93-clean-generalization-vj2-review` |
| V94 边缘与清晰度修复训练 | 完成但未达标 | `.runtime/ai-painter/natural-home-v94-edge-sharpness-repair-training` |
| V94 候选生成与质量筛选 | 完成 | `.runtime/ai-painter/natural-home-v94-edge-sharpness-repair-generation`、`.runtime/ai-painter/natural-home-v94-edge-sharpness-repair-quality-selection` |
| V94 VJ-1 / VJ-2 | 完成，0/48 通过 | `.runtime/ai-painter/natural-home-v94-edge-sharpness-repair-vj1-review`、`.runtime/ai-painter/natural-home-v94-edge-sharpness-repair-vj2-review` |
| V95 失败修复数据集 | 完成 | `.runtime/ai-painter/natural-home-v95-failure-repair-dataset` |
| V95 失败修复训练 | 完成但未达标 | `.runtime/ai-painter/natural-home-v95-failure-repair-training` |
| V95 候选生成与质量筛选 | 完成 | `.runtime/ai-painter/natural-home-v95-failure-repair-generation`、`.runtime/ai-painter/natural-home-v95-failure-repair-quality-selection` |
| V95 VJ-1 / VJ-2 | 完成，0/48 通过 | `.runtime/ai-painter/natural-home-v95-failure-repair-vj1-review`、`.runtime/ai-painter/natural-home-v95-failure-repair-vj2-review` |

## 最新 V95 结果

| 指标 | 数值 |
|---|---:|
| 数据集样本 | 200 |
| 训练样本 / 验证样本 | 185 / 15 |
| 失败聚焦来源 / 复制样本 | 34 / 140 |
| 训练 epoch / step | 14 / 1302 |
| 训练设备 | CUDA |
| 参数量 | 2176134 |
| bestGeneratorLoss | 0.4422638875 |
| bestValidationLoss | 0.4856465869 |
| 生成候选 | 48 |
| 质量筛选通过下一轮训练 | 41 |
| 质量筛选打回 | 7 |
| 平均分 | 86.323431 |
| 最高分 | 94.467040 |
| 最低分 | 69.091667 |
| VJ-1 通过 | 0 |
| VJ-1 打回 | 48 |
| VJ-2 通过 | 0 |
| VJ-2 打回 | 48 |
| 是否可展示 | 否 |
| 是否可写 ApprovedFrame | 否 |
| 是否进入 `/world` | 否 |

主要失败原因：

| 失败原因 | 次数 | 解释 |
|---|---:|---|
| `edge_density_ratio_above_vj1_line` | 48 | 边缘密度仍低于 VJ-1 线 |
| `mae_under_vj1_line` | 48 | 与目标差异仍超过 VJ-1 线 |
| `psnr_above_vj1_line` | 48 | 清晰接近度仍不足 |
| `sharpness_ratio_above_vj1_line` | 41 | 多数候选仍不够锐 |
| `score_above_vj1_line` | 34 | 综合质量不足 |
| `mask_boundary_ratio_above_vj1_line` | 27 | mask 边界与画面细节一致性不足 |
| `water_artifact_delta_under_vj1_line` | 4 | 部分水体仍有伪影风险 |
| `vj1_must_pass` | 48 | VJ-2 要求先通过 VJ-1 |

结论：

```txt
V95 是一次有效失败修复实验。
它证明仅靠复制 V94 失败来源并放大失败修复权重，仍不能让泛化候选通过 VJ-1。
下一步不继续蛮力重复同类失败样本，而是做 V96：扩充更干净、多布局、同源 mask 更稳定的自然家园样本，并把 VJ-1 失败原因转成更明确的数据配比。
```

## 历史 ApprovedFrame 记录

| 项目 | 内容 |
|---|---|
| worldId | `world-d0znz8` |
| tick | `0` |
| sourceFactIds | `41` |
| frameId | `approved-frame-world-d0znz8-0` |
| approvedForProduction | `false` |
| canShowToPlayer | 历史记录中为 `true`，但当前主页面闸门已收紧 |
| 当前主页面状态 | 已被新闸门阻断，不再作为 `/world` 主世界画面展示 |
| 阻断原因 | `256x192` 局部图，candidateId 含 `crop` |
| 最新索引 | `data/world-approved-frames/owner-d0znz8/world-d0znz8/latest-approved-frame.json` |
| 记录文件 | `data/world-approved-frames/owner-d0znz8/world-d0znz8/approved-frame-0-approved-frame-world-d0znz8-0.json` |

## 下一步计划

| 顺序 | 任务 | 是否当前允许 | 完成标准 |
|---:|---|---:|---|
| 1 | 整理训练主页入口 | 是 | `/ai-painter-progress` 分清完整训练入口和局部训练入口，不在主页堆候选图 |
| 2 | V96 扩充干净多布局自然样本 | 是 | 训练集不只重复失败来源，覆盖森林、水岸、空地、小路、石区多组合 |
| 3 | V96 调整失败样本配比 | 是 | 失败样本作为负向反馈，不压过干净目标分布 |
| 4 | V96 继续自然家园完整训练 | 是 | 能生成多结构完整自然家园候选，而不是局部 crop 图 |
| 5 | 强化 VJ-1 清晰度、边缘、结构一致性检查 | 是 | 稳定打回模糊、伪影、错误结构，并减少误判 |
| 6 | 强化 VJ-2 语义与风格判断 | 是 | 只让自然、明亮、治愈、俯视像素风候选进入 ApprovedFrame 候选 |
| 7 | 生成新的完整自然家园 ApprovedFrame | 是 | 非局部、非 crop、完整尺寸、当前事实匹配后进入 `/world` |
| 8 | VisualUnit judge | 否 | 后置 |
| 9 | 人物 / 管家视觉 | 否 | 后置 |
| 10 | 建筑 / 设施视觉 | 否 | 后置 |
| 11 | 动态状态帧 | 否 | 后置 |

## 固定提醒

候选图、训练图、失败图、质量筛选图、VJ 通过图，都不是正式世界图。

`/world` 是玩家主世界页面，不是训练预览页。任何局部图、crop 图、patch 图、tile 图、sprite 图、低于完整主世界帧尺寸的图，即使历史上写入过受控 MVP 记录，也只能保留归档，不能展示在 `/world`。

正式世界图必须满足：

```txt
本地小模型生成
-> 绑定世界事实
-> 通过 VisualJudge
-> 满足完整主世界帧尺寸
-> 不是 crop / partial / patch / tile / sprite
-> 写入 ApprovedFrame / RuntimeFrame
-> /world 读取展示
```
