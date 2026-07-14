# AI-PET-WORLD 文档与项目目录结构

更新时间：2026-07-13 19:31:50 +08:00

状态：active-reference / 已规整 / 不决定当前执行顺序

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
├─ DIRECTORY_STRUCTURE.md
├─ game-world-generation/
│  ├─ CURRENT_EXECUTION_GUIDE_20260710.md
│  ├─ AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md
│  ├─ TRAINING_DATA_AND_SOURCE_POLICY.md
│  └─ REVIEW_AUTOMATION_AND_STORAGE_SPEC.md
├─ world-visual-data-dictionary/
├─ ai-painter-progress/
└─ ziwei/
```

| 路径 | 内容 | 能否决定当前下一步 |
|---|---|---:|
| `docs/DOCUMENT_AUTHORITY_INDEX.md` | 文档优先级和正式入口。 | 否，只治理读取顺序。 |
| `docs/BUSINESS_SPEC.md` | 两大核心业务和长期业务边界。 | 否。 |
| `docs/ARCHITECTURE.md` | AI 管家与类地球世界的长期架构。 | 否。 |
| `docs/game-world-generation/` | 当前完整世界地图架构、模型、审核和执行指南。 | 只有当前执行指南可以。 |
| `docs/world-visual-data-dictionary/` | 分层视觉事实、对象、地形、过渡、失败码和训练标签。 | 否，是数据标准。 |
| `docs/ai-painter-progress/` | 后台页面、自动保存、模型对齐、诊断和修复契约。 | 否，是程序契约。 |
| `docs/ziwei/` | AI 管家人格数据子系统。 | 不参与当前地图顺序。 |

当前世界地图唯一执行文档：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

## 3. 文档清理边界

| 内容 | 处理规则 |
|---|---|
| 旧计划、旧进度表、阶段闭合报告 | 删除，不保留 Markdown 历史副本。 |
| 重复业务说明和重复架构说明 | 合并进 `BUSINESS_SPEC.md` 或 `ARCHITECTURE.md` 后删除。 |
| 当前地图架构规格 | 只保留 3 份下级规格，由当前执行指南按任务导航。 |
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

`natural-home-large-world-connectivity-v1` 只定义区域身份、邻接、边界连接口、道路、水文、可走图和对象身份的机器契约。`blueprints/` 只保存项目所有者命令下由程序登记的具体连接蓝图；当前第一版蓝图已登记并迁移到 `data/world-runtime/` 的 tick 2，项目所有者审核通过后形成 tick 3。迁移前后状态、hash 和报告自动保存在 `.runtime/world-connectivity-migrations/`，人工审核命令与不改几何的结果自动保存在 `.runtime/world-connectivity-owner-reviews/`；页面读取不得创建或修改这些业务记录。实际世界实例和运行状态不得写回原图库。

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
-> ml/ai-painter/ 项目自有训练器
-> .runtime/ai-painter/ 自动训练与推理证据
```

当前完整地图视觉运行目录固定分层：

```text
.runtime/ai-painter/
├─ local-foundation-models/                    # 已隔离历史第三方权重清单与文件 hash，不进入正式路线
├─ world-visual-generation-task-packages/      # 任务包与 23 通道条件
├─ complete-world-visual-bootstrap-inference/  # 每次完整候选、控制图和模型报告
├─ complete-world-visual-machine-reviews/      # CLIP、VJ-0、VJ-1、VJ-2 审核
├─ complete-world-visual-foundation-batches/   # 自动多 seed 批次总账
└─ training-process-ledger/                    # 中英文程序事件
```

## 5. 数据与展示边界

| 数据 | 正式位置 | 规则 |
|---|---|---|
| 世界事实 | `data/` 或世界 Runtime 存储 | 先于视觉存在。 |
| 视觉字典导出 | `data/world-visual-data-dictionary/` | 由字典文档导出，供程序读取。 |
| 正式训练样本 | `data/world-samples/registry/<dictionaryVersion>/` | 只能由登记程序写入，保存原图、来源、许可、hash、审核和标签。 |
| 不可变训练数据包 | `data/world-samples/dataset-packages/<packageId>/` | 保存四类 split、来源索引、字典/导演/任务/条件/审核快照和审计。 |
| 训练与推理产物 | `.runtime/ai-painter/` | 成功、失败和中间结果全部自动保存。 |
| RuntimeFrame | `.runtime/game-map-runtime-frame/` 及正式晋级存储 | 未通过全部闸门不得进入 `/world`。 |
| 被拒绝结果 | `.runtime` 对应失败归档 | 不删除，不作为正式画面。 |

`/world` 只能展示通过机器审核和项目所有者最终验收的完整 RuntimeFrame；训练图、局部图、候选图、失败图和程序占位图不得进入正式世界。
