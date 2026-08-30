# AI控制台数据字典与API合同

更新时间：2026-08-30 12:26:57 +08:00

状态：active-normative-target

文档版本：`AI-CONSOLE-DATA-API-1.4`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 文档职责

本文定义AI控制台统一字段语义、连接状态、只读页面查询合同、错误语义和未来业务投影接入要求。

## 2. 字段条目标准

每个字段条目必须定义：

| 字段 | 含义 |
|---|---|
| `canonicalName` | API、数据库和证据使用的唯一英文名 |
| `displayNameZh` | 中文显示名 |
| `dataType` | 稳定机器类型 |
| `role` | 身份、关系、状态、时间、完整性、度量或属性 |
| `nullable` | 是否允许为空 |
| `sourceOfTruth` | 权威来源 |
| `writerIdentity` | 允许写入器 |
| `updateSemantics` | 不可变、追加、单调修订或可替换投影 |
| `introducedIn` | 首次出现的Schema版本 |

页面不得重新发明同义字段或将显示文案当作机器字段。

产品合同身份与运行事实身份必须使用不同字段。例如`releaseGateId`不得写入`datasetReleaseIdentity`，`qualityGateId`不得写入`qualityReportId`，`evidenceTypeId`不得写入`evidenceId`，`transactionGateId`不得写入`transactionId`，`policyRuleId`不得写入`policyBoundaryReportId`；后者尚无机器登记时必须为`null`并列入`unavailableFields`，或在只查询正式记录的视图返回`not_connected`。

## 3. 页面查询合同API

### 3.1 平台目录

```http
GET /api/ai-console/catalog
```

返回能力域、四个Framework、十个模块、52个工作页和目录完整性。

### 3.2 二级工作页

```http
GET /api/ai-console/workspaces/{moduleSlug}/{workspaceSlug}?view={workArea}
```

成功载荷必须包含：

```text
schemaVersion
contractStatus
dataStatus
sourceIdentity
workspaceIdentity
selectedView
queryContract
result
```

### 3.2.1 V20毫秒精度实时观察快照

```http
GET /api/ai-console/observability/live
```

返回Schema固定为`ai_console_live_observability_v2`，包含：

```text
observedAtUtc
sampleSequence
sampleStartedAtUtc
sampleCompletedAtUtc
sampleDurationMs
timestampPrecision=milliseconds
refreshIntervalMs=250
channelTimings.cpu/memory/disk/gpu/trainingProcesses/trainingTelemetry
sourceIdentity
trustStatus=direct_observation
resources
gpu.adapters
trainingProcesses.records
trainingTelemetry.latest
host
reasonCodes
```

该接口无缓存、无写入且不接受路径、命令或Run参数。`observedAtUtc`是`sampleCompletedAtUtc`的兼容别名；所有时间采用ISO 8601 UTC毫秒精度。`sampleSequence`在同一`queryServiceProcessId`生命周期内严格单调，服务重启后以新的进程身份重新计数。`sampleDurationMs`使用单调高精度时钟计算，`channelTimings`逐项给出真实采样时间和通道耗时，页面必须据此计算年龄，不能把缓存通道表现为新采样。250毫秒是客户端目标刷新间隔，不是操作系统或设备计数器每1毫秒更新的承诺。CPU、内存、磁盘来自Node本机采样；NVIDIA GPU、显存、温度、功耗来自固定`nvidia-smi`只读参数；训练特征进程来自固定本机进程只读探针。进程命令只返回脚本摘要，不返回完整参数。Run、Epoch、Loss等训练语义只读取第5.14节新平台训练遥测登记。

### 3.2.2 AI Painter当前执行受信投影

```http
GET /api/ai-console/observability/current-execution
```

响应Schema固定为`ai_console_ai_painter_current_execution_projection_v1`。接口不接受路径、Run、来源或历史选择参数，返回：

```text
ok
dataStatus
reasonCode
sourceIdentity=ai-painter-current-execution
sourcePath=.runtime/ai-painter/current-execution-registry/current.json
sourceSha256
integrityStatus
registryRevision
eventSequence
recordedAtUtc
recordedAtAsiaShanghai
currentProjectTask
activeExecution
latestTrainingTerminal
selectedHistoricalRun
machineReview
```

`currentProjectTask`、`activeExecution`、`latestTrainingTerminal`和`selectedHistoricalRun`不得互相替代。`machineReview`只允许来自当前登记显式绑定的不可变时间线，必须重新计算文件SHA-256并验证Run、目标节点数、通过数、失败数和逐节点身份。任何路径越界、摘要、修订、计数或身份冲突使`ok=false`、`dataStatus=unknown_or_stale`；禁止扫描其他AI Painter目录寻找替代记录。

### 3.3 本地控制会话

```http
GET /api/ai-console/control/session
```

只允许回环地址调用。成功响应返回服务端确定的`actorIdentity=local_console_operator`、`role=operator`、CSRF令牌、过期时间和允许命令类型，同时设置作用域为`/api/ai-console/control`的HttpOnly、SameSite=Strict短时Cookie。客户端提交的角色或操作员身份不参与授权。

### 3.4 安全控制命令

```http
GET /api/ai-console/control/commands
GET /api/ai-console/control/commands?commandId={64位小写十六进制命令身份}
POST /api/ai-console/control/commands
```

控制GET同样只允许回环地址；服务端必须共同验证请求URL、`Host`和存在时的`X-Forwarded-Host`。无`commandId`的GET只返回执行器状态、边界和当前主登记修订；带精确身份的GET只读取并复核对应回执，成功时同时返回`integrityStatus=verified`、固定`receiptLogicalPath`和`receipt`。服务端不提供目录枚举、最近回执或任意路径查询。POST当前只接受下列字段，拒绝额外字段：

```text
commandType=verify_primary_registry
targetType=primary_registry
targetId=ai_console_primary_registry
expectedRegistryRevision
idempotencyKey
reasonText
```

