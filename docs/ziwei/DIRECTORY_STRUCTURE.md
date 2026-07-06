# 紫微斗数目录结构

更新日期：2026-07-05

## 文档目录

```txt
docs/ziwei/
  README.md
  ROADMAP.md
  DIRECTORY_STRUCTURE.md
  ALGORITHM_CONTRACTS.md
  CONTENT_DATA_DICTIONARY.md
  DATA_DICTIONARY_ARCHITECTURE.md
  DATA_DICTIONARY_FIELDS.md
  DATA_DICTIONARY_COVERAGE_PLAN.md
  DATA_DICTIONARY_ANALYSIS_FLOW.md
  SOURCE_STORAGE_BOUNDARY.md
  PAGE_ACCEPTANCE.md
  EXECUTION_TABLE.md
```

旧的阶段闭合报告、历史过程文档、零散来源索引文档已经删除。后续只维护上面 12 个文档。

## 核心代码目录

```txt
src/ai/destiny-core/content-intake/
  content-intake-contract.ts

src/ai/destiny-core/bazi-core/
  bazi-schema.ts
  bazi-runtime/
  bazi-data/

src/ai/destiny-core/ziwei-core/
  contracts/
  birth/
  natal-foundation/
  star-catalog/
  star-placement/
  full-chart/
  dynamic-chart/
  dynamic/
  interpretation/
  page-view/
  public-api/
```

## P35 资料清洗架构

```txt
命理资料通用协议层
  src/ai/destiny-core/content-intake/content-intake-contract.ts
    - domain profile：ziwei / bazi
    - source kind：公版古籍、古籍索引、大学图书馆馆藏目录、现代书籍、网站、视频、软件、论坛、人工样例、项目原创
    - storage policy：可存原文、仅元信息、仅自有摘要、用户自有输入、禁止
    - dedup profile：去重键模板、归一字段、碰撞策略
    - extraction profile：实体抽取字段
    - conflict profile：冲突信号、严重度、路由队列
    - review queue：来源不明、去重碰撞、硬规则冲突
    - cleaned result：清洗后的标准输出记录
    - cleaning pipeline：清洗执行顺序和禁止跳步规则
    - cleaning scenario：不同来源走清洗流程后的预期结果
    - directory rule：目录边界和扩展规则

紫微斗数接入层
  src/ai/destiny-core/ziwei-core/interpretation/content-details/content-data-intake.ts
    - 紫微来源登记
    - 紫微来源可存储边界
    - 紫微去重规则
    - 紫微星曜/宫位/格局/四化/动态盘实体抽取
    - 紫微冲突信号
    - 紫微复核队列
    - 紫微清洗结果样例
    - 紫微清洗执行流程
    - 紫微来源清洗输入/输出样例

八字后续接入层
  src/ai/destiny-core/bazi-core/
    - 已有 bazi-schema.ts
    - 已有 bazi-data/
    - 已有 bazi-runtime/
    - 后续如接资料 profile，优先放 bazi-core/bazi-data-intake.ts
```

## P35 文件边界

| 文件或目录 | 层级 | 允许内容 | 禁止内容 |
|---|---|---|---|
| `src/ai/destiny-core/content-intake/content-intake-contract.ts` | 通用协议 | 命理资料采集、清洗、去重、冲突、复核的类型和通用队列 | 紫微安星算法、八字排盘算法、`index.ts` 聚合入口 |
| `src/ai/destiny-core/ziwei-core/interpretation/content-details/content-data-intake.ts` | 紫微 profile | 紫微 P35-A 到 P35-F 的来源、边界、清洗、映射和复核 profile | 八字实体解释、行为映射、人格映射 |
| `src/ai/destiny-core/bazi-core/` | 八字已有核心 | 八字排盘、五行、天干地支、大运、流年、流月、流日、流时 | 紫微 profile、重复清洗协议 |
| `scripts/ziwei/check-p35-data-intake.mjs` | 检查脚本 | 复核 P35 数据结构、通用协议、紫微 profile、八字接入边界 | 手工口头检查、页面截图检查 |
| `docs/ziwei/` | 文档 | 当前 12 份紫微文档 | 旧阶段散文档、重复计划文档 |

## P36 数据字典规划文档

