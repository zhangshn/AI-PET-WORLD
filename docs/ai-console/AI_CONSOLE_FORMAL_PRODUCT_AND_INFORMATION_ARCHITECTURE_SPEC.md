# AI控制台正式产品、信息架构与统一数据字典规格

更新时间：2026-08-28 19:30:00 +08:00

状态：active-normative-target

文档版本：`AI-CONSOLE-1.7`

生效日期：`2026-08-27`

替代版本：`AI-CONSOLE-1.6`

文档状态：`active_normative_target`

程序符合状态：`v7_formal_evidence_index_connected`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 目的与产品定位

AI控制台是AI-PET-WORLD本地自研AI系统的统一操作、观察、审核和治理入口。它覆盖当前AI Painter视觉能力，并为文字与语言、语音与音频、视频和多模态能力预留同一套可扩展平台边界。

AI控制台不是单一训练页面，也不是Codex任务页面。它必须在Codex、聊天窗口和外部智能体全部关闭时，继续读取本地系统状态，并在后续控制能力接入后由本地程序完成任务执行、训练、验证、审核、能力发布、世界运行、失败关闭、人工控制和证据保存。

本规格固定以下产品关系：

```text
AI控制台（本地自研AI平台入口）
├─ AI Painter（当前视觉能力域，由新平台十模块完整承载）
├─ 文字与语言（未来能力域）
├─ 语音与音频（未来能力域）
├─ 视频（未来能力域）
└─ 多模态（未来能力域）
```

## 2. 权威边界

1. Owner职责只引用`docs/DOCUMENT_AUTHORITY_INDEX.md`中的`GOV-OWNER-001`，本规格不建立逐任务、逐训练、逐Stage或逐发布人工审批。
2. 本地自研AI在生效业务、安全、资源、数据和Runtime合同内自主运行。
3. 人工控制是本地操作员主动干预的独立控制平面，不是自动运行的必经握手。
4. Codex及其他外部智能体不属于正式运行链、状态数据库、权限系统、审核器或发布器。
5. 控制台不得把Markdown、浏览器状态、聊天内容、目录修改时间或格式正确的SHA字符串当作实时事实。
6. 当前任务、活动执行、最近训练终态和用户选择的历史Run必须保持独立身份。
7. 旧`/ai-painter-progress/`可以继续独立存在，但新AI控制台不得导航、嵌入、读取、调用或把它作为任何模块的下游内容。

## 3. 产品平面

### 3.1 观察平面

观察平面只读取本地程序和不可变证据，不改变任务状态：

```text
状态
进度
指标
模型与数据身份
审核结果
图片与多媒体产物
资源遥测
事件与日志
证据与归档
```

AP-01至AP-09主要属于观察平面。即使后续部分页面提供创建任务或能力管理入口，其写操作也必须转入独立控制服务，页面本身不得直接修改文件、数据库、进程或Checkpoint。

### 3.2 控制平面

AP-10是独立控制平面：

```text
提交控制意图
→ 本地身份与角色验证
→ 目标状态和合同校验
→ 幂等与冲突检查
→ 命令排队
→ 本地编排器执行
→ 结果终态和证据落盘
```

浏览器不得直接执行Shell、杀进程、改JSON、改SQLite、移动Checkpoint、修改审核结论或绕过本地编排器。

## 4. 一级页面与路由

### 4.1 唯一一级入口

```text
/ai-console
```

代码目录：

```text
src/app/ai-console/
```

页面正式名称固定为：

```text
AI控制台
```

### 4.2 一级模块

| 编号 | 一级模块 | 稳定路由 | 平面 | 业务职责 |
|---|---|---|---|---|
| AP-01 | 任务与执行中心 | `/ai-console/tasks` | 观察为主 | 展示当前项目任务、活动执行、任务队列、自动闭环状态和执行拓扑。 |
| AP-02 | 能力建设中心 | `/ai-console/capabilities` | 观察为主 | 管理能力域、候选版本、资格链、发布身份、回退关系和能力迁移状态。 |
| AP-03 | 训练与模型中心 | `/ai-console/training` | 观察为主 | 由新平台自身汇总训练计划、模型结构、Stage、指标、Checkpoint、资源与训练历史。 |
| AP-04 | 验证与机器审核中心 | `/ai-console/reviews` | 观察平面 | 展示验证过程、审核节点、审核器身份、失败码、终态和证据完整性。 |
| AP-05 | 数据与条件中心 | `/ai-console/data` | 观察平面 | 管理数据发布、split、样本、条件Schema、来源许可、质量和数据字典。 |
| AP-06 | 世界生成与Runtime中心 | `/ai-console/runtime` | 观察为主 | 展示WorldFacts绑定、生成任务、候选、RuntimeFrame、发布和世界消费状态。 |
| AP-07 | 证据与治理中心 | `/ai-console/evidence` | 观察平面 | 查询不可变证据、SHA-256、事件账本、任务胶囊、SQLite事务和政策边界报告。 |
| AP-08 | 系统资源与后台服务 | `/ai-console/system` | 观察为主 | 展示GPU、CPU、内存、磁盘、后台服务、心跳、队列和资源策略。 |
| AP-09 | 历史归档与全局检索 | `/ai-console/archive` | 观察平面 | 按能力、任务、Run、模型、数据、时间和终态检索历史记录，不影响当前身份。 |
| AP-10 | 操作与安全控制中心 | `/ai-console/control` | 控制平面 | 提供本地人工任务、训练、审核、能力、世界、资源与紧急控制。 |

