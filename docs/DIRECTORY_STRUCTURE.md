# AI-PET-WORLD 文档与项目目录结构

更新时间：2026-08-28 19:30:00 +08:00

状态：active-directory-reference

文档版本：`AI-PET-WORLD-DIRECTORY-1.4`

生效日期：`2026-08-26`

替代版本：`AI-PET-WORLD-DIRECTORY-1.3`

文档状态：`active_normative_target`

程序符合状态：`program_adoption_pending`

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 项目根目录

| 路径 | 唯一职责 |
|---|---|
| `README.md` | 项目总入口、两大核心业务和当前工作导航。 |
| `AGENTS.md` | 所有智能体必须执行的读取顺序和边界。 |
| `docs/` | 当前有效的业务、架构、数据定义和程序契约；不保存旧文档。 |
| `src/` | 页面、API、AI 管家、世界 Runtime 和游戏地图代码。 |
| `ml/ai-painter/` | 本地视觉模型、训练、推理和数据处理。 |
| `scripts/` | 自动检查、训练、推理、审核、归档和合成入口。 |
| `data/` | 可版本化的结构化事实、字典导出、训练样本和正式记录。 |
| `.runtime/` | 程序自动生成的运行状态、图片、模型、日志、审核和失败证据。 |

## 2. 正式文档目录

```text
docs/
├─ DOCUMENT_AUTHORITY_INDEX.md
├─ DOCUMENTATION_POLICY.md
├─ BUSINESS_SPEC.md
├─ ARCHITECTURE.md
├─ LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md
├─ DIRECTORY_STRUCTURE.md
├─ game-world-generation/
│  ├─ README.md
│  ├─ DOCUMENT_INDEX.md
│  ├─ CURRENT_EXECUTION_GUIDE_20260710.md
│  ├─ AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md
│  ├─ TRAINING_DATA_AND_SOURCE_POLICY.md
│  ├─ REVIEW_AUTOMATION_AND_STORAGE_SPEC.md
│  ├─ FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md
│  ├─ CROSS_MODAL_RGB_COLLAPSE_PREVENTION_SPEC.md
│  └─ CROSS_MODAL_RGB_GATE_THRESHOLD_ALIGNMENT_20260802.md
├─ ai-console/
│  ├─ README.md
│  ├─ AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md
│  ├─ AI_CONSOLE_FUNCTIONAL_SPEC.md
│  ├─ AI_CONSOLE_ARCHITECTURE_SPEC.md
│  ├─ AI_CONSOLE_INFORMATION_ARCHITECTURE_AND_UI_STANDARD.md
│  └─ AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md
├─ world-visual-data-dictionary/
├─ ai-painter-progress/
└─ ziwei/
```

| 路径 | 稳定职责 |
|---|---|
| `docs/DOCUMENT_AUTHORITY_INDEX.md` | 文档优先级和正式入口。 |
| `docs/BUSINESS_SPEC.md` | 两大核心业务和长期业务边界。 |
| `docs/ARCHITECTURE.md` | AI 管家与类地球世界的长期架构。 |
| `docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md` | 本地自研AI能力建设、任务执行和Codex职能迁移主体架构。 |
| `docs/game-world-generation/` | AI Painter正式主体、数据来源、审核发布、补充合同和唯一模块计划表。 |
| `docs/ai-console/` | 新AI控制台的平台总纲、功能规格、系统架构、信息架构与UI标准、数据字典与API合同。 |
| `docs/world-visual-data-dictionary/` | 分层视觉事实、对象、地形、过渡、失败码和训练标签。 |
| `docs/ai-painter-progress/` | AI Painter训练与验证专用后台页面、自动保存、模型对齐、诊断和修复契约；不承担全平台AI控制台定义。 |
| `docs/ziwei/` | AI 管家人格数据子系统的稳定合同。 |

项目唯一模块计划表：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

## 3. 文档清理边界

