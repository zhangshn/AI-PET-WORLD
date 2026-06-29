# AI-PET-WORLD 目录结构

状态：正式目录说明
更新日期：2026-06-27

## 根目录职责

| 目录 / 文件 | 职责 |
|---|---|
| `README.md` | 项目总入口，只放摘要和文档导航 |
| `docs/` | 业务、架构、目录、计划、进度表 |
| `src/` | Next.js 应用、API、世界 runtime、视觉闸门 |
| `ml/ai-painter/` | 本地自研 AI Painter 小模型、训练脚本、配置 |
| `scripts/` | 检查、构建、归档、ApprovedFrame、数据验证脚本 |
| `data/` | 项目正式数据、ApprovedFrame、VisualUnit 契约样例 |
| `.runtime/` | 本地运行产物、训练产物、候选图、失败图和归档 |

## 页面目录

| 页面 | 职责 | 是否可展示玩家正式画面 |
|---|---|---|
| `src/app/world` | 玩家主世界页面 | 是，但只展示完整游戏 RuntimeFrame / 游戏界面，不直铺单张 ApprovedFrame |
| `src/app/ai-painter-progress` | 本地训练主页 | 否 |
| `src/app/ai-painter-progress/generated-results` | 训练后内容归档页面 | 否 |
| `src/app/ai-painter-progress/local-assets` | 本地资产和数据查看 | 否 |

## API 目录

| API | 职责 |
|---|---|
| `src/app/api/world/*` | 世界创建、tick、正式视觉状态 |
| `src/app/api/ai-painter/training-control` | 启动本地训练动作 |
| `src/app/api/ai-painter/training-progress` | 读取训练进度、GPU、当前批次 |
| `src/app/api/ai-painter/natural-home/[view]` | 查看自然家园训练产物图片 |
| `src/app/api/world/visual/*` | Candidate、Judge、ApprovedFrame、Integrity 等视觉链路 |

## AI Painter 目录

| 目录 | 职责 |
|---|---|
| `ml/ai-painter/configs` | 每轮训练配置，例如 V100R3、V109 配置 |
| `ml/ai-painter/scripts` | 数据准备、训练、生成、筛选、VJ 调用脚本 |
| `ml/ai-painter/src` | 小模型和数据处理代码 |
| `.runtime/ai-painter/*-dataset` | 每轮训练数据集 |
| `.runtime/ai-painter/*-training` | 权重、日志、summary |
| `.runtime/ai-painter/*-generation` | 候选生成图 |
| `.runtime/ai-painter/*-quality-selection` | 质量筛选结果 |
| `.runtime/ai-painter/*-vj1-review` | VJ-1 审核结果 |
| `.runtime/ai-painter/*-vj2-review` | VJ-2 审核结果 |
| `.runtime/ai-painter/generated-results` | 训练后内容归档，成功失败都保留 |

## 当前关键产物

| 产物 | 路径 |
|---|---|
| 当前 ApprovedFrame 记录 | 暂无，`data/world-approved-frames` 当前没有正式可展示帧文件 |
| V109 rejected 记录 | `data/world-rejected-frames/owner-d0znz8/world-d0znz8/rejected-approved-frame-0-approved-frame-world-d0znz8-0.json` |
| V109 rejected 索引备份 | `data/world-rejected-frames/owner-d0znz8/world-d0znz8/rejected-latest-approved-frame-v109.json` |
| V109 生成结果 | `.runtime/ai-painter/natural-home-v109-pure-natural-formal-world-generation` |
| V109 质量筛选 | `.runtime/ai-painter/natural-home-v109-pure-natural-formal-world-quality-selection` |
| V109 formal VJ-1 | `.runtime/ai-painter/natural-home-v109-pure-natural-formal-world-formal-vj1-review` |
| V109 formal VJ-2 | `.runtime/ai-painter/natural-home-v109-pure-natural-formal-world-formal-vj2-review` |
| 训练后结果归档 | `.runtime/ai-painter/generated-results/index.json` |

## 正式展示数据

| 目录 | 用途 | 当前状态 |
|---|---|---|
| `data/world-approved-frames` | 保存通过完整闸门且经项目所有者最终确认的 ApprovedFrame | 当前为空，不能放训练图、候选图、局部图或未最终确认图 |
| `data/world-rejected-frames` | 保存被打回的历史 ApprovedFrame 记录 | V109 已移入此处，仅用于审计、复盘和后续训练参考 |
| `.runtime/world-state` | 本地 runtime 世界状态 | 本地 MVP 使用 |
| `.runtime/ai-painter/generated-results` | 训练归档，不是正式展示源 | 已接通 |

## 禁止混用

| 禁止行为 | 原因 |
|---|---|
| 从 `.runtime/ai-painter/*-generation` 直接读图进 `/world` | 候选图未通过 ApprovedFrame |
| 从 `generated-results` 直接展示到 `/world` | 归档页不等于主世界页 |
| 把 crop/patch/tile/sprite 当正式世界图 | 尺寸和语义都不完整 |
| 把单张 ApprovedFrame 图片直接铺到 `/world` | `/world` 是游戏界面，不是图片展示页 |
| 删除失败图 | 失败图是后续训练和审计数据 |