POST必须同时通过回环地址、同源、服务端签名会话与`x-ai-console-csrf`校验。命令只读取并重新验证`data/ai-console/registry/primary-registry-v1.json`；结果回执使用固定Schema `ai_console_control_command_receipt_v1`，按确定性`commandId`写入`.runtime/ai-console/control/command-receipts/{commandId}.json`，写入采用仅创建语义并保存`receiptSha256`。新建文件必须立即通过同一严格读取器重新校验后才能返回成功；重复幂等身份返回同一回执。

V5后的成功命令响应还必须返回`eventLedgerStatus=connected`、固定`eventLedgerLogicalPath`和`eventBinding`。`eventBinding`至少包含事件身份、事件序号、状态目标、事务身份和事件摘要。V4以前已有回执的精确GET允许`eventBinding=null`，不得为补齐而扫描历史回执。

V6后的成功命令响应还必须返回`transactionStoreStatus=connected`、固定`transactionStoreLogicalPath`和`transactionBinding`。`transactionBinding`至少包含事务身份、事务序号、提交状态、恢复状态和事务记录摘要。V6以前事件的精确GET允许`transactionBinding=null`，不得为补齐而扫描旧事件。

V7后的成功命令响应还必须返回`evidenceIndexStatus=connected`、固定`evidenceIndexLogicalPath`、`evidenceRegistration`和本批`evidenceRecordSet`。精确GET只返回与命令身份相同的登记批次；V7以前命令允许`evidenceRegistration=null`，不得为补齐而扫描回执目录或旧平台内容。

## 4. 连接状态语义

| 字段 | 值 | 含义 |
|---|---|---|
| `contractStatus` | `ready` | 页面身份、视图和字段合同合法 |
| `contractStatus` | `rejected` | 请求身份或视图不属于正式目录 |
| `dataStatus` | `connected` | 当前工作页的登记适配器已返回完整受信投影 |
| `dataStatus` | `partial` | 只返回能够直接证明的字段，其余字段显式列入`unavailableFields` |
| `dataStatus` | `not_connected` | 权威业务投影服务尚未接入 |
| `dataStatus` | `unknown_or_stale` | 来源、修订、身份或时效不能共同证明当前事实 |

`contractStatus=ready`不得被解释为训练、任务、审核或资源运行正常。

接入数据的`result`必须增加`unavailableFields`和`provenance`。`provenance`至少包含`sourceIdentity`、`writerIdentity`、`observedAtUtc`、`sourceRevision`、`evidenceReferences`和`trustStatus`。瞬时本机资源与当前查询进程允许使用`trustStatus=direct_observation`；此时必须明确探测器身份和采样时间，不得冒充持久登记或不可变历史证据。

## 5. 空值与结果合同

权威数据未接入时：

```json
{
  "records": null,
  "total": null,
  "nextCursor": null,
  "reasonCode": "authoritative_projection_service_not_connected"
}
```

禁止返回`records: []`、`total: 0`、`success`或`idle`冒充真实空结果。

通过固定新平台主登记的Schema、登记身份、修订、写入器、完整工作页集合和SHA-256校验后，`records: []`与`total: 0`可以表达“来源已连接且当前确实没有登记记录”。此时必须同时返回`dataStatus=connected`、`trustStatus=verified_registry`、正式`sourceIdentity`和`sourceRevision`；缺少任一证明仍按`not_connected`或`unknown_or_stale`处理。

### 5.1 新平台主登记

AP-03、AP-04和AP-09的基础记录使用固定登记身份`ai_console_primary_registry`，Schema为`ai_console_primary_registry_v1`，逻辑路径为`data/ai-console/registry/primary-registry-v1.json`。登记只包含新AI控制台的15个工作页记录集，`sourceBoundary`固定为`new_ai_console_only`。V13后AP-03模型结构与训练计划的在线权威投影由第5.10节独立训练设计登记覆盖；V14后AP-04审核合同、审核结果与失败分类由第5.11节审核裁决登记覆盖；V15后AP-02发布活动状态与AP-06候选/Frame由第5.12节运行发布登记覆盖。基础主登记不得据此取得写入、训练或审核执行权。页面字段之外的键、必填字段缺失、机器类型错误或摘要冲突均必须失败关闭。

### 5.2 新平台控制事件账本

控制事件Schema固定为`ai_console_control_event_v1`，机器Schema位于`data/ai-console/schemas/ai-console-control-event-ledger-v1.schema.json`。主表固定为`.runtime/ai-console/control/control-event-ledger-v1.jsonl`，Head固定为`.runtime/ai-console/control/control-event-ledger-head-v1.json`，登记身份固定为`ai_console_control_event_ledger`，写入器固定为`ai_console_control_event_ledger_writer_v1`，来源边界固定为`new_ai_console_only`。

每条事件必须包含`eventId`、`eventSequence`、`previousEventSha256`、`commandId`、`executionId`、`sourceState`、`targetState`、`transactionId`、`occurredAtUtc`、`evidencePath`、`evidenceSha256`和`eventSha256`。`eventId`与`transactionId`从命令身份和版本化域分隔串确定性计算；`eventSha256`覆盖除自身外的完整事件。Head的修订和事件数必须相等，并绑定最后事件身份与摘要。

### 5.3 新平台控制提交事务

事务库固定为`.runtime/ai-console/control/control-transactions-v1.sqlite`，Schema为`ai_console_control_transaction_registry_v1`，登记身份为`ai_console_control_transaction_registry`，写入器为`ai_console_control_transaction_writer_v1`，来源边界为`new_ai_console_only`。机器记录Schema位于`data/ai-console/schemas/ai-console-control-transaction-registry-v1.schema.json`。

每条事务包含`transactionId`、`transactionSequence`、`commandId`、`eventId`、`commitSurfaceSet`、`commitStatus`、`recoveryStatus`、`receiptPath`、`receiptSha256`、`eventSequence`、`eventSha256`、`eventLedgerRevision`、`committedAtUtc`、`previousTransactionSha256`和`transactionRecordSha256`。四个固定提交表面为`command_receipt`、`control_event`、`event_ledger_head`和`sqlite_transaction_registry`。事务序号与注册表修订单调递增，事务摘要覆盖除自身外的完整记录。

### 5.4 新平台正式证据索引

