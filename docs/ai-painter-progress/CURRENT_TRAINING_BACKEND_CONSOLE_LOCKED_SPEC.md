# AI Painter 当前训练后端控制台锁定规格

更新时间：2026-08-26 09:37:09 +08:00

状态：active-training-monitor-console-contract

文档版本：`AI-PAINTER-CURRENT-TRAINING-CONSOLE-1.0`

生效日期：`2026-08-26`

文档状态：`active_normative_target`

程序符合状态：`program_adoption_pending`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 0. 状态投影不变量

控制台必须把“训练程序状态”“固定预览机器状态”“正式模型资格”分成三个字段，不得用单一成功状态掩盖预览失败、资源阻断或资格未通过。训练执行期间按Stage 0→1→2展示真实Run、Epoch、父Checkpoint、Token与硬件状态；验证、正式推理、RuntimeFrame和进入世界分别读取各自证据，不得互相推导。

控制台必须另行区分`currentProjectTask`、`activeExecution`、`latestTrainingTerminal`和`selectedHistoricalRun`。顶部“当前任务”只使用`currentProjectTask`；运行指示灯只使用`activeExecution`；最近训练结果只使用`latestTrainingTerminal`；下方历史证据工作区只使用`selectedHistoricalRun`。四者不得共享一个可被覆盖的`currentRun`字段。

服务端快照不得从Smoke、Stage、验证、审核或裁决目录各自选择记录后组装为同一个“当前状态”。当前身份只能来自审核、自动闭环与存储规格第11节定义的当前执行登记。

## 1. 业务目的

`/ai-painter-progress/current-training` 是 AI Painter 训练模块专用实时监控台。桌面端必须在一个视口内保留固定工作台外壳：顶部首先说明当前是否在训练、正在训练的模型、数据包、训练链、Stage、Epoch、Checkpoint、资源和门禁；顶部功能导航中必须放置Stage训练记录与模糊查询入口；点击记录或其他查询模块时，只切换下方单一工作区的局部内容，不得整页跳转或移走顶部实时任务上下文。

该页面与`/ai-painter-progress/natural-home`职责不同：本页面只展示当前或最近运行的实时状态；`natural-home`负责完整地图训练内容和历史记录浏览。任何页面标题、导航或状态投影都不得把两者同时称为唯一“当前训练入口”。

`/ai-painter-progress/current-training/runs/<runId>` 仅保留为可直接定位的兼容证据地址。主监控台内的Stage选择和“查看完整证据”操作都不得导航到该地址：Stage选择只切换下方局部工作区；查看完整证据必须在当前监控台内打开自研`alertdialog`证据弹窗，关闭后保持原工作区、Run选择和URL不变。

该页面只解释程序已经保存的事实。它不是训练启动器，不是数据修复器，也不能替训练程序补记录。

## 2. 自研和目录边界

实现必须保留在现有 AI Painter 模块中，不新建平行后台：

```text
src/app/ai-painter-progress/
├─ progress-client.tsx                         # “当前运行”唯一入口
├─ current-training/
│  ├─ page.tsx                                 # Server page / metadata
│  ├─ current-training-dashboard.tsx           # 自研交互面板
│  ├─ training-dashboard-controls.tsx           # 参数说明和记录模糊查询
│  ├─ runs/[runId]/                             # 单次训练独立详情
│  └─ page.module.css                          # 自研视觉系统
└─ _lib/
   ├─ current-training-dashboard-types.ts      # 前后端共享只读类型
   ├─ training-stage-label.ts                  # Stage统一显示名称
   └─ training-parameter-catalog.ts             # 统一数据字典的查询适配器

src/app/api/ai-painter/current-training/route.ts # GET-only API
src/server/ai-painter-current-training.ts        # 只读证据聚合与短缓存
scripts/check-ai-painter-current-training-dashboard.mjs
data/ai-painter/system-governance/ai-painter-current-training-dashboard-contract-v1.json
data/ai-painter/system-governance/local-ai-model-data-dictionary-v1.json
```

禁止复制第三方训练平台、商业后台、开源 Dashboard 模板或图表代码。本控制台的卡片、搜索下拉、参数说明、表格和 SVG epoch 曲线均由本项目自行实现；不引入外部 UI 或图表依赖。

## 3. 固定数据流

