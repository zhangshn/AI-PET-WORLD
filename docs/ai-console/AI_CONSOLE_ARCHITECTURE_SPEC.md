# AI控制台系统架构规格

更新时间：2026-08-30 12:26:57 +08:00

状态：active-normative-target

文档版本：`AI-CONSOLE-ARCHITECTURE-1.6`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 文档职责

本文定义AI控制台的系统边界、层次、依赖方向、查询与控制分离以及本地独立运行合同，不重复页面功能清单和字段明细。

## 2. 系统上下文

```text
AI控制台页面
→ 新平台页面查询合同API
→ 受信业务投影适配器（逐模块接入）
→ 本地任务、训练、审核、Runtime和资源服务
→ 本地登记、SQLite与不可变证据
```

控制路径单独建立：

```text
AP-10控制页面
→ 本地控制API
→ 回环会话、同源与CSRF复核
→ 命令验证、修订校验与幂等状态机
→ 已登记的本地安全执行器
→ 结果终态与不可变证据
```

观察路径不得产生写入；控制路径不得绕过命令状态机。

## 3. 前端应用壳架构

```text
ApplicationShell
├─ Topbar                         固定主体框架
├─ Body
│  ├─ PrimaryNavigation          固定主体框架
│  ├─ Workspace                  框架内独立滚动
│  │  ├─ PlatformHeader
│  │  ├─ OperatingLoop
│  │  └─ FrameworkStack
│  │     ├─ Framework            外层大Frame
│  │     │  └─ ModuleFrame[]     内层小Frame
│  │     └─ ...
│  └─ ContextRail                框架内平台上下文
├─ LiveObservabilityBar           跨页面固定实时资源与训练摘要，可页内展开
└─ Statusbar                     固定路由与合同状态摘要
```

外层`Framework`表达业务责任边界，内层`ModuleFrame`表达一级模块，模块内部目录进入二级工作页。不得把模块Frame放到外层Frame之外，也不得把全部模块做成无所属关系的卡片墙。

## 4. 代码分层

