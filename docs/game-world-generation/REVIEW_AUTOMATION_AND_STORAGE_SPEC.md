# 审核、自动闭环与存储正式规格

更新时间：2026-08-26 15:30:00 +08:00

状态：active-long-term-review-automation-storage-contract

文档版本：`AI-PAINTER-REVIEW-STORAGE-1.4`

生效日期：`2026-08-26`

替代版本：`AI-PAINTER-REVIEW-STORAGE-1.3`

文档状态：`active_normative_target`

程序符合状态：`program_adoption_pending`

破坏性变更规则：审核语义、阈值、状态机、能力发布门、RuntimeFrame生命周期或正式存储身份改变时必须提升文档版本并重新形成能力发布身份。

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 规格范围

本文定义 AI Painter 的机器审核、自主能力版本发布、失败学习、内部任务票据、训练记录、Token 账本、物理存储、SQLite 索引和只读状态投影。本文不保存某次训练、某张图、某个 Run、某个 Checkpoint 或临时阻断的结果。

Owner职责只引用`DOCUMENT_AUTHORITY_INDEX.md`中的`GOV-OWNER-001`；本规格不定义第二套Owner审批、等待或签名状态。

正式系统记录由本地程序写入 `data/`、`.runtime/`和 SQLite。聊天、页面 GET、Codex 记忆和 Markdown 都不能成为运行状态、授权、审核决定或训练证据。

## 2. 审核链

```text
来源与权属审核
-> VJ-0 身份和绑定审核
-> VJ-1 技术质量审核
-> VJ-2 世界事实与结构审核
-> Professional Aesthetic 审核
-> 全历史构图和语义拓扑审核
-> 能力版本与Runtime发布门
-> 资格登记
```

任一机器硬门禁失败时，图片直接进入失败记录，不得伪造人工或能力发布否决。机器通过只取得当前能力版本声明的后续资格，不能自动成为训练样本；只有已发布能力版本且Runtime发布门通过的候选才能进入正式RuntimeFrame。

能力生命周期只使用总体架构第0.4节定义的正式状态：

```text
change_candidate
-> isolated_implementation
-> cpu_contract_verified
-> readonly_gpu_qualified（需要GPU时）
-> controlled_smoke_completed
-> formal_stage_validation_completed
-> independent_regression_completed
-> machine_release_adjudicated
-> released / rejected / rolled_back
```

第一版与重大能力版本使用同一机器发布门。机器发布拒绝阻止该版本发布，但不能删除或改写机器审核；不存在人工首发特例。新图片不继承旧图片结论，同一图片复审必须生成新的不可变审核记录并保留原记录。

## 3. 完整地图机器硬门禁

机器审核至少覆盖：

- 来源、许可、尺寸、哈希、任务和条件绑定；
- 完整矩形世界、无外部背景、无透明空洞、无悬浮切片；
- 原生高分辨率像素风、世界尺度、对象比例和游戏可读性；
- 道路与指定边界真实接触、可走和碰撞关系；
- 水体存在性、入口/出口、流向、岸线和道路避水；
- 当前季节、生态、对象和 23 通道响应；
- 无预设家园中心、建设空地和规则中央留白；
- 连接实例、主题架构、实例细节、条件几何和 RGB 构图的全历史唯一性；
- 未来动态身份与 WorldFacts 可追溯性。

风格一致和构图多样必须分别记录。不能用风格一致掩盖骨架重复，也不能用构图不同放行风格漂移。

生成前审核失败不得调用图像算力，并保存无图阻断记录；生成后审核失败必须保存真实失败图、失败码、位置、指标、时间和证据路径。

## 4. 道路、水体与岸线审核

道路颜色信号必须按季节与地表状态选择，并通过条件支持的连通分量、覆盖、交集、质心、空间网格、边界接触和完整跨度审核。暖色裸土、旱季草层和岩石高光不能直接计为道路。

水体审核由正式 `terrain_water` 条件决定有水或无水分支：