证据索引固定为`.runtime/ai-console/evidence/formal-evidence-index-v1.sqlite`，Schema为`ai_console_formal_evidence_index_v1`，登记身份为`ai_console_formal_evidence_index`，写入器为`ai_console_formal_evidence_index_writer_v1`，来源边界为`new_ai_console_only`。机器记录Schema位于`data/ai-console/schemas/ai-console-formal-evidence-index-v1.schema.json`。

每个登记批次必须绑定唯一`registrationId`、索引修订、控制事务及序号、命令身份、首末证据序号、批次证据链头、前序登记摘要和登记摘要。每批恰好包含`command_receipt`、`control_event_ledger`、`control_event_ledger_head`、`control_transaction_registry`四条记录。

每条正式证据记录包含`evidenceId`、`evidenceSequence`、`registrationId`、`evidenceType`、`logicalPath`、`mediaType`、`contentByteLength`、`contentSha256`、`sourceRevision`、`sourceBindingSha256`、`transactionId`、`commandId`、`registeredAtUtc`、`storageMode`、`integrityStatus`、`previousEvidenceRecordSha256`和`evidenceRecordSha256`。`evidenceId`由类型、逻辑路径和内容摘要确定性计算；原始字节以`embedded_immutable_blob`保存在同一SQLite事务中。首次登记冻结`firstEligibleTransactionSequence`，更早事务不得补录。

### 5.5 精确证据详情与跨表面对账

`GET /api/ai-console/evidence/artifacts/{evidenceId}`只接受64位小写十六进制身份，并必须通过回环URL、`Host`和存在时的`X-Forwarded-Host`检查。响应Schema固定为`ai_console_formal_evidence_artifact_detail_v1`，机器Schema位于`data/ai-console/schemas/ai-console-formal-evidence-artifact-detail-v1.schema.json`。成功响应包含`integrityStatus=verified`、`lookupMode=exact_evidence_identity`、完整证据记录和`contentInspection`。

`contentInspection.inspectionMode`只允许`verified_utf8_preview`或`binary_metadata_only`。JSON和JSONL文本检查上限为65536字节，必须返回`previewByteLength`与`previewTruncated`；SQLite不得返回页面文本或可执行内容。所有响应设置`Cache-Control: no-store`和`X-Content-Type-Options: nosniff`。

事务对账记录在原事务字段外增加`registrationId`、`indexRevision`、`reconciliationScope`、四类`*EvidenceId`、`fileConsistencyStatus`、`eventConsistencyStatus`、`sqliteConsistencyStatus`、`indexConsistencyStatus`、`crossSurfaceStatus`、`evidenceRecordCount`、`registrationRecordSha256`和`checkedAtUtc`。五项一致性状态只允许`verified`或内部冲突裁决；冲突时整个API返回`unknown_or_stale`，不得把`conflict`记录当成正常行。

### 5.6 新平台终态任务胶囊

任务胶囊库固定为`.runtime/ai-console/evidence/task-capsule-index-v1.sqlite`，Store Schema为`ai_console_task_capsule_store_v1`，记录Schema为`ai_console_task_capsule_v1`，登记身份为`ai_console_task_capsule_store`，写入器为`ai_console_task_capsule_writer_v1`，来源边界为`new_ai_console_only`。机器记录Schema位于`data/ai-console/schemas/ai-console-task-capsule-v1.schema.json`。

| 字段组 | 固定字段 | 规则 |
|---|---|---|
| 胶囊身份 | `capsuleId`、`capsuleSequence`、`contentSha256`、`capsuleRecordSha256`、`previousCapsuleRecordSha256` | 内容摘要派生胶囊身份；序号单调且记录形成哈希链 |
| 任务目标 | `taskId`、`taskGoal`、`taskGoalSha256` | `taskId`为64位身份；目标去首尾空白且摘要必须重算一致 |
| 能力与输入 | `capabilityDomain`、`capabilityVersionId`、`inputEvidenceSetId`、`inputEvidenceCount` | 能力域使用五类平台枚举；证据身份排序、唯一且由集合派生ID |
| 执行与结果 | `executionId`、`executionSummary`、`executionSummarySha256`、`terminalEventId`、`resultEvidenceSetId`、`resultEvidenceCount` | 执行和终态事件使用固定身份；结果证据集按同一规范派生 |
| 终态边界 | `terminalStatus`、`policyBoundaryReportId`、`startedAtUtc`、`terminalAtUtc` | 终态只允许`succeeded`、`failed_closed`、`cancelled`、`blocked_policy_boundary`；仅政策阻断终态允许且必须绑定报告身份 |
| 来源与登记 | `sourceTaskRegistryIdentity`、`sourceTaskRegistryRevision`、`registeredAtUtc`、`integrityStatus` | 来源固定为`ai_console_task_registry`；修订大于等于1；读回验证通过才显示`verified` |

写入器不接受路径、SQL、目录或客户端自报的胶囊/证据集摘要。同一`taskId`和相同规范化内容幂等返回原胶囊；同一任务的不同内容返回`ai_console_task_capsule_task_identity_conflict`。没有未来平台终态任务时，受验证空库合法返回`connected`、`records=[]`、`total=0`和`sourceRevision=0`。

### 5.7 新平台政策边界正式报告

政策边界报告库固定为`.runtime/ai-console/evidence/policy-boundary-report-index-v1.sqlite`，Store Schema为`ai_console_policy_boundary_report_store_v1`，记录Schema为`ai_console_policy_boundary_report_v1`，登记身份为`ai_console_policy_boundary_report_store`，写入器为`ai_console_policy_boundary_report_writer_v1`，来源固定为`ai_console_policy_boundary_engine`，来源边界为`new_ai_console_only`。机器记录Schema位于`data/ai-console/schemas/ai-console-policy-boundary-report-v1.schema.json`。

