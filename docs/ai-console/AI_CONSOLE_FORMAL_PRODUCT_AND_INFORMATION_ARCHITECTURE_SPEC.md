# AI控制台正式产品、信息架构与统一数据字典规格

更新时间：2026-08-30 12:26:57 +08:00

状态：active-normative-target

文档版本：`AI-CONSOLE-2.5`

生效日期：`2026-08-27`

替代版本：`AI-CONSOLE-2.4`

文档状态：`active_normative_target`

程序符合状态：`v21_current_execution_projection_and_legacy_ui_retirement_connected`

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
7. 旧`/ai-painter-progress/*`页面已经退役；旧网址只能由无状态兼容路由永久重定向到`/ai-console`，不得继续独立渲染、读取状态、调用接口或承载控制。旧页面资料不得作为当前任务、状态或权限来源。

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
| 训练总览 | `/ai-console/training/overview` | 新平台正式训练上报的Run、Stage、Epoch、Batch、优化步、Loss、学习率、吞吐、ETA、Checkpoint与资源；同时单独显示进程直接观测。 |
| 训练计划 | `/ai-console/training/plans` | V13内容寻址登记的非活动计划、模型依赖、数据划分、种子、分辨率、Epoch预算、父终态、优化器和资源档案。 |
| 模型结构 | `/ai-console/training/models` | V13内容寻址登记的模型家族、架构/源码摘要、输入输出Schema、参数量和不可变记录摘要。 |
| Checkpoint | `/ai-console/training/checkpoints` | 身份、资格、来源Stage、选择分数、晋级和禁止复用状态。 |
| 训练历史 | `/ai-console/training/runs` | Run、指标、预览、终态、Manifest、Finalization和资源遥测。 |

### AP-04 验证与机器审核中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 当前验证 | `/ai-console/reviews/current` | 验证阶段、节点、进度、审核器、输入身份和实时事件。 |
| 审核结果 | `/ai-console/reviews/results` | V14按冻结合同与机器观测值计算的唯一通过/失败终态、失败码、影响范围、指标与阈值快照。 |
| 证据查看 | `/ai-console/reviews/evidence` | 原始预览、规范化副本、SHA-256、参考来源和复现关系。 |
| 审核合同 | `/ai-console/reviews/contracts` | V14内容寻址登记的审核器身份/版本、指标定义、冻结阈值、证据要求、失败码、适用能力域与前序合同。 |
| 失败分类 | `/ai-console/reviews/failures` | 只从V14失败关闭结果派生失败码、分类、影响范围、证据摘要和重新准入条件。 |

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
| 候选审核 | `/ai-console/runtime/candidates` | V15绑定当前能力激活、WorldFacts、条件包、既有视觉制品与双摘要的待审核候选。 |
| RuntimeFrame | `/ai-console/runtime/frames` | V15绑定V14通过结果登记的正式未消费Frame、能力激活、发布身份和前序Frame链。 |
| 世界运行 | `/ai-console/runtime/world` | V16新平台登记的活动Frame、消费状态、发布暂停/恢复、合法回退和视觉冻结事实；不读取旧World Runtime。 |

### AP-07 证据与治理中心

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 证据浏览 | `/ai-console/evidence/artifacts` | 默认读取V7独立证据索引；V8按完整证据身份提供经摘要复核的受限UTF-8检查面板，SQLite保持二进制元数据模式；其他视图显示证据合同。 |
| 事件账本 | `/ai-console/evidence/events` | 当前接入新控制台V5后安全命令的单调事件、状态转换、哈希因果链、事务身份和回执证据；不扫描旧运行目录。 |
| 任务胶囊 | `/ai-console/evidence/capsules` | V9读取新平台独立终态任务胶囊库；四个视图分别展示任务目标、输入与能力、执行摘要、终态与边界。当前受验证正式库为空，不创建示例行。 |
| 数据库事务 | `/ai-console/evidence/transactions` | 默认展示V6控制提交事务；“文件与事件”“SQLite一致性”使用V8正式对账记录，其他视图展示身份准备、恢复和冲突门禁。 |
| 政策边界 | `/ai-console/evidence/policies` | 默认“正式边界报告”读取V10独立索引；其余页签展示长期目标、来源许可、外部费用、不可恢复操作、安全上限和审计真实性的禁止动作、失败关闭、保留要求与安全替代路线。 |