- 有水：验证淡水信号、覆盖、空间位置、连通、入口/出口、流向和岸线；
- 无水：只识别强蓝主导且局部连续的意外水面，不能把阴影或蓝绿色树冠误判为水。

道路、水文和岸线必须分别执行语义拓扑去重。换槽位、换坐标、换宽度、镜像、旋转、轻微形变或修改局部装饰不能绕过同一模板判定。

审核算法修复必须：

1. 保留原审核和原失败学习；
2. 不修改 RGB、WorldFacts、23 通道或阈值；
3. 保存修复前后指标与算法版本；
4. 对历史通过、历史拒绝、有水、无水和不同季节执行回归；
5. 以新审核记录表达同图复审结果。

## 5. 审核记录合同

每次审核至少保存：

```text
reviewId / recordId / runId
reviewerType / reviewMode
reviewerVersion
inputImagePath / inputImageSha256
taskPackageId / conditionPackId
scores / thresholds / passed
issueCodes / affectedRegions
evidencePaths
trainingEligibility / runtimeEligibility
createdAtUtc / createdAtAsiaShanghai
parentReviewId（复审时）
```

机器批量模式必须明确 `manualVisualInspectionPerformed=false`，不得伪造成逐张人工目视。批量范围必须来自当前能力版本和任务包；范围外记录保持原状态。

## 6. 失败学习

失败记录必须结构化为：

```text
failureFamily
issueCodes
affectedRegions
negativeSampleLabels
judgeGapRecord
dictionaryFixTarget
datasetTarget
modelCapabilityTarget
repairConstraints
```

拒绝图不得进入正样本。机器漏判建立 `judge-gap`，规则缺失建立字典或审核器目标，模型失败建立能力目标。失败学习器必须读取完整历史，不得因为记录数量上限、最新指针或新批次覆盖而丢失旧失败。

有界修复必须保持任务范围、WorldFacts、条件、图片和阈值等不变量；不得用降低门槛、删除证据或无上限重试制造通过。

## 7. 政策边界报告与能力版本变更

证据不能唯一裁决时，本地系统失败关闭当前路线并保存不可变裁决报告；触及长期业务目标、使用许可不明确或未登记付费外部资源、或者不可恢复操作时，必须禁止越界动作并生成不可变`policy-boundary-report`，至少包含：

1. 任务和资产身份；
2. 已知业务结论；
3. 机器发现和阻断码；
4. 不能继续的原因；
5. 合同内安全替代路线或停止结论；
6. 必须保持不变的内容；
7. 禁止副作用；
8. 证据路径；
9. Owner未来主动改变业务目标时需要建立的新版本边界。

报告只供观察，不是审批单、Owner动作请求或程序的常规运行入口；当前执行不得等待报告响应。模型、Loss、数据、审核实现、训练计划或正式能力版本变更必须绑定不可变版本、范围、程序和回归证据，并由本地能力生命周期自主推进。训练、生成、固定验证、机器审核、失败关闭、RuntimeFrame发布或回退及终态记录均不得在内部步骤之间请求人工操作。

能力版本变更和内部任务票据都必须具备幂等身份。重复、范围不符、动作不符、哈希不符或已消费票据必须在写入前失败，并保存拒绝证据。

## 8. 自动闭环边界

本地程序在正式能力版本和任务包范围内自主执行：

```text
读取证据
-> 预检
-> 执行合同动作
-> 自动保存
-> 机器审核
-> 失败分类或资格登记
-> 形成新的状态投影
```

程序必须停止的条件包括：

- 证据不唯一且当前合同没有唯一替代路线；
- 需要改变长期业务目标、来源许可、安全上限或使用付费/不可恢复外部动作；
- 数据不足、来源不明、身份冲突或资源门禁失败；
- 连续失败达到停止条件；
- 能力版本或任务票据缺失、无效或已消费；
- 同一条件已有待审、通过或合同不允许重试的失败记录。

完成一个动作只能进入状态机声明的下一状态。执行包只在记录的能力版本、范围、次数、重试和停止条件内有效。

