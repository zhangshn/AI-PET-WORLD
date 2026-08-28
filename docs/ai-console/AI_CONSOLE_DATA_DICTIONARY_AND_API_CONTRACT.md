# AI控制台数据字典与API合同

更新时间：2026-08-28 19:30:00 +08:00

状态：active-normative-target

文档版本：`AI-CONSOLE-DATA-API-1.0`

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

AP-03、AP-04和AP-09使用固定登记身份`ai_console_primary_registry`，Schema为`ai_console_primary_registry_v1`，逻辑路径为`data/ai-console/registry/primary-registry-v1.json`。登记只包含新AI控制台的15个工作页记录集，`sourceBoundary`固定为`new_ai_console_only`。页面字段之外的键、必填字段缺失、机器类型错误或摘要冲突均必须失败关闭。

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

所有错误均保持只读且无副作用。

## 7. 隔离规则

1. `/api/ai-console/`不得导入或调用`/api/ai-painter/`。
2. 不得读取`/ai-painter-progress/`页面内容、页面状态或页面私有接口。
3. 不得通过目录扫描和修改时间推测当前Run、Checkpoint或任务。
4. 后续业务投影必须验证登记修订、来源身份、写入器和不可变证据。
5. 控制服务不得接受客户端角色、任意文件路径、任意执行器身份或未登记命令类型。
6. 当前控制服务不得启动训练、审核、Checkpoint、Runtime、外部进程或Shell，也不得读写旧平台目录。

## 8. API验收

1. 目录接口返回10模块和52工作页。
2. 52个工作页接口均验证默认业务视图。
3. 非法视图返回400，未知页面返回404。
4. 响应中没有旧平台路径或旧API引用。
5. GET请求不写文件、不修改数据库、不启动或停止进程。
6. `partial`记录中的未知字段必须为`null`并列入`unavailableFields`，不得使用0替代未知值；字段字典的`nullable=false`约束在字段可用时生效，不能把传输层不可用伪装成合法业务空值。
7. 控制会话和命令接口分别验证回环、同源、Cookie、CSRF、严格字段、目标修订和请求体上限；无权限请求失败关闭。
8. 主登记核验成功返回`registry_verified`和登记证据SHA-256；预期修订冲突返回`registry_revision_conflict`；重复幂等身份返回相同`commandId`与回执SHA-256。
9. 现有回执通过文件名、命令身份、固定目标、状态组合和`receiptSha256`确定性检查；干净工作区允许尚无回执。
10. 精确回执GET成功时返回`integrityStatus=verified`和固定逻辑路径；不存在返回404，非法身份返回400，完整性冲突返回409，所有失败均不得降级为目录扫描。
11. 控制事件账本逐行校验Schema、序号、哈希链、确定性身份、回执路径与摘要，再与Head修订和链头核对；AP-07事件页只投影通过校验的记录。
12. 控制事务读取必须通过SQLite`integrity_check`、固定表和字段集合、元数据摘要、注册表修订、事务哈希链、回执及事件精确绑定；AP-07“控制提交事务”只投影全部检查通过的记录。
13. 正式证据读取必须通过SQLite`integrity_check`、固定表和字段集合、元数据摘要、登记批次链、证据记录链、嵌入BLOB长度与内容摘要、来源绑定和首次合格事务边界；AP-07“正式证据记录”只投影全部检查通过的记录。