| 字段组 | 固定字段 | 规则 |
|---|---|---|
| 报告身份 | `policyBoundaryReportId`、`reportSequence`、`contentSha256`、`policyBoundaryReportRecordSha256`、`previousPolicyBoundaryReportSha256` | 内容摘要派生报告身份；序号单调且记录形成哈希链 |
| 阻断事实 | `boundaryEventId`、`boundaryCategory`、`prohibitedAction`、`failureCode`、`terminalStatus`、`occurredAtUtc` | 边界类别只允许六类固定枚举；终态固定为`blocked_policy_boundary` |
| 影响绑定 | `affectedScope`、`affectedTaskId`、`affectedExecutionId` | 影响范围必填；任务和执行身份可空，非空时必须为64位身份 |
| 发现与保持 | `detectionEvidenceSetId`、`detectionEvidenceCount`、`preservedStateEvidenceSetId`、`preservedStateEvidenceCount` | 两类证据输入必须排序、唯一且至少一条；集合身份由写入器派生 |
| 处置要求 | `preservationRequirement`、`safeAlternativeRequirement` | 必须同时说明保存什么正式状态和允许的安全替代路线 |
| 来源与登记 | `sourcePolicyEngineIdentity`、`sourcePolicyRevision`、`registeredAtUtc`、`integrityStatus` | 来源固定、修订大于等于1；完整读回通过才显示`verified` |

同一`boundaryEventId`和相同规范化内容幂等返回原报告；同一事件的不同内容返回`ai_console_policy_boundary_event_identity_conflict`。正式报告与六类产品规则目录分层：规则目录中的`policyBoundaryReportId`必须保持`null`，只有实际阻断才写正式索引。当前无真实阻断时，受验证空库合法返回`connected`、`records=[]`、`total=0`和`sourceRevision=0`。

### 5.8 新平台任务登记、事件与命令回执

任务登记库固定为`.runtime/ai-console/tasks/task-registry-v1.sqlite`，Store Schema为`ai_console_task_registry_store_v1`，登记身份为`ai_console_task_registry`，写入器为`ai_console_task_registry_writer_v1`，安全执行器为`ai_console_task_registry_executor_v1`，来源边界为`new_ai_console_only`。任务记录Schema位于`data/ai-console/schemas/ai-console-task-registry-v1.schema.json`。

| 记录 | 固定字段 | 规则 |
|---|---|---|
| 元数据 | `storeRevision`、`registryRevision`、`taskCount`、`commandCount`、`eventCount`、两类Head摘要、`metadataSha256` | 每个已保存命令增加Store修订；只有成功任务变更增加登记修订与事件数 |
| 任务当前状态 | `taskId`、`taskSequence`、`queueItemId`、`taskGoal`、`capabilityDomain`、`priority`、`lifecycleStatus`、`taskRevision`、`taskRecordSha256` | 当前只允许`queued`和`cancelled`；任务身份由不可变创建BLOB派生；每次成功变更建立前序状态摘要 |
| 任务事件 | `taskEventId`、`eventSequence`、`commandId`、`taskId`、`eventType`、来源/目标状态、来源/目标优先级、两端任务摘要、`eventRecordSha256` | 只保存登记、优先级调整和取消三类成功事件；全局单调且形成哈希链 |
| 命令回执 | `commandId`、`commandSequence`、`commandType`、`expectedRegistryRevision`、`resultingRegistryRevision`、`inputSha256`、终态、失败码、事件身份、`commandReceiptSha256` | 成功与拒绝均保存；回执形成独立哈希链；拒绝不改变任务事实 |

任务命令API固定为`/api/ai-console/control/tasks`。GET只接受回环读取；POST复用HttpOnly操作员会话、同源和CSRF检查，正文上限8192字节。命令仅允许`create_registered_task`、`set_queued_task_priority`和`cancel_unstarted_task`。优先级为1至9；后两种命令只允许目标处于`queued`。相同命令幂等身份和相同内容返回原回执，不同内容返回`ai_console_task_command_idempotency_conflict`。

### 5.9 新平台能力候选、资格、发布与命令回执

能力生命周期库固定为`.runtime/ai-console/capabilities/capability-lifecycle-v1.sqlite`，Store Schema为`ai_console_capability_lifecycle_store_v1`，登记身份为`ai_console_capability_lifecycle_registry`，写入器为`ai_console_capability_lifecycle_writer_v1`，安全执行器为`ai_console_capability_lifecycle_executor_v1`，来源边界为`new_ai_console_only`。记录Schema位于`data/ai-console/schemas/ai-console-capability-lifecycle-v1.schema.json`。

| 记录 | 固定字段 | 规则 |
|---|---|---|
| 元数据 | `storeRevision`、`registryRevision`、四类实体数量、`commandCount`、`eventCount`、两类Head摘要、`metadataSha256` | 每个已保存命令增加Store修订；只有成功生命周期变更增加登记修订与事件数 |
| 候选当前状态 | `capabilityVersionId`、`candidateSequence`、`capabilityDomain`、父版本、模型、数据发布、训练范式、`qualificationStage`、`candidateStatus`、`candidateRevision`、`candidateRecordSha256` | 候选身份由不可变创建内容派生；每次成功资格或发布登记建立前序候选状态摘要 |
| 资格结果 | `qualificationResultId`、`qualificationGateId`、`gateOrder`、`qualificationStatus`、`evidenceRequirement`、`evidenceSha256`、`failureTerminal`、`qualificationRecordSha256` | 六级门禁顺序固定；每候选每门禁只能登记一次；失败后候选终结且证据必须保留 |
| 能力发布 | `capabilityReleaseIdentity`、`capabilityVersionId`、模型/数据/条件身份、`qualificationSetSha256`、`releaseStatus`、前序/回退身份、`releaseRecordSha256` | 只允许六级全部通过后登记；发布状态固定`registered_inactive`，不得解释为已激活Runtime能力 |
| 迁移评估 | `migrationAssessmentId`、`capabilityDomain`、当前/目标成熟度、外部依赖、机器验收、回退身份、`assessmentRecordSha256` | 当前只提供只读正式表；V12不开放人工写入或等级裁决 |
| 生命周期事件与命令回执 | 命令身份、事件身份、目标身份、来源/目标候选摘要、结果终态、失败码和双哈希链 | 成功与拒绝均保存回执；拒绝不改变能力事实，也不增加登记修订 |

