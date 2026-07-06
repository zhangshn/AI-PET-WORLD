# AI-PET-WORLD 目录结构说明

更新：2026-07-06

本文定义项目目录职责，防止训练内容、候选图、正式世界数据、文档和 Runtime 数据混用。

## 1. 根目录职责

| 目录 / 文件 | 职责 |
|---|---|
| `README.md` | 项目总入口，只放导航、固定方向和当前主线。 |
| `docs/` | 正式业务、架构、计划、进度、目录文档。 |
| `src/` | Next.js 页面、API、世界 Runtime、地图结构、视觉闸门。 |
| `ml/ai-painter/` | 本地 AI Painter 小模型、训练、推理、数据工具。 |
| `data/` | 需要进入项目生命周期的结构化数据、正式记录、训练集。 |
| `.runtime/` | 本地运行、训练、候选、失败、临时 Runtime 产物。 |
| `scripts/` | 检查、生成、训练、归档、合成脚本。 |

## 2. 文档目录

| 文件 | 职责 |
|---|---|
| `docs/BUSINESS_SPEC.md` | 业务规则、MVP 边界、AI Painter 边界、`/world` 展示规则。 |
| `docs/ARCHITECTURE.md` | 业务架构图、技术架构图、数据流、模块边界。 |
| `docs/DIRECTORY_STRUCTURE.md` | 目录职责和文件放置规则。 |
| `docs/EXECUTION_PLAN.md` | 唯一执行计划表。 |
| `docs/PROGRESS.md` | 当前进度表，每次工作后只更新这里。 |
| `docs/ziwei/` | 紫微模块文档。当前自然家园视觉主线不修改。 |

文档规则：

| 规则 | 说明 |
|---|---|
| 总入口只导航 | `README.md` 不承载长计划和实时进度。 |
| 计划只在 `EXECUTION_PLAN.md` | 不再创建临时计划文档。 |
| 进度只在 `PROGRESS.md` | 每次只更新进度表，不在多个文档散落进度。 |
| 架构只在 `ARCHITECTURE.md` | 不用临时方案替代正式架构。 |
| 业务只在 `BUSINESS_SPEC.md` | 不用讨论文本替代业务规则。 |

## 3. 页面目录

| 页面路径 | 职责 | 是否允许展示正式游戏画面 |
|---|---|---:|
| `src/app/world` | 玩家主世界页面 | 允许，但只能展示完整 GameMapRuntimeFrame。 |
| `src/app/create-world` | 创建世界入口 | 不展示正式世界画面。 |
| `src/app/ai-painter-progress` | 本地训练中心主页 | 不展示正式世界画面。 |
| `src/app/ai-painter-progress/generated-results` | 训练后内容归档页 | 不展示正式世界画面。 |
| `src/app/ai-painter-progress/local-assets` | 本地资源和训练数据查看 | 不展示正式世界画面。 |
| `src/app/world-visual-control` | 视觉控制或诊断页 | 不展示正式世界画面。 |

`/world` 禁止显示：

| 内容 | 原因 |
|---|---|
| 训练图 | 训练中间产物。 |
| 候选图 | 未正式通过。 |
| 失败图 | 只能归档。 |
| 局部图 | 不是完整游戏地图。 |
| crop / patch / tile / sprite | 只是素材，不是主世界。 |
| 单张 ApprovedFrame 图片 | 不是 RuntimeFrame。 |
| 程序占位图 | 不是正式 AI 视觉结果。 |

## 4. API 目录

| API 目录 | 职责 |
|---|---|
| `src/app/api/world/create` | 创建世界。 |
| `src/app/api/world/tick` | 推进世界 tick。 |
| `src/app/api/world/visual/*` | 世界视觉候选、审核、ApprovedFrame、完整性检查。 |
| `src/app/api/ai-painter/*` | 本地 AI Painter 训练、推理、归档、状态读取。 |

API 边界：

| 规则 | 说明 |
|---|---|
| world API 管世界事实 | 不负责训练小模型。 |
| ai-painter API 管训练和归档 | 不改变世界事实。 |
| visual API 管候选和审核 | 不直接把图片塞进 `/world`。 |

## 5. 世界模块目录

| 目录 | 职责 |
|---|---|
| `src/world/runtime/` | 世界运行、tick、事件、状态。 |
| `src/world/game-map-frame/` | GameMapFrame、RuntimeFrame、材料包、合成器、闸门。 |
| `src/world/creation/` | 创建世界输入和世界初始化。 |
| `src/world/world-visual-painter/` | 视觉事实清单、AI 候选、ApprovedFrame、质量审核和训练数据边界。 |
| `src/world/game-map-frame/` | GameMapFrame、材料包、RuntimeFrame、合成器和游戏地图闸门。 |
| `data/visual-units/` | 后置 VisualUnit 数据样例；当前不抢 P7 主线。 |

## 6. AI Painter 目录

| 目录 | 职责 |
|---|---|
| `ml/ai-painter/src/` | 小模型、数据集、损失函数、训练工具。 |
| `ml/ai-painter/scripts/` | 训练、推理、导入、修复、归档脚本。 |
| `data/ai-painter-datasets/` | 训练数据集和结构化标注。 |
| `.runtime/ai-painter/generated-results` | 成功、失败、候选、耗时、时间戳、GPU 信息归档。 |
| `.runtime/ai-painter/training-run-archive` | 每一轮完整训练档案，保存参考图、材料图、完整图、报告、模型清单和人工复核状态。 |

## 7. 正式数据和 Runtime 数据

| 目录 | 职责 |
|---|---|
| `data/world-runtime` | 世界 Runtime 当前状态。 |
| `data/world-approved-frames` | 正式 ApprovedFrame 或 RuntimeFrame 记录。 |
| `data/world-rejected-frames` | 被打回的视觉记录。 |
| `.runtime/game-map-runtime-frame` | 本地最新 GameMapRuntimeFrame 输出。 |
| `.runtime/game-map-rejected-runtime-frames` | 本地被打回的 RuntimeFrame。 |
| `.runtime/game-map-material-slot-inference-runs` | 材料槽推理运行结果。 |
| `.runtime/game-map-approved-material-packs` | 已审核材料包。 |
| `.runtime/game-map-runtime-compositor` | 地图合成器输出和审计。 |
| `.runtime/ai-painter/training-run-archive/latest.json` | 最新一轮训练档案索引，必须通过 `npm run check:ai-painter-training-run-archive`。 |

正式数据规则：

| 规则 | 说明 |
|---|---|
| 正式展示只读 RuntimeFrame | `/world` 不能直接从训练目录读图。 |
| 失败记录不能删除 | 失败图是质量迭代和审计数据。 |
| `.runtime` 不等于正式展示源 | `.runtime` 主要是本地运行和训练产物。 |
| `/world` 必须读 RuntimeFrame | 不从训练目录直接读图。 |

## 8. 禁止混用

| 禁止 | 原因 |
|---|---|
| 从 `.runtime/ai-painter/generated-results` 直接喂给 `/world` | 训练归档不是正式世界数据。 |
| 把单张图当地图结构 | 游戏逻辑无法交互、碰撞、动态更新。 |
| 把程序画图 fallback 当正式画面 | 违背本地 AI Painter 目标。 |
| 用图片反推世界事实作为正式数据 | 世界事实必须先存在。 |
| 新建临时方案文档替代计划 | 后续只能改主文档和进度表。 |