| 内容 | 处理规则 |
|---|---|
| 旧计划、旧进度表、阶段闭合报告 | 删除，不保留 Markdown 历史副本。 |
| 重复业务说明和重复架构说明 | 合并进 `BUSINESS_SPEC.md` 或 `ARCHITECTURE.md` 后删除。 |
| 当前地图架构规格 | 严格保留目录索引登记的3份核心规格和3份水文/跨模态补充规格，由当前执行指南按任务导航。 |
| 世界视觉数据字典条目 | 84 个条目保存在单一结构化 JSON 权威源；Markdown 只保留 README 和完整打印稿。 |
| 智能体读取视觉字典 | 只读 README、当前导出 JSON 和任务涉及条目，禁止默认全量读取。 |
| 页面与自动化锁定规格 | 保留；程序检查直接依赖这些契约。 |
| 图片、JSON、模型、训练日志、审核记录 | 不属于文档清理范围，继续由程序自动保存。 |

禁止创建 `history/`、`old-docs/`、`archive-docs/` 或新的平行计划目录。

## 4. 两大业务代码边界

| 核心业务 | 主要代码边界 | 主要文档边界 |
|---|---|---|
| AI 管家人格与角色自主 | `src/ai/personality-core/`、`src/ai/destiny-core/`、相关管家运行模块 | `docs/BUSINESS_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/ziwei/` |
| 类地球世界自主运行与生长 | `src/world/`、`src/app/world/`、世界相关 API | `docs/game-world-generation/`、`docs/world-visual-data-dictionary/` |

AI Painter 是类地球世界的视觉表达系统，不能决定世界事实：

| 路径 | 职责 |
|---|---|
| `ml/ai-painter/` | 本地模型训练和推理。 |
| `src/app/ai-console/` | 整个本地自研AI平台的固定应用壳、四个外层业务Frame、十个内层模块Frame和52个二级工作页。 |
| `src/app/api/ai-console/` | 新平台自有的目录、工作页只读查询合同和独立控制API；控制面当前只允许主登记核验，不读取或转发旧AI Painter页面与API。 |
| `src/server/ai-console/` | 新平台受信只读投影协议、固定主登记读取器与模块适配器；当前覆盖AP-01流程、AP-02能力、AP-03训练、AP-04验证审核、AP-05数据、AP-06 Runtime、AP-07证据治理、AP-08本机观察、AP-09归档和AP-10命令定义，只返回可证明的登记、产品合同或直接观察，不扫描旧页面状态及训练运行证据。 |
| `src/server/ai-console-control/` | 新平台独立控制服务；负责回环操作员会话、同源与CSRF复核、命令校验、主登记修订核验、幂等身份和不可变回执，当前不包含训练或Runtime执行器。 |
| `data/ai-console/` | 新平台独立主登记与Schema；当前固定登记AP-03、AP-04、AP-09共15个工作页记录集，使用`new_ai_console_only`来源边界、可信写入器、单调修订和SHA-256，不保存或迁移旧训练页面内容。 |
| `.runtime/ai-console/control/command-receipts/` | 新控制台安全命令不可变回执；当前只保存`verify_primary_registry`结果，使用确定性命令身份、仅创建写入和回执SHA-256。 |
| `.runtime/ai-console/control/control-event-ledger-v1.jsonl` | 新控制台V5后安全命令的追加式事件主表；事件使用单调序号、前序摘要、事务身份和回执证据绑定。 |
| `.runtime/ai-console/control/control-event-ledger-head-v1.json` | 控制事件账本固定Head索引；保存单调修订、事件数和链头身份/摘要，只能由控制事件写入器原子替换。 |
| `.runtime/ai-console/control/control-transactions-v1.sqlite` | 新控制台V6后安全命令的SQLite控制提交事务登记；原子绑定回执、事件、事件Head与事务哈希链，不连接旧平台数据库。 |
| `.runtime/ai-console/evidence/formal-evidence-index-v1.sqlite` | 新控制台V7后正式证据索引；原子保存四个固定控制表面的内容寻址原始字节BLOB、来源绑定、证据链和登记批次链，不扫描或迁移旧平台目录。 |
| `src/app/ai-painter-progress/` | 旧AI Painter训练与验证专用查看入口；与新AI控制台完全解耦，不属于AP-03、AP-04或任何新平台下游目录。 |
| `src/app/api/ai-painter/` | 训练状态、图片、归档和审核 API。 |
| `.runtime/ai-painter/` | 程序自动保存的训练与推理证据。 |

