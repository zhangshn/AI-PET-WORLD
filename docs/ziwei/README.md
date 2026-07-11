# 紫微斗数文档入口

更新时间：2026-07-10 20:28:12 +08:00

状态：separate-subsystem / AI 管家人格数据输入 / 不参与当前世界地图执行顺序

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

本目录全部文档继承 `separate-subsystem` 分类。这里的“独立”只表示技术、数据和任务执行顺序独立，不表示与项目业务无关。紫微斗数结构化结果属于 AI 管家“性格数据 -> 性格映射 -> 角色自主”核心业务的正式输入；紫微任务仍由独立任务窗口和本目录规则继续，不得影响当前完整世界地图主线。

## 项目目的

紫微斗数模块的目标是建立一个可排盘、可解释、可追溯来源、可扩充资料的数据与分析底座。

当前阶段只做紫微斗数本身：

1. 排盘算法、星曜安置、四化、庙旺落陷和动态盘。
2. 星曜、宫位、地支、天干、五行局、格局、组合、主题链的数据字典。
3. 原盘、大限、流年、流月、流日、流时的盘面展示和详细分析。
4. 理论来源、可存储边界、来源引用、复核队列和资料扩充队列。

暂不做行为映射、人格映射、世界行为映射；这些等紫微盘资料稳定后再接。

## 当前文档

| 文档 | 用途 |
|---|---|
| [ROADMAP.md](./ROADMAP.md) | 后续所有要做的紫微斗数内容和阶段顺序 |
| [DIRECTORY_STRUCTURE.md](./DIRECTORY_STRUCTURE.md) | 新文档结构、代码结构、模块边界 |
| [ALGORITHM_CONTRACTS.md](./ALGORITHM_CONTRACTS.md) | 参数契约、算法硬规则、客户端边界 |
| [CONTENT_DATA_DICTIONARY.md](./CONTENT_DATA_DICTIONARY.md) | 数据字典现状、资料层、后续扩充内容 |
| [DATA_DICTIONARY_MASTER_BLUEPRINT.md](./DATA_DICTIONARY_MASTER_BLUEPRINT.md) | 数据字典大模块蓝图，规定星曜、宫位、组合、格局、动态盘和当前盘分析的总边界 |
| [DATA_DICTIONARY_GAP_REVIEW.md](./DATA_DICTIONARY_GAP_REVIEW.md) | 数据字典缺口复核清单，规定下一批要补的紫微细节和验收标准 |
| [DATA_DICTIONARY_ARCHITECTURE.md](./DATA_DICTIONARY_ARCHITECTURE.md) | 数据字典总架构，定义来源、实体、星曜、宫位、入宫、组合、格局和动态盘边界 |
| [DATA_DICTIONARY_FIELDS.md](./DATA_DICTIONARY_FIELDS.md) | 数据字典字段模型，避免星曜、宫位、格局和动态盘字段重复定义 |
| [DATA_DICTIONARY_COVERAGE_PLAN.md](./DATA_DICTIONARY_COVERAGE_PLAN.md) | P36 覆盖矩阵和总进度表 |
| [DATA_DICTIONARY_ANALYSIS_FLOW.md](./DATA_DICTIONARY_ANALYSIS_FLOW.md) | 从排盘到当前盘解释的调用链和证据链标准 |
| [DATA_DICTIONARY_EXPLANATION_REFERENCE_METHOD.md](./DATA_DICTIONARY_EXPLANATION_REFERENCE_METHOD.md) | 现代资料站解释方法参考规则，只取结构和主题，不复制正文 |
| [DATA_DICTIONARY_STAR_SAMPLE_REVIEW.md](./DATA_DICTIONARY_STAR_SAMPLE_REVIEW.md) | 星曜字典抽样复核，按六颗主星检查本体、入宫、组合、三方四正、四化、动态盘和当前盘输出 |
| [DATA_DICTIONARY_STAR_PALACE_READABILITY_REVIEW.md](./DATA_DICTIONARY_STAR_PALACE_READABILITY_REVIEW.md) | 星曜入关键六宫可读性复核，按六颗主星和六个宫位生成 36 条读盘样本 |
| [DATA_DICTIONARY_PATTERN_READABILITY_REVIEW.md](./DATA_DICTIONARY_PATTERN_READABILITY_REVIEW.md) | 格局总字典和当前盘命中格局可读性复核，按 8 类格局固定 96 个解释段 |
| [DATA_DICTIONARY_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW.md](./DATA_DICTIONARY_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW.md) | 当前盘解释段落样例抽查，按 6 个场景检查星曜、宫位、格局、四化和动态盘能否合成读盘段落 |
| [DATA_DICTIONARY_CURRENT_CHART_REGRESSION_REVIEW.md](./DATA_DICTIONARY_CURRENT_CHART_REGRESSION_REVIEW.md) | 真实盘例回归复核，按 7 个黄金样本校验命身、顺逆、起运和动态宫位 |
| [DATA_DICTIONARY_CURRENT_CHART_OUTPUT_CLOSURE_GATE.md](./DATA_DICTIONARY_CURRENT_CHART_OUTPUT_CLOSURE_GATE.md) | 当前盘解释闭合清单，固定允许、总字典保留、隐藏、复核和禁止输出门禁 |
| [DATA_DICTIONARY_TRANSFORMATION_BRANCH_DEPTH.md](./DATA_DICTIONARY_TRANSFORMATION_BRANCH_DEPTH.md) | 四化来源盘层和地支空间关系补强 |
| [SOURCE_STORAGE_BOUNDARY.md](./SOURCE_STORAGE_BOUNDARY.md) | 理论来源、来源引用、复核队列、可存储边界 |
| [PAGE_ACCEPTANCE.md](./PAGE_ACCEPTANCE.md) | `/ziwei` 页面展示和人工验收要求 |
| [EXECUTION_TABLE.md](./EXECUTION_TABLE.md) | 已完成和下一步执行表 |

