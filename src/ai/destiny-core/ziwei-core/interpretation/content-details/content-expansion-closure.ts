export type ZiweiContentClosureStage =
  | "P24"
  | "P25"
  | "P26"
  | "P27"
  | "P28"
  | "P29"
  | "P30"
  | "P31"
  | "P32"
  | "P33"
  | "P34"

export interface ZiweiContentExpansionClosureRecord {
  stage: ZiweiContentClosureStage
  title: string
  priority: "P0" | "P1" | "P2" | "P3"
  status: "completed"
  relatedQueueItemIds: string[]
  relatedSourceIds: string[]
  completedScope: string[]
  acceptanceEvidence: string[]
  sourceBoundary: string[]
  remainingBoundary: string[]
  validationCommands: string[]
}

export const ZIWEI_P24_P34_CLOSURE_RECORDS: ZiweiContentExpansionClosureRecord[] = [
  {
    stage: "P24",
    title: "格局破格与不良格局细化",
    priority: "P0",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p0.pattern-breakage-detail"],
    relatedSourceIds: [
      "project.pattern-catalog",
      "project.content-dictionary",
      "internal.synthesis-reading-order"
    ],
    completedScope: [
      "195 个格局仍以项目格局目录为唯一命中来源。",
      "80 条格局与星曜组合关系覆盖成格、破格、弱承接和修复语境。",
      "24 条主题链命中规则保留 breakageHitRules，未命中格局不进入当前盘展示。"
    ],
    acceptanceEvidence: [
      "格局展示只读取盘中命中结果。",
      "破格、加煞、空劫、化忌、弱庙旺只作为证据域，不写绝对断语。",
      "高风险格局必须回到格局目录、证据域和复核边界。"
    ],
    sourceBoundary: [
      "格局硬规则只来自 project.pattern-catalog。",
      "破格解释为项目原创摘要，不复制外部格局断语。"
    ],
    remainingBoundary: [
      "后续新增格局必须先进入格局目录，再补字典解释。",
      "人工校盘争议不得直接改成硬规则。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-content-knowledge-repository.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  },
  {
    stage: "P25",
    title: "动态盘继承与降权资料补强",
    priority: "P0",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p0.dynamic-flow-inheritance"],
    relatedSourceIds: [
      "project.dynamic-flow-rules",
      "project.transformation-rules",
      "internal.synthesis-reading-order"
    ],
    completedScope: [
      "大限、流年、流月、流日、流时保留 chartLayer 和 dynamicFlowType。",
      "下级流层只追加短周期触发，不删除本命和上级流层证据。",
      "动态四化回到 sourceRuleIds，不重新定义四化目标表。"
    ],
    acceptanceEvidence: [
      "选择流年时保留大限层级，流月、流日、流时以此类推。",
      "短周期输出默认降权为提示，不覆盖本命结构。",
      "当前查看哪一层，只展示哪一层三方四正关系线。"
    ],
    sourceBoundary: [
      "动态盘规则只来自 project.dynamic-flow-rules。",
      "四化目标只来自 project.transformation-rules。"
    ],
    remainingBoundary: [
      "起运虚岁、节气边界或流派差异后续只进人工复核。",
      "不得用第三方软件排版作为动态盘规则。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-hard-rule-source-drift.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  },
  {
    stage: "P26",
    title: "星曜本体解释深度补充",
    priority: "P1",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p1-star-detail-deepening"],
    relatedSourceIds: [
      "project.star-catalog",
      "project.content-dictionary",
      "project.brightness-table",
      "classic.ziwei-doushu-quanshu"
    ],
    completedScope: [
      "103 颗星曜有星曜目录索引和分类边界。",
      "主星、辅曜、煞曜、杂曜、周期流系星曜分层解释，不混成同一规则。",
      "庙旺落陷只归有亮度表的目标星，不强行套到四化或无表杂曜。"
    ],
    acceptanceEvidence: [
      "星曜解释先做通用本体，再进入入宫、组合和当前盘解释。",
      "四化自身不写庙旺，庙旺落陷看目标星和目标宫。",
      "数据字典不直接等于当前盘结论。"
    ],
    sourceBoundary: [
      "星曜 ID、分类、显示名只来自 project.star-catalog。",
      "古籍只作为术语脉络和篇目索引，不复制长段原文。"
    ],
    remainingBoundary: [
      "后续可继续扩写文字深度，但不得新增重复星曜枚举。",
      "现代资料只登记元信息，不搬运正文。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-hard-rule-source-drift.mjs",
      "node scripts/ziwei/check-content-knowledge-repository.mjs"
    ]
  },
  {
    stage: "P27",
    title: "地支天干五行局细节补充",
    priority: "P1",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p1-branch-stem-element-detail"],
    relatedSourceIds: [
      "project.content-dictionary",
      "project.dynamic-flow-rules",
      "project.transformation-rules",
      "classic.ziwei-doushu-quanshu"
    ],
    completedScope: [
      "十二地支、十天干、五行局均有资料字典记录。",
      "四马地、四败地、四墓库地作为地支空间语境，不重写排盘算法。",
      "十干四化语境只解释触发背景，不重复定义四化目标表。"
    ],
    acceptanceEvidence: [
      "地支分组只进入解释层，不改变宫位顺序。",
      "五行局用于节律和大限语境，不重写紫微起星算法。",
      "天干与四化解释必须回到 transformation-rules。"
    ],
    sourceBoundary: [
      "基础空间解释为项目原创结构化摘要。",
      "古籍术语只存主题和索引。"
    ],
    remainingBoundary: [
      "流派差异进入人工复核，不直接改硬规则。",
      "五行局补充不得覆盖现有算法入口。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-content-knowledge-repository.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  },
  {
    stage: "P28",
    title: "宫位主题链证据补强",
    priority: "P1",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p1-theme-chain-evidence"],
    relatedSourceIds: [
      "project.content-dictionary",
      "project.pattern-catalog",
      "project.transformation-rules",
      "project.dynamic-flow-rules",
      "internal.synthesis-reading-order"
    ],
    completedScope: [
      "24 条宫位主题链、24 条结果阈值、24 条输出段落模板已经闭合。",
      "144 条字段段落矩阵和 72 条证据域交叉引用提供解释路径。",
      "每个段落必须能回到字段、证据域、格局、四化或动态盘来源。"
    ],
    acceptanceEvidence: [
      "复核缺口不得被当成结论输出。",
      "隐藏条件、降权条件和冲突证据必须保留。",
      "页面分析只展示当前盘命中的结果。"
    ],
    sourceBoundary: [
      "主题链为项目原创组织结构。",
      "不复制第三方排盘报告文案。"
    ],
    remainingBoundary: [
      "新增主题链段落必须补字段矩阵和来源引用。",
      "冲突证据后续进入人工校验。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-content-knowledge-repository.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  },
  {
    stage: "P29",
    title: "四化动态解释补强",
    priority: "P1",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p1-transformation-dynamic-detail"],
    relatedSourceIds: [
      "project.transformation-rules",
      "project.star-catalog",
      "project.content-dictionary",
      "internal.synthesis-reading-order"
    ],
    completedScope: [
      "20 条四化专题和 40 条四化目标星组合已经进入资料层。",
      "本命、大限、流年、流月、流日、流时均有盘层解释边界。",
      "四化目标、来源天干、目标星、目标宫和 sourceRuleIds 必须保留。"
    ],
    acceptanceEvidence: [
      "四化目标表不得在数据字典重复定义。",
      "四化自身不分庙旺，强弱承接看目标星和目标宫。",
      "动态四化必须标明 flowType。"
    ],
    sourceBoundary: [
      "四化目标只来自 project.transformation-rules。",
      "解释文字为项目原创摘要，不复制外部四化断语。"
    ],
    remainingBoundary: [
      "流派差异只能记录为待复核元信息。",
      "四化解释不能替代格局命中条件。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-hard-rule-source-drift.mjs",
      "node scripts/ziwei/check-content-knowledge-repository.mjs"
    ]
  },
  {
    stage: "P30",
    title: "古籍术语与篇目索引",
    priority: "P2",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p2-classic-term-index"],
    relatedSourceIds: [
      "classic.ziwei-doushu-quanshu",
      "classic.ziwei-doushu-quanshu-shuge-index",
      "classic.ziwei-doushu-lineage-ctext-index"
    ],
    completedScope: [
      "古籍来源以术语、篇目、版本和主题索引形式进入来源层。",
      "公开索引只作为查证入口，不作为唯一断法来源。",
      "古籍内容输出采用项目自有摘要。"
    ],
    acceptanceEvidence: [
      "不存长段原文。",
      "不把索引内容当成已校勘理论。",
      "版本差异保留 medium 或 low confidence。"
    ],
    sourceBoundary: [
      "古籍只存篇名、主题、版本和自有摘要。",
      "公开书影或页面排版不进入项目。"
    ],
    remainingBoundary: [
      "后续人工核书可补版本页码。",
      "争议条目不得提升为硬规则。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-content-knowledge-repository.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  },
  {
    stage: "P31",
    title: "现代资料元信息登记",
    priority: "P2",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p2-modern-source-metadata"],
    relatedSourceIds: ["external.modern-reference-metadata"],
    completedScope: [
      "现代资料仅作为 metadata-only 来源。",
      "允许登记书名、作者、版本、页码、主题、链接和复核状态。",
      "现代资料不得作为唯一硬规则。"
    ],
    acceptanceEvidence: [
      "不存受版权保护正文。",
      "不存截图、图标、商标或排版。",
      "现代资料只能作为人工查证入口。"
    ],
    sourceBoundary: [
      "metadata-only。",
      "不得复制现代书籍、课程、网站或软件内容。"
    ],
    remainingBoundary: [
      "后续补资料时必须先写版权策略。",
      "无法确认版权的资料只保留待复核标记。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-content-knowledge-repository.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  },
  {
    stage: "P32",
    title: "星曜组合与关系结构样例",
    priority: "P2",
    status: "completed",
    relatedQueueItemIds: [
      "content-expansion.p2-pair-combination-examples",
      "content-expansion.p2-relationship-structure-examples"
    ],
    relatedSourceIds: [
      "project.star-catalog",
      "project.pattern-catalog",
      "project.content-dictionary",
      "project.dynamic-flow-rules",
      "internal.synthesis-reading-order"
    ],
    completedScope: [
      "903 条星曜两两组合为组合解释提供样例基础。",
      "10 条关系结构覆盖同宫、对宫、三方四正、夹宫、会照和动态叠盘。",
      "组合样例只解释互动方式，不替代格局命中条件。"
    ],
    acceptanceEvidence: [
      "助力、压力、牵制、修复都必须有边界表达。",
      "三方四正线条只看当前查看盘层。",
      "冲突证据进入复核，不直接放大断语。"
    ],
    sourceBoundary: [
      "样例为项目原创表达。",
      "不复制外部排盘软件布局或断语。"
    ],
    remainingBoundary: [
      "后续样例可以继续增加，但必须保留 sourceReferences。",
      "组合解释不得生成未命中格局。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-content-knowledge-repository.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  },
  {
    stage: "P33",
    title: "人工样例校验补充",
    priority: "P3",
    status: "completed",
    relatedQueueItemIds: ["content-expansion.p3-human-calibration-samples"],
    relatedSourceIds: ["human.calibration-notes"],
    completedScope: [
      "人工样例被限定为校验材料，不提升为通用理论。",
      "样例需要保留日期、差异摘要和复核状态。",
      "第三方案例只存元信息和自有摘要。"
    ],
    acceptanceEvidence: [
      "单一样例不能写成普遍断法。",
      "样例差异必须进入复核状态。",
      "人工校验不能覆盖 P0 硬规则来源。"
    ],
    sourceBoundary: [
      "只存用户自有输入、项目样例和自有摘要。",
      "不存第三方完整案例或版权文本。"
    ],
    remainingBoundary: [
      "后续人工校盘按样例清单追加。",
      "争议样例只作为复核问题。"
    ],
    validationCommands: ["node scripts/ziwei/check-p24-p34-closure.mjs"]
  },
  {
    stage: "P34",
    title: "当前阶段总闭合",
    priority: "P0",
    status: "completed",
    relatedQueueItemIds: [
      "content-expansion.p0.pattern-breakage-detail",
      "content-expansion.p0.dynamic-flow-inheritance",
      "content-expansion.p1-star-detail-deepening",
      "content-expansion.p1-branch-stem-element-detail",
      "content-expansion.p1-theme-chain-evidence",
      "content-expansion.p1-transformation-dynamic-detail",
      "content-expansion.p2-classic-term-index",
      "content-expansion.p2-modern-source-metadata",
      "content-expansion.p2-pair-combination-examples",
      "content-expansion.p2-relationship-structure-examples",
      "content-expansion.p3-human-calibration-samples"
    ],
    relatedSourceIds: [
      "project.star-catalog",
      "project.pattern-catalog",
      "project.transformation-rules",
      "project.brightness-table",
      "project.dynamic-flow-rules",
      "project.content-dictionary",
      "internal.synthesis-reading-order"
    ],
    completedScope: [
      "P24-P33 的资料闭合记录已经全部登记。",
      "文档只保留 docs/ziwei 的 8 个当前文档。",
      "P0 硬规则、数据字典、来源版权、页面验收和执行表已经同步到闭合状态。"
    ],
    acceptanceEvidence: [
      "P24-P34 执行表状态为已完成。",
      "总闭合检查脚本覆盖资料队列、来源边界、文档结构和验证命令。",
      "盘面外映射仍保持暂停，不混入本阶段。"
    ],
    sourceBoundary: [
      "闭合说明只描述项目结构化资料，不引入外部正文。",
      "所有后续资料扩展仍需遵守来源和版权边界。"
    ],
    remainingBoundary: [
      "后续可以继续增量扩充资料深度，但当前 P24-P34 阶段视为闭合。",
      "新增算法或资料必须重新跑闭合检查。"
    ],
    validationCommands: [
      "node scripts/ziwei/check-hard-rule-source-drift.mjs",
      "node scripts/ziwei/check-content-knowledge-repository.mjs",
      "node scripts/ziwei/check-p24-p34-closure.mjs"
    ]
  }
]

export function getAllZiweiContentExpansionClosureRecords(): ZiweiContentExpansionClosureRecord[] {
  return ZIWEI_P24_P34_CLOSURE_RECORDS
}

export function getZiweiContentExpansionClosureRecord(
  stage: ZiweiContentClosureStage
): ZiweiContentExpansionClosureRecord | undefined {
  return ZIWEI_P24_P34_CLOSURE_RECORDS.find((record) => record.stage === stage)
}

