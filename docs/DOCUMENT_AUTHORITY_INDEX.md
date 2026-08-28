# 项目文档权威索引

更新时间：2026-08-26 15:30:00 +08:00

状态：active-document-governance-index

文档版本：`DOCUMENT-AUTHORITY-1.4`

生效日期：`2026-08-26`

替代版本：`DOCUMENT-AUTHORITY-1.3`

文档状态：`active_normative_target`

程序符合状态：`program_adoption_pending`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

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
| AI控制台平台总纲 | `docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md` | 整个平台定位、十个一级模块、四个业务Frame、观察/控制平面和稳定需求编号 |
| AI控制台功能规格 | `docs/ai-console/AI_CONSOLE_FUNCTIONAL_SPEC.md` | 用户角色、功能地图、52个二级工作页能力、实现状态和功能验收 |
| AI控制台系统架构 | `docs/ai-console/AI_CONSOLE_ARCHITECTURE_SPEC.md` | 应用壳、查询/控制分层、依赖方向、本地运行、隔离与失败关闭 |
| AI控制台信息架构与UI标准 | `docs/ai-console/AI_CONSOLE_INFORMATION_ARCHITECTURE_AND_UI_STANDARD.md` | 路由层级、固定主体壳、外层大Frame包含内层ModuleFrame、视觉与响应式验收 |
| AI控制台数据与API合同 | `docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md` | 统一字段、连接状态、页面查询合同、空值与错误语义 |
| 页面与后台规格 | `docs/ai-painter-progress/` | 页面职责、只读/写入边界、API和自动化合同 |
| 项目目录结构 | `docs/DIRECTORY_STRUCTURE.md` | 逻辑目录职责、数据包根、运行证据和RuntimeFrame目录边界 |
| 世界视觉数据字典 | `docs/world-visual-data-dictionary/` | 视觉事实、标签、失败码和机器审核语义 |
| 人格数据子系统 | `docs/ziwei/` | 紫微斗数、八字与人格映射输入数据 |
| 文档治理 | 本文件、`docs/DOCUMENTATION_POLICY.md` | 文档分类、必备元数据、链接和唯一性规则 |

## 2. 唯一Owner规则与权威顺序

### GOV-OWNER-001：Owner不进入本地AI正常运行状态机

本规则是全项目关于Owner职责的唯一权威定义：

> Owner负责设定或主动修改长期业务目标、观察系统、主动暂停和紧急停止；Owner不是本地AI的训练、验证、审核、能力发布、Checkpoint、Stage推进、正式推理、RuntimeFrame或世界运行审批者。本地AI在当前生效的业务、来源、资源、安全和Runtime合同内自主完成上述动作，程序不得生成等待Owner授权、签名、批准或响应的正常状态。

规则适用边界固定为：

| 主体或情况 | 正式规则 |
|---|---|
| 本地自研AI与本地程序 | 在生效项目合同内拥有常驻自主运行权，不逐任务、逐阶段、逐版本或逐次运行请求Owner |
| Owner | 可以主动修改业务目标、观察、暂停或紧急停止；这些是项目控制，不是任务审批 |
| Codex及其他外部智能体 | 只能执行Owner当前明确委托的建设或诊断任务，不继承本地AI常驻运行权 |
| 未定义付费、许可、法律或不可恢复动作 | 程序禁止执行、保存证据并选择安全替代路线或失败关闭；只报告，不等待审批 |

当前或后继文档、机器合同、状态机、程序、控制台和运行证据不得定义`waiting_owner_*`、`owner_action_request`、`owner_release_decision`、`owner_signature_required`或语义等价的正常运行门。历史记录中的同名字段只用于复核旧运行，不得授予当前权限。

### 2.1 权威顺序

| 优先级 | 来源 | 权限 |
|---:|---|---|
| 0 | `GOV-OWNER-001`及Owner主动业务目标变更 | 定义Owner、本地AI和外部执行者边界；Owner命令可调整业务目标、外部执行任务范围、暂停或紧急覆盖，但不成为本地AI日常审批 |
| 1 | `AGENTS.md` | 强制执行和安全规则 |
| 2 | 业务与总体架构 | 定义长期方向，不决定当前模块进度 |
| 3 | 本地AI能力迁移架构 | 定义能力和职责迁移，不直接授权执行 |
| 4 | 唯一模块计划表 | 唯一模块级进度入口 |
| 5 | 当前模块正式规格 | 定义实现合同与验收标准 |
| 6 | 完成程序迁移并通过机器回归后的能力发布注册表与符合性合同 | 证明已经完成的机器能力发布并限定日常运行范围；当前迁移前旧合同不得占用此权威层级 |
| 7 | 单次运行机器证据 | 提供每次运行的事实状态，不授予新能力或改变合同 |

发生冲突时停止并报告冲突，不得自行选择更方便的解释。

Owner当前明确命令可以主动调整业务目标、给Codex等外部执行者限定任务范围，或暂停、紧急覆盖本地系统；聊天本身不是能力发布记录。本地自研AI按`GOV-OWNER-001`在生效业务与安全合同内自主形成新模型、Loss、数据选择、训练计划和能力版本，完成训练、固定验证、机器审核、RuntimeFrame发布或回退、世界运行和记录。所有能力变更必须形成不可变版本与机器证据，但不得把版本化治理重新解释为逐任务、逐阶段或逐版本的人工审批。

AI Painter的四个生成责任阶段、稳定需求编号、机器合同登记、重大能力变更和正式身份链由总体架构与AI Painter正式主体规格共同定义；一个模型、三个隔离组件或其他模型家族只是可替换实现。唯一计划表记录当前候选状态，不得把实验结构升级为长期业务架构。数据路径以数据与来源规则及目录结构为准，审核、发布与终态以审核与存储规格为准，页面文档不得重新定义业务或训练顺序。