一级页面只承担平台总览、能力域选择、一级模块导航、关键边界说明和现有专用控制台入口。它不得复制所有二级模块数据，也不得直接执行控制命令。

### 4.3 业务大框架

一级模块不得在视觉和信息结构上作为十个彼此无关的独立卡片平铺。一级页面必须先建立以下四个业务大框架，再将一级模块嵌套其中：

| 框架 | 名称 | 内部模块 | 业务闭环 |
|---|---|---|---|
| FRAME-01 | 自主任务与能力闭环 | AP-01、AP-02、AP-03、AP-04 | 任务建立→能力建设→训练→验证与机器审核。 |
| FRAME-02 | 数据、生成与世界运行 | AP-05、AP-06 | 数据与条件→生成候选→RuntimeFrame→世界消费。 |
| FRAME-03 | 平台基础设施与可追溯治理 | AP-07、AP-08、AP-09 | 证据→资源与服务→历史归档与检索。 |
| FRAME-04 | 人工操作与安全控制 | AP-10 | 主动人工控制→本地命令状态机→结果证据。 |

框架之间表达业务依赖，模块内部表达职责，二级目录表达具体工作区。一级页面必须同时提供左侧稳定导航和中部框架工作区，使用户能够从全局结构进入具体模块，而不是通过滚动卡片墙理解系统。

## 5. 二级目录定版

### AP-01 任务与执行中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 当前项目任务 | `/ai-console/tasks/current` | `currentProjectTask`、任务目标、能力域、生命周期、阻断、下一机器动作。 |
| 活动执行 | `/ai-console/tasks/active` | `activeExecution`、PID、心跳、Run、进程、阶段、进度和执行锁。 |
| 任务队列 | `/ai-console/tasks/queue` | 排队、调度、优先级、资源等待和取消状态。 |
| 闭环拓扑 | `/ai-console/tasks/flows` | 规划、实施、训练、验证、审核、发布、失败关闭之间的状态图。 |
| 任务记录 | `/ai-console/tasks/history` | 任务定义、执行修订、终态和不可变证据入口。 |

### AP-02 能力建设中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 能力域 | `/ai-console/capabilities/domains` | AI Painter及未来能力域的责任、输入输出和当前状态。 |
| 候选版本 | `/ai-console/capabilities/candidates` | 候选模型、训练范式、数据版本和资格阶段。 |
| 资格链 | `/ai-console/capabilities/qualification` | CPU、只读GPU、Smoke、Stage、审核和Runtime资格。 |
| 发布版本 | `/ai-console/capabilities/releases` | 已发布能力身份、绑定证据、活动版本、前序版本和回退关系。 |
| 职能迁移 | `/ai-console/capabilities/migration` | 本地程序对外部研发能力的接管范围和机器验收状态。 |

### AP-03 训练与模型中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 训练总览 | `/ai-console/training/overview` | 当前训练、Stage、Epoch、Batch、优化步、Loss、ETA和资源。 |
| 训练计划 | `/ai-console/training/plans` | 冻结配置、数据划分、种子、分辨率、Epoch和阶段依赖。 |
| 模型结构 | `/ai-console/training/models` | 模型家族、组件、参数、输入输出、能力版本和状态哈希。 |
| Checkpoint | `/ai-console/training/checkpoints` | 身份、资格、来源Stage、选择分数、晋级和禁止复用状态。 |
| 训练历史 | `/ai-console/training/runs` | Run、指标、预览、终态、Manifest、Finalization和资源遥测。 |

### AP-04 验证与机器审核中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 当前验证 | `/ai-console/reviews/current` | 验证阶段、节点、进度、审核器、输入身份和实时事件。 |
| 审核结果 | `/ai-console/reviews/results` | 每节点通过/失败、失败码、区域、指标、阈值合同和终态。 |
| 证据查看 | `/ai-console/reviews/evidence` | 原始预览、规范化副本、SHA-256、参考来源和复现关系。 |
| 审核合同 | `/ai-console/reviews/contracts` | 审核器版本、指标定义、冻结阈值和适用能力域。 |
| 失败分类 | `/ai-console/reviews/failures` | 视觉失败、身份冲突、基础设施故障、证据不足和政策边界。 |

### AP-05 数据与条件中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 数据发布 | `/ai-console/data/releases` | 发布准入、来源许可、容量与split门禁；正式发布身份只从独立机器登记读取。 |
| 样本目录 | `/ai-console/data/samples` | 样本身份、能力域、模态、条件、标签、对象掩码和质量。 |
| 条件Schema | `/ai-console/data/conditions` | 字段/通道顺序、类型、范围、缺失规则和重采样规则。 |
| 统一数据字典 | `/ai-console/data/dictionary` | 全平台实体、字段、枚举、单位、来源、敏感级别和兼容规则。 |
| 数据质量 | `/ai-console/data/quality` | 完整性、一致性、分布、重复、泄漏、漂移和异常门禁；真实结论只从质量报告登记读取。 |