| 层 | 代码位置 | 职责 |
|---|---|---|
| 平台目录 | `src/app/ai-console/ai-console-catalog.ts` | 四大Frame、十模块、能力域和一级路由 |
| 工作页目录 | `src/app/ai-console/ai-console-workspace-catalog.ts` | 52工作页、字段、状态、来源和呈现类型 |
| 一级页面 | `src/app/ai-console/page.tsx` | 固定平台壳和嵌套Frame投影 |
| 二级渲染 | `src/app/ai-console/ai-console-workspace.tsx` | 模块总览与工作页统一骨架 |
| 页面交互 | `src/app/ai-console/ai-console-workspace-interactions.tsx` | 视图切换、字段筛选、受信记录选择、结果内检索、只读详情和合同连接 |
| 查询合同API | `src/app/api/ai-console/` | 新平台目录与工作页合同，只读失败关闭 |
| 受信投影协议 | `src/server/ai-console/projection-contract.ts` | 统一连接状态、记录、来源、不可用字段和来源证明 |
| AP-08投影适配器 | `src/server/ai-console/system-projection.ts` | 把统一实时快照投影为资源、服务、健康和遥测工作页；自身不执行命令、不写文件和数据库 |
| V20本机观察服务 | `src/server/ai-console-observability/local-observability.ts` | 在投影层之外通过固定只读命令探测NVIDIA GPU与本机进程，并与Node CPU、内存、磁盘采样形成带序号、毫秒起止时间、耗时与通道时间的统一快照；不接受页面参数、不改变进程状态 |
| V17训练遥测登记 | `src/server/ai-console-observability/training-telemetry-store.ts` | 为未来新平台训练服务提供严格追加式Run/Epoch/Loss等遥测写入器；GET只读，不导入旧训练记录 |
| V20实时API | `src/app/api/ai-console/observability/live/route.ts` | 无缓存GET以`ai_console_live_observability_v2`统一返回资源、GPU、训练特征进程、训练遥测与逐通道毫秒时间合同 |
| V20客户端观察层 | `src/app/ai-console/ai-console-live-observability.ts` | 单例250毫秒目标轮询、组件共享状态、往返延迟和最多600点浏览会话趋势；会话曲线不作为正式证据 |
| V20全局与专业UI | `src/app/ai-console/ai-console-live-status.tsx`、`ai-console-observability-panel.tsx` | 在全部页面固定显示实时条、序号和快照年龄，并在AP-03/AP-08呈现含毫秒时间、采样窗口和通道年龄的专业实时仪表盘 |
| V21当前执行桥接 | `src/server/ai-console/ai-painter-current-execution-projection.ts` | 唯一允许读取AI Painter正式当前执行登记的适配器；调用正式验证器，分离四类运行身份，复核绑定机器审核证据，禁止历史扫描回退 |
| V21当前执行API | `src/app/api/ai-console/observability/current-execution/route.ts` | 无缓存、无参数、无写入GET；只返回受验证当前任务、活动执行、最近训练终态、显式历史选择和机器审核绑定 |
| V19明亮企业主题层 | `src/app/ai-console/ai-console-theme.module.css` | 统一定义暖灰白Canvas、白色壳与内容、冷灰白导航/字段层、模块与Frame身份、状态和数据通道Token；一级页、七类二级呈现、控制合同和实时观察面只消费语义角色，不各自发明调色板 |
| AP-05投影适配器 | `src/server/ai-console/data-projection.ts` | 从新平台正式工作页目录投影实体与字段字典，从正式产品文档投影数据发布准入、六类条件Schema和质量门禁；真实发布、Runtime使用与质量报告身份保持未接入 |
| AP-02投影适配器 | `src/server/ai-console/capability-projection.ts` | 从V12固定能力生命周期库投影候选、门禁、资格和发布基础记录，并联合V15固定运行发布库裁决当前激活、被取代与未激活状态；资格图与迁移门禁继续分层 |
| AP-01投影适配器 | `src/server/ai-console/task-projection.ts` | 当前任务与活动执行读取V21当前执行桥接；排队任务和平台任务事件读取V11固定任务库；闭环拓扑继续投影版本化产品目录 |
| AP-03训练设计投影适配器 | `src/server/ai-console/training-design-projection.ts` | 从V13固定训练设计库投影不可变模型结构与非活动训练计划；训练总览、Checkpoint和Run不由该适配器补齐 |
| AP-03训练运行投影适配器 | `src/server/ai-console/training-observability-projection.ts` | 从V21当前执行桥接取得活动Run和最近终态；只有训练遥测Run与活动Run严格一致时合并Epoch、Loss和ETA |
| AP-04审核裁决投影适配器 | `src/server/ai-console/review-adjudication-projection.ts` | 从V14固定审核裁决库投影冻结合同和自主裁决登记；当前验证、结果与证据改由V21桥接读取当前登记显式绑定的机器审核时间线 |
| AP-06投影适配器 | `src/server/ai-console/runtime-projection.ts` | 候选与RuntimeFrame只读取V15固定运行发布库；世界运行只读取V16固定世界控制库。不得导入旧World Runtime Adapter或读取`data/world-runtime` |
| AP-07投影适配器 | `src/server/ai-console/evidence-projection.ts` | 路由正式证据、事件、任务胶囊、控制事务、政策边界正式报告以及各类产品合同；实际记录与规则目录按视图分层 |
| AP-07正式证据投影 | `src/server/ai-console/formal-evidence-projection.ts` | 从固定V7证据索引投影内容寻址身份、逻辑路径、原始字节摘要、来源修订、登记事务和双哈希链；完整性冲突返回`unknown_or_stale` |
| AP-07证据对账投影 | `src/server/ai-console/evidence-reconciliation-projection.ts` | 按正式登记批次与事务身份联合四类证据、事件及事务记录，向“文件与事件”“SQLite一致性”返回跨表面完整性裁决；冲突失败关闭 |
| AP-07控制事件投影 | `src/server/ai-console/control-event-projection.ts` | 从固定控制事件JSONL和Head索引返回单调事件、状态转换、事务身份与回执绑定；完整性冲突返回`unknown_or_stale` |
| AP-07控制事务投影 | `src/server/ai-console/control-transaction-projection.ts` | 从新控制台独立SQLite事务登记投影控制提交事务；产品门禁视图与真实事务视图保持分层 |
| AP-07任务胶囊投影 | `src/server/ai-console/task-capsule-projection.ts` | 只读验证固定V9任务胶囊SQLite库，返回目标、能力、证据集、执行、终态与政策边界；完整空库返回`connected · 0`，冲突返回`unknown_or_stale` |
| AP-07政策边界报告投影 | `src/server/ai-console/policy-boundary-report-projection.ts` | 只读验证固定V10政策报告SQLite库，返回实际阻断、影响、发现与保持证据、安全替代和记录链；完整空库返回`connected · 0`，冲突返回`unknown_or_stale` |
| 新平台主登记读取器 | `src/server/ai-console/registry-store.ts` | 只读取固定的`data/ai-console/registry/primary-registry-v1.json`，验证Schema、登记身份、单调修订、可信写入器、15个工作页集合和SHA-256；禁止目录扫描 |
| AP-03其余页面/AP-04当前验证与证据/AP-09投影 | `src/server/ai-console/registry-projection.ts` | 对主登记记录逐字段验证名称、必填项和机器类型；校验后的真实空集允许返回`connected · 0`，任何冲突失败关闭 |
| AP-10命令目录投影 | `src/server/ai-console/control-projection.ts` | 投影命令定义、目标类型、角色、验证规则、参数Schema和安全边界；执行器未登记时返回`partial`并保持无写入 |
| 工作页投影路由 | `src/server/ai-console/workspace-projection.ts` | 只按正式工作页身份选择新平台投影适配器，未登记适配器失败关闭 |
| 本地操作员会话 | `src/server/ai-console-control/operator-session.ts` | 只向回环地址签发短时服务端签名会话；变更请求必须同时通过同源、HttpOnly Cookie与CSRF复核 |
| 安全命令服务 | `src/server/ai-console-control/control-command-service.ts` | 当前只接受`verify_primary_registry`，固定目标、校验登记修订与幂等身份，只读复核新平台主登记并以`wx`语义写入不可变回执；新回执落盘后立即按严格Schema重新读取验证 |
| 控制事件账本 | `src/server/ai-console-control/control-event-ledger.ts` | 对V5后安全命令建立固定JSONL哈希链和原子替换Head索引；使用进程队列、跨进程短锁、单调序号、前序摘要和写后复核，禁止目录扫描 |
| 控制提交事务库 | `src/server/ai-console-control/control-transaction-store.ts` | 使用Node本地SQLite和`BEGIN IMMEDIATE`原子维护V6事务、元数据修订与事务哈希链；写后重新核对数据库、回执、事件和事件Head，不读取旧数据库 |
| 正式证据索引 | `src/server/ai-console-control/formal-evidence-index.ts` | 使用独立SQLite原子保存V7四个固定控制表面的原始字节BLOB、内容寻址身份、来源绑定、证据链与登记批次链；只接受命令服务显式输入，不提供目录扫描器 |
| 任务胶囊持久化层 | `src/server/ai-console-control/task-capsule-store.ts` | 只接受新平台任务登记终态输入，派生证据集与内容寻址身份，在SQLite原子事务中写入不可变BLOB、单调序号、任务唯一约束、记录链和元数据 |
| 政策边界报告持久化层 | `src/server/ai-console-control/policy-boundary-report-store.ts` | 只接受固定新平台政策引擎的六类阻断输入，派生两类证据集与内容寻址身份，在SQLite原子事务中写入不可变BLOB、单调序号、事件唯一约束、报告链和元数据 |
| 任务登记持久化层 | `src/server/ai-console-control/task-registry-store.ts` | 使用独立SQLite与`BEGIN IMMEDIATE`原子维护任务当前状态、追加任务事件、不可变命令回执和三条哈希链；来源边界固定为`new_ai_console_only` |
| 任务命令服务 | `src/server/ai-console-control/task-command-service.ts` | 严格解析登记任务、调整未启动任务优先级和取消未启动任务；拒绝外部身份、未知字段、旧修订、幂等冲突与非法状态转换 |
| 能力生命周期持久化层 | `src/server/ai-console-control/capability-lifecycle-store.ts` | 使用独立SQLite与`BEGIN IMMEDIATE`原子维护候选当前状态、六级资格结果、非活动发布、预留迁移评估、生命周期事件和命令回执；来源边界固定为`new_ai_console_only` |
| 能力命令服务 | `src/server/ai-console-control/capability-command-service.ts` | 严格解析候选登记、顺序资格结果和已资格化非活动发布登记；拒绝未知字段、旧修订、门禁跳级、证据摘要错误、资格不完整、血缘冲突与幂等冲突 |
| 训练设计持久化层 | `src/server/ai-console-control/training-design-store.ts` | 使用独立SQLite与`BEGIN IMMEDIATE`原子维护不可变模型结构、非活动训练计划、设计事件和命令回执；来源边界固定为`new_ai_console_only` |
| 训练设计命令服务 | `src/server/ai-console-control/training-design-command-service.ts` | 严格解析模型结构与训练计划登记；计划必须绑定同能力域已登记模型，拒绝未知字段、旧修订、重复内容、跨域依赖与幂等冲突 |
| 审核裁决持久化层 | `src/server/ai-console-control/review-adjudication-store.ts` | 使用独立SQLite与`BEGIN IMMEDIATE`原子维护冻结审核合同、服务端计算的机器审核终态、裁决事件和命令回执；来源边界固定为`new_ai_console_only` |
| 审核裁决命令服务 | `src/server/ai-console-control/review-adjudication-command-service.ts` | 严格解析审核合同与机器观测登记；不接受客户端结论，拒绝未知字段、旧修订、合同/审核器冲突、重复裁决与幂等冲突 |
| 运行发布持久化层 | `src/server/ai-console-control/runtime-release-registry-store.ts` | 使用独立SQLite与`BEGIN IMMEDIATE`原子维护能力激活、Frame候选、正式未消费Frame、事件和命令回执；读取时重新验证V12发布和V14通过结果 |
| 运行发布命令服务 | `src/server/ai-console-control/runtime-release-command-service.ts` | 严格解析合格发布激活、现有视觉制品候选登记和已通过审核Frame发布；不接受客户端资格或审核结论，不执行生成或世界消费 |
| 世界控制持久化层 | `src/server/ai-console-control/world-control-registry-store.ts` | 使用独立SQLite与`BEGIN IMMEDIATE`原子维护逐世界状态修订、控制事件和命令回执；每次消费或回退重新验证V15正式发布摘要与同世界血缘 |
| 世界控制命令服务 | `src/server/ai-console-control/world-control-command-service.ts` | 严格解析消费、暂停、恢复、合法回退与视觉冻结；强制全局登记修订、逐世界修订和幂等身份，只写新平台世界控制库 |
| 控制API | `src/app/api/ai-console/control/` | 只接受回环地址，签发本地操作员会话、查询安全执行器状态、提交主登记核验和按精确命令身份读取回执；成功复核返回`integrityStatus=verified`和固定逻辑路径，禁止任意路径与目录扫描 |
| 任务控制API | `src/app/api/ai-console/control/tasks/` | 复用本地操作员会话、同源与CSRF边界；GET只读返回任务库修订和排队摘要，POST只调用V11任务登记执行器，不启动任何进程 |
| 能力控制API | `src/app/api/ai-console/control/capabilities/` | 复用本地操作员会话、同源与CSRF边界；GET只读返回V12能力库修订和候选/发布摘要，POST只调用V12三种登记执行器 |
| 训练设计控制API | `src/app/api/ai-console/control/training/` | 复用本地操作员会话、同源与CSRF边界；GET只读返回模型/计划摘要，POST只调用V13设计登记执行器，不创建Run、不调度资源、不启动训练 |
| 审核裁决控制API | `src/app/api/ai-console/control/reviews/` | 复用本地操作员会话、同源与CSRF边界；GET只读返回合同/结果摘要，POST只调用V14登记执行器，由服务端按冻结阈值计算终态，不启动或重跑审核 |
| 运行发布控制API | `src/app/api/ai-console/control/runtime/` | 复用本地操作员会话、同源与CSRF边界；GET联合V12/V14/V15摘要，POST只调用V15三段式运行发布执行器，不生成图像、不启动训练/审核、不消费Frame或写世界 |
| 世界控制API | `src/app/api/ai-console/control/world/` | 复用本地操作员会话、同源与CSRF边界；GET只读联合V15发布摘要和V16世界控制状态，POST只调用V16五种登记执行器，不写游戏世界或WorldFacts |
| 精确证据详情API | `src/app/api/ai-console/evidence/artifacts/[evidenceId]/` | 只接受回环地址和64位证据身份；重新核验正式索引与嵌入BLOB，文本只读检查限制固定字节数，二进制只返回元数据 |