### AP-08 系统资源与后台服务

| 二级模块 | 路由 | 内容 |
|---|---|---|
| 资源总览 | `/ai-console/system/resources` | 250毫秒目标刷新CPU、内存、GPU、显存、温度、功耗、磁盘和训练特征进程；同时显示毫秒采样时间、序号、耗时、链路延迟与通道年龄。 |
| 后台服务 | `/ai-console/system/services` | 服务身份、PID、启动方式、心跳、状态和最近错误。 |
| 任务调度 | `/ai-console/system/scheduler` | 资源队列、优先级、时间窗口和容量策略。 |
| 健康检查 | `/ai-console/system/health` | Python、CUDA、Node、数据库、磁盘和证据目录健康。 |
| 遥测历史 | `/ai-console/system/telemetry` | 浏览会话资源采样、峰值与趋势；会话曲线不得冒充持久机器证据。 |

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
| 任务控制 | `/ai-console/control/tasks` | V11开放登记任务、调整未启动任务优先级和取消未启动任务；启动任务与暂停/恢复队列保持禁用。 |
| 训练控制 | `/ai-console/control/training` | V13开放模型结构与非活动训练计划登记；启动、在安全点暂停、恢复、安全停止和时间窗口保持禁用。 |
| 验证控制 | `/ai-console/control/reviews` | 开放主登记核验、冻结审核合同和机器观测终态登记；启动正式验证、审核重跑、投影重建和证据检查保持禁用。 |
| 能力控制 | `/ai-console/control/capabilities` | V12开放候选、顺序资格与非活动发布登记；V15开放完整资格发布激活；停用、合法回退和自动更新开关保持禁用。 |
| 世界控制 | `/ai-console/control/world` | V15开放既有视觉制品候选与机器审核通过的正式未消费Frame登记；V16开放消费、发布暂停/恢复、合法祖先回退和视觉冻结登记。全部只写新平台SQLite，不写游戏世界或WorldFacts。 |
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
| `activationId` | string | V15按能力域追加的能力发布激活身份。 |
| `runtimeFrameIdentity` | string | 机器审核通过后登记、尚未被世界消费的正式Frame身份。 |
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

