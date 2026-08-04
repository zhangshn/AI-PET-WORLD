# AI Painter Progress 页面文档入口

更新时间：2026-08-02 19:17:43 +08:00

状态：active-ai-painter-progress-index

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

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

本目录只定义页面和自动化契约，不定义 AI Painter 总业务或训练顺序。原图库页面中的五类入口是并行数据导航，不是五阶段训练计划；总路线必须返回 `../DOCUMENT_AUTHORITY_INDEX.md`、`../ARCHITECTURE.md` 和 `../game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md` 读取。

## 2. 修改前必须确认

| 检查项 | 要求 |
|---|---|
| 页面结构 | 不允许随意新增、删除或重排区块 |
| 页面样式 | 没有明确命令，不改颜色、布局、卡片样式 |
| 数据来源 | 只读程序自动保存的数据，不手工替程序补记录 |
| 版本命名 | 原目录名显示，`v54` 就是 `v54` |
| 阻断处理 | 发现页面读不到数据但磁盘存在时，先说明读取范围问题，再询问是否修 |

## 3. 固定入口

| 内容 | 路径 |
|---|---|
| 页面源码 | `src/app/ai-painter-progress/generated-results/page.tsx` |
| 页面 URL | `/ai-painter-progress/generated-results` |
| 自动保存目录 | `.runtime/ai-painter/` |
| 材料推理目录 | `.runtime/game-map-material-slot-inference-runs/world-d0znz8/0/` |
| 生成结果索引 | `.runtime/ai-painter/generated-results/index.json` |

## 4. 固定检查

| 命令 | 用途 |
|---|---|
| `npm run check:documentation-policy` | 检查页面锁定文档和项目文档规则是否包含强制句 |
| `npm run check:ai-painter-generated-results-page-lock` | 检查生成结果归档页面是否仍按锁定规格读取固定数据源 |
| `npm run check:ai-painter-training-data-persistence` | 检查训练总账、运行档案、原始输出、失败码和人工复核是否完整保存 |
| `npm run check:ai-painter-model-training-alignment` | 检查数据字典、模型架构、训练架构、自动保存链路是否对齐 |