## 5. 依赖规则

1. UI只能依赖新平台目录和`/api/ai-console/`。
2. `/api/ai-console/`不得导入、调用或转发`/api/ai-painter/`。
3. `/ai-console`是唯一现行控制台；`/ai-painter-progress/*`只能由无状态兼容路由永久重定向到该入口，不能保留旧UI、读取状态或调用旧接口。新平台不得导航、嵌入或读取退役页面资料。
4. 页面目录是静态产品事实，不是运行状态数据库。
5. 权威运行状态必须由受信投影服务验证登记修订、来源和证据；直接机器观察必须带采样时间、探测器与字段不可用原因。固定GPU/进程探针只能输出直接观察，不得据此推断正式训练身份。
6. 控制权限必须由本地服务端验证，不能依赖前端是否显示按钮。
7. Runtime投影只允许读取文档登记的V15运行发布库和V16世界控制库；禁止导入旧World Runtime Adapter、扫描运行目录、按修改时间推断最新记录，禁止借用训练页面查询服务。
8. AP-07产品合同目录不得冒充运行证据；`evidenceId`、`transactionId`和`policyBoundaryReportId`只能来自独立的新平台正式索引，不能从文件名、旧页面API或目录时间推断。
9. 新平台主登记只能从文档登记的固定逻辑路径读取；不得扫描`.runtime/ai-painter`、`data/ai-painter`或任何历史训练目录补全记录。
10. 控制命令定义与命令执行身份必须分层；`executorIdentity`为空时页面只展示合同，不得提交、排队或执行命令。
11. 当前执行身份包括`ai_console_primary_registry_verifier_v1`、任务、能力、训练设计、审核裁决、运行发布和`ai_console_world_control_executor_v1`七个执行器。世界控制执行器仅表示新平台登记意义上的Frame消费与控制状态修订，不代表游戏世界已消费或被修改；七者均不得扩展解释为训练运行、验证启动、审核重跑、Checkpoint选择、视觉生成、游戏世界写入、进程、Shell、业务数据库或旧平台数据库操作权限。
12. 控制回执只写入`.runtime/ai-console/control/command-receipts/{commandId}.json`；文件名、命令身份和内容SHA-256必须一致，已存在身份只能精确读取，不能覆盖。
13. 回执查询必须由调用方提供完整命令身份；服务端不得提供目录枚举、最近文件推断或任意路径参数，页面不得把未知命令显示为真实空历史。
14. 回环边界必须同时验证请求URL、`Host`和存在时的`X-Forwarded-Host`；不得因框架归一化请求URL而忽略非回环主机头。
15. 控制事件主表只允许追加到固定JSONL，Head只允许在短锁内按已验证链原子替换；锁超时、链断裂、Head超前或回执绑定冲突必须失败关闭。
16. 控制事务库固定为`.runtime/ai-console/control/control-transactions-v1.sqlite`；只允许`ai_console_control_transaction_writer_v1`写入，必须启用SQLite完整性检查、固定Schema、FULL同步和数据库忙等待，禁止接受客户端SQL或任意数据库路径。
17. 正式证据索引固定为`.runtime/ai-console/evidence/formal-evidence-index-v1.sqlite`；只允许`ai_console_formal_evidence_index_writer_v1`写入。每批必须恰好登记命令回执、控制事件账本、事件Head和控制事务库四类原始字节，使用嵌入式不可变BLOB、内容寻址身份、双哈希链和首次合格事务边界；禁止接受客户端路径、扫描目录或补录V7以前事务。
18. 精确证据详情必须使用固定动态路由和完整`evidenceId`，不得接受逻辑路径、SQL、目录、媒体类型或字节范围作为身份替代。响应必须设置`nosniff`；文本预览不得超过65536字节，SQLite保持`binary_metadata_only`。
19. 证据对账读取器不得写入或修复任何表面。它必须按`registrationId`、`transactionId`和`commandId`联合四类证据与控制事务，分别裁决文件、事件、SQLite、证据索引及跨表面一致性；任何单项冲突导致整个投影`unknown_or_stale`。
20. 任务胶囊库固定为`.runtime/ai-console/evidence/task-capsule-index-v1.sqlite`；只允许`ai_console_task_capsule_writer_v1`写入，并且来源必须为`ai_console_task_registry`。写入器不得接受任意路径、目录、SQL或旧平台身份；同一任务相同内容幂等返回，不同内容冲突失败关闭。
21. 任务胶囊读取器必须复核SQLite完整性、固定表和列、元数据摘要与数量、胶囊序号、内容BLOB、输入/结果证据集、终态关系和记录哈希链；不得在GET查询中初始化、补录或修复胶囊库。
22. 政策边界报告库固定为`.runtime/ai-console/evidence/policy-boundary-report-index-v1.sqlite`；只允许`ai_console_policy_boundary_report_writer_v1`写入，并且来源必须为`ai_console_policy_boundary_engine`。同一边界事件相同内容幂等返回，不同内容冲突失败关闭。
23. 政策边界报告读取器必须复核SQLite完整性、固定表和列、元数据摘要与数量、单调序号、内容BLOB、发现证据集、保留状态证据集、六类边界、阻断终态和报告哈希链；GET不得初始化、补录或修复报告库。
24. 任务登记库固定为`.runtime/ai-console/tasks/task-registry-v1.sqlite`；只允许`ai_console_task_registry_writer_v1`写入。任务身份由创建内容派生；任务状态修订、任务事件序号与成功变更一一对应，命令回执同时保存成功和失败关闭结果。
25. 任务控制只允许`ai_console_task_registry_executor_v1`执行三种登记级命令，不得启动任务、进程、训练、审核、Runtime或外部服务。相同幂等身份和内容返回原回执，不同内容冲突失败关闭。
26. AP-01队列与平台任务记录读取器必须复核V11 SQLite完整性、固定表列、元数据摘要、创建BLOB、逐任务状态链、全局事件链与命令回执链；当前项目任务和活动执行必须改由V21当前执行桥接读取，不能从排队列表、目录时间或历史Run推测。
27. 能力生命周期库固定为`.runtime/ai-console/capabilities/capability-lifecycle-v1.sqlite`；只允许`ai_console_capability_lifecycle_writer_v1`写入。候选身份由创建内容派生，发布身份由候选、条件Schema和完整资格集合共同派生；成功变更与生命周期事件一一对应，拒绝命令只增加回执修订。
28. 能力控制只允许`ai_console_capability_lifecycle_executor_v1`执行候选登记、顺序资格结果登记和非活动发布登记。六级资格不得跳过、重写或在失败后继续；发布必须绑定全部通过的资格结果，且固定为`registered_inactive`。
29. AP-02读取器必须复核SQLite完整性、固定表集、元数据摘要、候选状态、资格链、发布链、生命周期事件和命令回执链；GET不得初始化、补录或修复能力库，也不得扫描旧训练、审核、发布或Runtime目录。
30. 训练设计库固定为`.runtime/ai-console/training/training-design-registry-v1.sqlite`；只允许`ai_console_training_design_writer_v1`写入。模型和计划身份由规范化创建内容派生，成功登记与设计事件一一对应，拒绝命令只增加回执修订。
31. 训练控制只允许`ai_console_training_design_executor_v1`执行模型结构和非活动训练计划两种登记级命令。计划必须绑定同能力域的受验证模型结构；结果固定为`registered_inactive`，不得入队、启动、暂停、恢复或停止训练。
32. AP-03模型与计划读取器必须复核SQLite完整性、固定表列、元数据、创建BLOB、模型—计划关系、设计事件链和命令回执链；GET不得初始化、补录或读取旧Run、Checkpoint、Stage、审核与Runtime目录。
33. 审核裁决库固定为`.runtime/ai-console/reviews/review-adjudication-registry-v1.sqlite`；只允许`ai_console_review_adjudication_writer_v1`写入。合同与结果身份由规范化创建内容派生，成功登记与裁决事件一一对应，拒绝命令只增加回执修订。
34. 审核控制只允许`ai_console_review_adjudication_executor_v1`执行冻结合同和机器观测两种登记级命令。调用方不得提交通过/失败，服务端必须从合同阈值计算结果；同一运行与合同只允许一个终态。
35. AP-04合同、结果与失败读取器必须复核SQLite完整性、固定表列、元数据、创建BLOB、合同血缘、阈值快照、结果唯一性、事件链和命令回执链；GET不得初始化、补录或读取旧验证、审核、训练、Checkpoint、Runtime与证据目录。
36. 运行发布库固定为`.runtime/ai-console/runtime/runtime-release-registry-v1.sqlite`；只允许`ai_console_runtime_release_registry_writer_v1`写入。激活、候选和正式Frame身份都由规范化绑定内容派生，拒绝命令只增加回执修订。
37. `ai_console_runtime_release_executor_v1`只允许三种命令：完整资格发布激活、当前激活下的既有制品候选登记、匹配V14通过结果的正式Frame登记。正式Frame固定为`registered_formal_unconsumed`，不得进入或修改世界。
38. V15读取器必须复核SQLite完整性、固定表列、元数据、创建BLOB、按能力域激活链、候选绑定、按世界Frame链、事件/回执链，以及V12发布和V14审核记录摘要；GET不得初始化、补录、扫描或读取旧发布、RuntimeFrame、训练与审核目录。
39. 世界控制库固定为`.runtime/ai-console/runtime/world-control-registry-v1.sqlite`；只允许`ai_console_world_control_registry_writer_v1`写入，来源边界固定为`new_ai_console_only`。成功命令增加状态修订与事件，拒绝命令只增加回执。
40. `ai_console_world_control_executor_v1`只允许五种命令：V15正式Frame消费、发布暂停、发布恢复、合法祖先Frame回退和视觉冻结。消费要求同世界前序链与tick前进，回退要求发布已暂停；全部命令不得写游戏世界、WorldFacts或旧Runtime。
41. V16读取器必须复核SQLite完整性、固定表列、元数据、创建BLOB、逐世界修订、事件/回执链、状态转换，以及V15发布记录摘要和血缘；GET不得初始化、补录、扫描或读取`data/world-runtime`、旧训练、旧审核与旧页面目录。
42. V21当前执行桥接只允许读取`.runtime/ai-painter/current-execution-registry/current.json`；必须调用正式登记验证器复核文件指针、追加事件、SQLite事务、单调修订和证据绑定，不能自行遍历`.runtime/ai-painter`。
43. 当前项目任务、活动执行、最近训练终态和显式历史选择是四个独立身份。历史选择只服务只读查询，不能替代当前任务或重新激活旧Run。
44. 当前机器审核只能从当前登记显式绑定的逻辑路径读取；路径必须保持在项目内，文件SHA-256、Run身份、节点数和通过/失败计数必须重新计算一致。
45. 旧`src/app/ai-painter-progress/`只能保留覆盖根路径和任意子路径的永久重定向；不得保留旧UI、状态读取或训练控制。共享证据与仍被其他业务使用的`/api/ai-painter`接口不属于旧UI删除范围。