能力命令API固定为`/api/ai-console/control/capabilities`。GET只接受回环读取；POST复用HttpOnly操作员会话、同源和CSRF检查，正文上限12288字节。命令仅允许`register_capability_candidate`、`record_capability_qualification`和`register_qualified_capability_release`。资格证据必须是64位SHA-256；资格不得跳级或重写；发布要求完整资格集合。相同命令幂等身份和相同内容返回原回执，不同内容返回`ai_console_capability_command_idempotency_conflict`。

### 5.10 新平台模型结构、训练计划与命令回执

训练设计库固定为`.runtime/ai-console/training/training-design-registry-v1.sqlite`，Store Schema为`ai_console_training_design_store_v1`，登记身份为`ai_console_training_design_registry`，写入器为`ai_console_training_design_writer_v1`，安全执行器为`ai_console_training_design_executor_v1`，来源边界为`new_ai_console_only`。记录Schema位于`data/ai-console/schemas/ai-console-training-design-v1.schema.json`。

| 记录 | 固定字段 | 规则 |
|---|---|---|
| 元数据 | `storeRevision`、`registryRevision`、模型/计划/命令/事件数量、两类Head摘要、`metadataSha256` | 每个已保存命令增加Store修订；只有成功设计登记增加登记修订与事件数 |
| 模型结构 | `modelStructureId`、`modelSequence`、`capabilityDomain`、`modelFamily`、架构/源码摘要、输入/输出Schema、`parameterCount`、`modelStructureStatus`、`modelStructureRecordSha256` | 内容寻址且不可变；状态固定`registered`；相同创建内容不得登记第二条 |
| 训练计划 | `trainingPlanId`、`planSequence`、`capabilityDomain`、模型结构及其记录摘要、数据/Split身份、种子、分辨率、Epoch预算、父终态规则、优化器摘要、资源档案、`planStatus`、`trainingPlanRecordSha256` | 必须绑定同能力域已登记模型；状态固定`registered_inactive`；不创建Run或调度项 |
| 设计事件与命令回执 | 命令/事件/目标身份、预期/结果修订、输入摘要、终态、失败码和双哈希链 | 成功与拒绝均保存回执；拒绝不改变设计事实，也不增加登记修订 |

训练设计命令API固定为`/api/ai-console/control/training`。GET只接受回环读取；POST复用HttpOnly操作员会话、同源和CSRF检查，正文上限12288字节。命令仅允许`register_model_structure`和`register_training_plan`。模型必须绑定架构与源码SHA-256、输入输出Schema和正整数参数量；计划必须绑定已登记模型、数据/Split、种子、`宽x高`分辨率、Epoch预算、父终态规则、优化器SHA-256和资源档案。相同幂等身份不同内容失败关闭。

### 5.11 新平台审核合同、机器观测终态与命令回执

审核裁决库固定为`.runtime/ai-console/reviews/review-adjudication-registry-v1.sqlite`，Store Schema为`ai_console_review_adjudication_store_v1`，登记身份为`ai_console_review_adjudication_registry`，写入器为`ai_console_review_adjudication_writer_v1`，安全执行器为`ai_console_review_adjudication_executor_v1`，来源边界为`new_ai_console_only`。记录Schema位于`data/ai-console/schemas/ai-console-review-adjudication-v1.schema.json`。

| 记录 | 固定字段 | 规则 |
|---|---|---|
| 元数据 | `storeRevision`、`registryRevision`、合同/结果/命令/事件数量、两类Head摘要、`metadataSha256` | 每个已保存命令增加Store修订；只有成功登记增加登记修订与事件数 |
| 审核合同 | `reviewContractId`、`contractSequence`、`capabilityDomain`、审核器身份/版本、指标定义、阈值方向/值/单位、证据要求、失败码、前序合同、`contractStatus`、`reviewContractRecordSha256` | 内容寻址且冻结；状态固定`registered_frozen`；前序合同必须为同能力域同指标 |
| 机器审核结果 | `reviewResultId`、`resultSequence`、`reviewRunId`、验证输入、合同及摘要、审核节点、审核器、指标观测、阈值快照、`reviewStatus`、失败码、影响范围、证据类型/摘要、结果终态、`reviewResultRecordSha256` | 服务端按冻结合同计算唯一终态；同一运行与合同只能登记一次；通过时失败码为空，失败时使用合同失败码 |
| 裁决事件与命令回执 | 命令/事件/目标身份、预期/结果修订、输入摘要、终态、失败码和双哈希链 | 成功与拒绝均保存回执；拒绝不改变合同或审核结果事实 |

审核裁决命令API固定为`/api/ai-console/control/reviews`。GET只接受回环读取；POST复用HttpOnly操作员会话、同源和CSRF检查，正文上限12288字节。命令仅允许`register_review_contract`和`register_machine_review_observation`。观测命令不包含`reviewStatus`、结果终态或失败码；服务端必须重新读取冻结合同、验证审核器身份并以`greater_or_equal`或`less_or_equal`计算唯一结果。相同幂等身份不同内容、缺失合同、审核器冲突、重复裁决或修订冲突均失败关闭。

### 5.12 新平台能力激活、RuntimeFrame候选与正式发布

运行发布库固定为`.runtime/ai-console/runtime/runtime-release-registry-v1.sqlite`，Store Schema为`ai_console_runtime_release_registry_store_v1`，登记身份为`ai_console_runtime_release_registry`，写入器为`ai_console_runtime_release_registry_writer_v1`，安全执行器为`ai_console_runtime_release_executor_v1`，来源边界为`new_ai_console_only`。记录Schema位于`data/ai-console/schemas/ai-console-runtime-release-registry-v1.schema.json`。