AP-10二级页面当前接入41条正式命令定义、目标类型、角色、验证规则、参数Schema和安全边界，其中19种绑定安全执行器。世界控制的候选和正式未消费Frame登记绑定V15运行发布执行器；消费、发布暂停/恢复、合法祖先回退和视觉冻结绑定`ai_console_world_control_executor_v1`。该执行器的“消费”和“控制”仅表示新平台登记事实，不等于游戏世界已执行。其余启动任务、队列调度、训练运行、主动验证、审核重跑、能力停用/回退、资源和紧急命令执行器身份为空，不创建提交控件、不排队命令、不改变对应本地状态。

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
GET /api/ai-console/observability/current-execution
```

1. `catalog`只返回新平台能力域、四大框架、十个模块、52个工作页及目录完整性，不返回旧训练页面目录。
2. `workspaces`校验模块、工作页和页面内视图身份，并返回主要实体、允许视图、筛选字段、来源与更新语义。
3. 页面合同连接成功使用`contractStatus=ready`；这不等于权威数据源已连接。
4. 权威业务投影未接入时固定使用`dataStatus=not_connected`、`records=null`和`total=null`，不得返回空数组或0冒充真实空结果。
5. 未知模块、工作页或不属于当前工作页的视图必须返回4xx并保持无副作用。
6. 此API不得导入、转发或调用`/api/ai-painter/`、`/ai-painter-progress/`或旧训练页面服务。
7. AP-03模型结构与训练计划只读取固定V13训练设计登记；AP-04审核合同与自主裁决登记只读取固定V14审核裁决登记；AP-02发布活动状态与AP-06候选/Frame只读固定V15运行发布登记；AP-06世界运行只读固定V16世界控制登记。完整性通过后的真实空登记返回`connected · 0`，不得回退旧目录、旧World Runtime或旧页面填充。
8. AP-10命令定义可以由同一工作页查询API返回；执行器身份为空时必须返回部分接入且无写入能力。所有已登记安全执行器只能通过`/api/ai-console/control/`进入回环会话、同源、CSRF、目标修订与幂等校验链，并严格限制到各自固定新平台存储。
9. `observability/current-execution`是唯一允许读取AI Painter正式当前执行登记的查询入口。它必须使用正式读取器复核登记事务及绑定证据，严格分离当前任务、活动执行、最近训练终态和显式历史选择；不得调用旧页面API或扫描历史目录。

## 10. 一级页面视觉与交互标准

### 10.1 必备区域

```text
产品标题与业务定位
运行边界摘要
跨页面固定实时状态条与页内展开面板
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
8. 全局实时状态条必须在一级与全部二级页面持续显示CPU、内存、GPU、显存和训练上报摘要，页内展开后显示温度、功耗、磁盘与训练进程；用户查看训练时不得被迫切换工作页。
9. AP-08与AP-03使用同一新平台本机观察服务。资源和进程是带采样时间的直接观察；Run、Epoch、Loss等训练语义只接受新平台训练遥测登记，缺失时显示未上报，不得由GPU占用或进程名推测。

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
├─ ai-console-live-observability.ts   # 客户端单例轮询与会话趋势
├─ ai-console-live-status.tsx         # 跨页面固定实时状态条
├─ ai-console-live-status.module.css  # 实时条、抽屉与仪表盘样式
├─ ai-console-observability-panel.tsx # AP-03/AP-08专业实时仪表盘
├─ ai-console-current-execution-status.tsx # V21当前执行受信状态面板
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
├─ observability/
│  ├─ live/route.ts
│  └─ current-execution/route.ts
└─ control/
   ├─ session/route.ts
   ├─ commands/route.ts
   ├─ tasks/route.ts
   ├─ capabilities/route.ts
   ├─ training/route.ts
   └─ reviews/route.ts
```

控制服务与结构检查固定为：

```text
src/server/ai-console-control/
├─ operator-session.ts
├─ control-command-service.ts
├─ control-event-ledger.ts
├─ control-transaction-store.ts
├─ task-registry-store.ts
├─ task-command-service.ts
├─ capability-lifecycle-store.ts
├─ capability-command-service.ts
├─ training-design-store.ts
├─ training-design-command-service.ts
├─ review-adjudication-store.ts
└─ review-adjudication-command-service.ts

scripts/check-ai-console-structure.mjs
scripts/check-ai-console-control-service.mjs
scripts/check-ai-console-control-event-ledger.mjs
scripts/check-ai-console-control-transaction-store.mjs
scripts/check-ai-console-task-registry-store.mjs
scripts/check-ai-console-capability-lifecycle-store.mjs
scripts/check-ai-console-training-design-store.mjs
scripts/check-ai-console-review-adjudication-store.mjs