```text
操作人员打开“当前运行”
-> current-training React 展示层
-> GET /api/ai-painter/current-training
-> read-only server aggregator
-> 校验 .runtime/ai-painter/current-execution-registry/current.json
-> 以登记中的路径和SHA-256定向读取任务胶囊、活动执行、最近训练终态及其不可变证据
-> 使用 events.jsonl 和 SQLite 核对登记修订、事件序号与事务身份
-> 独立查询 selectedHistoricalRun 对应的历史证据
-> 补充 config / dataset manifest / source-index / stage manifest /
   policy-boundary-report / ledger + nvidia-smi + Windows只读硬件查询
-> 统一只读快照
```

GET 页面和 GET API 不得写文件、改 SQLite、改训练状态、启动训练、启动推理或生成图片。服务端重型快照共享 `2500ms` 短缓存和同一在途 Promise；客户端必须等待上一轮请求结束后再使用 `setTimeout` 安排下一轮，禁止重入式 `setInterval`。

## 4. 固定面板

当前监控台必须完整显示：

1. 固定顶部任务总览必须分别显示项目当前任务、活动执行和最近训练终态。存在活动训练时，显示训练链、Run、模型、Dataset、Stage总进度、当前Epoch、目标Epoch、父子Checkpoint与资源；不存在活动训练时，明确显示“未在训练”，同时保留`currentProjectTask`和`latestTrainingTerminal`，不得把历史选择或最近训练终态冒充当前任务。
2. CPU、内存、GPU负载、GPU显存四个自研环形仪表盘固定放在页面顶部标题与参数说明/当前终态之间的中部区域，不得隐藏到页签后才可见；仪表盘中心显示百分比，保留线程数、内存实际值、GPU型号和显存实际值，并按正常、偏高、危险三档变色。目标容量、登记容量、实际加载样本和实际 V7 样本继续在“模型与数据”工作区显示；不得引入外部图表库。
3. 模型身份、训练架构、预测目标和23个条件通道。
4. 目标、容量登记与实际 Python Dataset 均须显示 `48/8/4/4`，任一不一致立即显示阻断。
5. 顶部可收起的训练记录下拉入口，支持按 Stage、分辨率、状态和 Run ID 模糊查询；选择后只切换下方工作区。
6. 下方局部Stage详情显示该次训练全部 epoch、曲线、最佳 epoch 和 checkpoint 父子哈希；完整证据按钮使用当前页面内的`alertdialog`弹窗显示Run身份、时间、文件、哈希、父子关系、数据绑定、Token和阻断，不得整页跳转。
7. 新64组逐条容量绑定状态，不得用汇总隐藏单条失败。
8. 当前训练链程序事件和不可变证据路径。
9. 参数说明中心是本地自研AI模型的统一数据字典，不是页面私有提示词集合。字典必须机器可读，并覆盖模型身份、数据与条件、训练过程、Checkpoint与产物、严格复验、机器审核、Token与计算量、硬件与运行环境、能力版本与治理；每项至少保存中文名、英文代码、类别、字段类型、通俗说明、专业解释、阅读规则和权威数据源，并支持中文、英文代码、拒绝码和相关词模糊查询。Epoch表头可直接打开对应说明。
10. 当前电脑硬件状态：CPU型号、负载、物理核心、逻辑线程、频率；内存总量、已用、可用和占用率；GPU型号、负载、温度、显存、驱动和计算进程；所有固定磁盘容量；所有物理网卡状态与链路速率；操作系统、版本、Build、架构、主机名和运行时长。
11. 每个成功训练Run的本地计算账本：训练样本呈现、优化步、去噪样本前向、潜空间位置Token、潜空间通道值、23通道条件标量、验证轨迹、轨迹去噪步、RGB预测帧与像素。主监控台显示当前Run摘要，Stage详情显示该Run完整账本和每Epoch固定Token量。
12. 所有程序生成的数据、Run、Stage、Epoch、内部任务票据、事件、Checkpoint/Manifest/Token证据和训练数据记录必须保存详细时间戳。历史Owner授权仅在旧运行证据区按原始身份显示，不得作为当前状态字段。正式格式至少包含UTC ISO-8601原值，并在可用时同时保存`Asia/Shanghai`值；页面统一显示北京时间到毫秒并保留UTC原值。旧证据未保存时间时必须明确显示“未记录”，禁止用页面刷新时间、文件扫描时间或推测时间补写。
13. 本地能力迁移注册表：逐项展示执行方、目标执行方、迁移状态和准入门禁。页面只能监控，不能从卡片触发迁移、验证、推理或世界运行。
14. 严格复验可视化审核入口：作为顶部一级工作区存在，按不可变复验批次选择；每批展示程序实际保存的全部轨迹图。当前8轨迹批次必须以8张独立卡片展示`conditionLabel`、`seed`、split、状态、耗时和机器拒绝码；点击卡片在当前页面打开`alertdialog`，展示1024×768原图、Record/Run身份、UTC与北京时间、VJ门禁、拒绝码中文解释、受影响区域、修复目标、输出图/审核/manifest/批次报告路径及SHA-256和本地验证Token。没有输出图的失败轨迹只能显示“未生成”，不得使用训练原图或其他轨迹代替。
15. V7训练器必须在每个成功`optimizer.step`后形成Batch级实时事实，并以临时文件、`flush`、`fsync`和同卷原子替换写入当前Stage的`progress.json`。记录至少包含Run/Stage身份、阶段、Epoch/目标、Batch/目标、累计优化步/目标、完成百分比、已耗时、优化步速度、ETA、最新Batch Loss、滚动Epoch Loss、最新Batch耗时、实际Batch样本数、精确本地去噪前向次数、精确本地训练Token、UTC和`Asia/Shanghai`详细时间戳；写入可节流但Epoch末尾和终态必须强制落盘。页面只能展示程序已保存的数据，缺失值显示“未记录”，不得用轮询时间、GPU利用率或Codex Token推算训练进度。