| 记录 | 固定字段 | 规则 |
|---|---|---|
| 元数据 | `storeRevision`、`registryRevision`、激活/候选/发布/命令/事件数量、两类Head摘要、`metadataSha256` | 每个已保存命令增加Store修订；只有成功登记增加登记修订与事件数 |
| 能力激活 | `activationId`、`activationSequence`、能力域、V12发布身份/记录摘要、能力版本、资格集合摘要、条件Schema、`previousActivationId`、`activationStatus`、`activationRecordSha256` | 只能绑定V12真实发布；前序激活按能力域维护；当前状态由每能力域最新激活派生 |
| RuntimeFrame候选 | `runtimeFrameCandidateIdentity`、`candidateSequence`、激活身份/摘要、能力域/发布、世界/tick、WorldFacts、条件包、视觉制品、图像/清单摘要、`candidateStatus`、`candidateRecordSha256` | 只能绑定当前激活；状态固定`registered_for_review`；命令只登记既有制品，不生成内容 |
| 正式Frame发布 | `publishIdentity`、`publicationSequence`、`runtimeFrameIdentity`、候选及摘要、激活/能力/世界/tick、V14审核结果及摘要/合同、`previousRuntimeFrameIdentity`、`runtimeFrameStatus`、`publicationRecordSha256` | V14结果必须通过且验证输入等于候选；前序Frame按世界维护；状态固定`registered_formal_unconsumed`，不得据此写入世界 |
| 运行发布事件与命令回执 | 命令/事件/目标身份、预期/结果修订、输入摘要、终态、失败码和双哈希链 | 成功与拒绝均保存回执；拒绝不改变激活、候选或Frame事实 |

运行发布命令API固定为`/api/ai-console/control/runtime`。GET只接受回环读取，并联合返回V12合格发布、V14审核结果与V15登记摘要；POST复用HttpOnly操作员会话、同源和CSRF检查，正文上限12288字节。命令仅允许`activate_qualified_release`、`register_runtime_frame_candidate`和`publish_reviewed_runtime_frame`。客户端不得提交激活状态、候选状态、审核结论或正式Frame状态；缺失外部绑定、非当前激活、未通过/错配审核、前序冲突、世界/tick重复、修订或幂等冲突均失败关闭。

### 5.13 新平台世界控制状态、事件与命令回执

世界控制库固定为`.runtime/ai-console/runtime/world-control-registry-v1.sqlite`，Store Schema为`ai_console_world_control_registry_store_v1`，登记身份为`ai_console_world_control_registry`，写入器为`ai_console_world_control_registry_writer_v1`，安全执行器为`ai_console_world_control_executor_v1`，来源边界为`new_ai_console_only`。记录Schema位于`data/ai-console/schemas/ai-console-world-control-registry-v1.schema.json`。

| 记录 | 固定字段 | 规则 |
|---|---|---|
| 元数据 | `storeRevision`、`registryRevision`、世界/状态/命令/事件数量、事件/回执Head、`metadataSha256` | 每个保存的命令增加Store修订；只有成功状态转换增加登记修订、状态和事件 |
| 世界控制状态修订 | `worldStateRevisionId`、`stateSequence`、`worldId`、`worldRevision`、活动Frame/发布/摘要/tick、`consumptionStatus`、`publishControlStatus`、`visualUpdateStatus`、转换/来源/回退关系、`worldStateRecordSha256` | 逐世界追加，不覆盖；活动Frame必须绑定V15受验证正式发布；创建内容BLOB和公开记录摘要必须一致 |
| 世界控制事件 | `worldControlEventId`、`eventSequence`、命令/世界身份、来源/目标状态修订、目标世界修订/摘要、前序事件摘要、`eventRecordSha256` | 每个成功状态修订恰好一个事件；全局单调并形成哈希链 |
| 命令回执 | 命令序号/类型、全局和世界预期/结果修订、目标、输入摘要、终态、失败码、事件、前序回执摘要和`commandReceiptSha256` | 成功与拒绝均保存；拒绝不改变世界控制事实；相同幂等身份不同内容失败关闭 |

世界控制命令API固定为`/api/ai-console/control/world`。GET只接受回环读取，返回V16当前世界状态和V15正式发布摘要，不初始化或修改库。POST复用HttpOnly操作员会话、同源和CSRF检查，正文上限12288字节，只允许`consume_registered_runtime_frame`、`pause_frame_publish`、`resume_frame_publish`、`rollback_runtime_frame`和`freeze_visual_updates`。消费必须绑定状态为`registered_formal_unconsumed`的V15发布，符合同世界前序Frame链且tick前进；回退必须处于暂停发布状态并指向同世界祖先正式Frame。API不接受客户端状态、摘要、角色、写入器、旧Runtime身份或任意路径。

### 5.14 V20本机精确实时观察与V17训练遥测

资源快照使用`ai_console_local_observability_probe_v1`，`trustStatus=direct_observation`。关键资源字段固定为：

| 字段 | 类型/单位 | 空值规则 | 来源 |
|---|---|---|---|
| `cpuUtilization` | number / percent | CPU采样窗口无有效差值时为null | Node OS采样 |
| `memoryUtilization` | number / percent | 总内存不可用时为null | Node OS采样 |
| `gpuUtilization` | number / percent | GPU探针不可用时为null | 固定`nvidia-smi`只读探针 |
| `vramUtilization` | number / percent | 显存总量不可用时为null | 固定`nvidia-smi`只读探针 |
| `gpuTemperatureCelsius` | number / celsius | 设备不支持时为null | 固定`nvidia-smi`只读探针 |
| `gpuPowerDrawWatts` | number / watt | 设备不支持时为null | 固定`nvidia-smi`只读探针 |
| `diskUtilization` | number / percent | 文件系统容量不可用时为null | Node文件系统采样 |
| `detectedTrainingProcessCount` | integer | 进程探针失败时不得显示0，改为partial | 固定进程只读探针 |

训练遥测库固定为`.runtime/ai-console/observability/training-telemetry-v1.sqlite`，Schema为`ai_console_training_telemetry_v1`，内部写入器为`ai_console_training_telemetry_writer_v1`。它是新平台训练服务的追加式观察登记，不是浏览器控制入口。每条记录固定包含：

```text
sampleId / sampleSequence
runId / executionId / processId
trainingStage / epoch / batchIndex / batchCount / optimizationStep
loss / learningRate / throughputSamplesPerSecond
estimatedCompletionAtUtc / checkpointIdentity
heartbeatAtUtc / reportedAtUtc / reporterIdentity
schemaVersion / recordSha256
```