.runtime/ai-console/control/command-receipts/{commandId}.json
.runtime/ai-console/control/control-event-ledger-v1.jsonl
.runtime/ai-console/control/control-event-ledger-head-v1.json
.runtime/ai-console/control/control-transactions-v1.sqlite
.runtime/ai-console/tasks/task-registry-v1.sqlite
.runtime/ai-console/capabilities/capability-lifecycle-v1.sqlite
.runtime/ai-console/training/training-design-registry-v1.sqlite
.runtime/ai-console/reviews/review-adjudication-registry-v1.sqlite
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
| AIC-IA-004 | `/ai-console`是唯一现行控制台；旧训练页面UI必须删除，旧网址只能永久重定向到该入口，AP-03不得提供旧页面入口或读取旧页面数据。 |
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
| AIC-QRY-004 | AI Painter当前运行事实只能通过固定当前执行登记及其正式验证器投影；禁止历史目录扫描、Run优先级猜测和摘要冲突回退。 |
| AIC-CTRL-005 | 当前七类安全执行器只允许主登记核验、任务登记、能力生命周期登记、训练设计登记、审核裁决登记、运行发布登记和世界控制登记；必须通过回环会话、同源、CSRF、修订和幂等校验并形成不可变回执。 |
| AIC-CTRL-006 | 控制回执只允许按完整命令身份精确复核；服务端必须重新校验Schema、身份、终态和摘要，禁止目录扫描或最近文件推断。 |
| AIC-CTRL-007 | 审核裁决登记不得接受调用方通过/失败结论；服务端必须从冻结合同阈值计算唯一终态，同一运行与合同不得重复裁决。 |
| AIC-CTRL-008 | 世界控制只允许消费V15正式Frame、暂停/恢复发布、回退到同世界祖先Frame和冻结视觉更新；只写V16新平台登记，不得读写旧World Runtime、游戏世界或WorldFacts。 |
| AIC-DATA-006 | 新控制台控制事件必须使用固定追加账本、单调序号、哈希链、确定性事务身份和Head索引；冲突失败关闭，不补扫旧回执。 |
| AIC-DATA-007 | V6控制提交事务必须在独立SQLite中原子登记，绑定回执、事件和事件Head并维护元数据修订与事务哈希链；不得迁移旧数据库。 |
| AIC-QA-001 | 确定性检查必须验证10模块、52工作页、7类呈现、路由包装和禁止外部工具话术。 |
| AIC-SEC-001 | 路径、身份、事务和证据冲突必须失败关闭，不得回退旧记录。 |
| AIC-EXT-001 | 新模态能力必须复用统一十模块架构，不得复制平行控制台。 |
| AIC-OBS-001 | 一级与全部二级页面必须固定显示实时资源和训练摘要，展开观察不得要求页面跳转。 |
| AIC-OBS-002 | CPU、内存、GPU、显存、温度、功耗、磁盘和训练进程必须来自带时间与探针身份的本机直接观察。 |
| AIC-OBS-003 | 当前Run与执行身份可来自受验证当前执行登记；Epoch、Batch、Loss、学习率、吞吐、ETA和Checkpoint只接受与当前活动Run精确一致的新平台训练遥测，不得从历史终态、进程名或资源占用推测。 |
| AIC-OBS-004 | 浏览会话实时曲线不得冒充持久机器证据，训练遥测登记与资源直接观察必须分层显示。 |
| AIC-OBS-005 | V2快照必须记录单调采样序号、毫秒开始/完成时间、采样耗时、目标刷新间隔和逐通道时间；界面必须显示数据年龄，不得把缓存或慢探针伪装成刚刚采样。 |

## 15. 本轮实施与验收

### 15.1 本轮实施范围