```txt
docs/ziwei/
  DATA_DICTIONARY_ARCHITECTURE.md
    - 数据字典总目录
    - 来源、实体、星曜、宫位、入宫、组合、关系、状态、格局、动态盘、专题、当前盘调用边界

  DATA_DICTIONARY_FIELDS.md
    - 通用字段
    - 星曜本体字段
    - 宫位本体字段
    - 星曜入宫字段
    - 星曜组合字段
    - 格局字段
    - 动态盘字段
    - 当前盘输出字段

  DATA_DICTIONARY_COVERAGE_PLAN.md
    - P36 总进度表
    - 星曜、入宫、组合、宫位、地支天干、状态、格局、动态盘覆盖矩阵

  DATA_DICTIONARY_ANALYSIS_FLOW.md
    - 从排盘到当前盘解释的调用链
    - 原盘、大限、流年、流月、流日、流时继承关系
    - 当前盘证据链输出标准
```

P36 规划文档只定义字典架构和读盘调用顺序，不写行为映射，不把现代资料正文搬进项目。

## P35 命名规则

1. 通用资料协议使用 `Destiny*` 前缀。
2. 紫微资料 profile 使用 `ZiweiData*` 前缀。
3. 八字后续资料 profile 使用 `BaziData*` 前缀，并放在已有 `bazi-core` 下。
4. 不新增无职责的 `index.ts`；需要导出时从既有模块出口处理。
5. 不把清洗规则写进页面组件。
6. 不把八字资料接入写进紫微目录。

## P35-C 清洗结果输出

程序清洗每一条资料后，输出统一结果记录：

| 字段 | 含义 |
|---|---|
| `resultId` | 清洗结果 ID |
| `domain` | 命理域，如 `ziwei`、后续 `bazi` |
| `sourceId` / `fragmentId` | 来源和原始片段 |
| `sourceKind` / `storagePolicy` | 来源类型和可存储策略 |
| `dedupProfileId` / `dedupKey` | 去重规则和去重键 |
| `normalizedFields` | 已归一字段 |
| `entityRefs` | 抽取出的实体引用 |
| `topicTags` | 主题标签 |
| `conflictSignalIds` | 命中的冲突信号 |
| `reviewQueueId` | 需要进入的复核队列 |
| `reviewStatus` | 复核状态 |
| `promotionStatus` | 阻断、仅元信息、待复核、可入字典 |
| `targetDictionaryLayer` | 目标数据字典层 |
| `rejectionReason` | 阻断原因 |
| `auditTrail` | 清洗过程轨迹 |

## P35-C 清洗执行流程

```txt
source-registration
  -> storage-boundary
  -> entity-extraction
  -> deduplication
  -> conflict-detection
  -> review-routing
  -> cleaned-result
```

执行规则：

1. 不能跳过来源登记。
2. 不能跳过可存储边界判断。
3. 不能把现代资料正文直接写入数据字典。
4. 不能用外部资料覆盖星曜、格局、四化、庙旺或动态盘硬规则。
5. `blocked` 结果必须有 `rejectionReason`。
6. `ready-for-dictionary` 结果必须有 `targetDictionaryLayer`。

## P35-C 输入输出样例

| 来源类型 | 默认输出状态 | 复核队列 | 目标层 |
|---|---|---|---|
| 公版古籍正文 | `ready-for-dictionary` | 无 | `pattern.dictionary` |
| 古籍目录索引 | `metadata-only` | `destiny.review.source-unknown` | 无 |
| 世界大学图书馆馆藏目录 | `metadata-only` | `destiny.review.source-unknown` | 无 |
| 现代书籍 | `metadata-only` | `destiny.review.source-unknown` | 无 |
| 网站文章 | `needs-review` | `p35.review.ziwei-topic-mapping` | `star.dictionary` |
| 视频课程 | `needs-review` | `p35.review.ziwei-topic-mapping` | `star.dictionary` |
| 排盘软件 | `needs-review` | `p35.review.ziwei-dynamic-flow` | `dynamic-flow.dictionary` |
| 论坛社群 | `needs-review` | `p35.review.ziwei-topic-mapping` | 无 |
| 人工校盘样例 | `needs-review` | `destiny.review.duplicate-collision` | 无 |
| 项目原创整理 | `ready-for-dictionary` | 无 | `star.dictionary` |

## P35-D 主题映射矩阵

P35-D 已把清洗后的资料分成 12 个可筛选主题。每个主题都有独立的目标字典层、实体字段、来源类型、必填清洗字段、溯源字段、接收规则、拒绝规则和后续用途。