### AP-06 世界生成与Runtime中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 权威事实绑定 | `/ai-console/runtime/facts` | WorldFacts、VisualFactManifest、world/region/tick/factHash身份。 |
| 生成任务 | `/ai-console/runtime/generations` | 能力版本、条件包、候选、推理进度和生成终态。 |
| 候选审核 | `/ai-console/runtime/candidates` | 候选身份、机器审核、拒绝码和发布资格。 |
| RuntimeFrame | `/ai-console/runtime/frames` | Frame候选、正式Frame、发布身份、回退和世界消费。 |
| 世界运行 | `/ai-console/runtime/world` | 当前世界视觉版本、消费状态、暂停、冻结和恢复事实。 |

### AP-07 证据与治理中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 证据浏览 | `/ai-console/evidence/artifacts` | 默认读取V7独立证据索引中的内容寻址身份、逻辑路径、原始字节摘要、来源修订、登记事务和哈希链；其他视图显示证据类型、不可变性、完整性与保留合同。 |
| 事件账本 | `/ai-console/evidence/events` | 当前接入新控制台V5后安全命令的单调事件、状态转换、哈希因果链、事务身份和回执证据；不扫描旧运行目录。 |
| 任务胶囊 | `/ai-console/evidence/capsules` | 任务目标、能力、输入、执行、终态和政策边界。 |
| 数据库事务 | `/ai-console/evidence/transactions` | 默认展示V6后新控制台安全命令的SQLite控制提交事务；其他视图展示身份准备、文件、事件、SQLite、恢复和冲突门禁。 |
| 政策边界 | `/ai-console/evidence/policies` | 长期目标、来源许可、外部费用、不可恢复操作、安全上限和审计真实性的禁止动作、失败关闭、保留要求与安全替代路线；真实报告只从独立报告索引读取。 |

### AP-08 系统资源与后台服务

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 资源总览 | `/ai-console/system/resources` | CPU、内存、GPU、显存、磁盘和任务占用。 |
| 后台服务 | `/ai-console/system/services` | 服务身份、PID、启动方式、心跳、状态和最近错误。 |
| 任务调度 | `/ai-console/system/scheduler` | 资源队列、优先级、时间窗口和容量策略。 |
| 健康检查 | `/ai-console/system/health` | Python、CUDA、Node、数据库、磁盘和证据目录健康。 |
| 遥测历史 | `/ai-console/system/telemetry` | 资源采样、峰值、趋势和异常，不以控制台文本替代证据。 |

### AP-09 历史归档与全局检索

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 全局检索 | `/ai-console/archive/search` | 按统一身份、时间、状态、能力、数据和SHA-256搜索。 |
| 训练归档 | `/ai-console/archive/training` | 历史训练Run、Checkpoint身份、预览、指标和终态。 |
| 审核归档 | `/ai-console/archive/reviews` | 历史验证批次、审核节点、失败码和证据。 |
| 生成归档 | `/ai-console/archive/generations` | 候选、RuntimeFrame、发布和回退历史。 |
| 历史合同 | `/ai-console/archive/contracts` | 只读复核已停用合同、SHA-256和替代关系，不参与当前解析。 |

### AP-10 操作与安全控制中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 任务控制 | `/ai-console/control/tasks` | 启动已登记任务、暂停/恢复队列、优先级和取消未启动任务。 |
| 训练控制 | `/ai-console/control/training` | 启动合格训练、在安全点暂停、合法恢复、安全停止和时间窗口。 |
| 验证控制 | `/ai-console/control/reviews` | 启动正式验证、重跑只读审核、重建投影和检查证据。 |
| 能力控制 | `/ai-console/control/capabilities` | 激活合格能力、停用、合法回退和自动更新开关。 |
| 世界控制 | `/ai-console/control/world` | 暂停/恢复Frame发布、回退正式Frame和冻结视觉更新。 |
| 资源控制 | `/ai-console/control/resources` | 设置合同允许的资源窗口和上限、管理安全缓存与服务。 |
| 紧急控制 | `/ai-console/control/emergency` | 紧急停止、冻结新任务、冻结世界发布并保存现场证据。 |

## 6. 能力域扩展合同

### 6.1 能力域枚举

| `capabilityDomain` | 中文名称 | 当前接入状态 | 主要产物 |
|---|---|---|---|
| `visual_world_generation` | AI Painter | 当前能力域 | 完整地图RGB、审核、RuntimeFrame。 |
| `text_and_language` | 文字与语言 | 接口预留 | 文本生成、理解、知识与对话产物。 |
| `speech_and_audio` | 语音与音频 | 接口预留 | 语音、音频、识别、合成与审核产物。 |
| `video_generation` | 视频 | 接口预留 | 视频候选、时间一致性审核与发布产物。 |
| `multimodal_orchestration` | 多模态 | 接口预留 | 跨模态任务、联合证据和组合发布产物。 |

新增能力域不得复制一套控制台。必须复用任务、能力、数据、训练、审核、证据、资源、归档和控制十个一级模块，并通过`capabilityDomain`、`modality`和版本化Schema隔离。

### 6.2 模态枚举

```text
image
text
language
speech
audio
video
multimodal
structured_world_fact
runtime_frame
```

## 7. 统一数据字典

### 7.1 字典定位

统一数据字典是未来数据库、API、事件、文件证据和控制台字段的基础语义源。任何页面不得自行发明同义字段、状态或单位。机器Schema可分版本演进，但必须引用稳定`dictionaryEntryId`和兼容关系。