训练遥测心跳15秒内有效时返回`connected`；库不存在或空时返回`not_connected`；Schema、SQLite或记录摘要冲突及心跳过期返回`unknown_or_stale`。GPU占用、进程存在和脚本名称均不得替代上述字段。浏览器最多保存600个实时点到当前`sessionStorage`形成会话曲线，目标间隔为250毫秒；页面必须标注该曲线不是不可变机器证据，并显示服务端完成时间、接收年龄、往返耗时和慢通道年龄。

## 6. 错误合同

| HTTP状态 | `errorCode` | 场景 |
|---|---|---|
| 400 | `invalid_workspace_identity` | 路由身份格式非法 |
| 400 | `view_not_in_workspace_contract` | 视图不属于当前工作页 |
| 404 | `workspace_not_found` | 模块或工作页不存在 |
| 500 | `catalog_integrity_failure` | 静态目录完整性失败 |
| 400 | `control_command_*_invalid` / `control_command_*_not_allowed` | 控制命令身份、JSON、字段、类型、目标、修订、幂等键或原因不合法 |
| 401 | `local_operator_session_required` / `local_operator_session_invalid` / `local_operator_session_expired` | 缺少、无效或过期的本地操作员会话 |
| 403 | `local_control_loopback_required` / `local_control_same_origin_required` / `local_operator_csrf_invalid` | 回环、同源或CSRF校验失败 |
| 409 | `expected_registry_revision_conflict` / `control_command_receipt_integrity_failure` | 预期修订冲突或已有回执完整性失败 |
| 413 | `control_command_body_too_large` | 控制命令请求体超过4096字节 |
| 503 | 主登记读取器原因码 | 主登记完整性无法证明，安全命令失败关闭 |
| 400 | `formal_evidence_identity_invalid` | 精确证据身份格式非法 |
| 404 | `ai_console_formal_evidence_artifact_not_found` | 正式证据身份不存在 |
| 409 | 正式证据索引完整性原因码 | 证据记录、嵌入字节或公开投影绑定冲突 |
| 400/409 | `capability_command_*` / `ai_console_capability_*` | 能力命令字段、身份、修订、资格顺序、候选终态、发布血缘或幂等关系不合法 |
| 400/409 | `training_design_command_*` / `ai_console_training_*` | 训练设计字段、内容身份、模型依赖、能力域、修订、重复登记或幂等关系不合法 |
| 400/409 | `review_adjudication_command_*` / `ai_console_review_*` | 审核合同或机器观测字段、审核器身份、合同血缘、唯一终态、修订或幂等关系不合法 |
| 400/409 | `runtime_release_command_*` / `ai_console_runtime_*` / `ai_console_capability_activation_*` | 运行发布字段、V12/V14绑定、当前激活、审核资格、前序Frame、世界/tick、修订或幂等关系不合法 |
| 400/409 | `world_control_command_*` / `ai_console_world_control_*` | 世界控制字段、V15正式发布、前序血缘、全局/世界修订、暂停/冻结状态、合法回退或幂等关系不合法 |
| 503 | `ai_console_live_observability_probe_failed` | V20统一实时快照无法形成；不得返回旧平台或缓存历史作为替代 |

所有错误均保持只读且无副作用。

## 7. 隔离规则

1. `/api/ai-console/`不得导入或调用`/api/ai-painter/`。
2. 不得读取已退役`/ai-painter-progress/`页面内容、页面状态、页面私有接口或历史页面资料；旧网址的永久重定向不构成数据来源。
3. 不得通过目录扫描和修改时间推测当前Run、Checkpoint或任务。
4. 后续业务投影必须验证登记修订、来源身份、写入器和不可变证据。
5. 控制服务不得接受客户端角色、任意文件路径、任意执行器身份或未登记命令类型。
6. 当前控制服务不得启动训练、审核、Checkpoint、Runtime、外部进程或Shell，也不得读写旧平台目录。
7. 任务胶囊写入器只接受新平台任务登记终态输入；不得把Codex任务、旧训练任务、目录发现记录或聊天内容转换为本地平台任务胶囊。
8. 政策边界报告写入器只接受固定新平台政策引擎的实际阻断；不得把规则目录、演示数据、聊天判断或旧平台报告转换为正式报告。
9. 任务登记写入器只接受新平台任务服务显式输入；不得扫描目录、读取旧页面、导入外部执行记录或把聊天内容自动转换为任务。执行器未接入前不得产生活动执行身份、进程、心跳或Run身份。
10. 能力生命周期写入器只接受新平台能力命令服务显式输入；不得扫描或导入旧训练、审核、Checkpoint、发布与Runtime记录。V12登记发布固定为非活动状态，不能据此启动或替换任何运行能力。
11. 训练设计写入器只接受新平台训练设计命令服务显式输入；不得扫描、导入或读取旧训练配置、Run、Checkpoint、Stage、审核与Runtime记录。V13计划固定为非活动状态，不能据此创建运行身份或启动训练。
12. 审核裁决写入器只接受新平台审核命令服务显式输入；不得扫描、导入或读取旧验证、审核、训练、Checkpoint、Runtime与证据目录。V14只能登记冻结合同和观测终态，不能据此启动验证、运行审核或改写历史结论。
13. 运行发布写入器只接受新平台运行发布命令服务显式输入，并从V12与V14固定登记按完整身份重新验证来源。不得扫描、导入或读取旧能力发布、候选、RuntimeFrame、训练、审核和世界目录；V15不得生成图像、启动任何运行或消费Frame。
14. 世界控制写入器只接受新平台世界控制命令服务显式输入，并从V15固定登记重新验证正式发布摘要与血缘。不得导入、读取或写入旧World Runtime、`data/world-runtime`、WorldFacts、训练、验证、审核、Checkpoint、Stage或旧页面；“消费”仅表示新平台V16登记状态，不等于游戏世界已消费。
15. 实时观察服务只允许固定只读探针和新平台训练遥测登记；不得接受页面命令、任意进程过滤条件、任意可执行文件、旧页面响应、旧训练目录或Stage4证据路径。
16. 实时GET不得创建训练遥测库。只有新平台内部训练遥测写入器可以创建和追加记录；浏览器、AP-03和AP-08均无写入能力。

