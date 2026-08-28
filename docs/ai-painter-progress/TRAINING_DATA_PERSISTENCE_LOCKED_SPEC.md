# AI Painter 训练数据完整保存锁定规格

更新时间：2026-08-24 12:43:09 +08:00

状态：active-training-data-persistence-contract

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

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
| 第一版家园原图库 | `data/world-samples/original-image-library/natural-home-v1/` |
| 正式样本登记 | `data/world-samples/registry/<dictionaryVersion>/` |
| 不可变完整地图数据包 | `data/world-samples/dataset-packages/<packageId>/` |
| AI辅助冷启动不可变数据包 | `data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/` |
| 本地推理目录 | `.runtime/ai-painter/*-inference/` |
| bootstrap 完整地图候选 | `.runtime/ai-painter/complete-world-visual-bootstrap-inference/` |
| bootstrap 机器审核与失败回写 | `.runtime/ai-painter/complete-world-visual-machine-reviews/` |
| foundation 自动候选批次 | `.runtime/ai-painter/complete-world-visual-foundation-batches/` |
| 本地 foundation 模型来源与文件 hash | `.runtime/ai-painter/local-foundation-models/manifest.json` |
| 材料槽推理运行 | `.runtime/game-map-material-slot-inference-runs/` |
| RuntimeFrame 候选 | `.runtime/game-map-runtime-frame-candidates/` |
| RuntimeFrame 工作区 | `.runtime/game-map-runtime-frame-working/` |
| RuntimeFrame 正式记录 | `.runtime/game-map-runtime-frame/` |
| RuntimeFrame 拒绝记录 | `.runtime/game-map-rejected-runtime-frames/` |
| Runtime 合成器输出 | `.runtime/game-map-runtime-compositor/` |
| 当前完整视觉任务包 | `.runtime/ai-painter/world-visual-generation-task-packages/<taskId>/` |
| 编译后模型条件 | `.runtime/ai-painter/world-visual-generation-task-packages/<taskId>/compiled-conditions/` |

RuntimeFrame目录按`working -> candidates -> accepted frame / rejected frames`流转；页面不得把工作区或候选目录展示为已经进入世界的正式画面。两个数据包根目录按通用正式血缘与AI辅助冷启动血缘分工，活动训练只能读取配置精确绑定的路径、packageId和SHA-256。

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
| 页面可查 | 所有程序保存的图片必须进入所属索引并在控制台可查；`/ai-painter-progress/generated-results` 展示生成结果，`/ai-painter-progress/original-images` 按三级页面自动刷新并展示全部原图缩略图和详情 |
| 条件可追溯 | 每个条件通道必须绑定 taskId、字典版本、Manifest、尺寸、路径和 SHA-256；条件编译不得生成玩家画面 |

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
| `npm run check:current-world-visual-conditions` | 检查当前任务的模型条件、身份、尺寸、hash 和无 RGB 输出边界 |
| `npm run check:original-image-library` | 检查原图目录、索引、记录、图片 hash、尺寸和分类一致性 |

## 7. 处理规则

如果检查发现训练数据缺失，不允许直接补造成功记录。必须先说明：

1. 缺的是哪一类数据。
2. 缺失路径是什么。
3. 是程序没有保存，还是页面没有读取。
4. 是否会影响继续训练。
5. 若属于当前合同内的保存或读取缺陷，由本地系统形成有界修复并完成回归；若涉及长期业务、许可或不可恢复操作，禁止越界动作，生成政策边界报告后停止且不等待审批。