### 8.1 包内自主判断与内部任务票据

内部任务票据是能力版本内的幂等、防重、状态转换、资源配额和证据记录，不是从Owner派生的权限。本地程序为合法的下一状态生成一次性任务票据；票据记录执行包、能力版本、输入证据、程序血缘、动作、状态转换、输出命名空间和消费身份，不能用聊天内容或`latest.json`替代。

机器审核完成后，程序必须用冻结规则自动进入唯一后续状态：通过则进入资格、发布或Finalization；真实视觉失败则进入`failed_closed`；基础设施失败只有在能力版本明确允许且恢复次数未耗尽时才能恢复；需要修改模型、数据、Loss、审核实现、程序或训练路线时，当前执行进入`failed_closed`并登记`failureCode=capability_change_required`，随后建立新的`change_candidate`能力版本。审核程序和确定性裁决程序负责正式结论，Codex只可提供技术建议。

所有内部票据、决策报告、拒绝理由和状态转换保存到不可变运行目录并索引到SQLite。票据重放、跨包证据、状态跳跃、未登记的程序血缘变化、超出尝试上限或自由动作注入必须在写入前失败关闭。

## 9. 训练与验证记录

训练程序必须自动保存：

- Run 身份、任务、配置和代码版本；
- 数据包、最终 Dataset 选择和四类 split；
- 模型、Stage、父 Checkpoint 路径与哈希；
- 每个 Epoch 的训练、验证、Checkpoint 选择和最坏轨迹指标；
- Token、CPU、内存、GPU、显存、磁盘、网络、耗时和退出状态；
- 条件证据、算法证据、环境与依赖快照；
- Checkpoint、manifest、progress、日志和 SQLite 索引；
- 成功、阻断、失败、取消和恢复事件。

冒烟只证明程序与最小数据路径可运行；Stage 完成只证明该阶段训练完成；Checkpoint 保存只证明资产存在。它们都不能自动证明视觉能力、训练后验证、正式推理或 Runtime 资格。

challenge 和 regression 的内容及指标不得在训练或 Checkpoint 选择期间读取。阶段执行包已经声明的固定训练后validation、预览复现和机器审核由同包自动完成，并在同一包内使用隔离的子证据命名空间；challenge、regression、额外复审或新证据任务使用独立任务票据和独立证据目录。

## 10. Token 账本

图像扩散训练的本地潜空间 Token 定义为“一个去噪样本前向处理的一个潜空间位置”。它不是 NLP Token，也不是 API 计费 Token。

训练程序必须把 `trainingTokenAccounting` 写入 Epoch、Checkpoint 和 Manifest。账本至少包含：

```text
latentSpatialTokens
latentChannelValues
conditionScalars
rgbPredictionPixels
samplePresentations
optimizerSteps
modelForwardPasses
validationTrajectories
calculationVersion
```

旧运行不得改写原 Manifest；需要补充账本时，使用与原 Run 绑定的不可变旁路账本，并保存来源文件哈希和计算版本。

外部服务 Token 和费用只有在服务方返回权威 usage 时才能登记，禁止按字符、时间、图片数或 GPU 用量估算。

## 11. 当前执行登记、实时状态与投影

当前执行登记是本地系统的机器状态，控制台只读投影。任务是否当前、是否活动以及应继续哪个动作，均不得由GET接口、页面组件或目录扫描结果决定。

### 11.1 四类状态身份

| 字段 | 来源 | 定义 | 空值条件 |
|---|---|---|---|
| `currentProjectTask` | 当前执行登记 | 本地系统当前应推进的唯一项目任务，包括实现、训练、验证、审核、裁决或候选规划 | 未建立任务或登记不可验证 |
| `activeExecution` | 任务锁、进程身份、心跳和执行事件联合验证 | 当前真实运行的执行实例 | 不存在合法锁、进程已退出、心跳过期或身份不一致 |
| `latestTrainingTerminal` | 当前执行登记的训练终态子登记 | 最近一次完成或失败关闭的训练Run | 尚无合法训练终态 |
| `selectedHistoricalRun` | 用户查询参数或页面本地选择 | 当前查看的历史Run | 用户未选择历史记录 |