AI Painter现行自主执行使用以下逻辑目录。具体能力或执行未物化时不提前创建其身份目录：

```text
.runtime/ai-painter/
├─ current-execution-registry/
│  ├─ current.json
│  ├─ events.jsonl
│  └─ transactions/<transactionId>.json
├─ autonomous-closed-loop-packages/<packageId>/
│  ├─ package.json
│  └─ manifest.json
├─ autonomous-closed-loop-executions/<packageId>/
│  ├─ execution-state.json
│  ├─ progress.json
│  ├─ heartbeat.json
│  ├─ review-state.json
│  ├─ event-ledger.jsonl
│  ├─ local-task-capsule.json
│  ├─ execution.sqlite
│  ├─ phase-evidence/
│  └─ phase-terminal.json
├─ autonomous-background-launches/<packageId>/
│  ├─ launch-receipt.json
│  ├─ stdout.log
│  └─ stderr.log
├─ capability-lifecycle/<capabilityVersion>/
│  ├─ candidate.json
│  ├─ state.json
│  ├─ lifecycle.sqlite
│  ├─ event-ledger.jsonl
│  └─ evidence/
├─ capability-runtime-tickets/<capabilityReleaseIdentity>/<ticketId>/
│  ├─ internal-capability-ticket.json
│  └─ consumption.json
└─ policy-boundary-reports/<reportId>/
   └─ report.json
```

`current-execution-registry`保存项目当前任务、活动执行和最近训练终态的唯一查询登记、追加事件和可恢复事务。它只指向不可变证据，不替代运行终态、任务胶囊或SQLite记录。`autonomous-closed-loop-packages`保存本地程序物化的不可变执行包，`autonomous-closed-loop-executions`保存训练或生成到验证、审核、裁决和终态的完整状态，`autonomous-background-launches`保证关闭Codex或浏览器不终止执行，`capability-lifecycle`保存新能力版本的机器资格链，`capability-runtime-tickets`保存已发布能力内一次一动作、不可重放的内部任务票据，`policy-boundary-reports`保存禁止越界后的正式报告。所有路径都只能使用项目逻辑相对路径并映射到正式注册的`.runtime`物理目录，不得接受调用方提供的外部绝对路径。内部票据只承担幂等、防重、状态转换和证据追溯，不是从Owner派生的权限。

运行证据按能力版本、执行包、任务和Run物理隔离；当前身份通过`current-execution-registry`逻辑隔离。程序不得扫描Smoke、Stage、审核、裁决或候选目录并按目录名、修改时间、代码顺序或来源类型选择“最新”。新任务只通过更高的登记修订替代前任，旧目录保持不可变历史。历史记录查询不得修改当前登记，也不得使失败关闭或已完成的旧Run重新成为活动执行。

第一版原始视觉来源目录固定为：

```text
data/world-samples/original-image-library/natural-home-v1/
├─ library.json
├─ index.json
├─ coverage-blueprint.json
├─ parallel-visual-knowledge-catalog-v1.json
├─ mainland-southeast-asia-tropical-monsoon-profile-v1.json
├─ mainland-southeast-asia-tropical-monsoon-species-catalog-v1.json
├─ provisional-visual-snapshot-v2.json
├─ earth-parameter-snapshots/<snapshotId>/manifest.json
├─ earth-parameter-snapshots/<snapshotId>/<raw-source-response>.json
├─ east-asia-temperate-humid-species-catalog.json       [旧档案历史证据]
├─ provisional-visual-snapshot-v1.json                  [旧档案历史证据]
├─ complete-maps/<recordId>/
├─ terrain/<terrainType>/<stateId>/<recordId>/
├─ vegetation/<plantKind>/<speciesId>/<lifeStage>/<season>/<recordId>/
├─ natural-objects/<objectKind>/<stateId>/<recordId>/
└─ transitions/<transitionKind>/<recordId>/
```

