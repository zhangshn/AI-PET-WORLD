# 项目文档权威索引

更新时间：2026-08-24 09:48:00 +08:00

状态：active-document-governance-index

文档版本：`DOCUMENT-AUTHORITY-1.1`

生效日期：`2026-08-24`

替代版本：`DOCUMENT-AUTHORITY-1.0`

文档状态：`active_internal_formal_standard`

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 文档职责

| 类型 | 权威文件 | 职责 |
|---|---|---|
| 项目业务 | `docs/BUSINESS_SPEC.md` | 两大核心业务、用户价值和长期业务边界 |
| 项目总体架构 | `docs/ARCHITECTURE.md` | 系统分层、数据流、Runtime、能力版本、内部任务票据和模块边界 |
| 本地AI能力迁移架构 | `docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md` | 本地AI原生能力、自主裁决、MVP筛选、Codex职能迁移与治理 |
| 唯一模块计划表 | `docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md` | 当前模块、模块目标、阻断、完成条件与下一模块 |
| AI Painter正式主体规格 | `docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | 长期业务责任、输入输出、四段机器接口、稳定需求编号、能力变更、身份链、自动审核、发布与回退边界 |
| AI Painter数据与来源 | `docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md` | 来源、64份批准容量、split、数据包血缘和样本身份 |
| AI Painter审核与存储 | `docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 原生自动审核、自主裁决、内部任务票据、终态、发布、存储和RuntimeFrame生命周期 |
| AI Painter机器合同登记 | `docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md`第17.1节 | 当前长期合同、能力发布受信注册表、历史合同替代索引和唯一机器检查入口 |
| 页面与后台规格 | `docs/ai-painter-progress/` | 页面职责、只读/写入边界、API和自动化合同 |
| 项目目录结构 | `docs/DIRECTORY_STRUCTURE.md` | 逻辑目录职责、数据包根、运行证据和RuntimeFrame目录边界 |
| 世界视觉数据字典 | `docs/world-visual-data-dictionary/` | 视觉事实、标签、失败码和机器审核语义 |
| 人格数据子系统 | `docs/ziwei/` | 紫微斗数、八字与人格映射输入数据 |
| 文档治理 | 本文件、`docs/DOCUMENTATION_POLICY.md` | 文档分类、必备元数据、链接和唯一性规则 |

## 2. 权威顺序

| 优先级 | 来源 | 权限 |
|---:|---|---|
| 0 | 项目所有者当前明确命令 | 调整业务目标、外部执行任务范围、暂停或紧急覆盖；不是本地AI日常运行审批 |
| 1 | `AGENTS.md` | 强制执行和安全规则 |
| 2 | 业务与总体架构 | 定义长期方向，不决定当前模块进度 |
| 3 | 本地AI能力迁移架构 | 定义能力和职责迁移，不直接授权执行 |
| 4 | 唯一模块计划表 | 唯一模块级进度入口 |
| 5 | 当前模块正式规格 | 定义实现合同与验收标准 |
| 6 | 受信能力发布注册表与当前机器合同 | 证明已经完成的能力发布决定并限定日常运行范围；不能产生超出发布身份的新研发权限 |
| 7 | 单次运行机器证据 | 提供每次运行的事实状态，不授予新能力或改变合同 |

发生冲突时停止并报告冲突，不得自行选择更方便的解释。

Owner当前明确命令可以调整业务目标、给Codex等外部执行者限定任务范围，或暂停、紧急覆盖本地系统；聊天本身不是能力发布记录。本地自研AI在生效业务与安全合同内可以自主形成新模型、Loss、数据选择、训练计划和能力版本，完成训练、固定验证、机器审核、RuntimeFrame发布或回退、世界运行和记录。所有能力变更必须形成不可变版本与机器证据，但不得把版本化治理重新解释为逐任务、逐阶段或逐版本的人工审批。

AI Painter的四个生成责任阶段、稳定需求编号、机器合同登记、重大能力变更和正式身份链由总体架构与AI Painter正式主体规格共同定义；一个模型、三个隔离组件或其他模型家族只是可替换实现。唯一计划表记录当前候选状态，不得把实验结构升级为长期业务架构。数据路径以数据与来源规则及目录结构为准，审核、发布与终态以审核与存储规格为准，页面文档不得重新定义业务或训练顺序。

## 3. 唯一计划表规则

全项目只允许`docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`承担计划表职责。它只保存当前模块和最近一次模块终态，不保存逐命令历史；只有模块建立、完成、失败关闭或范围实质变化时才更新。

README、AGENTS、业务、架构、页面规格、数据规格和本索引不得出现运行中的临时行动指令、训练流水或授权历史。

## 4. 机器状态边界

每次训练、验证、推理、审核、能力变更或发布消费、内部票据消费、Token、硬件和失败记录保存到`data/`、`.runtime/`与SQLite。控制台从这些机器记录投影状态；Markdown不复制运行事实，也不作为实时状态数据库。

历史合同保留原始字节和SHA用于复核历史运行，并由替代索引登记后继合同与停用状态。当前能力发布只从正式机器注册表读取；注册表的动态内容属于机器状态，不在长期文档重复声明。发布记录必须由本地系统根据真实数据、模型、审核、Runtime、条件和测试证据原子生成，不能由聊天或自报布尔字段建立。

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

阅读AI Painter时，先从`BUSINESS_SPEC.md`确认它只是本地自研AI的一项视觉能力，再从`ARCHITECTURE.md`读取业务运行、能力版本和Runtime边界，从本地AI能力迁移架构读取执行主体职责，最后进入AI Painter正式主体规格和唯一计划表。历史签名机制只用于复核旧研发运行，不是当前长期授权架构；连续执行、内部票据和自主判断合同只能实现上述业务规则，不能取代权威文档。