### 7.2 每个字典条目的必备字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `dictionaryEntryId` | string | 是 | 稳定、唯一、不可复用的字段定义身份。 |
| `canonicalName` | string | 是 | API、数据库和机器证据使用的唯一英文名称。 |
| `displayNameZh` | string | 是 | 控制台中文名称。 |
| `domain` | enum | 是 | task/capability/training/review/data/runtime/evidence/system/archive/control。 |
| `dataType` | enum | 是 | string/integer/number/boolean/enum/timestamp/object/array/path/sha256。 |
| `nullable` | boolean | 是 | 是否允许空值；未知值不得使用0或空字符串冒充。 |
| `unit` | string/null | 是 | 单位；无单位明确为null。 |
| `enumValues` | array/null | 是 | 枚举及语义；非枚举为null。 |
| `sourceOfTruth` | string | 是 | 权威机器来源或Schema路径。 |
| `writerIdentity` | string | 是 | 唯一允许写入的本地服务类型。 |
| `updateSemantics` | enum | 是 | immutable/append_only/monotonic_revision/replaceable_projection。 |
| `sensitivity` | enum | 是 | public/local_internal/restricted/secret。 |
| `validationRule` | string | 是 | 格式、范围、关系和完整性规则。 |
| `introducedIn` | string | 是 | 首次出现的Schema版本。 |
| `deprecatedIn` | string/null | 是 | 停用版本；未停用为null。 |
| `supersededBy` | string/null | 是 | 后继条目身份。 |

### 7.3 全局身份字段

| 字段 | 类型 | 语义 |
|---|---|---|
| `capabilityDomain` | enum | 能力域，决定业务责任，不决定单次状态。 |
| `capabilityVersionId` | string | 不可变能力版本身份。 |
| `capabilityReleaseIdentity` | string | 本地系统根据完整资格证据原子登记的发布身份。 |
| `taskId` | string | 稳定任务定义身份。 |
| `executionId` | string | 单次执行身份。 |
| `runId` | string | 训练、验证或推理运行身份。 |
| `stageId` | string | 执行阶段身份；不得与训练分辨率Stage混淆。 |
| `datasetReleaseIdentity` | string | 不可变数据发布身份。 |
| `conditionSchemaId` | string | 版本化条件Schema身份。 |
| `modelIdentity` | string | 模型结构、参数和版本的联合身份。 |
| `checkpointIdentity` | string | Checkpoint内容、来源和资格的联合身份。 |
| `validationRunId` | string | 独立验证运行身份。 |
| `reviewRunId` | string | 机器审核运行身份。 |
| `evidenceId` | string | 不可变证据身份。 |
| `runtimeFrameCandidateIdentity` | string | 单次RuntimeFrame候选身份。 |
| `publishIdentity` | string | 正式发布事务身份。 |
| `commandId` | string | 人工控制命令身份。 |

### 7.4 通用完整性字段

| 字段 | 类型 | 规则 |
|---|---|---|
| `schemaVersion` | string | 必须在对应Schema注册表中存在。 |
| `status` | enum | 必须使用所属状态机枚举，禁止跨层复用。 |
| `createdAtUtc` | timestamp | ISO 8601 UTC，精度到毫秒。 |
| `updatedAtUtc` | timestamp/null | 只用于可修订投影；不可变证据为null。 |
| `timestampAsiaShanghai` | timestamp/string | 展示投影字段，不替代UTC源值。 |
| `writerIdentity` | string | 必须属于受信本地写入器注册表。 |
| `registryRevision` | integer | 单调递增，不得回退。 |
| `eventSequence` | integer | 追加事件的单调序号。 |
| `transactionId` | string | 文件、事件和SQLite一致性事务身份。 |
| `evidencePath` | path | 项目逻辑相对路径，禁止调用方外部绝对路径。 |
| `evidenceSha256` | sha256 | 真实文件重新计算的小写64位十六进制摘要。 |
| `failureCode` | string/null | 失败时必须使用登记失败码；成功时为null。 |
| `failureDetail` | object/null | 保存具体原因、范围和证据，禁止只写“失败”。 |

### 7.5 核心数据库实体

未来数据库至少使用以下稳定实体边界；物理表名可以按存储引擎映射，但不得合并不同生命周期：

```text
ai_capability_domain
ai_capability_version
ai_capability_release
ai_task_definition
ai_task_execution
ai_execution_event
ai_training_run
ai_training_stage
ai_model_identity
ai_checkpoint_identity
ai_validation_run
ai_machine_review_run
ai_review_node_result
ai_dataset_release
ai_dataset_record
ai_condition_schema
ai_evidence_artifact
ai_runtime_generation
ai_runtime_frame
ai_resource_sample
ai_background_service
ai_control_command_definition
ai_control_command_request
ai_control_command_validation
ai_control_command_execution
ai_control_command_event
ai_control_target_lock
ai_emergency_stop_state
ai_manual_override_record
```

### 7.6 状态机分层

以下状态不得混成一个`status`含义：

1. 能力生命周期：设计、实施、CPU资格、只读GPU资格、Smoke、Stage、发布、活动、回退、退出。
2. 任务执行：created、queued、preflighting、running、validating、reviewing、finalizing、succeeded、failed_closed、cancelled。
3. 训练运行：initializing、training、checkpointing、completed、failed_closed、safely_stopped。
4. 机器审核：pending、running、passed、failed、evidence_conflict。
5. Runtime发布：candidate、reviewing、qualified、published、rolled_back、rejected。
6. 人工控制命令：created、validating、accepted、queued、executing、succeeded、rejected、cancelled、failed_closed、expired、superseded_by_emergency_stop。

