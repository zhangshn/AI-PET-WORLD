# AI-PET-WORLD 目录结构说明

版本：v1.2
状态：目录基线
更新日期：2026-06-25

## 根目录

| 路径 | 职责 |
|---|---|
| `README.md` | 项目总入口，只做摘要和文档索引 |
| `docs/` | 正式文档 |
| `src/` | Next.js 应用、世界逻辑、视觉逻辑 |
| `ml/ai-painter/` | 本地 AI Painter 小模型训练、推理和数据脚本 |
| `scripts/` | 检查、构建、ApprovedFrame、数据验证脚本 |
| `data/` | 项目正式数据、ApprovedFrame、VisualUnit 契约样例 |
| `.runtime/` | 本地运行产物、训练结果、候选图、失败图、日志 |

## 文档目录

| 路径 | 职责 |
|---|---|
| `docs/BUSINESS_SPEC.md` | 业务主线和边界 |
| `docs/EXECUTION_PLAN.md` | 唯一执行计划表 |
| `docs/PROGRESS.md` | 当前进度表 |
| `docs/ARCHITECTURE.md` | 技术架构 |
| `docs/DIRECTORY_STRUCTURE.md` | 目录结构说明 |

## 应用目录

| 路径 | 职责 |
|---|---|
| `src/app/world` | 正式世界页面，只展示 ApprovedFrame / RuntimeFrame |
| `src/app/create-world` | 创建世界入口 |
| `src/app/ai-painter-progress` | 本地训练进度主页 |
| `src/app/ai-painter-progress/generated-results` | 训练后生成内容、失败图、候选图、审核图查看页 |
| `src/app/api/world` | 世界创建、tick、视觉帧相关 API |
| `src/app/api/ai-painter` | AI Painter 训练、推理、结果读取 API |

## 训练页面规划

训练页面必须分层，避免把训练候选、失败图和正式世界展示混在一起。

| 页面 | 类型 | 职责 | 是否允许进 `/world` |
|---|---|---|---:|
| `src/app/world` | 玩家主页面 | 只展示完整 ApprovedFrame / RuntimeFrame | 是，仅通过闸门后 |
| `src/app/ai-painter-progress` | 训练主页 | 只展示整体状态和入口 | 否 |
| `src/app/ai-painter-progress/generated-results` | 训练结果归档 | 查看训练后 PNG、失败图、候选图、时间戳、耗时、资源账本、审核结果 | 否 |
| 完整训练入口 | 规划入口 | 自然家园完整画面训练、生成、VJ、ApprovedFrame 候选 | 否，只有写入 ApprovedFrame 后由 `/world` 读取 |
| 局部训练入口 | 规划入口 | VisualUnit、局部资产、状态帧训练 | 否 |

规则：

```txt
训练页展示训练内容
归档页保存所有训练结果
/world 只展示玩家可见正式世界
```

## 世界逻辑目录

| 路径 | 职责 |
|---|---|
| `src/world` | 世界 Runtime、世界事实、管家行为、视觉结构 |
| `src/world/visual` | Candidate、Review、ApprovedFrame 等视觉链路代码 |
| `src/world/runtime` | runtime tick、存档、事实读取 |
| `src/world/creation` | 创建世界输入与人格映射 |

## 本地小模型目录

| 路径 | 职责 |
|---|---|
| `ml/ai-painter/configs` | 训练配置 |
| `ml/ai-painter/scripts` | 训练、推理、数据清洗、质量筛选、VJ 辅助脚本 |
| `ml/ai-painter/tests` | 数据和训练脚本测试 |
| `ml/ai-painter/.venv` | 本地 Python 虚拟环境，不作为业务代码 |

## 运行产物目录

| 路径 | 职责 |
|---|---|
| `.runtime/ai-painter/*-dataset` | 训练数据集产物 |
| `.runtime/ai-painter/*-training` | 训练权重、训练摘要、日志 |
| `.runtime/ai-painter/*-generation` | 模型推理候选图 |
| `.runtime/ai-painter/*-quality-selection` | 质量筛选报告 |
| `.runtime/ai-painter/*-vj1-review` | VJ-1 审核结果 |
| `.runtime/ai-painter/*-vj2-review` | VJ-2 审核结果 |
| `.runtime/ai-painter/logs` | 命令运行日志 |

## 训练产物归档规则

| 产物 | 存放位置 | 要求 |
|---|---|---|
| 训练数据集 | `.runtime/ai-painter/*-dataset` | 保留生成来源、mask、metadata |
| 训练权重 | `.runtime/ai-painter/*-training` | 保留配置、权重、loss、时间戳、耗时、GPU 信息 |
| 推理候选 | `.runtime/ai-painter/*-generation` | 保留所有候选，不删除失败图 |
| 质量筛选 | `.runtime/ai-painter/*-quality-selection` | 保留通过、打回、失败原因 |
| VJ-1 审核 | `.runtime/ai-painter/*-vj1-review` | 保留清晰度、边缘、结构审核 |
| VJ-2 审核 | `.runtime/ai-painter/*-vj2-review` | 保留语义、风格、状态一致性审核 |
| ApprovedFrame | `data/world-approved-frames` | 只保存通过完整主世界闸门的帧 |

训练产物不由 Codex 手动零散保存，必须由项目脚本和页面入口自动生成、自动记录、自动归档。

## 正式数据目录

| 路径 | 职责 |
|---|---|
| `data/world-approved-frames` | ApprovedFrame 正式记录 |
| `data/world-runtime` | 当前本地 runtime 存档 |
| `data/visual-units` | 后续 VisualUnit 契约样例 |

## 当前禁止

| 禁止事项 | 原因 |
|---|---|
| 把候选图直接放入 `/world` | 没有通过 ApprovedFrame |
| 把程序图当正式世界图 | 不是 AI Painter 正式输出 |
| 把训练失败图删除 | 失败图是下一轮训练和 VJ 的依据 |
| 在主页堆训练图 | 训练图统一进入 `generated-results` |
| 新增未计划目录 | 必须先按执行计划申请确认 |