上述四类身份必须在API Schema中分开返回。一次训练失败后，其机器裁决或下一候选规划可以成为新的`currentProjectTask`；原训练仍是`latestTrainingTerminal`。用户选中某个历史Smoke或Stage时，只能改变`selectedHistoricalRun`。

### 11.2 当前执行登记Schema

逻辑路径固定为：

```text
.runtime/ai-painter/current-execution-registry/
├─ current.json
├─ events.jsonl
└─ transactions/<transactionId>.json
```

`current.json`是指向不可变证据的查询记录，至少包含：

```text
schemaVersion
registryIdentity
registryRevision
eventSequence
capabilityVersion
packageId
packageSha256
taskId
taskKind
runId
lifecycleStage
executionState
activity
taskCapsule { path, sha256 }
terminalEvidence { path, sha256, status }
latestTrainingTerminal { runId, path, sha256, status } | null
supersedes { registryRevision, taskId, runId } | null
recordedAtUtc
recordedAtAsiaShanghai
writerIdentity
transactionId
```

`data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json`只登记允许调用的程序入口及其代码血缘，不保存项目当前任务，也不得作为本节当前执行登记的替代。前者回答“哪些入口合法”，后者回答“项目现在推进什么、是否有真实活动执行、最近训练终态是什么”。

`recordedAtUtc`用于审计和显示；合法先后关系只由`registryRevision`和`eventSequence`决定。文件系统修改时间、目录名、Run ID字典序、来源类型和页面轮询时间均不得参与当前身份选择。

### 11.3 唯一写入者与原子事务

当前执行登记的唯一写入者为本地能力生命周期编排器。其他组件只能提交已完成的不可变证据，不得直接写`current.json`。每次更新顺序固定为：

```text
验证前一registryRevision和当前任务身份
-> 重新计算任务胶囊、终态和执行包SHA-256
-> 在SQLite事务内预留新registryRevision与eventSequence
-> 写入同目录临时文件，flush并fsync
-> 以同卷原子替换更新current.json
-> 追加events.jsonl并登记SQLite事件
-> 提交事务并保存transactionId
```

`registryRevision`比较失败、事件序号重复、证据SHA不符或SQLite唯一约束冲突时，必须失败关闭。不得覆盖并发写入，不得为显示正常而只修改指针文件。

### 11.4 合法转换与历史隔离

Smoke、Stage 0/1/2、训练后验证、机器审核、失败裁决和候选规划属于同一能力生命周期中的不同任务类型，不存在全局固定来源优先级。后续任务只能通过合法状态转换和更高的`registryRevision`替代前任。

禁止以下选择行为：

- 某个Smoke目录存在时始终优先返回Smoke；
- 按代码中读取函数的顺序选择第一个非空记录；
- 在不同命名空间内各自选择最新后，不进行全局身份验证就将多个结果组合为一份快照；
- 当当前指针无效时，扫描历史目录并选取一个可解析记录作为降级结果；
- 因用户选中历史Run而改变项目当前任务或下一动作。

历史证据必须保留不可变原始字节。历史Run如需重新执行，必须建立新任务、新Run和新登记修订；不得将原历史Run本身重新标记为活动。

### 11.5 活动执行判定

实时执行状态来自训练控制器、任务锁、真实进程、心跳和不可变事件，不得根据GPU占用推测，也不得把旧`running`文件当成活动任务。`activeExecution`必须同时通过：

1. 任务锁中的`runId`、`packageId`和`capabilityVersion`与当前登记一致；
2. PID存在且进程命令身份符合登记的程序血缘；
3. 心跳未超过能力版本声明的过期时间；
4. 执行状态为`preflight`、`executing`、`validating`、`reviewing`、`adjudicating`或`finalizing`。