状态投影必须同时返回状态层级和来源身份，禁止仅显示“运行中”或“失败”而不说明主体。

## 8. 人工控制合同

### 8.1 业务定位

人工控制用于主动启动已登记任务、暂停、恢复、安全停止、调度、只读验证、状态重投影、合法能力回退、Runtime冻结和本地故障处理。即使没有人工操作，系统也必须持续自主运行。

人工控制不得用于逐Epoch批准、逐Stage签名、逐产物批准、代写机器通过、绕过失败、降低阈值、改写证据、使用失败Checkpoint、直接修改WorldFacts或绕过发布合同。

### 8.2 本地角色

```text
viewer
operator
system_administrator
emergency_operator
```

权限必须由本地服务端复核，不能通过隐藏前端按钮实现。

### 8.3 命令必备字段

```text
commandId
commandType
targetType
targetId
targetRunId
targetCapabilityId
requestedBy
requestedAtUtc
reasonCode
reasonText
expectedStateRevision
expectedRegistryRevision
idempotencyKey
parameterSchemaId
parameters
validationStatus
executionStatus
executorIdentity
queuedAtUtc
startedAtUtc
finishedAtUtc
resultTerminalId
resultEvidencePath
resultEvidenceSha256
failureCode
```

AP-10二级页面当前接入29条正式命令定义、目标类型、角色、验证规则、参数Schema和安全边界。其中只为`verify_primary_registry`登记`ai_console_primary_registry_verifier_v1`安全执行器；它通过独立控制服务核验新平台主登记并写入不可变幂等回执。验证控制页允许按完整命令身份精确复核该回执，服务端重新验证固定字段、身份、终态组合和摘要后才返回完整性状态；不得扫描目录生成历史列表。其余命令的执行器身份为空，不创建提交控件、不排队命令、不改变本地状态。

## 9. 数据源与投影

1. 一级页面可以静态展示模块架构和接入状态，但不得伪造实时任务、资源或审核数据。
2. 后续实时总览必须从受信查询服务读取，查询服务再验证当前执行登记和不可变证据。
3. 当前状态不得通过扫描历史目录、目录时间、命名优先级或首个可读文件推测。
4. 历史选择只影响历史工作区，不改变当前任务、活动执行、最近终态或下一机器动作。
5. 数据缺失显示“未接入”或“未记录”，不得显示0、成功、空闲或最新作为默认推测。
6. 所有写操作必须进入本地命令状态机；页面GET查询和观察平面组件保持只读。

### 9.1 新平台页面查询合同API

新AI控制台先建立完全独立于旧页面和旧API的页面合同查询层：

```text
GET /api/ai-console/catalog
GET /api/ai-console/workspaces/{moduleSlug}/{workspaceSlug}?view={workArea}
```

1. `catalog`只返回新平台能力域、四大框架、十个模块、52个工作页及目录完整性，不返回旧训练页面目录。
2. `workspaces`校验模块、工作页和页面内视图身份，并返回主要实体、允许视图、筛选字段、来源与更新语义。
3. 页面合同连接成功使用`contractStatus=ready`；这不等于权威数据源已连接。
4. 权威业务投影未接入时固定使用`dataStatus=not_connected`、`records=null`和`total=null`，不得返回空数组或0冒充真实空结果。
5. 未知模块、工作页或不属于当前工作页的视图必须返回4xx并保持无副作用。
6. 此API不得导入、转发或调用`/api/ai-painter/`、`/ai-painter-progress/`或旧训练页面服务。
7. AP-03、AP-04和AP-09只读取固定的新平台主登记；完整性通过后的真实空登记返回`connected · 0`，不得回退旧目录填充。
8. AP-10命令定义可以由同一工作页查询API返回；执行器身份为空时必须返回部分接入且无写入能力。唯一安全执行器只能通过`/api/ai-console/control/`进入回环会话、同源、CSRF、目标修订与幂等校验链。

## 10. 一级页面视觉与交互标准

### 10.1 必备区域

```text
产品标题与业务定位
运行边界摘要
能力域选择区
四个业务大框架及其内部十个一级模块目录
统一数据字典基础说明
观察平面与控制平面边界
本地独立运行说明
新平台自身的训练总览、计划、模型、Checkpoint与历史入口
当前页面接入状态
```

### 10.2 交互规则

1. 一级页面必须采用专业应用外壳，至少包含顶部运行上下文、左侧一级导航、中部业务工作区和右侧平台上下文，不得实现为独立营销卡片墙；桌面端顶部栏与左侧目录必须固定为主体框架，文档根不随业务内容滚动，中部工作区与右侧上下文在框架内独立滚动。
2. 中部工作区必须先显示四个业务大框架，再在每个大框架内部嵌套对应一级模块；一级模块必须显示编号、名称、平面、职责、稳定路由和二级目录摘要。
3. 已实施的二级内容工作页必须使用稳定路由并从一级目录直接进入；实时查询未接入时必须明确显示“数据未接入”，不得用模拟任务、虚构指标或目录时间填充。
4. 新平台不得导航或嵌入旧训练页面；AP-03的所有内容必须由`/ai-console/training/*`稳定路由独立承载。
5. 控制模块必须采用与观察模块可辨识的视觉样式；已登记执行器显示精确执行边界和结果回执，未登记命令明确显示执行器禁用。
6. 页面必须支持桌面与小屏访问；文本、标签和状态不得依赖颜色作为唯一表达。
7. 用户页面使用“本地自主闭环”和“本地独立运行”等业务语言，不显示Codex Token、聊天状态、外部授权或外部工具是否运行。