1. 保持`/ai-console`一级页面和AP-01至AP-10目录为平台总入口。
2. 为十个一级模块建立包含上下游、证据和运行规则的模块总览，并实现52个内部二级内容工作页的稳定路由。
3. 二级工作页按业务采用七类专业呈现，统一展示查询合同、可信空状态、记录详情、状态事实链、五维字段合同和安全边界。
4. 观察平面保持只读；AP-10只为十九种已登记安全命令提供有界执行控件，其余命令只展示控制合同。
5. AP-03只承载新平台自身训练页面，不导航、不嵌入、不调用旧训练页面。
6. 接通新平台自身的目录、工作页查询合同API和独立安全控制API；控制API仅写各自新平台固定登记与回执，训练设计API不读取实时训练状态，不连接或修改旧训练控制台。
7. 页面必须显示页面合同与权威数据投影的不同连接状态。
8. 建立AI控制台结构完整性检查，固定模块、工作页、呈现类型、查询合同与UI语言边界。
9. 建立V9任务胶囊SQLite库、严格内部写入器和只读投影；仅未来新平台任务登记终态可以写入，不接收旧任务、目录扫描或外部执行记忆。
10. 建立V10政策边界报告SQLite库、严格内部写入器和只读投影；仅固定新平台政策引擎的实际阻断可以写入，不接收规则占位、演示数据或旧平台报告。
11. 建立V11任务SQLite登记、三种登记级安全命令与AP-01队列/平台任务记录投影；当前项目任务与活动执行不从该库推测，统一由V21当前执行桥接接入。
12. 建立V12能力生命周期SQLite登记、三种登记级安全命令与AP-02投影；候选、资格结果、非活动发布和机器迁移评估只读新平台能力库，激活、停用、回退与迁移裁决不在本批伪造接入。
13. 建立V13训练设计SQLite登记、两种登记级安全命令与AP-03模型/计划投影；模型结构与非活动训练计划只读新平台设计库，训练Run、Checkpoint、调度与执行不在本批伪造接入。
14. 建立V14审核裁决SQLite登记、两种登记级安全命令与AP-04合同/结果/失败投影；审核终态由服务端按冻结阈值计算，验证运行、审核重跑和证据写入不在本批伪造接入。
15. 建立V15运行发布SQLite登记、三段式安全命令、AP-02激活状态联合投影与AP-06候选/Frame投影；只登记完整资格发布激活、当前激活下既有制品候选和V14通过后的正式未消费Frame，不生成图片、不消费Frame、不写世界。
16. 建立V16世界控制SQLite登记、五种安全命令和AP-06世界运行投影；只消费V15正式Frame、登记发布暂停/恢复、合法祖先回退和视觉冻结，不导入或写入旧World Runtime、游戏世界、WorldFacts及任何训练状态。
17. 建立V17统一本机观察服务、实时GET、客户端单例轮询、全局固定实时条、AP-08资源/会话遥测仪表盘和AP-03训练实时仪表盘；固定只读探针读取本机资源和训练特征进程，新平台内部写入器追加训练语义遥测。该实时资源API不读取旧页面、旧API、训练目录或Stage4证据；Stage4当前身份只允许由V21独立桥接读取正式当前登记。
18. 建立V19平台语义色系统：以明亮中性层级表达ApplicationShell、工作区和内嵌面板，以模块稳定身份色表达当前位置，以成功、等待、失败和人工控制语义色表达状态；CPU、内存、GPU、显存和温度使用可区分的数据通道色。颜色不得取代文字、图标、边框或数值状态。
19. 建立V19明亮企业控制台主题：默认Canvas使用暖灰白，ApplicationShell和主内容使用白色，导航、字段及嵌套面板使用冷灰白明度层级；不得以暗色作为平台基底。深色只允许用于尺寸受控的局部高对比内容，不得形成页面主表面。模块、Frame、状态与数据通道继续使用语义Token，身份色不得大面积填充内容区。
20. 建立V20毫秒精度实时观察合同：统一快照升级为V2，记录采样序号、开始时间、完成时间、采样耗时、目标刷新间隔和CPU、内存、磁盘、GPU、训练进程、训练遥测各通道的采样时间；客户端以250毫秒为目标轮询并显示快照年龄与HTTP往返耗时。毫秒时间戳表示测量和传输合同精度，不虚构操作系统或设备驱动每1毫秒都会产生新计数器。
21. 建立V21当前执行受信桥接与旧页面退役：一级页、AP-01当前/活动、AP-03训练总览及AP-04当前/结果/证据读取同一受验证当前执行登记；绑定审核证据重新计算SHA-256。删除旧页面UI，所有旧网址永久重定向到`/ai-console`；保留运行证据和仍由其他业务使用的共享API。

### 15.2 验收条件

