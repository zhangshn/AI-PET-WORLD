# 紫微斗数内容数据字典合同

更新时间：2026-08-03 09:23:45 +08:00

状态：active-data-dictionary-contract

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

## 1. 文档职责

本文件定义紫微斗数内容数据的范围、分层、采集、清洗、主题映射、入库和页面使用合同，不记录阶段进度、运行批次或实时数量。

结构、字段和调用链分别由以下正式文档约束：

- `DATA_DICTIONARY_ARCHITECTURE.md`
- `DATA_DICTIONARY_FIELDS.md`
- `DATA_DICTIONARY_ANALYSIS_FLOW.md`
- `DATA_DICTIONARY_MASTER_BLUEPRINT.md`
- `SOURCE_STORAGE_BOUNDARY.md`

## 2. 内容边界

数据字典覆盖来源、术语、星曜、宫位、天干地支、五行局、四化、组合、格局、动态盘、主题链和当前盘解释。具体条目数量、覆盖率和阻断状态由结构化数据及检查程序计算。

必须遵守：

1. 总字典解释通用资料，不直接等于当前盘结论。
2. 当前盘只读取盘中实际命中的星曜、宫位、关系、格局和动态盘层。
3. 未命中格局和未触发规则只保留在字典，不进入当前盘结果。
4. 星曜本体、星曜入宫、组合、格局和整盘综合解释必须分层。
5. 每段当前盘解释必须能够回到事实、规则、来源和盘层证据。
6. 字典不得重复定义星曜目录、格局目录、四化表、庙旺落陷表或动态盘算法。

## 3. 数据层

| 数据层 | 责任 | 禁止事项 |
|---|---|---|
| 来源层 | 保存来源身份、版本、许可、定位和可存储边界 | 用无来源文本覆盖规则 |
| 总字典层 | 保存通用术语、星曜、宫位、关系、格局和动态盘资料 | 直接断定某张盘 |
| 当前盘命中层 | 根据盘面事实筛出适用条目 | 展示未命中内容 |
| 当前盘解释层 | 按证据链组织可读段落 | 从通用段落跳到结论 |
| 复核层 | 保存冲突、缺口、人工校盘和晋级决定 | 未复核即进入解释正文 |

## 4. 领域模块登记

P24 至 P34 是稳定领域标识，不是项目计划或实时进度：

| 标识 | 稳定职责 |
|---|---|
| P24 | 格局成格、破格、不良格局和主题链证据 |
| P25 | 大限、流年、流月、流日、流时的继承与短周期降权 |
| P26 | 星曜本体、星曜分层和亮度表适用边界 |
| P27 | 十二地支、十天干、五行局和空间组语境 |
| P28 | 宫位主题链、字段段落和证据域引用 |
| P29 | 四化目标、来源天干、所属盘层和动态解释 |
| P30 | 公版古籍术语、篇目、版本、主题索引和项目自有释义 |
| P31 | 现代资料元信息、定位、主题和复核状态 |
| P32 | 星曜组合、三方四正、对宫、夹宫和关系结构 |
| P33 | 脱敏人工样例、差异摘要和复核证据 |
| P34 | 数据闭合合同、文档集合和自动检查 |

## 5. P35 资料接收合同

| 标识 | 稳定职责 |
|---|---|
| P35-A | 来源入口、来源登记和采集字段模板 |
| P35-B | 来源类型与可存储边界分级 |
| P35-C | 清洗、去重、实体抽取、冲突检测和复核路由 |
| P35-D | 清洗结果到数据字典主题的映射 |
| P35-E | 直入、仅元信息、需复核、拒绝和等待门禁 |
| P35-F | 字典页面、当前盘页面和复核页面的使用边界 |

采集程序固定执行：

```text
source registration
  -> allowed-field capture
  -> cleaning and deduplication
  -> conflict detection
  -> topic mapping
  -> admission decision
  -> review routing
  -> governed dictionary record
```

采集任务和适配器只处理明确允许的字段。网络请求、OCR、截图采集和现代资料正文采集分别受 Owner 授权约束，不能由任务草案自动扩权。

## 6. P36 数据字典重整

P36 是数据字典结构化能力域，不承担执行计划职责：