### 10.3 二级页面业务工作台标准

1. 每个二级页面必须呈现与该业务实体对应的视图目录，不得只复制通用说明卡片。
2. 页面首个工作区必须固定查询合同摘要，包括关键查询维度、机器字段名、数据类型和连接状态。
3. 查询服务未接入时必须使用可信空状态，明确预期实体、默认视图和未连接状态，不得创建示例记录填充表格。
4. 页面必须固定记录详情结构，包括主要实体、权威来源、更新语义和稳定路由。
5. 页面必须显示状态事实链、所属状态机、规范状态字段和事实裁决规则；页面投影不得覆盖权威登记。
6. 字段面板至少显示机器字段、中文名称、数据类型、字段角色和空值规则，并由统一目录生成。
7. 观察页和控制合同页复用同一信息骨架；只有已登记执行器对应的页面可以出现与其参数Schema一致的表单和按钮，未登记执行器不得出现可执行控件。
8. 工作区视图目录必须提供可访问的页面内切换，切换后同步更新当前投影范围且不发起未登记数据查询。
9. 字段面板必须支持按机器字段、中文名称和字段角色过滤；过滤只作用于当前页面数据字典，不改变统一目录。
10. 二级页面必须提供业务投影、记录合同、字段字典和接入状态的页内快速定位。

### 10.4 二级页面专业呈现类型

二级页面必须根据业务实体和读取方式选择呈现类型，不得以同一张空表或同一卡片模板覆盖所有页面：

| 呈现类型 | 适用业务 | 未接入数据时的正式表现 |
|---|---|---|
| `registry` | 候选、发布、Checkpoint、证据、策略等身份记录 | 固定真实字段列，只显示等待受信记录，不创建演示行。 |
| `timeline` | 任务、训练、审核、生成、事件和遥测历史 | 显示事件序列结构及页面专属阶段，不伪造时间或事件。 |
| `topology` | 闭环、资格、模型、事实、事务、调度和替代关系 | 显示合同节点与合法关系，不推测节点运行状态。 |
| `matrix` | 能力域、审核合同、条件Schema、数据字典、质量与政策 | 以页面专属分区和统一字段建立矩阵，单元格明确未接入。 |
| `monitor` | 当前任务、活动执行、训练总览、当前验证、世界与系统资源 | 固定监测指标槽位，无机器采样时不显示数值。 |
| `search` | 样本、证据和全局归档检索 | 固定检索维度与结果结构，服务未接入时不提供假输入或目录扫描结果。 |
| `control_contract` | AP-10全部人工控制目录 | 展示目标、修订、幂等、转换复核和结果证据链；仅已登记执行器开放严格匹配的执行界面。 |

当受信API返回记录时，`registry`、`timeline`与`search`必须展示真实记录、允许选择单条记录并在只读详情中按统一字段字典展开；`search`只允许过滤当前API返回的受信结果，不得因此扫描项目目录。未接入时不得显示可操作的假检索输入。

### 10.5 模块总览与页面关系标准

1. 十个一级模块总览必须显示业务上游、当前模块、业务下游、证据绑定和模块运行规则。
2. 模块总览必须以专业目录显示每个二级工作页的呈现类型、主要实体、更新语义和业务职责。
3. 每个二级工作页必须显示同模块前序页、当前页、后序页以及模块证据绑定；首尾页面分别回退到模块级上游或下游语义。
4. AP-03模块总览只允许进入新平台自身的五个训练工作页，不得出现旧训练页面入口。
5. 能力域页面必须直接投影正式静态能力目录：AI Painter为当前能力域，文字与语言、语音与音频、视频和多模态为未来预留。
6. 页面目录完整性必须由确定性检查验证十个模块、52个工作页、七类呈现、稳定路由包装和禁止外部工具话术。

## 11. 代码与目录定版

```text
src/app/ai-console/
├─ page.tsx                           # 一级页面，只负责平台总览和模块目录
├─ page.module.css                    # 一级页面私有样式
├─ ai-console-catalog.ts              # 一级模块、能力域和二级目录的只读目录定义
├─ ai-console-workspace-catalog.ts    # 二级工作页、业务视图、状态合同和字段字典定义
├─ ai-console-workspace.tsx           # 十模块共用的二级业务投影工作台
├─ ai-console-workspace-interactions.tsx # 二级视图切换、字段筛选和页面查询合同连接
├─ ai-console-control-surface.tsx      # 已登记安全命令的独立控制面交互
├─ ai-console-workspace.module.css    # 二级工作页共用样式
├─ tasks/[[...view]]/page.tsx
├─ capabilities/[[...view]]/page.tsx
├─ training/[[...view]]/page.tsx
├─ reviews/[[...view]]/page.tsx
├─ data/[[...view]]/page.tsx
├─ runtime/[[...view]]/page.tsx
├─ evidence/[[...view]]/page.tsx
├─ system/[[...view]]/page.tsx
├─ archive/[[...view]]/page.tsx
└─ control/[[...view]]/page.tsx
```

新平台页面查询合同API固定为：