这五个目录是并行来源分类，不是脚本执行顺序。目录负责来源身份、权属证据、分类字段和原图追溯；正式训练顺序由数据包与训练配置决定，Runtime 图层由世界结构决定，两者都不得从文件夹名称推断。

大世界连接结构与视觉原图库分开保存，固定目录为：

```text
data/world-samples/world-connectivity/
├─ world-connectivity-contract-v1.json
├─ earth-reference-sources/<sourceId>.json
├─ blueprints/latest.json
└─ blueprints/<worldProfileId>/<connectivityBlueprintId>/
   └─ blueprint.json
```

真实地理测量与自然化派生和视觉原图库分开保存，固定目录为：

```text
data/world-samples/earth-geospatial/
├─ source-registry/
│  └─ earth-geospatial-source-registry-v1.json
└─ regions/
   └─ <naturalizationContractId>/
      ├─ region-contract.json
      ├─ sources/                         # 可版本化的小型原始响应与hash
      └─ derived-world-facts/             # 审核后的自然化事实，不含RGB

.runtime/ai-painter/
├─ earth-geospatial-naturalization-preflights/
│  ├─ latest.json
│  └─ <runId>/preflight-report.json
└─ earth-geospatial-naturalization-runs/
   └─ <runId>/
      ├─ raw/                             # D盘热层的大型源栅格
      ├─ normalized/
      ├─ human-removal/
      ├─ derived/
      └─ reports/
```

`earth-geospatial`只保存真实测量来源、许可、版本、采集时间、hash、自然化步骤与派生世界事实。外部栅格不得进入`original-image-library`，不得成为RGB训练原图；页面和GET API只能读取程序已经保存和索引的摘要，不得通过页面访问触发下载或派生。

`natural-home-large-world-connectivity-v1` 只定义区域身份、邻接、边界连接口、道路、水文、可走图和对象身份的机器契约。`blueprints/` 只保存在生效世界事实合同下由程序登记的具体连接蓝图。迁移前后状态、hash 和报告自动保存在 `.runtime/world-connectivity-migrations/`。`.runtime/world-connectivity-owner-reviews/` 是为复核旧运行保留的历史路径名，不是当前Owner审批入口；当前系统的连接审核结果由机器证据和状态机登记。页面读取不得创建或修改这些业务记录，实际世界实例和运行状态不得写回原图库。

程序从当前任务包提取的待审核连接候选固定保存在：

```text
.runtime/ai-painter/world-connectivity-proposals/
├─ latest.json
└─ <proposalId>/proposal.json
```

该目录只保存自动提取的边界证据和待世界事实编译器裁决的候选，不是正式 `blueprints/`。查看或生成候选不得修改世界事实，也不得把未通过RegionGraph与连接合同的邻居、道路出口或水文方向登记为正式事实。

正式数据流固定为：

```text
original-image-library/<五类并行来源>
 + registered authoritative world-connectivity blueprint
-> data/world-samples/registry/<dictionaryVersion>/
-> data/world-samples/dataset-packages/<packageId>/
   或 data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/
-> ml/ai-painter/ 项目自有训练器
-> .runtime/ai-painter/ 自动训练与推理证据
```

两个数据包根目录按血缘分工，不按新旧或优先级互相覆盖：`dataset-packages/`保存通用正式包，`ai-assisted-cold-start-dataset-packages/`保存AI辅助冷启动正式包。活动配置必须绑定精确路径、packageId和SHA-256，程序不得扫描两个目录后自行选择“最新”数据包。

完整地图视觉运行目录按职责分层；下列目录是稳定公共命名空间，不是对`.runtime/ai-painter/`全部运行证据目录的穷举：