| 主题 | 目标字典层 | 核心实体 |
|---|---|---|
| `star` | `star.dictionary` | 星曜、分类、别名、亮度引用 |
| `palace` | `palace.dictionary` | 宫位、宫位主题、字段 |
| `branch` | `branch.dictionary` | 十二地支、四马地等地支组、空间语境 |
| `stem` | `stem.dictionary` | 天干、阴阳、五行、四化来源引用 |
| `element-gate` | `element-gate.dictionary` | 五行局、局数、五行门类 |
| `pattern` | `pattern.dictionary` | 格局、成格、破格、修复信号 |
| `transformation` | `transformation.topic` | 天干、四化、目标星、所属流层 |
| `brightness` | `star-brightness.dictionary` | 星曜、地支、庙旺落陷状态 |
| `dynamic-flow` | `dynamic-flow.dictionary` | 大限、流年、流月、流日、流时 |
| `relationship` | `relationship.dictionary` | 星曜关系、格局关系、宫位主题关系 |
| `sample` | `sample.calibration` | 脱敏样例、校验字段、复核结论 |
| `storage-boundary` | `source-storage-boundary.dictionary` | 来源类型、存储边界、复核队列 |

所有 P35-D 映射必须携带 `sourceId`、`fragmentId`、`dedupKey`、`entityRefs`、`promotionStatus`。不能通过主题映射新增硬规则，也不能把现代资料正文直接写入解释字典。

## P35-E 入库决策输出

P35-E 在清洗结果和主题映射之后执行，输出可审计的入库决策：

| 字段 | 含义 |
|---|---|
| `decisionId` | 入库决策 ID |
| `cleanedResultId` | 对应 P35-C 清洗结果 |
| `policyId` | 命中的入库门禁策略 |
| `score` | 可用性分数 |
| `admissionStatus` | `admitted`、`metadata-only`、`review-required`、`rejected` |
| `targetDictionaryLayer` | 允许进入的目标字典层 |
| `requiredReviewQueueId` | 需要人工复核时的队列 |
| `acceptedEvidenceFields` | 已满足的证据字段 |
| `rejectionReason` | 拒绝原因 |
| `nextAction` | 下一步处理动作 |
| `auditTrail` | 筛选审计轨迹 |

P35-E 的策略不直接改当前盘页面。只有 `admitted` 或复核通过后的资料，才允许进入后续 P35-F 分析模型和页面使用。

## P35-F 页面使用规则

P35-F 使用 P35-E 的入库决策作为入口，不绕过 `admissionStatus`：

| 可见性 | 用途 | 限制 |
|---|---|---|
| `dictionary-only` | 数据字典弹层、通用资料查看 | 不生成当前盘结论 |
| `chart-hit-only` | 当前盘命中星曜、格局和宫位分析 | 必须有盘中命中证据 |
| `review-panel` | 动态盘差异、现代资料复核 | 未复核前不进入解释正文 |
| `hidden` | 被拒绝资料和阻断原因 | 只做审计，不展示到页面 |

星曜字典页面采用“左侧星曜索引 + 右侧单星详情”结构，避免所有星曜解释一次性展开导致排版混乱。

## 资料采集批次结构

采集批次由程序读取 `content-data-intake.ts` 中的三类结构执行：

| 结构 | 作用 |
|---|---|
| `ZIWEI_DATA_COLLECTION_FIELD_PROFILES` | 定义程序必须采集和校验的字段 |
| `ZIWEI_DATA_SOURCE_SEED_RECORDS` | 定义来源类型、定位模板、可采字段和禁采字段 |
| `ZIWEI_DATA_COLLECTION_BATCH_PLANS` | 定义一批采集任务要使用哪些来源种子、字段模板和复核门禁 |
| `ZIWEI_DATA_COLLECTION_ADAPTER_PROFILES` | 定义真实采集适配器骨架和每类来源的请求模式 |
| `ZIWEI_DATA_COLLECTION_EXECUTOR_PROFILE` | 定义采集程序的固定执行步骤、输入输出、护栏和失败模式 |
| `ZIWEI_DATA_COLLECTION_EXECUTION_TASK_RECORDS` | 定义由批次和来源种子展开的执行任务队列 |
| `ZIWEI_DATA_COLLECTION_SOURCE_REGISTRATION_DRAFTS` | 定义来源登记草案 |
| `ZIWEI_DATA_COLLECTION_FRAGMENT_CAPTURE_INPUTS` | 定义采集器可消费的允许字段输入 |
| `ZIWEI_DATA_COLLECTION_CLEANING_INPUT_DRAFTS` | 定义清洗、去重、冲突检测和主题映射输入 |
| `ZIWEI_DATA_COLLECTION_REVIEW_QUEUE_ITEM_DRAFTS` | 定义复核队列草案 |
| `ZIWEI_DATA_COLLECTION_JOB_DRAFTS` | 定义真实采集作业草案 |
| `ZIWEI_DATA_COLLECTION_RUN_BATCHES` | 定义采集运行批次 |
| `ZIWEI_DATA_COLLECTION_RUN_RESULT_DRAFTS` | 定义运行结果草案 |
| `ZIWEI_DATA_COLLECTION_JOB_BLOCK_RECORDS` | 定义失败/阻断审计记录 |
| `ZIWEI_DATA_COLLECTION_AUDIT_RECORDS` | 定义采集审计输出 |
| `ZIWEI_DATA_COLLECTION_SOURCE_RESULT_CANDIDATES` | 定义来源登记结果候选 |
| `ZIWEI_DATA_COLLECTION_FRAGMENT_RESULT_CANDIDATES` | 定义片段结果候选 |
| `ZIWEI_DATA_COLLECTION_CLEANED_RESULT_CANDIDATES` | 定义清洗结果候选 |
| `ZIWEI_DATA_COLLECTION_TOPIC_MAPPING_CANDIDATES` | 定义主题映射候选 |
| `ZIWEI_DATA_COLLECTION_ADMISSION_DECISION_CANDIDATES` | 定义入库决策候选 |
| `ZIWEI_DATA_COLLECTION_REVIEW_ROUTE_CANDIDATES` | 定义复核路由候选 |
| `ZIWEI_DATA_COLLECTION_PROMOTION_GATE_PROFILES` | 定义候选晋级门禁 |
| `ZIWEI_DATA_COLLECTION_PROMOTION_DECISION_RECORDS` | 定义候选晋级决策 |

