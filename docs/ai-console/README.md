# AI控制台文档入口

更新时间：2026-08-30 12:26:57 +08:00

状态：active-module-document-index

文档版本：`AI-CONSOLE-DOC-INDEX-2.5`

生效日期：`2026-08-27`

文档状态：`active_normative_target`

程序符合状态：`v21_current_execution_projection_and_legacy_ui_retirement_connected`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

本目录定义整个本地自研AI平台的全新统一控制台。它不等同、不导航、不嵌入也不调用旧AI Painter训练页面，并且不承担实时运行证据存储。

## 权威文档与职责

| 文档 | 业务作用 |
|---|---|
| `AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md` | 平台总纲：固定产品定位、十模块、四大Frame、观察/控制平面和稳定需求编号。 |
| `AI_CONSOLE_FUNCTIONAL_SPEC.md` | 功能规格：定义用户角色、全局功能、十模块与52个工作页能力、当前实现状态和功能验收。 |
| `AI_CONSOLE_ARCHITECTURE_SPEC.md` | 系统架构：定义应用壳、查询/控制分层、依赖方向、本地运行和失败关闭。 |
| `AI_CONSOLE_INFORMATION_ARCHITECTURE_AND_UI_STANDARD.md` | 信息架构与UI标准：定义路由、固定顶部/左侧主体壳、外层大Frame包含内层ModuleFrame及响应式验收。 |
| `AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md` | 数据与API：定义统一字段、连接状态、页面查询合同、空值和错误语义。 |

阅读顺序固定为：总纲 → 功能规格 → 系统架构 → 信息架构与UI标准 → 数据字典与API合同 → `docs/DIRECTORY_STRUCTURE.md`。

## 关联边界