## 6. 状态与失败关闭

- `contractStatus`表示页面合同是否合法且可读取。
- `dataStatus`表示权威业务数据是否可用。
- 合同成功不等于训练、任务或资源运行正常。
- 数据缺失返回`null`和原因码，不返回推测值。
- 身份、修订、证据或来源冲突时返回明确错误，不回退旧记录。

## 7. 本地独立运行

控制台是本地系统的观察与操作入口，不是Runtime必要依赖。关闭浏览器或外部开发工具后，本地任务、训练、验证、审核、发布、Runtime和证据保存必须继续。

## 8. 架构验收

1. 顶部与左侧目录属于固定ApplicationShell。
2. 四个外层Framework各自包含登记的ModuleFrame。
3. 页面和API无旧训练页面依赖。
4. 查询与控制链分离，GET观察无副作用。
5. 新能力域复用同一十模块架构，不复制第二套控制台。
6. 唯一安全命令通过回环会话、同源、CSRF、目标、修订、幂等和回执完整性检查；未登记执行器保持禁用。
7. 正式证据索引通过SQLite完整性、固定Schema、登记批次、证据链、嵌入字节摘要和来源绑定检查；AP-07默认视图只显示全部校验通过的记录。
8. 精确详情与证据对账保持GET只读；身份、字节、摘要、事件、Head、事务或登记链冲突全部失败关闭，不产生修复写入。
9. 任务胶囊库通过固定来源、内容寻址、任务唯一约束、SQLite事务与完整读回验证；无新平台终态任务时显示受验证空库，不创建示例胶囊。
10. 政策边界报告库通过固定政策引擎、内容寻址、事件唯一约束、SQLite事务与完整读回验证；无实际政策阻断时显示受验证空库，不创建示例报告。
11. 任务登记通过固定写入器、三种安全命令、预期修订、幂等回执、任务状态链和事件链验证；空库显示已连接，活动执行明确保持部分连接且不伪造进程或心跳。
12. V15运行发布通过固定写入器、三段式安全命令、跨登记摘要复核、能力域激活链和世界Frame链验证；空库显示已连接，正式Frame保持未消费且不产生世界写入。
13. V16世界控制通过固定写入器、五种安全命令、全局/逐世界乐观修订、V15发布摘要与祖先链验证；空库显示已连接，所有状态只存在于新平台控制登记且不产生游戏世界或WorldFacts写入。
14. V20实时GET、全局固定状态条、AP-03和AP-08使用同一V2快照合同；250毫秒目标轮询不得创建持久机器事实或调用旧平台，且必须显示实际采样耗时、快照年龄与慢通道年龄。
15. 新平台训练遥测库不存在或心跳失效时显示`not_connected`或`unknown_or_stale`；GPU和进程直接观察继续工作但不得补造Run、Epoch或Loss。
16. V21当前执行GET和AP-01/AP-03/AP-04工作页返回同一登记修订、任务、Run及审核计数；输入冲突失败关闭，旧路径全部308跳转，新入口与动态API保持200。
