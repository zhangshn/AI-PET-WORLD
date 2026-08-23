# 审核、自动闭环与存储正式规格

更新时间：2026-08-24 05:56:04 +08:00

状态：active-long-term-review-automation-storage-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 规格范围

本文定义 AI Painter 的机器审核、能力版本发布验收、失败学习、内部任务票据、训练记录、Token 账本、物理存储、SQLite 索引和只读状态投影。本文不保存某次训练、某张图、某个 Run、某个 Checkpoint 或临时阻断的结果。

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

能力版本发布验收状态固定为：

```text
not_required_released_capability
pending_capability_release_review
capability_release_approved
capability_release_rejected
```

冷启动或重大能力版本发布验收拒绝可以阻止该版本发布，但不能删除或改写机器审核。正式能力版本发布后，单次图片不重复人工审核；新图片不继承旧图片结论，同一图片复审必须生成新的不可变审核记录并保留原记录。

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

## 7. Owner 异常升级与能力版本变更

只有证据不能唯一裁决、需要改变业务范围或需要发布新的模型/数据/阈值能力版本时，本地系统才生成不可变 `owner-action-request`，至少包含：

1. 任务和资产身份；
2. 已知业务结论；
3. 机器发现和阻断码；
4. 不能继续的原因；
5. 最小请求动作；
6. 必须保持不变的内容；
7. 禁止副作用；
8. 证据路径；
9. 获批后的有界执行链。

请求不是决定，也不是程序的常规运行入口。模型、Loss、数据、阈值、训练计划或正式能力版本变更必须绑定不可变版本、范围、程序和回归证据。已发布能力版本内的生成、固定验证、机器审核、失败关闭、RuntimeFrame发布或回退及终态记录由本地系统自主完成，不得在内部步骤之间再次请求人工操作。

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

- 证据不唯一或需要 Owner 业务决定；
- 需要改变来源政策、模型路线、审核门槛、页面结构或任务范围；
- 数据不足、来源不明、身份冲突或资源门禁失败；
- 连续失败达到停止条件；
- 能力版本或任务票据缺失、无效或已消费；
- 同一条件已有待审、通过或合同不允许重试的失败记录。

完成一个动作只能进入状态机声明的下一状态。执行包只在记录的能力版本、范围、次数、重试和停止条件内有效。

### 8.1 包内自主判断与内部任务票据

内部任务票据是能力版本内的幂等、防重、状态转换和证据记录，不是从Owner派生的权限。本地程序为合法的下一状态生成一次性任务票据；票据记录执行包、能力版本、输入证据、程序血缘、动作、状态转换、输出命名空间和消费身份，不能用聊天内容或`latest.json`替代。

机器审核完成后，程序必须用冻结规则自动进入唯一的后续状态：通过则进入资格、发布或Finalization；真实视觉失败则失败关闭；基础设施失败只有在能力版本明确允许且恢复次数未耗尽时才能恢复；需要修改模型、数据、Loss、阈值、程序或业务路线时进入`waiting_owner_decision`。审核程序和确定性裁决程序负责正式结论，Codex只可提供技术建议。

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

## 11. 实时状态与投影

实时状态来自训练控制器、任务锁、真实进程、心跳和不可变事件，不得根据 GPU 占用猜测，也不得把旧 `running` 文件当成活动任务。

状态至少区分：

```text
idle
preflight
dataset_building
training
validating
inference
reviewing
archiving
blocked
failed
completed_waiting_capability_release
waiting_owner_decision
waiting_capability_change
completed
```

状态语义固定为：`completed_waiting_capability_release`只表示冷启动或重大能力版本正在等待项目级发布验收；`waiting_owner_decision`只表示证据不能唯一裁决或存在真实业务路线选择；`waiting_capability_change`表示继续执行需要新的模型、数据、Loss、阈值、训练计划或程序版本；已发布能力版本内的正常生成、验证、审核、发布和记录不得进入上述等待状态，完成后直接进入`completed`或相应失败终态。

状态投影比较任务身份、事件时间和终态优先级。旧 `latest.json` 不能覆盖更新的失败、阻断、暂停或完成证据；无法确定时显示 `unknown_or_stale`。

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

完成 Run 进入冷层前必须生成不可变归档 Manifest，记录原相对路径、文件数、总字节、逐文件哈希和归档哈希；只有文件校验和 SQLite 事务成功后才能标记 `archived`。迁移与备份删除需要单独授权和可恢复证据。

## 13. 逻辑目录

| 数据 | 逻辑位置 |
|---|---|
| 训练总账 | `.runtime/ai-painter/training-process-ledger/` |
| 运行控制 | `.runtime/ai-painter/training-control/` |
| 训练档案 | `.runtime/ai-painter/training-run-archive/` |
| 训练 Token | `.runtime/ai-painter/training-token-ledgers/` |
| Owner 业务决策请求 | `.runtime/ai-painter/owner-action-requests/` |
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

RuntimeFrame生命周期固定为`working -> candidates -> accepted frame / rejected frames`。工作区和候选目录都不能被`/world`读取；只有来自已发布能力版本并完成机器审核与Runtime发布门的正式记录才能进入`.runtime/game-map-runtime-frame/`及正式晋级存储。冷启动能力版本在首次发布前另需项目级发布验收。

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

具体 Run、样本、哈希、指标、资源阻断和授权消费状态只保存在机器记录中，不写入本规格。