任一条件不满足时，不得显示“正在运行”。如果当前登记声明为活动但进程或心跳无效，投影必须标记`unknown_or_stale`并产生只读冲突报告，不得自动补写成功或失败终态。

### 11.6 正式状态与页面活动标签

正式状态不得由控制台另行命名。单次执行只使用总体架构第0.4节定义的执行生命周期：

```text
package_materialized
-> preflight
-> executing
-> validating
-> reviewing
-> adjudicating
-> finalizing
-> completed

任一状态 -> failed_closed
触及冻结政策边界 -> blocked_policy_boundary
```

审核只使用`review_pending -> review_running -> review_passed / review_failed / review_evidence_conflict`。能力变化不作为执行状态保存，而是关闭当前执行并建立`change_candidate`能力版本；政策越界统一为`blocked_policy_boundary`。以上状态均不是等待Owner批准。

页面可以显示“数据准备”“训练”“验证”“审核”“裁决”“归档”等活动标签，但活动标签只是正式状态的`activity`展示。页面显示“空闲”时表示没有活动执行包，不得将“空闲”写为运行终态。

### 11.7 读取失败与中断恢复

控制台读取当前登记时必须验证Schema、修订、写入者、事务、路径边界和SHA-256。任一验证失败时：

```text
currentProjectTask.status = unknown_or_stale
activeExecution = null
stateProjectionIntegrity = evidence_conflict
```

控制台保持GET只读，不得修复指针、补写事件或更改SQLite。本地编排器可依据`transactions/`与SQLite事务日志幂等恢复未完成提交；恢复后必须重新生成完整快照，不得重用损坏指针或历史Run充当恢复结果。

### 11.8 必须通过的状态投影回归

状态投影实现至少必须通过：

1. 旧Smoke、更新Stage 0失败终态和最新候选规划同时存在时，`currentProjectTask`指向规划，`latestTrainingTerminal`指向Stage 0，Smoke仅作历史记录；
2. 选中历史Smoke后，全局当前任务、最近训练终态和下一动作不变；
3. 当前登记SHA不符、证据路径不存在或事务不完整时，返回`unknown_or_stale`，不回退旧Smoke；
4. 两个写入者竞争同一修订时，只有一个事务可提交；
5. 文件更新成功但SQLite事务中断时，恢复程序只能完成原修订或恢复上一完整修订；
6. 旧`running`文件存在但PID或心跳无效时，`activeExecution`为空并显示证据冲突；
7. 任意新增命名空间未经当前登记写入时，不得影响控制台的当前身份。

## 12. 物理存储与 SQLite

AI Painter 独立数据根使用：

```text
D:\AI-PET-WORLD-DATA\hot\runtime
D:\AI-PET-WORLD-DATA\cold\runs
D:\AI-PET-WORLD-DATA\catalog
D:\AI-PET-WORLD-DATA\migrations
```

项目内 `.runtime` 是兼容逻辑入口，只能指向一个正式热层，不能产生第二套可写业务身份。

文件是正式证据，SQLite 是目录和查询层。程序写入运行状态、事件、Manifest、图片、Checkpoint、审核或失败后，必须同步或在 Run 结束时事务化登记 URI、字节数、时间、SHA-256、Run ID 和资产类型。

`latest.json` 只作指针；SQLite 也不能替代原始文件。GET 页面不得递归扫描全部运行目录或补写索引。

完成 Run 进入冷层前必须生成不可变归档 Manifest，记录原相对路径、文件数、总字节、逐文件哈希和归档哈希；只有文件校验和 SQLite 事务成功后才能标记 `archived`。迁移与备份删除只能在生效存储与保留策略已明确允许、绝对目标逐项校验、可恢复证据和内部任务票据齐全时执行；未定义或证据不完整时必须禁止，不进入Owner等待状态。

## 13. 逻辑目录

