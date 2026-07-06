# AI-PET-WORLD

状态：项目总入口  
更新：2026-07-06

AI-PET-WORLD 是一个“自主世界 + 自主管家 + 本地 AI 视觉生成”的长期运行游戏项目。项目核心不是生成一张地图图片，而是建立一套可运行、可交互、可持续演化的世界系统。

## 项目定义

```txt
程序生成和维护世界事实。
AI Painter 根据结构化世界数据生成视觉表现。
玩家行为和管家行为改变世界状态。
世界状态驱动画面更新。
评审结果进入正负样本库，反哺后续训练。
```

## 当前主线

当前主线已重构为：

```txt
P0 活世界 Schema 收口
```

当前不继续把单张 AI 图、局部图、材料槽图或候选图推进到 `/world`。后续所有工作先按活世界定版方案完成世界数据协议、目录结构、候选归档和 POC-0 验证。

## 绝对规则

| 规则 | 说明 |
|---|---|
| 世界事实优先 | 世界里有什么，必须先由世界事实和规则决定。 |
| AI 只负责视觉表达 | AI Painter 不能决定世界事实，不能凭空新增建筑、人物、动物或资源。 |
| 图片不能反写世界 | 图片画错时只能进入候选失败或负样本，不能修改 WorldState。 |
| 候选图不是样本 | VisualCandidate 必须经人工复核后才能进入正负样本库。 |
| `/world` 只展示正式 Runtime | 训练图、候选图、局部图、失败图、程序占位图不能进入 `/world`。 |
| README 只做入口 | 详细计划、进度、架构和目录结构必须维护在 docs 中。 |

## 正式文档入口

| 文档 | 作用 |
|---|---|
| [项目总计划](./docs/PROJECT_MASTER_PLAN.md) | 项目级主控计划，定义整体阶段、当前主线和模块边界。 |
| [活世界定版技术方案](./docs/live-world/AI_LIVE_WORLD_MVP_TECHNICAL_SPEC.md) | 活世界 MVP 技术架构、P0 Schema、视觉输入、归档、验收和路线。 |
| [活世界目录结构](./docs/live-world/DIRECTORY_STRUCTURE.md) | 活世界文档、代码、数据、候选、样本和 Runtime 的目录边界。 |
| [唯一执行计划表](./docs/EXECUTION_PLAN.md) | 当前可执行计划，后续工作按此推进。 |
| [当前进度表](./docs/PROGRESS.md) | 当前状态、阻塞、下一步和历史阶段记录。 |
| [业务规则说明](./docs/BUSINESS_SPEC.md) | 业务主线、MVP 边界、AI Painter 边界、`/world` 规则。 |
| [业务与技术架构](./docs/ARCHITECTURE.md) | 业务架构图、技术架构图、数据流和模块边界。 |
| [目录结构说明](./docs/DIRECTORY_STRUCTURE.md) | 项目总目录职责。 |

## 当前允许做

```txt
src/world/live-world/types/
src/world/live-world/rules/
src/world/live-world/collision/
src/world/live-world/visual-input/
data/live-world/
data/world-runs/
data/world-visual-candidates/
data/world-samples/
```

## 当前禁止做

```txt
直接继续整图训练
直接把候选图放进 /world
直接接 Runtime 完整展示
直接做自动训练闭环
提前做管家人物、建筑、动物、城市
用程序直绘最终玩家画面
```