自动采集只负责登记来源、捕获允许字段、生成清洗输入和复核队列项；不能直接写入当前盘解释，也不能采集现代资料正文、截图、扫描图、软件版式或未脱敏个人资料。

当前紫微执行器只放在 `content-data-intake.ts`，通用执行任务类型放在 `content-intake-contract.ts`。后续八字接入时复用同一套 `DestinyCollectionExecutorProfile` 和 `DestinyCollectionExecutionTaskRecord`，不要为八字再建一套重复协议。

## 内容资料目录

```txt
src/ai/destiny-core/ziwei-core/interpretation/content-details/
  content-detail-types.ts
  content-dictionary-builder.ts
  content-knowledge-repository.ts
  content-source-reference-map.ts
  source-reference-index.ts
  source-reference-review-queue.ts
  content-expansion-priority-queue.ts
  content-expansion-closure.ts
  content-data-intake.ts
  theory-source-reference-catalog.ts
  *-meaning-catalog.ts
  *-combination-catalog.ts
  palace-theme-chain-*.ts
```

`content-intake-contract.ts` 是命理资料采集、清洗、去重、冲突和复核的通用协议层。紫微斗数通过 `content-data-intake.ts` 挂接自己的星曜、宫位、格局、四化、动态盘实体；八字后续通过已有 `bazi-core` 挂接天干、地支、十神、五行、藏干、大运和流年等实体，不再复制一套清洗协议。

## 页面目录

```txt
src/app/ziwei/
  page.tsx
  _components/
  _lib/
  _styles/
```

## 检查脚本

```txt
scripts/ziwei/
  run-current-ziwei-closure-checks.mjs
  check-hard-rule-source-drift.mjs
  check-p24-p34-closure.mjs
  check-p35-data-intake.mjs
  check-content-knowledge-repository.mjs
  check-content-detail-closure.mjs
  check-ziwei-content-total-closure.mjs
  check-client-boundary.mjs
```

## 边界

1. `contracts/` 只放类型契约。
2. `star-catalog/` 是星曜 ID、分类、庙旺落陷表等结构来源。
3. `star-placement/` 只做安星，不写解释长文。
4. `full-chart/` 负责完整本命盘。
5. `dynamic-chart/` 和 `dynamic/` 负责大限、流年、流月、流日、流时。
6. `interpretation/` 负责解释资料、数据字典、详细分析。
7. `page-view/` 负责页面 ViewModel。
8. `src/app/ziwei` 只负责展示和交互，不重复定义排盘算法。
9. `content-intake/` 不写紫微或八字具体算法，只放命理资料采集与清洗通用契约。
10. `scripts/ziwei/check-hard-rule-source-drift.mjs` 负责复核 P0 硬规则来源是否漂移。
11. `scripts/ziwei/check-p24-p34-closure.mjs` 负责复核 P24-P34 当前阶段闭合状态。
12. `scripts/ziwei/run-current-ziwei-closure-checks.mjs` 是旧闭合脚本的当前兼容入口。
13. `scripts/ziwei/check-p35-data-intake.mjs` 负责复核 P35 资料采集结构。