| 数据 | 逻辑位置 |
|---|---|
| 训练总账 | `.runtime/ai-painter/training-process-ledger/` |
| 运行控制 | `.runtime/ai-painter/training-control/` |
| 当前执行登记 | `.runtime/ai-painter/current-execution-registry/` |
| 训练档案 | `.runtime/ai-painter/training-run-archive/` |
| 训练 Token | `.runtime/ai-painter/training-token-ledgers/` |
| 政策边界报告 | `.runtime/ai-painter/policy-boundary-reports/` |
| 原图库 | `data/world-samples/original-image-library/natural-home-v1/` |
| 样本 Registry | `data/world-samples/registry/<dictionaryVersion>/` |
| 不可变数据包 | `data/world-samples/dataset-packages/<packageId>/` |
| AI辅助冷启动数据包 | `data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/` |
| VisualFactManifest | `.runtime/ai-painter/world-visual-fact-manifests/` |
| 视觉任务与条件 | `.runtime/ai-painter/world-visual-generation-task-packages/` |
| 隔离验证 | `.runtime/ai-painter/ai-assisted-conditional-inference-validation/<runId>/` |
| 正式推理候选 | `.runtime/ai-painter/complete-world-visual-inference/` |
| 失败学习 | `.runtime/ai-painter/auto-visual-judge-learning/` |
| Runtime 合成 | `.runtime/game-map-runtime-compositor/` |
| RuntimeFrame工作区 | `.runtime/game-map-runtime-frame-working/` |
| RuntimeFrame候选 | `.runtime/game-map-runtime-frame-candidates/` |
| RuntimeFrame正式记录 | `.runtime/game-map-runtime-frame/` |
| RuntimeFrame拒绝记录 | `.runtime/game-map-rejected-runtime-frames/` |

所有目录使用不可变身份；页面只读取明确文件或 SQLite 查询结果。

RuntimeFrame生命周期固定为`working -> candidates -> accepted frame / rejected frames`。工作区和候选目录都不能被`/world`读取；只有来自机器发布能力版本并完成机器审核与Runtime发布门的正式记录才能进入`.runtime/game-map-runtime-frame/`及正式晋级存储。第一版与后续能力版本使用同一机器发布规则。

## 14. 控制台边界

训练监控台是只读观察入口，操作台才是受控写操作入口。监控台展示当前任务、Stage、Epoch、参数、数据、Token、硬件、日志、Checkpoint、审核、阻断和能力迁移状态。

历史 Run 按 Run ID 独立查看。没有程序保存的预览、去噪节点或诊断图时，页面必须显示“无证据”，不得伪造图片或把训练原图冒充 Epoch 输出。

GET 页面不得改变台账、更新时间、审核、训练资格或当前指针。控制台按钮只能向本地任务编排器提交任务或项目级决定，页面组件不得直接写业务文件。

## 15. 能力迁移记录

本地自研 AI 能力迁移注册表保存每项能力的当前执行方、目标执行方、成熟度、测试证据、阻断和回退方案。控制台只读展示，不在页面内自动切换执行方。

Codex 可以按项目任务建设代码、编译测试和处理复杂诊断；已达到本地闭环验收的能力由本地系统执行，Codex 降为只读监控与证据核验。迁移不能让 Codex 成为审核、发布或 Runtime 的必要依赖。

## 16. 验收标准

审核、自动闭环与存储系统合格必须证明：

1. 所有写操作在执行前验证能力版本、任务票据和输出边界，并原子登记。
2. 机器审核、能力版本发布验收、训练资格和 Runtime 资格相互独立。
3. 失败、复审和修复证据不可变且可按身份完整追溯。
4. 训练、验证、Token、硬件、Checkpoint 和算法证据由程序自动保存。
5. 实时状态来自最新合法机器证据，不被旧指针覆盖。
6. 文件、SQLite 和物理存储身份一致，可校验、归档和恢复。
7. 页面 GET 只读，历史 Run 分页且不扫描全盘。
8. 关闭 Codex 或丢失聊天不会破坏正式流程和状态解释。

具体 Run、样本、哈希、指标、资源阻断、内部票据消费和历史授权证据只保存在机器记录中，不写入本规格。
