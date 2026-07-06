export type ZiweiDataDictionaryGapPriority = "P0" | "P1" | "P2"

export type ZiweiDataDictionaryGapStatus =
  | "ready-for-next-batch"
  | "watching"
  | "blocked-by-source-review"

export interface ZiweiDataDictionaryGapReviewItem {
  gapId: string
  title: string
  priority: ZiweiDataDictionaryGapPriority
  status: ZiweiDataDictionaryGapStatus
  affectedLayers: string[]
  currentEvidence: string[]
  missingDetail: string[]
  nextDataWork: string[]
  acceptanceCriteria: string[]
  reviewBoundary: string[]
}

export const ZIWEI_DATA_DICTIONARY_GAP_REVIEW_ITEMS: ZiweiDataDictionaryGapReviewItem[] = [
  {
    gapId: "ziwei.gap.misc-star-detail-depth",
    title: "杂曜细节分组与组合权重补强",
    priority: "P0",
    status: "ready-for-next-batch",
    affectedLayers: ["星曜本体", "辅煞杂入宫", "星曜组合", "当前盘证据链"],
    currentEvidence: [
      "现有字典已覆盖杂曜本体和入十二宫第一批解释，能在盘面中显示星曜、宫位和基础含义。",
      "当前盘证据链已经能区分主星、辅曜、煞曜、杂曜和周期星，不会把所有星曜混成同一权重。"
    ],
    missingDetail: [
      "杂曜内部还需要按贵人、桃花、孤寡、刑忌、仪饰、耗损、文书、声名、迁动等主题重新分组。",
      "同一杂曜遇到主星、六吉、六煞、四化和三方四正时，增强、减弱、转义、只作提示的边界还不够细。"
    ],
    nextDataWork: [
      "先整理每颗杂曜的本体象义、常见宫位、同宫触发、三方触发、动态盘触发和误读边界。",
      "补一批杂曜与主星、辅曜、煞曜、四化的组合说明，明确哪些只作细节提示，哪些会改变主题判断。"
    ],
    acceptanceCriteria: [
      "每颗杂曜至少具备本体、入宫、同宫、三方四正、动态盘、误读边界和来源线索。",
      "当前盘解释中杂曜不得压过主星和主宫主题，除非有四化、煞曜、格局或三方四正共同支持。"
    ],
    reviewBoundary: [
      "杂曜不使用庙旺落陷表强行判强弱；只使用可确认的分类、主题、位置和组合证据。"
    ]
  },
  {
    gapId: "ziwei.gap.periodic-star-layer-boundary",
    title: "年月日时流系星曜层级边界补强",
    priority: "P0",
    status: "ready-for-next-batch",
    affectedLayers: ["周期星本体", "周期星入宫", "动态盘", "当前盘证据链"],
    currentEvidence: [
      "现有资料已区分长生、博士、岁前、将前、月系、日时系等层级。",
      "动态盘已经建立原盘、大限、流年、流月、流日、流时的继承顺序。"
    ],
    missingDetail: [
      "年月日时星曜在不同盘层的作用强度、可解释范围、不得越级反推原盘的边界还要更细。",
      "流月、流日、流时的短周期提示需要和流年、大限、本命宫位分开，避免把临时触发写成长期结论。"
    ],
    nextDataWork: [
      "为年系、月系、日系、时系星曜分别补充本体解释、触发范围、有效周期和继承关系。",
      "补动态盘输出模板，要求说明当前选择的是大限、流年、流月、流日还是流时。"
    ],
    acceptanceCriteria: [
      "动态盘解释必须标明盘层，流年选择时保留大限背景，流月以下必须保留上层来源。",
      "周期星解释必须写清短期提示和长期结构的区别，不能直接替代本命主星。"
    ],
    reviewBoundary: [
      "周期流系星曜只作时间层触发，不作为原盘常驻星曜重写命盘结构。"
    ]
  },
  {
    gapId: "ziwei.gap.current-pattern-synthesis",
    title: "当前盘格局命中综合解释补强",
    priority: "P0",
    status: "ready-for-next-batch",
    affectedLayers: ["格局总字典", "当前盘命中", "破格复核", "动态盘"],
    currentEvidence: [
      "现有格局总字典已覆盖一百九十五条格局，并区分成格、破格、加吉、加煞和动态盘边界。",
      "当前盘只显示命中的格局，未命中格局不进入盘面结果。"
    ],
    missingDetail: [
      "格局本身解释和当前盘解释仍需进一步分开：总字典解释格局，当前盘解释这张盘为什么成、哪里弱、哪里破。",
      "多个格局同时命中时，主格、辅格、冲突格、破格信号之间的先后关系还需要更明确。"
    ],
    nextDataWork: [
      "补当前盘格局综合段落模板，按命中证据、成格条件、破格条件、加吉加煞、动态盘层级逐项输出。",
      "补多格局同盘时的排序规则，优先看命宫、三方四正、四化、庙旺落陷和破格证据。"
    ],
    acceptanceCriteria: [
      "盘中格局结果只显示命中项，并标明原盘、大限、流年、流月、流日或流时。",
      "每条命中格局都要有该盘证据，不得只复制总字典说明。"
    ],
    reviewBoundary: [
      "格局解释先做正统盘面分析，不进入人格化、行为映射或现实事件断语。"
    ]
  },
  {
    gapId: "ziwei.gap.palace-topic-paragraph-depth",
    title: "十二宫专题段落证据合成补强",
    priority: "P1",
    status: "ready-for-next-batch",
    affectedLayers: ["十二宫本体", "宫位主题链", "三方四正", "当前盘段落"],
    currentEvidence: [
      "十二宫本体已经具备观察问题、星曜读法、关系结构读法和动态盘读法。",
      "主题链规则层已经能为命身、财官、夫妻、迁移、疾厄等专题提供证据字段。"
    ],
    missingDetail: [
      "每个宫位还需要从单宫说明升级为专题段落，例如夫妻宫要看关系对象、互动方式、福德对宫和财官迁移支援。",
      "三方四正、对宫、夹宫、会照和空宫借对宫进入段落时，证据先后关系还不够细。"
    ],
    nextDataWork: [
      "补十二宫专题段落模板，每宫至少包括本宫、对宫、三方四正、同宫星曜、四化、动态盘和复核边界。",
      "补主题链字段到自然段落的转换规则，避免只堆标签。"
    ],
    acceptanceCriteria: [
      "当前盘每宫解释都能回答看什么、证据来自哪里、哪些只是辅助提示。",
      "宫位段落必须能追溯到本宫星曜、关系宫位、组合资料和动态盘层级。"
    ],
    reviewBoundary: [
      "十二宫解释不写现代人格标签，不跳到行为映射。"
    ]
  },
  {
    gapId: "ziwei.gap.transformation-source-layer",
    title: "四化来源天干与盘层差异复核",
    priority: "P0",
    status: "watching",
    affectedLayers: ["四化表", "四化专题", "四化目标星组合", "动态盘"],
    currentEvidence: [
      "现有资料已要求四化标明目标星、来源天干和盘层，不再把四化写成庙旺落陷。",
      "四化专题和四化目标星组合已经具备基础结构。"
    ],
    missingDetail: [
      "同一颗星在本命四化、大限四化、流年四化、流月以下触发时的解释差异还要细化。",
      "四化落在本宫、对宫、三方四正、夹宫和动态宫位时，证据权重还需要更多人工复核。"
    ],
    nextDataWork: [
      "补四化来源层级表，逐层说明本命、大限、流年、流月、流日、流时的使用边界。",
      "补四化目标星组合解释，把化禄、化权、化科、化忌与目标星本性、宫位主题和三方关系合并说明。"
    ],
    acceptanceCriteria: [
      "四化解释必须写清是谁的四化、来自哪个天干、作用在哪个星和哪个宫。",
      "页面和字典均不得给四化显示庙旺落陷。"
    ],
    reviewBoundary: [
      "四化不是独立星曜亮度，只能作为目标星和宫位主题的动态修正。"
    ]
  },
  {
    gapId: "ziwei.gap.branch-spatial-combination",
    title: "地支空间组三合冲合刑害补强",
    priority: "P1",
    status: "ready-for-next-batch",
    affectedLayers: ["十二地支", "宫位空间", "三方四正", "动态盘"],
    currentEvidence: [
      "十二地支已经补入四马地、四败地、四墓库地等空间语境。",
      "宫位与地支资料已经能为盘面空间提供基础解释。"
    ],
    missingDetail: [
      "三合局、六合、六冲、刑害、墓库、马地和败地在宫位解释中的具体用法还不够系统。",
      "地支空间与星曜组合、格局成败、动态盘流转之间的衔接还需要细化。"
    ],
    nextDataWork: [
      "补十二地支空间关系表，分清三合、六合、冲、刑、害、墓、马、败的读盘用途。",
      "补地支进入当前盘段落的证据规则，只解释空间语境，不做生肖化断语。"
    ],
    acceptanceCriteria: [
      "每个地支都要能说明宫位空间、三方关系、动态盘落点和误读边界。",
      "四马、四败、四墓库必须能被当前盘解释引用。"
    ],
    reviewBoundary: [
      "地支层服务盘面空间，不做生肖性格解释。"
    ]
  },
  {
    gapId: "ziwei.gap.source-reference-manual-review",
    title: "古籍与现代资料来源人工复核",
    priority: "P1",
    status: "blocked-by-source-review",
    affectedLayers: ["理论来源", "资料来源索引", "复核队列", "资料入库边界"],
    currentEvidence: [
      "现有来源层已建立理论来源索引、来源复核队列和可存储边界。",
      "现代网站只登记元信息、主题标签和项目自有摘要，不复制正文。"
    ],
    missingDetail: [
      "古籍条目仍需继续补版本、卷册、篇目、术语位置和可复核引用。",
      "现代资料的栏目结构可参考，但需要人工确认哪些只是说法差异，哪些能归入正式资料。"
    ],
    nextDataWork: [
      "按古籍、公版资料、现代网站元信息、人工校盘样例四类继续补来源。",
      "建立冲突标记，记录不同资料对同一星曜、格局或组合的差异。"
    ],
    acceptanceCriteria: [
      "正式入库解释必须有来源线索或项目自有整理依据。",
      "现代书籍和现代网站正文不入库，只允许保存元信息和自有摘要。"
    ],
    reviewBoundary: [
      "来源复核不足的内容先进入候选和复核队列，不作为最终断语。"
    ]
  },
  {
    gapId: "ziwei.gap.manual-calibration-samples",
    title: "人工校盘样例复核与脱敏样例",
    priority: "P2",
    status: "watching",
    affectedLayers: ["人工样例", "当前盘分析", "复核队列", "解释质量"],
    currentEvidence: [
      "当前阶段已经有人工样例校验结构和当前盘证据链。",
      "资料层已经能够记录复核边界，避免把单条资料直接当结论。"
    ],
    missingDetail: [
      "真实校盘样例还不足，缺少已脱敏、可复核、可反复校验的盘例集合。",
      "样例中不同老师、不同流派、不同判断路径的差异尚未形成冲突标记。"
    ],
    nextDataWork: [
      "建立脱敏样例格式，记录出生参数、排盘版本、命中证据、人工判断和复核结论。",
      "用样例反查数据字典，标记哪些解释太泛、哪些解释缺证据、哪些解释冲突。"
    ],
    acceptanceCriteria: [
      "样例不得包含可识别个人信息。",
      "样例只用于校验解释质量，不反向覆盖固定算法。"
    ],
    reviewBoundary: [
      "人工样例不能替代正统排盘规则，只能用于解释层复核。"
    ]
  },
  {
    gapId: "ziwei.gap.star-palace-text-quality",
    title: "星曜入宫文本深度抽样复核",
    priority: "P1",
    status: "ready-for-next-batch",
    affectedLayers: ["主星入宫", "辅煞杂入宫", "周期星入宫", "页面字典"],
    currentEvidence: [
      "主星、辅曜、煞曜、杂曜和周期流系星曜入十二宫已经完成第一批可读盘资料。",
      "检查脚本已锁定主星一百六十八条、辅煞杂三百四十八条、周期流系六百七十二条。"
    ],
    missingDetail: [
      "部分文本仍偏模板化，需要补具体宫位问题、主次关系、组合触发和解释边界。",
      "盘中位置页需要更细说明这颗星在本宫、对宫、三方和动态盘中怎样被读取。"
    ],
    nextDataWork: [
      "先抽样命宫、夫妻、财帛、官禄、迁移、疾厄六宫，逐星复核文本是否能支撑实际读盘。",
      "补每条入宫资料的本宫含义、对宫影响、三方四正、同宫杂曜、四化修正和动态盘差异。"
    ],
    acceptanceCriteria: [
      "入宫解释不能只有一句概括，必须能说明为什么落在该宫会这样读。",
      "页面字典中的盘中位置必须能解释当前盘出现位置，不显示未出现位置。"
    ],
    reviewBoundary: [
      "入宫资料是字典资料，不直接给出现实事件结论。"
    ]
  },
  {
    gapId: "ziwei.gap.dynamic-flow-inheritance-narrative",
    title: "动态盘继承解释段落补强",
    priority: "P0",
    status: "ready-for-next-batch",
    affectedLayers: ["大限", "流年", "流月", "流日", "流时", "当前盘解释"],
    currentEvidence: [
      "页面已经支持原盘、大限、流年、流月、流日、流时切换和命宫标记。",
      "当前盘证据链已经能记录动态流层级。"
    ],
    missingDetail: [
      "大限、流年、流月、流日、流时各自的解释段落还需要更清楚地写出继承链。",
      "用户选择流年时，大限背景应保留；选择流月、流日、流时时，上层背景也应保留并分层说明。"
    ],
    nextDataWork: [
      "补动态盘段落模板，按原盘底色、大限阶段、流年主题、流月焦点、流日触发、流时微调输出。",
      "补动态盘格局和动态盘宫位解释的盘层标签，避免把流动资料误认为本命资料。"
    ],
    acceptanceCriteria: [
      "选择任一动态层时，解释必须标明当前层和上层继承背景。",
      "取消大限时必须回到原盘状态，后续流年、流月、流日、流时选择同步清空。"
    ],
    reviewBoundary: [
      "动态盘只解释时间层变化，不改变原盘固定结构。"
    ]
  }
]

export function getAllZiweiDataDictionaryGapReviewItems(): ZiweiDataDictionaryGapReviewItem[] {
  return ZIWEI_DATA_DICTIONARY_GAP_REVIEW_ITEMS
}

export function getZiweiDataDictionaryGapReviewItem(
  gapId: string
): ZiweiDataDictionaryGapReviewItem | undefined {
  return ZIWEI_DATA_DICTIONARY_GAP_REVIEW_ITEMS.find((item) => item.gapId === gapId)
}
