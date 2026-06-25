# AI-PET-WORLD 当前进度表

版本：v1.0  
状态：实时进度文档  
更新时间：2026-06-25

本文档只记录当前进度。项目总入口看 [README](../README.md)，执行顺序看 [唯一执行计划表](./EXECUTION_PLAN.md)。

## 1. 当前阶段

```txt
当前主线：自然家园小模型训练 + 自然家园 VisualJudge + 第一张自然家园 ApprovedFrame
当前阶段：C 阶段，自然家园 VisualJudge 强化
当前最新结果：V91 自然家园候选完成 VJ-1 审核，17 / 17 通过 VJ-1
当前限制：VJ-2 未完成，ApprovedFrame 未写入，/world 不能展示候选图
```

## 2. 总体进度表

| 模块 | 状态 | 完成度 | 当前说明 |
|---|---|---:|---|
| 业务主线定义 | 完成 | 100% | 自主世界、自主管家、世界事实优先已冻结 |
| 文档入口整理 | 完成 | 100% | README、执行计划、架构、目录、进度表分离 |
| 正式展示闸门 | 完成 | 100% | `/world` 只允许 ApprovedFrame / RuntimeFrame |
| 本地训练工程 | 可运行 | 95% | PyTorch、CUDA、训练、推理、资源记录已接通 |
| 训练结果归档 | 已接通 | 90% | 训练图、失败图、时间戳、资源账本已进入归档链路 |
| 自然家园数据清洗 | 进行中 | 80% | V90/V91 已剔除建筑、施工、人物、动物等当前禁区 |
| 自然家园小模型训练 | 进行中 | 75% | V91 已训练并生成 17 张当前 MVP 候选 |
| 自然家园质量筛选 | 进行中 | 80% | V91 quality selection 17 / 17 通过下一轮训练候选 |
| VisualJudge VJ-0 | 完成 | 100% | 文件、来源、事实、runtime gate 已建 |
| VisualJudge VJ-1 | 进行中 | 55% | V91 当前 MVP 自然候选 17 / 17 通过 VJ-1；仍需继续补真实语义和风格判断 |
| VisualJudge VJ-2 | 未完成 | 10% | 语义、风格、状态一致性判断未完成 |
| ApprovedFrame | 未完成 | 0% | 当前正式世界图仍为 0 |
| `/world` 正式展示 | 未完成 | 0% | 未写入 ApprovedFrame 前继续隐藏 |
| VisualUnit v0 | 暂停 | 25% | schema、registry、状态帧、运行时帧、样例已建；judge 后置 |
| 人物 / 管家视觉单元 | 未开始 | 0% | 后置 |
| 设施 / 建筑视觉单元 | 未开始 | 0% | 后置 |
| 动态状态帧 | 未开始 | 0% | 后置 |
| Runtime 动态合成 | 未开始 | 0% | 后置 |

## 3. 当前小模型链路进度

| 阶段 | 状态 | 输出 |
|---|---|---|
| V90 当前 MVP 自然内容过滤 | 完成 | `.runtime/ai-painter/natural-home-v90-current-mvp-natural-only-filter` |
| V90 当前 MVP 数据集 | 完成但有质量打回 | `.runtime/ai-painter/natural-home-v90-current-mvp-natural-only-dataset` |
| V91 质量可训练候选过滤 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-filter` |
| V91 质量可训练数据集 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-dataset` |
| V91 本地训练 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-training` |
| V91 候选生成 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-generation` |
| V91 质量筛选 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-quality-selection` |
| V91 VJ-1 审核 | 完成 | `.runtime/ai-painter/natural-home-v91-current-mvp-vj1-review` |

## 4. 最新 V91 结果

| 指标 | 数值 |
|---|---:|
| V91 候选总数 | 17 |
| 质量筛选通过 | 17 |
| VJ-1 通过 | 17 |
| VJ-1 打回 | 0 |
| VJ-2 | 未实现 |
| ApprovedFrame | 未写入 |
| 是否可进入 `/world` | 否 |

最新文件：

| 文件 | 作用 |
|---|---|
| `.runtime/ai-painter/natural-home-v91-current-mvp-vj1-review/latest.json` | VJ-1 最新审核报告 |
| `.runtime/ai-painter/natural-home-v91-current-mvp-vj1-review/review-report.json` | VJ-1 审核报告留档 |
| `.runtime/ai-painter/natural-home-v91-current-mvp-vj1-review/contact-sheet.png` | VJ-1 审核预览 |

## 5. 下一步计划

| 顺序 | 任务 | 是否当前允许 | 完成标准 |
|---:|---|---:|---|
| 1 | ApprovedFrame 候选审核入口 | 是 | VJ-1 通过候选绑定 worldId、tick、sourceFactIds、image hash、review hash |
| 2 | VJ-2 最小语义 / 风格检查 | 是 | 明显不符合明亮治愈俯视像素风、语义错位、状态错位能打回 |
| 3 | 第一张自然家园 ApprovedFrame | 是，等 1 和 2 | 只写入通过审核的自然家园图 |
| 4 | `/world` 读取 ApprovedFrame | 是，等 3 | 页面只显示 ApprovedFrame，不显示候选 |
| 5 | 继续泛化训练 | 是，等第一张闭环稳定 | 能生成更多不同自然家园 |
| 6 | VisualUnit judge | 否 | 等 B-D 完成 |
| 7 | 人物 / 建筑 / 动态 | 否 | 后置 |

## 6. 当前阻塞

| 阻塞 | 影响 | 处理 |
|---|---|---|
| VJ-2 未完成 | VJ-1 通过不能代表正式可展示 | 下一步补最小 VJ-2 |
| ApprovedFrame 未写入 | `/world` 仍无正式自然家园图 | 先做候选审核绑定 |
| 当前样本量仍偏少 | 泛化能力还需要继续增强 | 第一张闭环后继续扩数据 |

## 7. 固定提醒

候选图、训练图、失败图、质量筛选图、VJ-1 通过图，都不是正式世界图。

正式世界图必须满足：

```txt
本地小模型生成
-> 绑定世界事实
-> 通过 VisualJudge
-> 写入 ApprovedFrame / RuntimeFrame
-> /world 读取展示
```