1. `/ai-console`、十个模块总览和52个内部二级稳定路由可以独立渲染。
2. AP-01至AP-10及二级目录的编号、名称、路由、平面、上下游和证据关系无遗漏、无重复。
3. 每个二级工作页使用匹配业务的专业呈现类型，并显示专属视图目录、主要实体、权威来源、更新语义、状态事实链、统一字段和严格边界。
4. 查询服务未接入时只显示结构接入状态，不显示虚构运行数据。
5. `/ai-console`及其所有子页面不存在指向`/ai-painter-progress/`的链接、嵌入或读取逻辑。
6. AP-10只有主登记核验、V11任务登记、V12能力生命周期登记、V13训练设计登记、V14审核裁决登记、V15运行发布登记和V16世界控制登记可产生POST；七类执行器分别限制在各自固定新平台存储。V16只登记Frame消费和控制状态，不得启动进程、执行Shell、生成图像、启动训练/验证/审核、写入游戏世界、WorldFacts或改变旧平台状态。
7. 旧`/ai-painter-progress`页面代码已经删除；仅保留覆盖全部旧子路径的永久重定向。重定向不得读取旧API、运行证据、训练状态或浏览器参数来决定目标。
8. TypeScript检查、文档检查、路由遍历和浏览器响应式检查通过。
9. 两类`/api/ai-console/`查询合同返回预期Schema；非法工作页和非法视图返回4xx，全部接口无旧平台耦合。
10. 控制会话与命令API按合同拒绝缺少会话、同源、CSRF或非法参数的请求，并对相同幂等身份返回同一不可变回执。
11. 验证控制页可以按完整命令身份精确复核已有回执并显示服务端完整性状态；非法、不存在或冲突身份失败关闭且不扫描目录。
12. AP-07事件账本从固定JSONL和Head索引返回V5控制事件；序号、前序摘要、事件摘要、事务身份、回执证据和Head全部一致。
13. AP-07“控制提交事务”从新平台固定SQLite返回V6事务；数据库完整性、Schema、元数据、事务链、回执、事件和Head全部一致。
14. AP-07“正式证据记录”从固定V7 SQLite索引返回四类控制证据；索引Schema、元数据、登记批次、证据双哈希链、嵌入字节摘要、来源绑定和首次合格事务边界全部一致。
15. 精确证据详情按64位身份返回受验证记录；文本检查上限、截断状态、SQLite二进制隔离、回环Host边界和`nosniff`全部生效。
16. “文件与事件”“SQLite一致性”按正式身份返回V8对账记录，文件、事件、Head、SQLite、索引和跨表面状态全部为`verified`；任一冲突失败关闭。
17. AP-07任务胶囊四个视图从固定V9 SQLite读取；来源、Schema、元数据、单调序号、内容BLOB、输入/结果证据集、终态关系与记录哈希链全部验证，当前返回`connected · 0`。
18. AP-07“正式边界报告”从固定V10 SQLite读取；来源、Schema、元数据、单调序号、内容BLOB、两类证据集、六类边界、阻断终态与报告哈希链全部验证，当前返回`connected · 0`。
19. `scripts/check-ai-console-structure.mjs`返回10个模块、52个工作页、七类呈现且无诊断错误；控制服务、事件账本、事务库、正式证据索引、证据对账、任务胶囊、政策报告、任务登记、能力生命周期、训练设计、审核裁决、运行发布与世界控制检查器验证安全执行边界和全链完整性。
20. AP-01队列和平台任务记录从固定V11 SQLite读取；元数据、创建BLOB、任务状态、事件与命令回执链全部验证。当前项目任务与活动执行从V21当前执行桥接读取，不得由队列或历史目录推测。AP-10三种任务登记操作继续通过会话、同源、CSRF、修订、幂等和终态门禁。
21. AP-02候选、当前门禁、资格结果、发布和迁移评估从固定V12 SQLite读取；元数据、创建BLOB、候选状态、六级资格、发布、事件与命令回执链全部验证。AP-10三种能力登记操作通过会话、同源、CSRF、修订、幂等、门禁顺序和发布资格检查；当前正式库返回空集，资格图与迁移门禁继续显示版本化合同。
22. AP-03模型结构与训练计划从固定V13 SQLite读取；元数据、创建BLOB、内容寻址身份、模型—计划关系、设计事件和命令回执链全部验证。AP-10两种训练设计登记通过会话、同源、CSRF、修订、幂等、重复内容和能力域检查；当前正式库返回空集，训练运行五种控制命令继续禁用。
23. AP-04审核合同与自主裁决登记从固定V14 SQLite读取；当前验证、结果和证据从V21当前执行桥接显式绑定的机器审核时间线读取并重新计算SHA-256。AP-10两种审核登记通过会话、同源、CSRF、修订、幂等、合同与审核器身份检查；主动验证、审核重跑、投影重建和证据改写继续禁用。
24. AP-02发布活动状态和AP-06候选/Frame从固定V15 SQLite读取；固定表列、元数据、创建BLOB、按能力域激活链、候选绑定、按世界Frame链、V12/V14外部摘要、事件与回执链全部验证。AP-10三种运行发布命令通过会话、同源、CSRF、修订、幂等、当前激活与审核准入检查；当前正式库返回空集，视觉生成继续禁用。
25. AP-06世界运行从固定V16 SQLite读取并返回`connected · 0`；不得导入旧World Runtime Adapter或读取`data/world-runtime`。AP-10五种世界控制命令通过会话、同源、CSRF、全局/世界修订、幂等、V15正式发布、前序链、暂停状态和祖先回退检查；动态检查覆盖消费、幂等、失败关闭、暂停、回退、恢复和冻结，且没有游戏世界或WorldFacts写入。
26. 全局实时条在`/ai-console`和全部二级壳中固定存在，以250毫秒为目标自动刷新，展开后不导航即可查看资源与训练摘要、采样序号、毫秒完成时间、快照年龄和链路延迟。
27. AP-08资源页显示真实CPU、内存、GPU、显存、温度、功耗、磁盘、GPU身份与训练特征进程；GPU可用机器不得返回伪造空值。
28. AP-03训练总览始终显示V21登记的当前任务Run或最近训练终态；只有训练遥测Run等于当前`activeExecution.runId`且心跳有效时才显示Epoch、Loss和ETA，否则明确显示无匹配活动遥测并继续显示硬件与进程直接观察。
29. V20实时API和源码不得包含旧页面路由、旧API、旧训练目录读取或Stage4执行/证据写入；GET无文件、数据库或进程状态副作用。
30. V19语义色Token必须由一级页、全部二级壳和实时观察面共同复用；十个模块身份色、四个Frame色、成功/等待/失败/控制色及五类资源指标色必须稳定且可检查，页面不得退回单一青色覆盖所有层级与数据系列。
31. V19默认主题必须在一级页、七类二级呈现、控制合同、实时状态条和专业仪表盘中保持明亮表面；桌面及窄屏不得出现大面积暗色Canvas、暗色导航或暗色工作区，文字、输入控件、焦点态和状态必须达到清晰可辨且不只依赖颜色。
32. V20快照必须使用`ai_console_live_observability_v2`并返回单调采样序号、毫秒开始/完成时间、实际采样耗时、250毫秒目标刷新间隔和逐通道采样时间；固定状态条及AP-03/AP-08仪表盘必须显示数据年龄，任何缓存或慢探针不得被表现为刚刚采样。
33. V21当前执行接口、首页状态面板及AP-01/AP-03/AP-04工作页必须返回同一登记修订、任务、Run和审核计数；登记或证据冲突返回`unknown_or_stale`，不得扫描目录回退。
34. `/ai-painter-progress`根路径、已知子路径和任意深层子路径必须308永久重定向到`/ai-console`；旧UI源码不得存在，AI Painter运行证据与其他业务仍使用的共享API不得被删除。

真实查询与控制服务接入必须以本规格和二级工作页字段合同为信息架构来源增量实施，不得重新定义一级目录和核心字段语义。