```text
src/app/api/ai-console/
├─ catalog/route.ts
├─ workspaces/[moduleSlug]/[workspaceSlug]/route.ts
└─ control/
   ├─ session/route.ts
   └─ commands/route.ts
```

控制服务与结构检查固定为：

```text
src/server/ai-console-control/
├─ operator-session.ts
├─ control-command-service.ts
├─ control-event-ledger.ts
└─ control-transaction-store.ts

scripts/check-ai-console-structure.mjs
scripts/check-ai-console-control-service.mjs
scripts/check-ai-console-control-event-ledger.mjs
scripts/check-ai-console-control-transaction-store.mjs

.runtime/ai-console/control/command-receipts/{commandId}.json
.runtime/ai-console/control/control-event-ledger-v1.jsonl
.runtime/ai-console/control/control-event-ledger-head-v1.json
.runtime/ai-console/control/control-transactions-v1.sqlite
```

二级页面只允许在同一根目录下使用以下稳定一级路由段：

```text
tasks/
capabilities/
training/
reviews/
data/
runtime/
evidence/
system/
archive/
control/
```

禁止把AI控制台放入`ai-painter-progress`，禁止建立第二个AI控制台根目录，禁止导航、嵌入或调用旧训练页面，禁止以历史页面目录作为当前状态选择来源。

## 12. Codex退出正式运行链

正式目标链固定为：

```text
AI控制台
→ 本地查询API / 本地控制API
→ 本地任务与命令服务
→ 本地生命周期编排器
→ 训练、验证、审核、发布和Runtime服务
→ 本地数据库与不可变证据
```

正式运行链禁止依赖Codex任务、Codex聊天、Codex Token、Codex授权、Codex进程或Codex临时状态。关闭Codex后，训练、验证、审核、能力发布、世界生成、RuntimeFrame、状态更新、人工控制和故障恢复必须继续。

## 13. 安全与失败关闭

1. 控制台不能直接修改WorldFacts、审核阈值、历史证据、Checkpoint内容或模型权重。
2. 路径必须使用项目逻辑相对路径并由服务端映射；前端不得提交任意文件系统路径。
3. SHA-256用于内容完整性，权限来源必须由受信注册表、写入器身份和事务证明，不能相信布尔字段。
4. 控制命令必须验证目标修订、登记修订、幂等键、锁和允许状态转换。
5. 证据冲突时显示`unknown_or_stale`或`evidence_conflict`，禁止降级读取旧Run。
6. 紧急停止可以立即中断，但必须尽可能保存现场身份、阶段、心跳、资源和未完成写入。

## 14. 稳定需求编号

| 需求ID | 要求 |
|---|---|
| AIC-BIZ-001 | AI控制台必须是整个本地自研AI平台入口，不得等同于AI Painter训练页。 |
| AIC-BIZ-002 | 当前支持AI Painter并为文字、语言、语音、音频、视频和多模态预留统一能力域。 |
| AIC-AUTH-001 | Owner职责只引用`GOV-OWNER-001`，不得建立逐任务审批。 |
| AIC-AUTH-002 | 本地系统正常运行不得依赖Codex或聊天。 |
| AIC-IA-001 | 一级入口固定为`/ai-console`，页面名称固定为“AI控制台”。 |
| AIC-IA-002 | 一级目录固定为AP-01至AP-10，稳定路由不得随UI调整改变。 |
| AIC-IA-003 | AP-01至AP-09和AP-10必须区分观察平面与控制平面。 |
| AIC-IA-004 | 新AI控制台与旧训练页面完全解耦；AP-03不得提供旧页面入口。 |
| AIC-DATA-001 | 全平台字段必须引用统一数据字典，不得页面内另造同义字段。 |
| AIC-DATA-002 | 统一数据字典必须定义类型、空值、单位、来源、写入器、更新语义和版本。 |
| AIC-DATA-003 | 当前任务、活动执行、最近训练终态和历史选择必须使用独立身份。 |
| AIC-DATA-004 | 能力、执行、训练、审核、Runtime和控制命令状态机不得混用。 |
| AIC-DATA-005 | 证据路径和SHA-256必须来自真实不可变文件及受信写入事务。 |
| AIC-CTRL-001 | 浏览器不得直接执行Shell、杀进程、改文件、改数据库或移动Checkpoint。 |
| AIC-CTRL-002 | 所有人工控制必须进入本地命令状态机并形成结果证据。 |
| AIC-CTRL-003 | 人工控制是可选覆盖，不是自主运行的必经步骤。 |
| AIC-CTRL-004 | 权限必须由本地服务端验证，不得依赖前端可见性。 |
| AIC-UI-001 | 一级页面必须使用固定顶部栏与固定左侧目录组成的应用外壳；业务内容在框架内部独立滚动，并显示四个业务大框架、十模块、数据字典、平面边界和接入状态。 |
| AIC-UI-002 | 二级页必须使用稳定路由和可信空状态；未接入查询服务时不得提供404假入口或伪造实时数据。 |
| AIC-UI-003 | AP-10必须明确区分已登记安全执行器与未登记命令；未登记命令不得产生副作用。 |
| AIC-UI-004 | 每个二级页必须具备页面专属视图、查询合同、详情结构、状态事实链和五维字段面板。 |
| AIC-UI-005 | 二级页必须按业务选择registry、timeline、topology、matrix、monitor、search或control_contract呈现类型。 |
| AIC-UI-006 | 十个模块总览必须显示上下游、证据绑定、运行规则和完整二级专业目录。 |
| AIC-UI-007 | 二级页必须显示前序页、当前页、后序页和模块证据绑定。 |
| AIC-UI-008 | 二级页必须支持业务视图切换、字段检索与角色筛选、主要内容区页内定位；这些页面交互不得伪装成机器查询或写入。 |
| AIC-QRY-001 | 新平台必须通过`/api/ai-console/`提供独立页面查询合同，未知工作页或非法视图失败关闭。 |
| AIC-QRY-002 | 页面合同状态与权威数据状态必须分离；未接入数据源时返回`records=null`和`total=null`，不得伪造空结果。 |
| AIC-QRY-003 | 新平台查询合同API不得导入、调用或转发旧AI Painter页面与API。 |
| AIC-CTRL-005 | 当前唯一安全执行器只允许核验新平台主登记，必须通过回环会话、同源、CSRF、修订和幂等校验并形成不可变回执。 |
| AIC-CTRL-006 | 控制回执只允许按完整命令身份精确复核；服务端必须重新校验Schema、身份、终态和摘要，禁止目录扫描或最近文件推断。 |
| AIC-DATA-006 | 新控制台控制事件必须使用固定追加账本、单调序号、哈希链、确定性事务身份和Head索引；冲突失败关闭，不补扫旧回执。 |
| AIC-DATA-007 | V6控制提交事务必须在独立SQLite中原子登记，绑定回执、事件和事件Head并维护元数据修订与事务哈希链；不得迁移旧数据库。 |
| AIC-QA-001 | 确定性检查必须验证10模块、52工作页、7类呈现、路由包装和禁止外部工具话术。 |
| AIC-SEC-001 | 路径、身份、事务和证据冲突必须失败关闭，不得回退旧记录。 |
| AIC-EXT-001 | 新模态能力必须复用统一十模块架构，不得复制平行控制台。 |