## 8. API验收

1. 目录接口返回10模块和52工作页。
2. 52个工作页接口均验证默认业务视图。
3. 非法视图返回400，未知页面返回404。
4. 响应中没有退役页面路径或旧页面API引用；当前执行接口仅允许返回固定当前登记逻辑路径及其显式绑定证据路径。
5. GET请求不写文件、不修改数据库、不启动或停止进程。
6. `partial`记录中的未知字段必须为`null`并列入`unavailableFields`，不得使用0替代未知值；字段字典的`nullable=false`约束在字段可用时生效，不能把传输层不可用伪装成合法业务空值。
7. 控制会话和命令接口分别验证回环、同源、Cookie、CSRF、严格字段、目标修订和请求体上限；无权限请求失败关闭。
8. 主登记核验成功返回`registry_verified`和登记证据SHA-256；预期修订冲突返回`registry_revision_conflict`；重复幂等身份返回相同`commandId`与回执SHA-256。
9. 现有回执通过文件名、命令身份、固定目标、状态组合和`receiptSha256`确定性检查；干净工作区允许尚无回执。
10. 精确回执GET成功时返回`integrityStatus=verified`和固定逻辑路径；不存在返回404，非法身份返回400，完整性冲突返回409，所有失败均不得降级为目录扫描。
11. 控制事件账本逐行校验Schema、序号、哈希链、确定性身份、回执路径与摘要，再与Head修订和链头核对；AP-07事件页只投影通过校验的记录。
12. 控制事务读取必须通过SQLite`integrity_check`、固定表和字段集合、元数据摘要、注册表修订、事务哈希链、回执及事件精确绑定；AP-07“控制提交事务”只投影全部检查通过的记录。
13. 正式证据读取必须通过SQLite`integrity_check`、固定表和字段集合、元数据摘要、登记批次链、证据记录链、嵌入BLOB长度与内容摘要、来源绑定和首次合格事务边界；AP-07“正式证据记录”只投影全部检查通过的记录。
14. 精确证据详情必须按完整身份读取固定索引行并重新验证BLOB；文本上限、截断状态、二进制隔离、`nosniff`和回环Host边界全部生效。
15. 证据对账必须把回执证据、事件账本证据、事件Head证据和事务库证据与同一控制事务逐项联合；五项一致性全部为`verified`才返回受信记录。
16. 任务胶囊读取必须通过SQLite完整性、固定表与列、元数据摘要、记录数量、胶囊序号、内容BLOB、任务/执行/终态身份、输入与结果证据集、终态政策关系和记录哈希链；临时动态测试必须证明幂等、冲突关闭和旧来源拒绝。
17. 政策边界报告读取必须通过SQLite完整性、固定表与列、元数据摘要、记录数量、报告序号、内容BLOB、事件身份、两类证据集、六类边界、阻断终态和报告哈希链；临时动态测试必须证明幂等、冲突关闭、外部来源拒绝和终态拒绝。
18. 任务登记读取必须通过SQLite完整性、固定表与列、元数据摘要、创建BLOB、任务状态链、任务事件链和命令回执链；临时动态测试必须证明任务登记、幂等重放、优先级、取消、修订冲突、终态冲突和外部身份拒绝。
19. 能力生命周期读取必须通过SQLite完整性、固定表集、元数据摘要、候选当前状态、六级资格链、发布链、生命周期事件链和命令回执链；临时动态测试必须证明候选登记、幂等重放、门禁顺序、资格终态、完整资格发布、重复发布、血缘冲突和外部身份拒绝。
20. 训练设计读取必须通过SQLite完整性、固定表列、元数据摘要、创建BLOB、模型/计划内容身份、模型—计划能力域关系、设计事件链和命令回执链；临时动态测试必须证明模型登记、计划登记、幂等重放、重复内容、缺失模型、跨域依赖、修订冲突和外部身份拒绝。
21. 审核裁决读取必须通过SQLite完整性、固定表列、元数据摘要、创建BLOB、合同内容身份与血缘、结果阈值快照、单运行单合同唯一性、裁决事件链和命令回执链；临时动态测试必须证明合同登记、服务端通过/失败计算、幂等重放、缺失合同、审核器冲突、重复裁决、修订冲突和外部身份拒绝。
22. 运行发布读取必须通过SQLite完整性、固定表列、元数据摘要、创建BLOB、能力激活、Frame候选、正式发布、V12/V14外部摘要、事件链与回执链；正式状态固定为未消费，动态测试必须证明审核失败关闭与幂等。
23. 世界控制读取必须通过SQLite完整性、固定表列、元数据摘要、创建BLOB、逐世界状态修订、V15发布摘要/血缘、事件链和回执链；动态测试必须证明首帧/后续消费、幂等、未暂停回退失败关闭、暂停后祖先回退、恢复与冻结。正式空库必须返回`connected · 0`，AP-06及API源码不得包含旧World Runtime读取依赖。
24. V20实时快照必须在GPU可用机器返回真实GPU身份、利用率、显存、温度和功耗，并以250毫秒目标间隔、`no-store`、直接观察来源、单调序号、毫秒起止时间、采样耗时和逐通道采样时间返回。
25. 全局状态条、AP-08和AP-03必须共享客户端单例快照；切换视图不得创建第二套业务状态或读取旧内容。
26. 无训练遥测登记时必须显示训练语义未上报；有登记时必须复核SQLite、固定列集、Schema、sampleSequence、sampleId、recordSha256和心跳时效后才显示训练指标。
27. 当前执行接口必须重新验证正式当前登记及其事务、事件、SQLite和证据绑定；返回的登记修订、任务、Run和机器审核计数必须与AP-01当前/活动、AP-03训练总览及AP-04当前/结果/证据一致。
28. 只有训练遥测Run等于当前`activeExecution.runId`且心跳有效时，AP-03才能显示Epoch、Batch、Loss、吞吐与ETA；GPU占用、进程探针、最近训练终态和历史Run均不能作为替代。
29. 旧控制台根路径、已知子路径和任意深层子路径必须308永久重定向到`/ai-console`；重定向不得读取查询参数、证据、训练状态或旧API。
