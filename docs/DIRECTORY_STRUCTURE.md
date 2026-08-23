# AI-PET-WORLD 文档与项目目录结构

更新时间：2026-08-24 07:35:09 +08:00

状态：active-directory-reference

文档版本：`AI-PET-WORLD-DIRECTORY-1.0`

生效日期：`2026-08-24`

替代版本：`未登记（首次建立显式版本号）`

批准状态：`active_internal_formal_standard`

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

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
| `docs/world-visual-data-dictionary/` | 分层视觉事实、对象、地形、过渡、失败码和训练标签。 |
| `docs/ai-painter-progress/` | 后台页面、自动保存、模型对齐、诊断和修复契约。 |
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
| `src/app/ai-painter-progress/` | 后台查看与控制入口。 |
| `src/app/api/ai-painter/` | 训练状态、图片、归档和审核 API。 |
| `.runtime/ai-painter/` | 程序自动保存的训练与推理证据。 |

AI Painter包内自主判断使用以下逻辑目录。当前能力未激活时不提前创建运行目录：

```text
.runtime/ai-painter/
├─ autonomous-package-executions/<packageId>/
│  ├─ state.json
│  ├─ progress.json
│  └─ phase-terminal.json
├─ autonomous-package-internal-capabilities/<packageId>/<ticketId>/
│  ├─ internal-capability-ticket.json
│  └─ consumption.json
└─ autonomous-package-decision-records/<packageId>/<decisionId>/
   └─ decision-report.json
```

`autonomous-package-executions`保存执行包状态机；`autonomous-package-internal-capabilities`保存一次一动作、不可重放的内部任务票据；`autonomous-package-decision-records`保存冻结规则、证据引用、排除选项和唯一裁决。三者都只能使用项目逻辑相对路径并映射到正式注册的`.runtime`物理目录，不得接受调用方提供的外部绝对路径。内部票据只承担幂等、防重、状态转换和证据追溯，不是从Owner派生的权限。

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

`natural-home-large-world-connectivity-v1` 只定义区域身份、邻接、边界连接口、道路、水文、可走图和对象身份的机器契约。`blueprints/` 只保存项目所有者命令下由程序登记的具体连接蓝图。迁移前后状态、hash 和报告自动保存在 `.runtime/world-connectivity-migrations/`，人工审核命令与不改几何的结果自动保存在 `.runtime/world-connectivity-owner-reviews/`；页面读取不得创建或修改这些业务记录。实际世界实例和运行状态不得写回原图库。

程序从当前任务包提取的待审核连接候选固定保存在：

```text
.runtime/ai-painter/world-connectivity-proposals/
├─ latest.json
└─ <proposalId>/proposal.json
```

该目录只保存自动提取的边界证据和待项目所有者选择的候选，不是正式 `blueprints/`。查看或生成候选不得修改世界事实，也不得自动批准邻居、道路出口或水文方向。

正式数据流固定为：

```text
original-image-library/<五类并行来源>
 + owner-approved world-connectivity blueprint
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
| AI Painter当前治理合同 | `data/ai-painter/system-governance/` | 保存长期业务、职责、Runtime自治、受信能力发布注册表及历史合同替代索引；历史合同保留原始字节但不得授权新任务。 |
| AI Painter能力发布文件 | `data/ai-painter/capability-releases/<capabilityReleaseIdentity>/` | 保存不可变能力发布文件、Owner发布决定及其绑定；只有受信注册表登记且全部SHA复核通过的身份可进入正式运行。 |
| 正式训练样本 | `data/world-samples/registry/<dictionaryVersion>/` | 只能由登记程序写入，保存原图、来源、许可、hash、审核和标签。 |
| 不可变训练数据包 | `data/world-samples/dataset-packages/<packageId>/` | 保存四类 split、来源索引、字典/导演/任务/条件/审核快照和审计。 |
| AI辅助冷启动数据包 | `data/world-samples/ai-assisted-cold-start-dataset-packages/<packageId>/` | 保存冷启动正式血缘；与通用包目录分工，不可由程序猜测替换。 |
| 训练与推理产物 | `.runtime/ai-painter/` | 成功、失败和中间结果全部自动保存。 |
| RuntimeFrame工作区 | `.runtime/game-map-runtime-frame-working/` | 生成与合成中的临时工作身份，不得进入`/world`。 |
| RuntimeFrame候选 | `.runtime/game-map-runtime-frame-candidates/` | 等待机器审核或能力版本发布门的候选，不得进入`/world`。 |
| RuntimeFrame正式记录 | `.runtime/game-map-runtime-frame/` 及正式晋级存储 | 只有通过全部闸门的记录可供`/world`读取。 |
| RuntimeFrame拒绝记录 | `.runtime/game-map-rejected-runtime-frames/` | 保存不可变拒绝证据，不得覆盖或晋级。 |
| 被拒绝结果 | `.runtime` 对应失败归档 | 不删除，不作为正式画面。 |

RuntimeFrame生命周期固定为`working -> candidates -> accepted frame / rejected frames`。`.runtime`在项目中的逻辑权威入口是`F:\ai-pet-world\.runtime`；Windows部署允许它解析到项目已注册的物理热层，但文档、配置和授权只能使用项目逻辑相对路径，不能把物理映射路径当作新的项目根或外部数据源。

`/world` 只能展示由已发布能力版本生成并通过机器审核与Runtime发布门的完整 RuntimeFrame；冷启动能力版本发布前另需项目级发布验收。训练图、局部图、候选图、失败图和程序占位图不得进入正式世界。