严格复验入口只承担证据读取和人工观察，不得在卡片中代写机器通过、重跑复验、启动训练或修改审核文件。复验图由既有只读图片接口按项目内允许路径提供；批次选择、图片查看和关闭弹窗不得改变URL或顶部训练任务上下文。

### 4.1 Token口径

V7是图像扩散模型，不使用NLP tokenizer。本项目将“一个去噪样本前向处理的一个潜空间位置”定义为一个`本地潜空间Token`。它是本地模型计算量单位，不是文字Token、上下文Token或API计费Token。`GPU active seconds × 1000`旧代理规则已废止，禁止继续显示为Token。

外部模型/API的prompt、completion、total token及费用只有在本地程序收到服务商权威usage对象时才允许入账；不存在该证据时必须标记不可获得或不适用，禁止按时间、字符、图片或费用反推。本地PyTorch训练不得把本地计算量记作外部API Token。

历史成功Run不改写原manifest，而是在`.runtime/ai-painter/training-token-ledgers/<runId>/ledger.json`建立不可变旁路账本；训练器同时把`trainingTokenAccounting`写入epoch、checkpoint和manifest。具体Run的Token数只从对应不可变账本读取，不写入本规格。

硬件采集只允许调用只读的 `Get-CimInstance`、`Get-NetAdapter` 与 `nvidia-smi`；失败时可降级使用 Node `os` 模块。不得采集或展示MAC地址、硬盘序列号、主板/BIOS序列号等与训练监控无关的敏感标识。硬件列表必须在“本机硬件状态”面板内部滚动，不能拉长页面。

桌面端页面根节点固定为 `100vh` 且禁止文档级滚动。顶部任务总览和功能导航保持可见；下方只保留一个当前工作区，64行容量表、Epoch、程序事件、证据、硬件、参数字典和训练记录结果必须在该工作区或各自内容框内纵向/横向滚动。小屏设备允许降级为文档滚动，但不得造成内容不可访问。

桌面端监控台必须使用浏览器全部可用宽度，只保留约10像素安全边距，不得设置1600像素内容上限。主标题、面板标题、指标、参数、表格和事件文字必须按监控距离保持可读，不得为了单视口布局把正文压缩为微小字号；空间不足时优先使用既定框内滚动。

历史训练没有程序保存的诊断图片时，Stage详情必须明确显示缺失事实，禁止伪造图片或把训练原图冒充epoch输出。未来训练程序保存与Run ID绑定的固定验证预览、阶段最佳图和关键去噪节点后，详情页才允许显示这些图。

## 5. 状态数据源与投影规则

本规格只定义长期页面合同，不保存某次训练的“当前事实”或运行结论。项目当前任务的唯一查询入口为：

```text
.runtime/ai-painter/current-execution-registry/current.json
```