```text
.runtime/ai-painter/
├─ local-foundation-models/                    # 已隔离历史第三方权重清单与文件 hash，不进入正式路线
├─ current-execution-registry/                 # 当前任务、活动执行、最近训练终态的唯一查询登记
├─ world-visual-generation-task-packages/      # 任务包与 23 通道条件
├─ complete-world-visual-bootstrap-inference/  # 每次完整候选、控制图和模型报告
├─ complete-world-visual-machine-reviews/      # CLIP、VJ-0、VJ-1、VJ-2正式机器审核
├─ complete-world-visual-foundation-batches/   # 自动多 seed 批次总账
├─ autonomous-execution-packages/              # 历史父授权包证据，仅用于旧运行复核
├─ capability-runtime-executions/              # 已发布能力版本的当前运行状态
├─ capability-runtime-tickets/                 # 已发布能力内部一次性任务票据与消费证据
├─ capability-runtime-decisions/               # 冻结规则裁决与异常升级证据
└─ training-process-ledger/                    # 中英文程序事件
```

## 5. 数据与展示边界

| 数据 | 正式位置 | 规则 |
|---|---|---|
| 世界事实 | `data/` 或世界 Runtime 存储 | 先于视觉存在。 |
| 视觉字典导出 | `data/world-visual-data-dictionary/` | 由字典文档导出，供程序读取。 |
| AI Painter当前治理合同 | `data/ai-painter/system-governance/` | 保存长期业务、职责、自主能力生命周期、机器发布注册表、合法程序入口白名单及历史合同替代索引；入口白名单不保存项目当前任务，历史Owner合同保留原始字节但不得启动新任务。 |
| AI Painter能力发布文件 | `data/ai-painter/capability-releases/<capabilityReleaseIdentity>/` | 保存由本地系统根据数据、模型、审核、Runtime、条件、测试与程序血缘生成的不可变机器发布文件；全部SHA和生命周期终态复核通过后才可进入正式运行。 |
| AI Painter当前执行登记 | `.runtime/ai-painter/current-execution-registry/` | 保存单调修订的当前任务指针、追加事件和事务记录；只由本地能力生命周期编排器写入，控制台只读，不得通过扫描历史目录替代。 |
| 正式训练样本 | `data/world-samples/registry/<dictionaryVersion>/` | 只能由登记程序写入，保存原图、来源、许可、hash、审核和标签。 |
| 不可变训练数据包 | `data/world-samples/dataset-packages/<packageId>/` | 保存四类 split、来源索引、字典/导演/任务/条件/审核快照和审计。 |
| AI辅助冷启动数据包 | `data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/` | 保存冷启动正式血缘；与通用包目录分工，不可由程序猜测替换。 |
| 训练与推理产物 | `.runtime/ai-painter/` | 成功、失败和中间结果全部自动保存。 |
| RuntimeFrame工作区 | `.runtime/game-map-runtime-frame-working/` | 生成与合成中的临时工作身份，不得进入`/world`。 |
| RuntimeFrame候选 | `.runtime/game-map-runtime-frame-candidates/` | 等待机器审核或能力版本发布门的候选，不得进入`/world`。 |
| RuntimeFrame正式记录 | `.runtime/game-map-runtime-frame/` 及正式晋级存储 | 只有通过全部闸门的记录可供`/world`读取。 |
| RuntimeFrame拒绝记录 | `.runtime/game-map-rejected-runtime-frames/` | 保存不可变拒绝证据，不得覆盖或晋级。 |
| 被拒绝结果 | `.runtime` 对应失败归档 | 不删除，不作为正式画面。 |

RuntimeFrame生命周期固定为`working -> candidates -> accepted frame / rejected frames`。`.runtime`在项目中的逻辑权威入口是`F:\ai-pet-world\.runtime`；Windows部署允许它解析到项目已注册的物理热层，但文档、配置和内部任务票据只能使用项目逻辑相对路径，不能把物理映射路径当作新的项目根或外部数据源。

`/world` 只能展示由机器发布能力版本生成并通过机器审核与Runtime发布门的完整 RuntimeFrame；第一版与后续能力使用同一机器发布规则。训练图、局部图、候选图、失败图和程序占位图不得进入正式世界。
