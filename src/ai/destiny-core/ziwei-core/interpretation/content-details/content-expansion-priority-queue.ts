import type { ZiweiSourceReferenceReviewPriority } from "./source-reference-review-queue"

export type ZiweiContentExpansionDomain =
  | "algorithm-source"
  | "dictionary-detail"
  | "classic-index"
  | "pattern-breakage"
  | "dynamic-flow"
  | "theme-chain"
  | "manual-calibration"
  | "copyright-boundary"

export interface ZiweiContentExpansionPriorityItem {
  itemId: string
  title: string
  priority: ZiweiSourceReferenceReviewPriority
  domain: ZiweiContentExpansionDomain
  relatedLayerIds: string[]
  relatedSourceIds: string[]
  goal: string
  deliverables: string[]
  acceptanceChecks: string[]
  blockedBy: string[]
  copyrightBoundary: string[]
}

export const ZIWEI_CONTENT_EXPANSION_PRIORITY_QUEUE: ZiweiContentExpansionPriorityItem[] = [
  {
    itemId: "content-expansion.p0.algorithm-source-drift-audit",
    title: "项目算法来源漂移复核",
    priority: "P0",
    domain: "algorithm-source",
    relatedLayerIds: [
      "star.dictionary",
      "pattern.dictionary",
      "transformation.topic",
      "transformation.target-combination"
    ],
    relatedSourceIds: [
      "project.star-catalog",
      "project.pattern-catalog",
      "project.transformation-rules",
      "project.brightness-table",
      "project.dynamic-flow-rules"
    ],
    goal: "确保星曜目录、格局目录、四化目标、庙旺落陷表和动态盘规则仍是唯一硬规则来源。",
    deliverables: [
      "硬规则来源与资料层引用对照。",
      "算法改动后的 sourceReferences 更新清单。",
      "样例与检查脚本补充点。"
    ],
    acceptanceChecks: [
      "P0 来源必须保持 canActAsHardRule=true。",
      "资料字典不得重复定义 P0 算法表。",
      "check-hard-rule-source-drift.mjs 必须覆盖来源反查。"
    ],
    blockedBy: [],
    copyrightBoundary: ["只复核项目结构化算法，不引入外部正文或第三方软件排版。"]
  },
  {
    itemId: "content-expansion.p0.pattern-breakage-detail",
    title: "格局破格与不良格局细化",
    priority: "P0",
    domain: "pattern-breakage",
    relatedLayerIds: [
      "pattern.dictionary",
      "pattern-combination.relation",
      "palace-theme.evidence-hit-rule",
      "palace-theme.result-threshold"
    ],
    relatedSourceIds: [
      "project.pattern-catalog",
      "project.content-dictionary",
      "internal.synthesis-reading-order"
    ],
    goal: "补强格局命中、破格、加煞、弱承接和隐藏门槛，避免只列吉格而缺少风险结构。",
    deliverables: [
      "不良格局和破格结构的字段化说明。",
      "破格优先级、修复条件和隐藏条件。",
      "格局与星曜组合关系的复核问题。"
    ],
    acceptanceChecks: [
      "未命中格局不得进入当前盘展示。",
      "破格说明必须回到格局目录和证据域。",
      "高风险结论必须有降权或复核边界。"
    ],
    blockedBy: ["content-expansion.p0.algorithm-source-drift-audit"],
    copyrightBoundary: ["只写项目原创摘要，不复制外部格局断语。"]
  },
  {
    itemId: "content-expansion.p0.dynamic-flow-inheritance",
    title: "动态盘继承与降权资料补强",
    priority: "P0",
    domain: "dynamic-flow",
    relatedLayerIds: [
      "palace-theme.chain",
      "palace-theme.result-threshold",
      "palace-theme.output-paragraph-template",
      "transformation.topic"
    ],
    relatedSourceIds: [
      "project.dynamic-flow-rules",
      "project.transformation-rules",
      "internal.synthesis-reading-order"
    ],
    goal: "明确大限、流年、流月、流日、流时如何继承上级证据，以及短周期如何降权。",
    deliverables: [
      "盘层继承资料表。",
      "短周期触发降权规则。",
      "动态四化与主题链证据衔接说明。"
    ],
    acceptanceChecks: [
      "下级流层不能删除上级证据。",
      "流月、流日、流时输出必须标短周期提示。",
      "动态四化必须回到 sourceRuleIds。"
    ],
    blockedBy: ["content-expansion.p0.algorithm-source-drift-audit"],
    copyrightBoundary: ["不参考第三方动态盘版式或软件文案。"]
  },
  {
    itemId: "content-expansion.p1-star-detail-deepening",
    title: "星曜本体解释深度补充",
    priority: "P1",
    domain: "dictionary-detail",
    relatedLayerIds: [
      "star.dictionary",
      "main-star.palace-combination",
      "non-main-star.palace-combination",
      "star-pair.combination"
    ],
    relatedSourceIds: [
      "project.star-catalog",
      "project.content-dictionary",
      "project.brightness-table",
      "classic.ziwei-doushu-quanshu"
    ],
    goal: "继续扩充每颗星曜的特性、象义、优势、风险、喜忌、组合和误读边界。",
    deliverables: [
      "逐星解释扩展字段。",
      "主星、辅曜、煞曜、杂曜差异化说明。",
      "星曜与庙旺落陷、宫位、组合的边界说明。"
    ],
    acceptanceChecks: [
      "四化不写庙旺，庙旺只归目标星和目标宫。",
      "辅曜、煞曜、杂曜不能强行套主星规则。",
      "解释不能直接等同当前盘结论。"
    ],
    blockedBy: [],
    copyrightBoundary: ["古籍只能作为术语脉络，现代资料只存元信息。"]
  },
  {
    itemId: "content-expansion.p1-branch-stem-element-detail",
    title: "地支天干五行局细节补充",
    priority: "P1",
    domain: "dictionary-detail",
    relatedLayerIds: [
      "branch.dictionary",
      "stem.dictionary",
      "element-gate.dictionary"
    ],
    relatedSourceIds: [
      "project.content-dictionary",
      "project.dynamic-flow-rules",
      "project.transformation-rules",
      "classic.ziwei-doushu-quanshu"
    ],
    goal: "补充四马地、四败地、四墓库地、十干四化语境和五行局节律资料。",
    deliverables: [
      "地支分组细节。",
      "天干与四化语境说明。",
      "五行局与大限节律边界。"
    ],
    acceptanceChecks: [
      "基础空间层不重写排盘算法。",
      "天干不重复定义四化目标表。",
      "五行局不重写紫微起星算法。"
    ],
    blockedBy: [],
    copyrightBoundary: ["只记录项目原创结构化摘要。"]
  },
  {
    itemId: "content-expansion.p1-theme-chain-evidence",
    title: "宫位主题链证据资料补强",
    priority: "P1",
    domain: "theme-chain",
    relatedLayerIds: [
      "palace-theme.chain",
      "palace-theme.evidence-field-standard",
      "palace-theme.field-paragraph-matrix",
      "palace-theme.evidence-domain-cross-reference"
    ],
    relatedSourceIds: [
      "project.content-dictionary",
      "project.pattern-catalog",
      "project.transformation-rules",
      "project.dynamic-flow-rules",
      "internal.synthesis-reading-order"
    ],
    goal: "补强主题链字段、段落矩阵和证据域关系，保证整盘解释有证据路径。",
    deliverables: [
      "主题链字段补充。",
      "段落展示与隐藏条件。",
      "格局、四化、宫位关系证据域交叉说明。"
    ],
    acceptanceChecks: [
      "每个段落必须能回到证据字段。",
      "隐藏条件必须明确。",
      "复核缺口不得被当成结论输出。"
    ],
    blockedBy: ["content-expansion.p0.pattern-breakage-detail"],
    copyrightBoundary: ["输出模板为项目原创组织，不复制第三方排盘报告。"]
  },
  {
    itemId: "content-expansion.p1-transformation-dynamic-detail",
    title: "四化动态解释资料补强",
    priority: "P1",
    domain: "dynamic-flow",
    relatedLayerIds: [
      "transformation.topic",
      "transformation.target-combination",
      "palace-theme.evidence-domain-cross-reference"
    ],
    relatedSourceIds: [
      "project.transformation-rules",
      "project.star-catalog",
      "project.content-dictionary",
      "internal.synthesis-reading-order"
    ],
    goal: "补强四化来源天干、目标星、目标宫、盘层和动态触发的解释边界。",
    deliverables: [
      "四化盘层解释说明。",
      "目标星组合补充。",
      "化禄、化权、化科、化忌在动态盘中的降权规则。"
    ],
    acceptanceChecks: [
      "四化目标表不得重复定义。",
      "四化自身不分庙旺。",
      "动态四化必须带盘层和来源规则。"
    ],
    blockedBy: ["content-expansion.p0.dynamic-flow-inheritance"],
    copyrightBoundary: ["不复制外部四化断语。"]
  },
  {
    itemId: "content-expansion.p2-classic-term-index",
    title: "古籍术语与篇目索引补充",
    priority: "P2",
    domain: "classic-index",
    relatedLayerIds: [
      "star.dictionary",
      "pattern.dictionary",
      "palace.dictionary"
    ],
    relatedSourceIds: [
      "classic.ziwei-doushu-quanshu",
      "classic.ziwei-doushu-quanshu-shuge-index",
      "classic.ziwei-doushu-lineage-ctext-index"
    ],
    goal: "补充古籍术语、篇目、版本和主题索引，为后续人工核书留入口。",
    deliverables: [
      "古籍术语索引。",
      "篇目主题映射。",
      "待人工核验清单。"
    ],
    acceptanceChecks: [
      "不得复制长段原文。",
      "索引不能当成具体断法。",
      "版本差异必须标明待复核。"
    ],
    blockedBy: [],
    copyrightBoundary: ["只存篇名、主题、版本和项目自有摘要。"]
  },
  {
    itemId: "content-expansion.p2-modern-source-metadata",
    title: "现代资料元信息登记",
    priority: "P2",
    domain: "copyright-boundary",
    relatedLayerIds: [],
    relatedSourceIds: ["external.modern-reference-metadata"],
    goal: "登记现代书籍、课程、网站或软件资料的元信息和复核状态。",
    deliverables: [
      "书名、作者、版本、页码、主题、链接。",
      "版权边界和复核状态。",
      "禁止复制内容提醒。"
    ],
    acceptanceChecks: [
      "不存受版权保护正文。",
      "不存截图、图标、商标或排版。",
      "现代资料不能作为唯一硬规则。"
    ],
    blockedBy: [],
    copyrightBoundary: ["metadata-only；只做查证入口。"]
  },
  {
    itemId: "content-expansion.p2-pair-combination-examples",
    title: "星曜组合样例解释补充",
    priority: "P2",
    domain: "dictionary-detail",
    relatedLayerIds: [
      "star-pair.combination",
      "pattern-combination.relation",
      "main-star.palace-combination",
      "non-main-star.palace-combination"
    ],
    relatedSourceIds: [
      "project.star-catalog",
      "project.pattern-catalog",
      "project.content-dictionary",
      "internal.synthesis-reading-order"
    ],
    goal: "为星曜两两组合和组合格局关系补充可复用解释样例。",
    deliverables: [
      "组合互动样例。",
      "助力、压力、牵制、修复样例。",
      "误读边界和复核问题。"
    ],
    acceptanceChecks: [
      "样例只说明解释方式，不直接套当前盘。",
      "组合不能替代格局命中条件。",
      "压力组合必须有边界表达。"
    ],
    blockedBy: ["content-expansion.p1-star-detail-deepening"],
    copyrightBoundary: ["样例须为项目原创表达。"]
  },
  {
    itemId: "content-expansion.p2-relationship-structure-examples",
    title: "关系结构解释样例补充",
    priority: "P2",
    domain: "theme-chain",
    relatedLayerIds: [
      "relationship.structure",
      "palace-theme.chain",
      "palace-theme.evidence-domain-cross-reference"
    ],
    relatedSourceIds: [
      "project.content-dictionary",
      "project.dynamic-flow-rules",
      "project.pattern-catalog",
      "internal.synthesis-reading-order"
    ],
    goal: "补充同宫、对宫、三方四正、夹宫、会照和动态叠盘的解释样例。",
    deliverables: [
      "关系结构样例。",
      "证据优先级说明。",
      "冲突复核问题。"
    ],
    acceptanceChecks: [
      "关系结构不重写宫位算法。",
      "三方四正线条只看当前查看盘层。",
      "冲突证据必须进入复核。"
    ],
    blockedBy: ["content-expansion.p1-theme-chain-evidence"],
    copyrightBoundary: ["不复制外部排盘软件布局或断语。"]
  },
  {
    itemId: "content-expansion.p3-human-calibration-samples",
    title: "人工样例校验补充",
    priority: "P3",
    domain: "manual-calibration",
    relatedLayerIds: [],
    relatedSourceIds: ["human.calibration-notes"],
    goal: "补充人工样例、差异摘要和复核状态，用于验证资料解释是否稳定。",
    deliverables: [
      "人工样例清单。",
      "差异点摘要。",
      "待复核状态和下一步处理。"
    ],
    acceptanceChecks: [
      "单一样例不能写成通用理论。",
      "样例必须保留日期和复核状态。",
      "第三方案例只存元信息和自有摘要。"
    ],
    blockedBy: [],
    copyrightBoundary: ["只存用户自有输入、项目样例和自有摘要。"]
  }
]

export function getAllZiweiContentExpansionPriorityItems(): ZiweiContentExpansionPriorityItem[] {
  return ZIWEI_CONTENT_EXPANSION_PRIORITY_QUEUE
}

export function getZiweiContentExpansionPriorityItem(
  itemId: string
): ZiweiContentExpansionPriorityItem | undefined {
  return ZIWEI_CONTENT_EXPANSION_PRIORITY_QUEUE.find((item) => {
    return item.itemId === itemId
  })
}