## 15. 本轮实施与验收

### 15.1 本轮实施范围

1. 保持`/ai-console`一级页面和AP-01至AP-10目录为平台总入口。
2. 为十个一级模块建立包含上下游、证据和运行规则的模块总览，并实现52个内部二级内容工作页的稳定路由。
3. 二级工作页按业务采用七类专业呈现，统一展示查询合同、可信空状态、记录详情、状态事实链、五维字段合同和安全边界。
4. 观察平面保持只读；AP-10只为`verify_primary_registry`提供有界安全执行控件，其余命令只展示控制合同。
5. AP-03只承载新平台自身训练页面，不导航、不嵌入、不调用旧训练页面。
6. 接通新平台自身的目录、工作页查询合同API和独立安全控制API；控制API只读核验新平台主登记并写入自身回执，不读取实时训练状态，不连接或修改旧训练控制台。
7. 页面必须显示页面合同与权威数据投影的不同连接状态。
8. 建立AI控制台结构完整性检查，固定模块、工作页、呈现类型、查询合同与UI语言边界。

### 15.2 验收条件

1. `/ai-console`、十个模块总览和52个内部二级稳定路由可以独立渲染。
2. AP-01至AP-10及二级目录的编号、名称、路由、平面、上下游和证据关系无遗漏、无重复。
3. 每个二级工作页使用匹配业务的专业呈现类型，并显示专属视图目录、主要实体、权威来源、更新语义、状态事实链、统一字段和严格边界。
4. 查询服务未接入时只显示结构接入状态，不显示虚构运行数据。
5. `/ai-console`及其所有子页面不存在指向`/ai-painter-progress/`的链接、嵌入或读取逻辑。
6. AP-10只有主登记核验可产生POST并在`.runtime/ai-console/control/command-receipts/`创建不可变回执；不得启动进程、执行Shell、修改数据库、主登记或旧平台状态。
7. 旧`/ai-painter-progress/current-training`代码和路由保持未修改，并且不属于新平台信息架构。
8. TypeScript检查、文档检查、路由遍历和浏览器响应式检查通过。
9. 两类`/api/ai-console/`查询合同返回预期Schema；非法工作页和非法视图返回4xx，全部接口无旧平台耦合。
10. 控制会话与命令API按合同拒绝缺少会话、同源、CSRF或非法参数的请求，并对相同幂等身份返回同一不可变回执。
11. 验证控制页可以按完整命令身份精确复核已有回执并显示服务端完整性状态；非法、不存在或冲突身份失败关闭且不扫描目录。
12. AP-07事件账本从固定JSONL和Head索引返回V5控制事件；序号、前序摘要、事件摘要、事务身份、回执证据和Head全部一致。
13. AP-07“控制提交事务”从新平台固定SQLite返回V6事务；数据库完整性、Schema、元数据、事务链、回执、事件和Head全部一致。
14. AP-07“正式证据记录”从固定V7 SQLite索引返回四类控制证据；索引Schema、元数据、登记批次、证据双哈希链、嵌入字节摘要、来源绑定和首次合格事务边界全部一致。
15. `scripts/check-ai-console-structure.mjs`返回10个模块、52个工作页、七类呈现且无诊断错误；控制服务、事件账本、事务库与正式证据索引检查器验证安全执行边界和全链完整性。

真实查询与控制服务接入必须以本规格和二级工作页字段合同为信息架构来源增量实施，不得重新定义一级目录和核心字段语义。