该文件不是业务证据本体，而是由本地能力生命周期编排器原子维护的查询登记。控制台必须先验证其Schema、`registryRevision`、`eventSequence`、`writerIdentity`、`transactionId`、路径边界和SHA-256，再按登记路径定向读取不可变证据。`events.jsonl`和SQLite用于核对修订、事务和恢复状态。控制台不得通过扫描运行目录、比较文件修改时间、比较Run ID或设置Smoke/Stage/审核/裁决的固定来源优先级来决定当前任务。

当前状态的定向证据至少包括：

- 当前执行登记、追加事件和对应SQLite事务。
- 训练控制状态与非过期运行心跳。
- Dataset manifest、source index和实际加载证据。
- Stage、Checkpoint及Token账本。
- 训练后验证与对账报告。
- 有界修复、Smoke和完整训练finalization。
- 能力版本、执行包及内部任务票据状态；历史研发签名记录仅作为旧运行复核证据，不得启动新任务。
- 本地AI能力迁移注册表。
- GPU、CPU、内存、磁盘和进程只读遥测。

服务端快照必须返回相互独立的字段：

```text
currentProjectTask
activeExecution
latestTrainingTerminal
selectedHistoricalRun
stateProjectionIntegrity
registryRevision
eventSequence
```

`currentProjectTask`、`activeExecution`和`latestTrainingTerminal`只能来自已验证的当前执行登记及其指向证据。`selectedHistoricalRun`只能来自用户查询和历史索引，不得写回登记，也不得改变顶部任务、活动状态、下一动作或最近训练终态。下方历史工作区可以使用SQLite分页和模糊查询，但查询结果不参加当前身份竞争。

同一模型链存在多份历史证据时，必须核对`modelId`、`datasetPackageId`、`checkpointSha256`和训练链或验证批次身份；任务不匹配的证据不得组合。登记无效、路径不存在、SHA不符、事件与SQLite不一致或事务未完成时，固定返回：

```text
currentProjectTask.status = unknown_or_stale
activeExecution = null
stateProjectionIntegrity = evidence_conflict
```

此时不得回退到旧Smoke、旧Stage或任一可读取历史记录。陈旧心跳不得覆盖更新的失败、阻断或终态，旧证据不得删除或改写。资源门禁、Owner主动紧急暂停、内部票据状态、执行失败、验证失败、能力变化和机器发布审核必须使用各自正式状态，不得压缩成单一“失败”或“等待验证”。

训练、验证、复核与失败归因程序必须先在自身终态路径写入不可变报告，再由本地能力生命周期编排器通过审核、自动闭环与存储规格第11节定义的事务更新当前执行登记、程序事件和SQLite索引。Token、资源账本和政策边界报告分别保留独立证据。控制台GET接口保持只读；Codex、浏览器和React组件不得作为登记写入器、状态数据库或闭环依赖。

## 6. 验证门禁

固定检查命令：

```text
npm run check:ai-painter-current-training-dashboard
npx tsc --noEmit
```

浏览器验证至少确认：入口唯一；顶部把项目当前任务、活动执行和最近训练终态分开显示；Stage记录与严格复验入口在顶部；选择Run或复验批次后只局部切换下方工作区；历史选择不改变顶部当前任务、活动状态和下一动作；完整证据和复验图按钮均打开`alertdialog`且URL不变；弹窗可关闭并恢复原工作区；最新完整复验批次显示8张真实轨迹图；监控台文档无纵向滚动；各长内容框可独立滚动；训练记录可模糊查询；统一数据字典可按字段和拒绝码模糊查询；Run/Stage/Epoch/复验/事件/内部票据/64组记录显示程序保存的详细时间戳或明确的“未记录”；每个Run的epoch与证据一致；容量逐行可查；CPU/内存/GPU/磁盘/网卡/系统状态可见；无横向溢出；无浏览器error或warning。生产构建不得打包`.runtime`训练产物。

状态投影回归必须额外覆盖：旧Smoke、更新Stage 0训练终态和最新候选规划同时存在；历史Run切换；当前登记SHA不符；事务中断；旧`running`文件但PID或心跳无效；未登记新命名空间。预期结果必须与审核、自动闭环与存储规格第11.8节一致。任何以函数调用顺序、命名空间类型、目录修改时间或第一个非空结果决定当前任务的实现均不通过。