## 当前完成状态

| 模块 | 状态 |
|---|---|
| 资料仓库 | 2951 条资料记录 |
| 来源明细索引 | 22 个资料层，2938 条带来源引用资料 |
| 来源复核队列 | 13 个理论来源 |
| 资料扩充队列 | 12 个后续扩充项 |
| 算法来源漂移复核 | 已接入 `scripts/ziwei/check-hard-rule-source-drift.mjs` |
| P24-P34 当前阶段闭合 | 已接入 `scripts/ziwei/check-p24-p34-closure.mjs` |
| P35 资料采集与分析 | P35-A 到 P35-F 已完成，已接入通用命理资料清洗协议、主题映射、入库门禁、页面可见性规则和 `scripts/ziwei/check-p35-data-intake.mjs` |
| P36 数据字典重整 | P36-0 已完成；P36-C 星曜入十二宫第一批已闭合；P36-D 星曜两两组合第一批已闭合；P36-E 格局总字典第一批已闭合；P36-F 当前盘证据链已闭合；P36-G 数据字典大模块蓝图、读盘可用性复核和缺口复核清单已建立；P36-H-1 已补杂曜、周期流系和动态盘继承三类内容；P36-H-2 已补十二宫专题和当前盘格局综合资料；P36-H-3 已补四化来源盘层和地支空间关系；P36-H-4 已补外部解释法参考规则；P36-H-5 已补星曜字典抽样复核；P36-H-6 已补星曜入关键六宫可读性复核；P36-H-7 已补格局可读性复核；P36-H-8 已补当前盘段落样例抽查；P36-H-9 已补真实盘例回归复核；P36-H-10 已补当前盘解释闭合清单 |
| 行为映射 | 暂停 |

## 下一步

P35 已闭合。P36-0 数据字典总规划已完成，当前进入 P36-H 数据字典可读性复核和样例抽查：

1. P36-A 真实资料来源登记与索引扩充。进行中，只存元信息和项目自有摘要。
2. P36-B 星曜本体解释深挖。进行中，十四主星第一批已完成。
3. P36-C 星曜入十二宫解释深挖。已完成，主星、辅曜、煞曜、杂曜、周期流系星曜入宫第一批资料已闭合。
4. P36-D 星曜组合解释深挖。已完成，903 条两两组合已接入 15 分节解释和校验。
5. P36-E 格局解释深挖。已完成，195 条格局总字典已接入 14 分节解释和校验。
6. P36-F 当前盘综合解释资料化。已完成，当前盘证据链已接入详细分析。
7. P36-G 字典缺口复核与人工校验。已完成大模块蓝图、读盘可用性复核和十项缺口复核清单。
8. P36-H-1 内容补强第一批。已完成杂曜主题深度、周期流系层级和动态盘继承段落。
9. P36-H-2 综合解释深度补强。已完成十二宫专题综合和当前盘格局综合解释资料。
10. P36-H-3 四化与地支空间补强。已完成四化来源盘层和地支空间关系资料。
11. P36-H-4 外部解释法参考规则。已完成 ziwei.my 这类现代资料站的结构参考规则，只取解释层级、栏目和主题，不复制正文。
12. P36-H-5 星曜字典抽样复核。已完成紫微、贪狼、巨门、廉贞、武曲、破军六颗主星的七维度复核，并接入 `scripts/ziwei/check-star-dictionary-sample-review.mjs`。
13. P36-H-6 星曜入关键六宫可读性复核。已完成六颗主星入命宫、夫妻、财帛、官禄、迁移、疾厄 36 条样本，并接入 `scripts/ziwei/check-star-palace-readability-review.mjs`。
14. P36-H-7 格局总字典与当前盘命中格局可读性复核。已完成 8 类格局、96 个解释段，并接入 `scripts/ziwei/check-pattern-readability-review.mjs`。
15. P36-H-8 当前盘解释段落样例抽查。已完成 6 个场景、60 个解释段，并接入 `scripts/ziwei/check-current-chart-paragraph-sample-review.mjs`。
16. P36-H-9 真实盘例回归复核。已完成 7 个黄金样本、91 个复核段，并接入 `scripts/ziwei/check-current-chart-regression-review.mjs`。
17. P36-H-10 当前盘解释闭合清单。已完成 8 类输出门禁，并接入 `scripts/ziwei/check-current-chart-output-closure-gate.mjs`。

## 当前收口结论

紫微斗数当前阶段先收口，不继续扩展采集系统。

已经闭合的主线包括：排盘算法、十二宫盘面、主星辅曜杂曜、庙旺落陷、四化、格局与破格、不良格局、原盘/大限/流年/流月/流日/流时动态盘、三方四正动态线条、星曜字典、宫位/地支/天干/五行局/格局/四化解释、当前盘命中展示和资料来源边界。

资料采集批次已建立到可后续增强的结构层：字段模板、来源种子、批次计划、采集适配器、执行器、任务队列、程序输入草案、采集作业草案、运行批次、运行结果、阻断审计、审计输出、落库候选、晋级门禁和晋级决策。当前不再继续向下拆采集链路。

下一步只做两类事情：一是按 P36 覆盖矩阵补紫微数据字典内容；二是人工验收页面和内容缺口。若发现紫微斗数内容本体缺项，先回到星曜、入宫、组合、宫位、格局、四化、动态盘解释层补资料，再进入当前盘综合解释。
