# 项目文档权威索引

更新时间：2026-08-02 22:58:31 +08:00

状态：active-document-governance-index

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 文档职责

| 类型 | 权威文件 | 职责 |
|---|---|---|
| 项目业务 | `docs/BUSINESS_SPEC.md` | 两大核心业务、用户价值和长期业务边界 |
| 项目总体架构 | `docs/ARCHITECTURE.md` | 系统分层、数据流、Runtime和模块边界 |
| 本地AI能力迁移架构 | `docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md` | 本地AI能力、MVP筛选、Codex职能迁移与治理 |
| 唯一模块计划表 | `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md` | 当前模块、模块目标、阻断、完成条件与下一模块 |
| AI Painter正式规格 | `docs/game-world-generation/` | 模型、数据、来源、审核和专项机器合同 |
| 页面与后台规格 | `docs/ai-painter-progress/` | 页面职责、只读/写入边界、API和自动化合同 |
| 世界视觉数据字典 | `docs/world-visual-data-dictionary/` | 视觉事实、标签、失败码和机器审核语义 |
| 人格数据子系统 | `docs/ziwei/` | 紫微斗数、八字与人格映射输入数据 |
| 文档治理 | 本文件、`docs/DOCUMENTATION_POLICY.md` | 文档分类、必备元数据、链接和唯一性规则 |

## 2. 权威顺序

| 优先级 | 来源 | 权限 |
|---:|---|---|
| 0 | 项目所有者当前明确命令 | 批准、拒绝或调整任务范围 |
| 1 | `AGENTS.md` | 强制执行和安全规则 |
| 2 | 业务与总体架构 | 定义长期方向，不决定当前模块进度 |
| 3 | 本地AI能力迁移架构 | 定义能力和职责迁移，不直接授权执行 |
| 4 | 唯一模块计划表 | 唯一模块级进度入口 |
| 5 | 当前模块正式规格 | 定义实现合同与验收标准 |
| 6 | 机器证据与注册表 | 提供每次运行的事实状态，不授予新权限 |

发生冲突时停止并报告冲突，不得自行选择更方便的解释。

## 3. 唯一计划表规则

全项目只允许`docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`承担计划表职责。它只保存当前模块和最近一次模块终态，不保存逐命令历史；只有模块建立、完成、失败关闭或范围实质变化时才更新。

README、AGENTS、业务、架构、页面规格、数据规格和本索引不得出现运行中的临时行动指令、训练流水或授权历史。

## 4. 机器状态边界

每次训练、验证、推理、审核、Owner授权消费、Token、硬件和失败记录保存到`data/`、`.runtime/`与SQLite。控制台从这些机器记录投影状态；Markdown不复制运行事实，也不作为实时状态数据库。

`latest.json`只允许作为指向不可变记录的查询指针。状态投影必须比较任务身份、证据时间和终态优先级，不能因为某个旧指针存在而覆盖更新证据。

## 5. 正式阅读链

```text
DOCUMENT_AUTHORITY_INDEX
-> BUSINESS_SPEC
-> ARCHITECTURE
-> LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE
-> 唯一模块计划表
-> 当前模块对应的一份正式规格
-> 需要时读取机器合同和运行证据
```