| 能力域 | 合同 |
|---|---|
| P36-0 | 统一架构、字段、调用链和主蓝图 |
| P36-G | 分开总字典、命中层、解释层和复核层 |
| P36-G-1 | 检查星曜、宫位、地支、关系、四化、格局和证据链的读盘可用性 |
| P36-G-2 | 以结构化缺口记录管理细节深度、来源冲突和校盘覆盖 |
| P36-H | 提供杂曜主题、周期流系、动态继承、宫位专题和格局综合解释资料 |

内容扩充的优先次序属于唯一模块计划表；本文件只规定任何扩充都必须通过来源、字段、证据和复核门禁。

## 7. 机器接口

| 结构 | 作用 |
|---|---|
| `ZIWEI_EXTERNAL_DATA_SOURCE_REGISTRY` | 来源登记 |
| `ZIWEI_RAW_INTAKE_FRAGMENT_SLOTS` | 原始片段槽，不直接保存现代受限正文 |
| `ZIWEI_DATA_TOPIC_MAPPINGS` | 主题映射 |
| `ZIWEI_DATA_USABILITY_SCORE_RULES` | 可用性评分和存储阻断 |
| `ZIWEI_DATA_DICTIONARY_ADMISSION_POLICY_PROFILES` | 入库策略 |
| `ZIWEI_DATA_DICTIONARY_ADMISSION_DECISION_RECORDS` | 入库决定和审计轨迹 |
| `ZIWEI_DATA_ANALYSIS_USAGE_PROFILES` | 分析与页面使用规则 |
| `ZIWEI_DATA_COLLECTION_EXECUTOR_PROFILE` | 批次加载、登记、清洗、映射、入库和复核执行合同 |
| `ZIWEI_DATA_COLLECTION_PROMOTION_GATE_PROFILES` | 候选晋级门禁 |
| `ZIWEI_DATA_COLLECTION_PROMOTION_DECISION_RECORDS` | 每条候选唯一晋级决定 |

任务、批次、候选、复核和晋级的实时状态必须保存在机器记录中，不复制到 Markdown。

## 8. 主题映射

P35-D 必须支持以下主题：

| 主题 | 目标层 |
|---|---|
| `star` | `star.dictionary` |
| `palace` | `palace.dictionary` |
| `branch` | `branch.dictionary` |
| `stem` | `stem.dictionary` |
| `element-gate` | `element-gate.dictionary` |
| `pattern` | `pattern.dictionary` |
| `transformation` | `transformation.topic` |
| `brightness` | `star-brightness.dictionary` |
| `dynamic-flow` | `dynamic-flow.dictionary` |
| `relationship` | `relationship.dictionary` |
| `sample` | `sample.calibration` |
| `storage-boundary` | `source-storage-boundary.dictionary` |

每条映射必须保留 `sourceId`、`fragmentId`、`dedupKey`、`entityRefs`、`promotionStatus`。四化只描述主题、目标星、来源天干和盘层，不写成庙旺。

## 9. 入库门禁

| 决策 | 规则 |
|---|---|
| `promote` | 来源、许可、实体引用和目标层完整，可以晋级 |
| `metadata-only` | 只保存元信息，不进入解释正文 |
| `review-required` | 保留 `reviewQueueId`，复核前不得晋级 |
| `reject` | 只保留审计，不进入资料正文 |
| `wait` | 输入或运行结果不完整，不得提前晋级 |

现代正文、截图、扫描图、受限来源和未脱敏个人资料不得进入解释字典。网站、视频和现代资料只能保存元信息及项目自有摘要，并按主题复核。

## 10. 页面使用

| 使用层 | 可见性 | 规则 |
|---|---|---|
| 字典详情 | `dictionary-only` | 展示通用资料，不等于当前盘结论 |
| 当前盘命中分析 | `chart-hit-only` | 必须有当前盘事实和证据引用 |
| 格局命中分析 | `chart-hit-only` | 只显示算法确认的格局 |
| 动态流限复核 | `review-panel` | 未复核资料不写成断语 |
| 拒绝资料 | `hidden` | 只保留审计 |

## 11. 验收标准

1. 每条内容可追溯到唯一来源和可存储策略。
2. 总字典、当前盘命中、当前盘解释和复核记录严格分层。
3. 主题映射、入库决定和页面使用规则均可机器检查。
4. 硬规则只来自项目算法权威源，资料扩充不得暗改算法。
5. 实时数量、运行结果和阶段状态只由本地程序记录。
6. 所有检查失败必须保留原因与证据，不得降低门禁伪造通过。