## 3. 唯一计划表规则

全项目只允许`docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md`承担计划表职责。它只保存当前模块和最近一次模块终态，不保存逐命令历史；只有模块建立、完成、失败关闭或范围实质变化时才更新。

README、AGENTS、业务、架构、页面规格、数据规格和本索引不得出现运行中的临时行动指令、训练流水或授权历史。

## 4. 机器状态边界

每次训练、验证、推理、审核、能力变更或发布消费、内部票据消费、Token、硬件和失败记录保存到`data/`、`.runtime/`与SQLite。控制台从这些机器记录投影状态；Markdown不复制运行事实，也不作为实时状态数据库。

历史合同保留原始字节和SHA用于复核历史运行，并由替代索引登记后继合同与停用状态。当前能力发布只从正式机器注册表读取；注册表的动态内容属于机器状态，不在长期文档重复声明。发布记录必须由本地系统根据真实数据、模型、审核、Runtime、条件和测试证据原子生成，不能由聊天或自报布尔字段建立。

`latest.json`只允许作为指向不可变记录的查询指针，不得作为当前任务选择算法。当前任务、当前活动执行、最近训练终态和用户选中的历史Run是四个不同身份，必须分别存储和投影：

| 身份 | 含义 | 不得影响 |
|---|---|---|
| `currentProjectTask` | 项目当前正在推进的唯一任务，可以是训练、验证、审核、裁决或下一候选规划 | 不由历史列表选择或旧命名空间改写 |
| `activeExecution` | 存在有效任务锁、活动进程和未过期心跳的当前执行 | 不由历史`running`文件或GPU利用率推测 |
| `latestTrainingTerminal` | 最近一次训练执行的不可变成功或失败终态 | 不直接代表当前项目任务 |
| `selectedHistoricalRun` | 用户在只读控制台中选择的历史记录 | 不得改写前三项身份或任何机器状态 |

项目只允许一个由本地编排器维护的当前执行登记。登记必须使用单调`registryRevision`和`eventSequence`，绑定能力版本、执行包、任务、Run、生命周期、状态、证据路径与SHA-256及前任身份。文件指针、追加事件和SQLite索引必须作为一个可恢复事务更新。任意路径、哈希、任务或修订不一致时，状态必须显示`unknown_or_stale`并记录证据冲突；不得扫描其他历史目录后选取一条旧记录作为降级结果。

当前身份的选择不得使用“Smoke优先”、“Stage优先”、“首个存在的目录优先”或其他来源类型固定优先级。新的合法裁决或候选规划可以在训练失败后成为`currentProjectTask`，同时失败训练仍保留为`latestTrainingTerminal`。历史记录仅在用户只读查询时成为`selectedHistoricalRun`；除非本地系统建立新执行身份和明确恢复事件，否则历史Run不得重新成为当前执行。

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

阅读AI控制台时，先读取本文件和项目总体架构，再按`docs/ai-console/README.md`规定的顺序读取平台总纲、功能规格、系统架构、信息架构与UI标准、数据字典与API合同，最后核对`docs/DIRECTORY_STRUCTURE.md`。AI控制台覆盖整个本地自研AI平台；`docs/ai-painter-progress/`及`src/app/ai-painter-progress/`与新平台完全解耦，不得定义、承载或作为新平台一级、二级目录的下游页面。

## 6. 文档基线验收与程序符合状态

文档是否生效与程序是否已全部实现是两个独立结论：

| 字段或结论 | 严格含义 |
|---|---|
| `文档状态：active_normative_target` | 当前文档是开发、测试和机器合同必须遵循的正式目标标准，不是草案。 |
| `程序符合状态：program_adoption_pending` | 程序尚未能对整份规范声明全量符合；已接入和未接入项必须以稳定需求追踪表逐项判定，不得把该字段解释为“程序零实现”或“文档尚未生效”。 |
| 文档基线验收通过 | 权威层级唯一、Owner职责唯一、状态机一致、现行与历史合同隔离、身份关系一致、需求可追踪且链接、编码和文档集通过本地检查。 |
| 能力发布或模型通过 | 只能由数据、模型、审核、Runtime、条件、测试和程序血缘的真实不可变机器证据得出；文档检查通过不等于模型或能力通过。 |

AI Painter正式文档基线的必须检查项固定为：

1. `GOV-OWNER-001`在权威文档中只定义一次，其他文档只引用，不另建Owner职责。
2. 能力、单次执行和机器审核三层状态机使用总体架构的唯一枚举及映射。
3. `currentProjectTask`、`activeExecution`、`latestTrainingTerminal`和`selectedHistoricalRun`分离，当前任务不得从历史目录推测。
4. 现行合同只能从正式登记路径读取；历史合同保留原始字节和SHA-256，只能经替代索引用于旧运行复核，不得参与当前解析、候选选择或权限建立。
5. 四个内部责任阶段与Stage 0/1/2训练分辨率阶段必须分离。
6. 23通道为版本化条件合同；12通道潜变量仅为当前能力实现值，不得固化为长期业务参数。
7. 37条稳定需求在定义和追踪表中一一对应；文档、机器合同、程序、测试和运行证据的缺口必须显式标记。
8. 唯一计划表只记录当前模块状态；长期文档不得复制Run、Epoch、临时失败和操作指令。

上述检查全部通过后，可以宣告“当前正式文档基线一致”；仍不得宣告“全部程序已符合”、“AI Painter能力已发布”或“Stage4已突破60%”。
