# AI Painter 训练数据完整保存锁定规格

更新时间：2026-07-10 19:50:04 +08:00

状态：active-lock / 程序自动保存边界 / 已进入代码实现

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 核心要求

所有训练数据必须由本地小模型程序自动保存。任何一轮训练、推理、审核、失败、修复、人工复核都不能只存在聊天记录里，也不能只靠 Codex 手工整理。

## 2. 必须保存的完整细节

| 类别 | 必须保存的内容 |
|---|---|
| 输入数据 | 数据集 manifest、样本清单、输入包、结构化条件、参考图路径、字典版本 |
| 训练配置 | 训练脚本、配置文件、模型版本、数据集路径、初始 checkpoint、epoch、学习率、loss 权重 |
| 训练过程 | training log、每轮 loss、最佳指标、开始时间、结束时间、设备、显存/资源记录 |
| 模型产物 | best checkpoint、latest checkpoint、模型 manifest、合并模型清单 |
| 推理输入 | 推理请求、模型根目录、参考数据集、seed/策略、运行 ID |
| 推理输出 | 图片、材料槽、contact sheet、latest.json、输出 manifest、图片 hash/尺寸 |
| 质量审核 | MaterialQuality、FormalVisualJudge、VisualJudge、失败码、通过/失败状态 |
| 失败记录 | failedSlots、formal issues、negative sample labels、owner rejected record |
| 修复依据 | visual delta review、next repair target slots、next action |
| 人工复核 | owner review 状态、是否 required、是否 pending、是否 rejected/pass |
| 页面读取 | 页面必须读取程序保存的数据，不能伪造、改名、搬运或补造 |

## 3. 固定存储位置

| 数据 | 固定位置 |
|---|---|
| 训练过程总账 | `.runtime/ai-painter/training-process-ledger/events.jsonl` |
| 最新训练过程总账 | `.runtime/ai-painter/training-process-ledger/latest.json` |
| 完整训练运行档案 | `.runtime/ai-painter/training-run-archive/` |
| 最新完整训练运行档案索引 | `.runtime/ai-painter/training-run-archive/latest.json` |
| 生成结果索引 | `.runtime/ai-painter/generated-results/index.json` |
| 本地训练目录 | `.runtime/ai-painter/*-training/` |
| 本地数据目录 | `.runtime/ai-painter/*-dataset/` |
| 本地候选目录 | `.runtime/ai-painter/*-candidate*/` |
| 本地推理目录 | `.runtime/ai-painter/*-inference/` |
| 材料槽推理运行 | `.runtime/game-map-material-slot-inference-runs/` |
| RuntimeFrame 候选 | `.runtime/game-map-runtime-frame-candidates/` |
| Runtime 合成器输出 | `.runtime/game-map-runtime-compositor/` |

## 4. 通过标准

| 检查项 | 通过标准 |
|---|---|
| 总账存在 | `events.jsonl` 和 `latest.json` 都存在且非空 |
| 最新运行档案存在 | `training-run-archive/latest.json` 存在且可解析 |
| 原始输出可追溯 | manifest 里记录的原始训练、推理、审核路径必须存在 |
| 档案输出可追溯 | manifest 里记录的已保存图片、报告、模型清单必须存在 |
| 失败也保存 | 失败时必须记录 failedSlots 或 formalVisualJudgeIssues |
| 人工复核状态保存 | 必须记录 manualReview.required 和 manualReview.status |
| 字典版本保存 | 必须记录 dictionaryContract 或等价字典版本信息 |
| 页面可查 | `/ai-painter-progress/generated-results` 必须能展示自动保存目录 |

## 5. 禁止事项

| 禁止项 | 原因 |
|---|---|
| 只在聊天里记录训练结果 | 聊天不是项目数据源 |
| 训练后不写 manifest | 无法追溯输入、模型、输出和失败原因 |
| 失败图不保存 | 失败样本是下一轮训练依据 |
| 修改版本名 | `v54` 必须仍然是 `v54` |
| 用 Codex 手工补造成功记录 | 成功/失败必须来自程序运行记录 |
| 页面只读一部分目录 | 用户必须能查到程序自动保存的所有训练数据入口 |

## 6. 固定检查命令

| 命令 | 用途 |
|---|---|
| `npm run check:ai-painter-training-data-persistence` | 检查训练数据、运行档案、失败码、人工复核、原始输出路径是否可追溯 |
| `npm run check:ai-painter-generated-results-page-lock` | 检查生成结果页面仍按锁定规格读取自动保存目录 |
| `npm run check:documentation-policy` | 检查文档是否保留强制句 |

## 7. 处理规则

如果检查发现训练数据缺失，不允许直接补造成功记录。必须先说明：

1. 缺的是哪一类数据。
2. 缺失路径是什么。
3. 是程序没有保存，还是页面没有读取。
4. 是否会影响继续训练。
5. 等项目所有者确认后再修。