- `src/app/ai-console/`：AI控制台一级总入口、十个专业模块总览与52个二级业务投影工作台；页面具备业务视图切换、字段筛选、页内定位、上下游、证据关系和可信连接状态，验证控制页支持按完整命令身份精确复核新平台控制回执。
- `src/app/api/ai-console/`：新平台自有的目录、二级页面查询合同和独立控制API；AP-01至AP-10均通过受信适配器返回。除新平台登记外，只允许`observability/current-execution`通过下述唯一桥接器读取AI Painter正式当前执行登记；不得调用旧页面、旧页面API或旧世界Runtime。
- `src/server/ai-console/`：新平台统一只读投影协议、工作页路由、固定主登记读取器和模块投影适配器。AP-01的当前任务/活动执行、AP-03训练总览和AP-04当前审核/结果使用同一AI Painter当前执行投影；队列、设计合同、审核合同及其他平台记录继续读取各自固定新平台登记。
- `src/server/ai-console/ai-painter-current-execution-projection.ts`：唯一允许的AI Painter运行事实桥接器；只调用正式当前执行登记读取器，严格区分当前项目任务、活动执行、最近训练终态和显式历史选择，并重新计算绑定机器审核时间线的SHA-256。禁止扫描Smoke、Stage、Run、审核或历史目录补值。
- `src/app/api/ai-console/observability/current-execution/route.ts`：当前执行无缓存GET；不接受Run、路径或来源参数，不写入文件或数据库，冲突时返回`unknown_or_stale`而不是回退历史记录。
- `src/app/ai-console/ai-console-current-execution-status.tsx`：一级页面当前执行状态面板；每1000毫秒读取上述受信GET，动态显示登记修订、任务、Run、生命周期、活动执行、最近训练终态、机器审核和历史选择状态。
- `src/server/ai-console-observability/`：V20新平台本机精确实时观察服务；使用固定只读探针采样CPU、内存、磁盘、NVIDIA GPU、显存、温度、功耗和训练特征进程，并为每次快照登记毫秒级序号、开始/完成时间、采样耗时及通道时间。进程观测不得冒充正式`activeExecution`、Run、Epoch或Loss。
- `src/app/api/ai-console/observability/live/`：V20统一实时快照GET；返回`ai_console_live_observability_v2`，客户端以250毫秒为目标刷新，显示采样年龄与往返延迟；接口无缓存、无写入，不读取旧页面、旧API、训练目录或旧运行证据。
- `src/app/ai-console/ai-console-live-status.tsx`：跨一级与二级页面固定显示的全局实时状态条；无需离开当前页面即可展开本机资源与训练摘要。
- `src/app/ai-console/ai-console-observability-panel.tsx`：AP-08资源/遥测和AP-03训练总览的专业实时仪表盘；浏览会话曲线与正式持久证据明确分层。
- `src/app/ai-console/ai-console-theme.module.css`：V19明亮企业控制台主题；以暖灰白Canvas、白色ApplicationShell、冷灰白导航与字段层建立主体层级，十个模块使用稳定身份色，成功、等待、失败、人工控制与五类资源指标使用互不混淆的功能色。
- `src/server/ai-console-control/`：新平台独立控制与持久化服务；V16新增正式Frame消费、发布暂停/恢复、合法祖先回退与视觉冻结登记。该控制只改变新平台自己的追加式状态修订，不写游戏世界、WorldFacts、旧Runtime、训练状态或外部进程。
- `src/server/ai-console-control/task-registry-store.ts`：新平台任务SQLite登记；原子保存任务当前状态、任务事件与命令回执三条身份链，严格区分排队、取消和尚未接入的活动执行。
- `src/server/ai-console-control/task-command-service.ts`：新平台任务命令解析与服务边界；只接受登记任务、调整未启动任务优先级和取消未启动任务。
- `src/server/ai-console-control/capability-lifecycle-store.ts`：V12新平台能力生命周期SQLite登记；原子维护候选当前状态、六级资格结果、非活动发布身份、事件与命令回执哈希链。
- `src/server/ai-console-control/capability-command-service.ts`：V12能力命令严格解析边界；只接受候选登记、顺序资格结果登记和完成全部资格后的非活动发布登记。
- `src/server/ai-console-control/training-design-store.ts`：V13训练设计SQLite登记；原子保存不可变模型结构、非活动训练计划、设计事件和命令回执哈希链。
- `src/server/ai-console-control/training-design-command-service.ts`：V13训练设计命令严格解析边界；只接受模型结构登记和绑定已登记模型的非活动训练计划登记。
- `src/server/ai-console-control/review-adjudication-store.ts`：V14审核裁决SQLite登记；原子保存冻结合同、服务端计算的机器审核终态、事件与命令回执哈希链。
- `src/server/ai-console-control/review-adjudication-command-service.ts`：V14审核命令严格解析边界；只接受冻结合同和机器观测值，调用方不能提交审核结论。
- `src/server/ai-console-control/runtime-release-registry-store.ts`：V15运行发布SQLite登记；原子保存合格能力激活、待审核Frame候选、正式未消费Frame、事件与命令回执，并重新验证V12发布和V14通过结果绑定。
- `src/server/ai-console-control/runtime-release-command-service.ts`：V15运行发布命令严格解析边界；只接受发布激活、既有视觉制品候选登记和机器审核通过后的正式Frame登记。
- `src/server/ai-console-control/world-control-registry-store.ts`：V16世界控制SQLite登记；原子保存正式Frame消费、发布控制、合法回退、视觉冻结、事件和命令回执，并重新验证V15正式发布链。
- `src/server/ai-console-control/world-control-command-service.ts`：V16世界控制命令严格解析边界；只接受五种新平台登记命令，并强制预期登记修订、世界修订和幂等身份。
- `src/server/ai-console-control/control-event-ledger.ts`：新平台控制事件账本；只把新安全命令绑定到固定JSONL哈希链和单调Head索引，不扫描回执目录，不迁移旧运行内容。
- `src/server/ai-console-control/control-transaction-store.ts`：新平台控制提交事务库；通过本地SQLite原子事务绑定回执、事件、事件Head与事务记录，维护独立修订、事务哈希链和写后全链复核。
- `src/server/ai-console-control/formal-evidence-index.ts`：新平台正式证据索引；只登记命令链显式提供的四个固定表面，以内容寻址身份和嵌入式不可变BLOB保存原始字节快照，不扫描任何目录。
- `src/server/ai-console-control/task-capsule-store.ts`：新平台任务胶囊持久化层；只接受`ai_console_task_registry`提供的终态任务身份、规范化输入/结果证据集与终态事件，使用内容寻址身份、SQLite原子事务、幂等任务约束和胶囊哈希链保存记录。
- `src/server/ai-console-control/policy-boundary-report-store.ts`：新平台政策边界报告持久化层；只接受固定政策引擎登记的六类实际阻断，以内容寻址BLOB、事件唯一约束、单调序号和报告哈希链保存正式报告。
- `src/server/ai-console/evidence-reconciliation-projection.ts`：新平台证据对账投影；把V7证据登记批次与控制事务按正式身份联合，复核文件、事件、Head、SQLite和索引一致性。
- `src/server/ai-console/task-capsule-projection.ts`：新平台任务胶囊只读投影；固定读取任务胶囊SQLite索引，完整性通过后的真实空库返回`connected · 0`，不扫描任务或训练目录。
- `src/server/ai-console/policy-boundary-report-projection.ts`：新平台政策边界报告只读投影；固定读取V10报告索引，规则合同与实际报告严格分层，完整空库返回`connected · 0`。
- `src/server/ai-console/task-projection.ts`：AP-01只读投影；当前任务与活动执行来自受验证AI Painter当前执行登记，队列与任务事件来自V11固定任务库，闭环拓扑继续来自产品合同。
- `src/server/ai-console/capability-projection.ts`：AP-02只读投影；候选、当前门禁、资格结果和发布基础身份从V12固定能力库读取，发布活动状态联合V15激活登记，资格图与迁移门禁继续作为产品合同分层展示。
- `src/server/ai-console/training-design-projection.ts`：AP-03训练计划与模型结构只读投影；只读取V13固定训练设计库，受验证空库返回`connected · 0`。
- `src/server/ai-console/training-observability-projection.ts`：AP-03训练总览只读投影；先读取当前执行登记，再仅在遥测Run与`activeExecution.runId`精确一致时合并实时训练指标，禁止以GPU占用、历史终态或不同Run遥测伪造活动训练。
- `src/server/ai-console/review-adjudication-projection.ts`：AP-04审核合同与机器裁决登记投影；当前审核、结果和证据由当前执行投影读取其显式绑定且重新验SHA的机器审核时间线，不扫描审核目录。
- `src/server/ai-console/runtime-projection.ts`：AP-06候选与RuntimeFrame只读V15固定运行发布库；世界运行只读V16世界控制库。该适配器不导入World Runtime Adapter、不读取`data/world-runtime`，空库返回`connected · 0`。
- `data/ai-console/`：新平台主登记与Schema；固定路径、独立来源边界、单调修订、可信写入器和SHA-256校验通过后，才允许把真实空登记显示为`connected · 0`。
- `scripts/check-ai-console-structure.mjs`：确定性检查十个模块、52个工作页、七类呈现、产品身份与运行身份分层、固定/响应式主体壳、二级交互合同和UI语言边界。
- `scripts/check-ai-console-primary-registry.mjs`：确定性检查新平台主登记身份、15个记录集、来源隔离和SHA-256。
- `scripts/check-ai-console-control-service.mjs`：确定性检查唯一安全命令、会话与CSRF边界、执行器隔离及现有不可变回执完整性。
- `scripts/check-ai-console-control-event-ledger.mjs`：确定性检查事件序号、前序摘要、事件摘要、事务身份、回执绑定和Head索引一致性。
- `scripts/check-ai-console-control-transaction-store.mjs`：确定性检查SQLite完整性、表结构、元数据摘要、事务序号与哈希链、回执和事件绑定。
- `scripts/check-ai-console-formal-evidence-index.mjs`：确定性检查正式证据索引Schema、登记批次、证据哈希链、嵌入字节摘要、来源绑定和最新固定表面一致性。
- `scripts/check-ai-console-evidence-reconciliation.mjs`：确定性检查精确证据详情边界及回执、事件、Head、事务、索引的跨表面对账。
- `scripts/check-ai-console-task-capsule-store.mjs`：确定性检查胶囊库Schema与来源边界，并在系统临时目录验证首写、幂等复用、身份冲突关闭、旧来源拒绝和完整读回。
- `scripts/check-ai-console-policy-boundary-report-store.mjs`：确定性检查政策报告库Schema与来源边界，并在系统临时目录验证首写、幂等复用、事件身份冲突、外部来源拒绝、终态约束和完整读回。
- `scripts/check-ai-console-task-registry-store.mjs`：确定性检查任务库Schema、三条记录链和来源边界，并在系统临时目录验证登记、幂等、优先级、取消、修订冲突、终态冲突与外部身份拒绝。
- `scripts/check-ai-console-capability-lifecycle-store.mjs`：确定性检查能力库Schema、身份链和来源边界，并在系统临时目录验证候选、六级顺序资格、非活动发布、幂等和各类失败关闭。
- `scripts/check-ai-console-training-design-store.mjs`：确定性检查训练设计库Schema、内容身份、依赖关系和双哈希链，并在临时目录验证模型、计划、幂等、重复登记、跨域与修订冲突。
- `scripts/check-ai-console-review-adjudication-store.mjs`：确定性检查审核裁决库Schema、合同/结果/事件/回执链，并在临时目录验证服务端阈值裁决、一次性终态、幂等与失败关闭。
- `scripts/check-ai-console-runtime-release-registry-store.mjs`：确定性检查V15运行发布库Schema、三类记录、事件/回执链和外部身份绑定，并在临时目录验证激活、候选、失败审核拒绝、通过审核发布与幂等回放。
- `scripts/check-ai-console-world-control-registry-store.mjs`：确定性检查V16世界控制库、来源隔离、事件/回执链和V15发布绑定，并动态验证消费、幂等、暂停、失败关闭、祖先回退、恢复和冻结。
- `.runtime/ai-console/control/command-receipts/`：新控制台安全命令的不可变幂等回执；只保存新平台主登记核验结果，不保存或迁移旧训练证据。
- `.runtime/ai-console/control/control-event-ledger-v1.jsonl`与`control-event-ledger-head-v1.json`：新控制台追加式控制事件和固定Head索引；AP-07事件账本只从这两个精确路径读取。
- `.runtime/ai-console/control/control-transactions-v1.sqlite`：V6后新控制台安全命令的控制提交事务登记；不连接或迁移旧平台数据库。
- `.runtime/ai-console/evidence/formal-evidence-index-v1.sqlite`：V7后新控制台正式证据登记；原子保存命令回执、事件账本、事件Head和控制事务库的内容寻址字节快照，不读取旧平台目录。
- `.runtime/ai-console/evidence/task-capsule-index-v1.sqlite`：V9后新平台终态任务胶囊登记；当前正式库为已连接空库，不补录Codex任务、旧训练任务或历史目录。
- `.runtime/ai-console/evidence/policy-boundary-report-index-v1.sqlite`：V10后新平台政策边界正式报告登记；当前为受验证空库，不创建示例阻断、不回扫旧平台报告。
- `.runtime/ai-console/tasks/task-registry-v1.sqlite`：V11后新平台任务、任务事件与命令回执登记；当前为受验证空库，不导入外部任务、聊天任务或旧训练任务。
- `.runtime/ai-console/capabilities/capability-lifecycle-v1.sqlite`：V12后新平台候选、资格结果、非活动发布、迁移评估、生命周期事件和命令回执登记；当前为受验证空库，不导入旧能力、训练或审核记录。
- `.runtime/ai-console/training/training-design-registry-v1.sqlite`：V13后新平台模型结构与非活动训练计划登记；当前为受验证空库，不导入旧Run、Checkpoint、训练配置或Stage状态。
- `.runtime/ai-console/reviews/review-adjudication-registry-v1.sqlite`：V14后新平台冻结审核合同与机器审核终态登记；当前为受验证空库，不导入旧验证、审核、训练或证据目录。
- `.runtime/ai-console/runtime/runtime-release-registry-v1.sqlite`：V15后新平台能力激活、RuntimeFrame候选与正式未消费Frame登记；当前为受验证空库，不导入旧发布、候选、Frame、世界运行或训练证据。
- `.runtime/ai-console/runtime/world-control-registry-v1.sqlite`：V16后新平台世界控制登记；当前为受验证空库，只接受V15正式Frame，不导入且不写入旧世界Runtime、WorldFacts或训练状态。
- `.runtime/ai-console/observability/training-telemetry-v1.sqlite`：V17新平台训练遥测登记；只有新平台训练服务调用固定内部写入器时创建并追加Run、Epoch、Batch、Loss、学习率、吞吐、ETA、Checkpoint和心跳。当前旧训练不导入，未上报时明确显示`not_connected`。
- `src/app/ai-painter-progress/`：退役路由兼容层；仅允许把旧网址永久重定向到`/ai-console`，不得保留旧UI、状态读取或控制逻辑。
- `docs/ai-painter-progress/`：退役页面的历史设计资料；只用于旧实现复核，不是现行页面、后台、状态或授权规格。
- `src/app/api/ai-painter/`：AI Painter共享后台API；继续服务`ai-painter-lab`等非退役业务，不属于旧页面UI，也不得被新控制台查询层调用。
- `docs/DOCUMENT_AUTHORITY_INDEX.md`：项目文档权威顺序和Owner职责唯一来源。
- `docs/DIRECTORY_STRUCTURE.md`：项目目录职责。

实时状态、训练证据、控制命令和数据库记录必须来自本地程序及其正式机器记录；Markdown只定义长期接口和业务边界。
