# AI Painter Progress 页面文档入口

更新时间：2026-08-24 05:24:15 +08:00

状态：active-ai-painter-progress-index

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 当前锁定页面

| 页面 | 规格文件 | 状态 |
|---|---|---|
| `/ai-painter-progress/generated-results` | `GENERATED_RESULTS_PAGE_LOCKED_SPEC.md` | 已锁定 |
| 训练数据完整保存 | `TRAINING_DATA_PERSISTENCE_LOCKED_SPEC.md` | 已锁定 |
| AI 模型架构与训练架构对齐 | `AI_MODEL_TRAINING_ARCHITECTURE_ALIGNMENT.md` | 已锁定 |
| AI Painter 训练控制台页面 | `AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md` | 已锁定 |
| AI Painter 后台管理自动化 | `AI_PAINTER_ADMIN_BACKEND_LOCKED_SPEC.md` | 已锁定 |
| 自动修复计划执行器 | `AUTO_REPAIR_PLAN_RUNNER_LOCKED_SPEC.md` | 已锁定 |
| 自动视觉审核学习 | `AUTO_VISUAL_JUDGE_LEARNING_LOCKED_SPEC_20260709.md` | 已锁定 |
| 原图资料库三级页面 | `ORIGINAL_IMAGE_LIBRARY_LOCKED_SPEC.md` | 已锁定 |
| 当前训练只读监控台与Run详情 | `CURRENT_TRAINING_BACKEND_CONSOLE_LOCKED_SPEC.md` | 已锁定 |

局部材料修复、单次失败分析和按日期生成的阶段说明不再作为文档保存；相关运行事实必须由程序写入 `.runtime` 台账。

本目录只定义页面和自动化契约，不定义 AI Painter 总业务或训练顺序。原图库页面中的五类入口是并行数据导航，不是五阶段训练计划；AI Painter主体从`../game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md`读取，当前候选从`../game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`读取。

页面是本地自研AI运行状态的只读投影，不是执行主体、授权机关或审核机关。训练、验证、机器审核、发布、回退和记录由后台本地程序完成；关闭页面、浏览器或Codex不得停止后台任务。

## 2. 修改前必须确认

| 检查项 | 要求 |
|---|---|
| 页面结构 | 不允许随意新增、删除或重排区块 |
| 页面样式 | 没有明确命令，不改颜色、布局、卡片样式 |
| 数据来源 | 只读程序自动保存的数据，不手工替程序补记录 |
| 版本命名 | 原目录名显示，`v54` 就是 `v54` |
| 阻断处理 | 发现页面读不到数据但磁盘存在时，先说明读取范围问题，再询问是否修 |

## 3. 页面与规格映射

| 页面或页面组 | 固定职责 | 权威规格 |
|---|---|---|
| `/ai-painter-progress` | AI Painter总控制台与导航 | `AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md` |
| `/ai-painter-progress/current-training` | 当前或最近运行的实时只读监控 | `CURRENT_TRAINING_BACKEND_CONSOLE_LOCKED_SPEC.md` |
| `/ai-painter-progress/natural-home` | 完整地图训练内容与历史记录浏览 | `AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md` |
| `/ai-painter-progress/generated-results` | 程序生成结果归档 | `GENERATED_RESULTS_PAGE_LOCKED_SPEC.md` |
| `/ai-painter-progress/original-images` | 原始图片资料库 | `ORIGINAL_IMAGE_LIBRARY_LOCKED_SPEC.md` |
| `/ai-painter-progress/training-directory`、`training-ledger`、`history`、`dataset-inventory` | 训练目录、事件账本、历史与数据清单 | `TRAINING_DATA_PERSISTENCE_LOCKED_SPEC.md`、`AI_PAINTER_ADMIN_BACKEND_LOCKED_SPEC.md` |
| `/ai-painter-progress/trial-reviews` | 训练候选与视觉审核记录 | `AUTO_VISUAL_JUDGE_LEARNING_LOCKED_SPEC_20260709.md`及正式审核规格 |
| `/ai-painter-progress/autonomous-training`、`training-expansion` | 本地AI自动训练、能力版本和扩展状态；页面只提交任务或项目级决定，不直接执行 | `AI_PAINTER_ADMIN_BACKEND_LOCKED_SPEC.md`、`AUTO_REPAIR_PLAN_RUNNER_LOCKED_SPEC.md` |
| `/ai-painter-progress/bootstrap`、`asset-fit`、`component-readiness`、`discrete-assets`、`local-assets`、`multiscene`、`rgb-refiner`、`structure-guided` | 模型、资产和能力证据的只读页面组 | `AI_MODEL_TRAINING_ARCHITECTURE_ALIGNMENT.md`、`AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md` |
| `/ai-painter-progress/task-console` | 本地任务与证据投影 | `AI_PAINTER_ADMIN_BACKEND_LOCKED_SPEC.md` |
| `/ai-painter-progress/world-visual-dictionary` | 世界视觉数据字典查询 | `AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md`及字典README |

`natural-home`与`current-training`必须保持不同职责：前者浏览完整地图训练内容和历史，后者显示当前运行实时进度。页面只能读取本地程序已经保存的数据，不得因打开页面而训练、验证、审核或补写记录。

固定数据入口：

| 内容 | 路径 |
|---|---|
| 页面源码 | `src/app/ai-painter-progress/` |
| 页面API | `src/app/api/ai-painter/` |
| 自动保存目录 | `.runtime/ai-painter/` |
| 通用不可变数据包 | `data/world-samples/dataset-packages/` |
| AI辅助冷启动数据包 | `data/world-samples/ai-assisted-cold-start-dataset-packages/` |
| 生成结果索引 | `.runtime/ai-painter/generated-results/index.json` |

## 4. 固定检查

| 命令 | 用途 |
|---|---|
| `npm run check:documentation-policy` | 检查页面锁定文档和项目文档规则是否包含强制句 |
| `npm run check:ai-painter-generated-results-page-lock` | 检查生成结果归档页面是否仍按锁定规格读取固定数据源 |
| `npm run check:ai-painter-training-data-persistence` | 检查训练总账、运行档案、原始输出、失败码和人工复核是否完整保存 |
| `npm run check:ai-painter-model-training-alignment` | 检查数据字典、模型架构、训练架构、自动保存链路是否对齐 |
