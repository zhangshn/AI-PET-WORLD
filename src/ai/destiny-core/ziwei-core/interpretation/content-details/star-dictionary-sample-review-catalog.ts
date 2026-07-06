import type { ZiweiStarId } from "../../contracts"
import { MAIN_STAR_IDS } from "../../star-catalog"

export type ZiweiStarDictionaryReviewDimensionId =
  | "star-body"
  | "twelve-palaces"
  | "same-palace-combination"
  | "opposite-trine-square"
  | "transformation-trigger"
  | "dynamic-flow-boundary"
  | "current-chart-output"

export type ZiweiStarDictionaryReviewStatus =
  | "ready"
  | "needs-more-detail"
  | "needs-source-review"

export interface ZiweiStarDictionaryReviewDimension {
  dimensionId: ZiweiStarDictionaryReviewDimensionId
  label: string
  status: ZiweiStarDictionaryReviewStatus
  existingEvidenceRefs: string[]
  requiredReadingFields: string[]
  missingDetailNotes: string[]
  nextAction: string
}

export interface ZiweiStarDictionarySampleReviewProfile {
  reviewId: string
  starId: ZiweiStarId
  starLabel: string
  reason: string
  referenceMethod: string[]
  dimensions: ZiweiStarDictionaryReviewDimension[]
  currentChartUseRules: string[]
  sourceBoundary: string[]
  nextSupplementOrder: string[]
}

interface ReviewedMainStarDraft {
  starId: ZiweiStarId
  starLabel: string
  reason: string
  bodyFocus: string
  palaceFocus: string
  combinationFocus: string
  relationFocus: string
  transformationFocus: string
  dynamicFocus: string
  outputFocus: string
  missingDetailNotes: Partial<Record<ZiweiStarDictionaryReviewDimensionId, string[]>>
}

const REVIEWED_MAIN_STARS: ReviewedMainStarDraft[] = [
  {
    starId: MAIN_STAR_IDS.ziwei,
    starLabel: "紫微",
    reason: "紫微是中枢主星，适合检查星曜本体、统御主题、辅佐条件、孤君风险和当前盘输出边界是否完整。",
    bodyFocus: "本体必须写清帝座、中枢、定序、统摄、名分、权责、稳定资源与孤君风险，不能只写尊贵。",
    palaceFocus: "入十二宫时，要把中枢、责任、组织、调度、权责和名分转换到命、夫、财、官、迁、疾等具体人事领域。",
    combinationFocus: "重点复核紫微七杀、紫微天府、紫微贪狼、紫微破军、紫微天相以及百官朝拱类辅佐结构。",
    relationFocus: "三方四正要看辅佐是否到位、权责是否有人承接、对宫是否形成外部牵制，夹宫与会照不可混写。",
    transformationFocus: "四化触发时要写清权责、名誉、资源或牵挂落在哪一宫、来自哪一层盘，不能只写地位提升。",
    dynamicFocus: "大限和流年见紫微，重点看阶段中心、职责位置、资源调度和外部认可；流月流日流时只能降权为短期触发。",
    outputFocus: "当前盘输出先写所在宫位与同宫结构，再写三方四正是否成局，最后判断中枢能力是否能落地。",
    missingDetailNotes: {
      "same-palace-combination": ["继续补紫微与辅曜、煞曜、杂曜同宫时的细节权重，尤其是辅佐成局与孤君失辅的界线。"],
      "current-chart-output": ["需要用实际盘例复核紫微在关系宫、福德宫、疾厄宫时，是否会被误写成单纯领导力。"]
    }
  },
  {
    starId: MAIN_STAR_IDS.tanlang,
    starLabel: "贪狼",
    reason: "贪狼最容易被简化成桃花，适合检查欲望、社交、才艺、资源流动、变化与边界风险是否分开。",
    bodyFocus: "本体必须写清欲望、体验、社交、才艺、变化、资源交换、享受、扩张和沉迷边界。",
    palaceFocus: "入十二宫时，要区分财帛的资源流动、夫妻的吸引边界、官禄的才艺营销、福德的享受欲望。",
    combinationFocus: "重点复核廉贞贪狼、紫微贪狼、贪狼破军、贪狼火铃、贪狼禄存等组合，不能只按桃花断。",
    relationFocus: "三方四正要看欲望是否有承接，社交资源是否进入财官迁或关系宫，以及煞忌是否形成失控成本。",
    transformationFocus: "四化触发时要区分资源、扩张、名声、牵挂、沉迷和欲望过度，不能把化禄一律写成好。",
    dynamicFocus: "动态盘见贪狼，多看社交、消费、合作、曝光、兴趣、短期机会和资源交换。",
    outputFocus: "当前盘输出必须写清欲望落在哪个宫位，以及是否有边界、资源和现实承接。",
    missingDetailNotes: {
      "star-body": ["继续补贪狼在才艺、消费、社交、资源交换四条线的来源复核。"],
      "same-palace-combination": ["贪狼与火铃、禄存、桃花杂曜的组合需要细分为资源型、欲望型、曝光型和风险型。"]
    }
  },
  {
    starId: MAIN_STAR_IDS.jumen,
    starLabel: "巨门",
    reason: "巨门最容易被简化成是非口舌，适合检查表达、遮蔽、疑惑、研究和沟通成本的完整性。",
    bodyFocus: "本体必须写清口舌、辨析、遮蔽、怀疑、问题揭露、研究分析、沟通成本和解释压力。",
    palaceFocus: "入十二宫时，要把语言和疑惑转换到命、夫妻、官禄、财帛、疾厄等不同问题场。",
    combinationFocus: "重点复核天机巨门、太阳巨门、天同巨门、巨门化忌等组合，区分研究表达与是非误解。",
    relationFocus: "三方四正要看巨门的问题意识由哪条宫线引入，是否被太阳、昌曲、化科照明。",
    transformationFocus: "巨门化忌、化权、化科等触发要分清话语权、误会、文书、解释和遮蔽来源。",
    dynamicFocus: "动态盘见巨门，多看沟通、文件、争议、解释、质疑、调查和澄清。",
    outputFocus: "当前盘输出必须先写需要说清楚什么，再写误会、争议或研究能力如何形成。",
    missingDetailNotes: {
      "opposite-trine-square": ["继续补巨门在对宫和三方照入时，如何区分外部误会、内部疑虑和事实调查。"],
      "current-chart-output": ["用实际盘例复核巨门化忌时是否过度输出负面断语。"]
    }
  },
  {
    starId: MAIN_STAR_IDS.lianzhen,
    starLabel: "廉贞",
    reason: "廉贞兼具规则、欲望、审美、边界和是非，适合检查复杂星曜是否被拆成多条语义线。",
    bodyFocus: "本体必须写清规范、边界、欲望、审美、制度、辨别、纠葛、名声风险和自我约束。",
    palaceFocus: "入十二宫时，要区分夫妻关系边界、官禄制度责任、财帛资源约束、福德欲望管理。",
    combinationFocus: "重点复核廉贞贪狼、廉贞七杀、廉贞破军、天府廉贞、天相廉贞等组合。",
    relationFocus: "三方四正要看规则和欲望是否互相牵制，煞忌是否形成破格、纠缠或代价。",
    transformationFocus: "四化触发时要区分制度资源、权责推动、名声修饰、纠缠牵挂和边界风险。",
    dynamicFocus: "动态盘见廉贞，多看关系边界、制度审查、名声、人情、欲望和规则冲突。",
    outputFocus: "当前盘输出必须保留边界与欲望两条线，不能只写桃花或是非。",
    missingDetailNotes: {
      "star-body": ["继续补廉贞作为囚星、次桃花、制度边界的不同来源口径。"],
      "transformation-trigger": ["廉贞四化触发需要补目标宫位差异，尤其是官禄、夫妻、财帛、福德。"]
    }
  },
  {
    starId: MAIN_STAR_IDS.wuqu,
    starLabel: "武曲",
    reason: "武曲容易被简化成财星，适合检查财务、执行、纪律、现实压力和关系冷硬是否分层。",
    bodyFocus: "本体必须写清财务资源、执行纪律、现实结果、成本控制、硬度、技术、管理和孤克感。",
    palaceFocus: "入十二宫时，要区分财帛的现金流、官禄的执行责任、夫妻的现实条件、田宅的资产管理。",
    combinationFocus: "重点复核武曲破军、武曲天府、武曲天相、武曲七杀等现实执行组合。",
    relationFocus: "三方四正要看财官迁资源链是否成形，煞忌是否转成损耗、硬碰硬或财务压力。",
    transformationFocus: "武曲化禄、化权、化忌等要分别看资源入账、权责执行、财务牵挂和现实压力。",
    dynamicFocus: "动态盘见武曲，多看财务、预算、项目执行、合同、成本、资产和现实承接。",
    outputFocus: "当前盘输出必须写清现实资源和执行压力落在哪一宫，不能只写有财或破财。",
    missingDetailNotes: {
      "same-palace-combination": ["继续补武曲与辅曜、杂曜同宫时如何从财务扩展到制度、技术和执行细节。"],
      "dynamic-flow-boundary": ["流月、流日见武曲时要明确降权为付款、预算、执行节点和短期现实压力。"]
    }
  },
  {
    starId: MAIN_STAR_IDS.pojun,
    starLabel: "破军",
    reason: "破军容易被简化成破坏或破财，适合检查破旧立新、重组、消耗和重建条件是否完整。",
    bodyFocus: "本体必须写清破旧立新、结构重组、变动消耗、资源再分配、新旧替换和先破后立。",
    palaceFocus: "入十二宫时，要区分命宫的变动性、官禄的职业重组、财帛的资源波动、夫妻的关系重组。",
    combinationFocus: "重点复核武曲破军、七杀破军、廉贞破军、贪狼破军等变局组合。",
    relationFocus: "三方四正要看破后能否重建，是否有天府、紫微、辅曜、禄权科承接。",
    transformationFocus: "四化触发时要区分主动更新、强行重组、名声修补、牵挂破耗和止损边界。",
    dynamicFocus: "动态盘见破军，多看换环境、改计划、拆旧结构、项目翻修、关系重组和资源重新配置。",
    outputFocus: "当前盘输出必须写清破什么、为什么破、破后有没有承接，不能只写凶。",
    missingDetailNotes: {
      "opposite-trine-square": ["继续补破军在三方四正里作为变动源、破格点或重建入口的判断次序。"],
      "current-chart-output": ["用实际盘例复核破军在短周期出现时不会被放大成长久破败结论。"]
    }
  }
]

export const ZIWEI_STAR_DICTIONARY_SAMPLE_REVIEW_PROFILES: ZiweiStarDictionarySampleReviewProfile[] =
  REVIEWED_MAIN_STARS.map((star) => ({
    reviewId: `p36-h5.star-sample-review.${star.starId}`,
    starId: star.starId,
    starLabel: star.starLabel,
    reason: star.reason,
    referenceMethod: [
      "先读星曜本体，再读星曜入十二宫。",
      "再读同宫组合、对宫、三方四正、夹宫会照。",
      "再读四化来源盘层和目标宫位。",
      "再读大限、流年、流月、流日、流时的动态边界。",
      "最后只输出当前盘命中的证据和解释。"
    ],
    dimensions: buildReviewDimensions(star),
    currentChartUseRules: [
      `${star.starLabel}只在当前盘真实出现时输出。`,
      `输出${star.starLabel}时必须同时写明所在宫位、盘层、同宫星曜、对宫和三方四正。`,
      `若${star.starLabel}被四化触发，必须写清来源天干、来源盘层、目标星和目标宫。`,
      `若${star.starLabel}只在流月、流日或流时出现，只能作为短周期触发，不能反推本命结论。`,
      "资料不足时隐藏或进入复核队列，不用空泛断语补足。"
    ],
    sourceBoundary: [
      "现代网站只作为解释结构、栏目和主题标签参考，不复制正文。",
      "星曜解释正文必须使用项目自有语言，并保留来源线索和复核状态。",
      "单站资料不能直接升为硬规则，必须能被公版古籍、既有规则或人工样例复核。",
      "当前盘解释不得把总字典全文直接填入盘面。"
    ],
    nextSupplementOrder: [
      `先补${star.starLabel}本体来源复核。`,
      `再抽样${star.starLabel}入命、夫、财、官、迁、疾六宫文本。`,
      `再补${star.starLabel}主要同宫组合与三方四正权重。`,
      `再补${star.starLabel}四化目标宫差异。`,
      "最后用人工样例验证当前盘输出是否过度泛化。"
    ]
  }))

function buildReviewDimensions(star: ReviewedMainStarDraft): ZiweiStarDictionaryReviewDimension[] {
  return [
    dimension(star, "star-body", "星曜本体", "ready", [
      "getMainStarContentDetail",
      "ZIWEI_MAIN_STAR_CONTENT_DETAILS"
    ], [
      star.bodyFocus,
      "五行阴阳、核心象义、优势、风险、喜忌边界和误读边界。"
    ], "继续补来源复核和不同资料口径差异。"),
    dimension(star, "twelve-palaces", "星曜入十二宫", "ready", [
      "getMainStarPalaceCombinationContentDetail",
      "ZIWEI_MAIN_STAR_PALACE_COMBINATION_DETAILS"
    ], [
      star.palaceFocus,
      "每宫都要保留本宫、对宫、三方四正、四化、动态盘和当前盘证据入口。"
    ], "抽样六宫文本做人工可读性复核。"),
    dimension(star, "same-palace-combination", "同宫组合", "needs-more-detail", [
      "getSpecificStarPairCombinationContentDetailsForStar",
      "ZIWEI_STAR_PAIR_COMBINATION_DETAILS"
    ], [
      star.combinationFocus,
      "同宫组合要分主次、同宫、对宫、三方、夹宫、四化和动态层。"
    ], "先补高频主星组合，再补辅曜、煞曜和杂曜组合。"),
    dimension(star, "opposite-trine-square", "对宫与三方四正", "needs-more-detail", [
      "relationship-structure-catalog",
      "palace-topic-synthesis-depth-catalog",
      "star-pair-combination-catalog"
    ], [
      star.relationFocus,
      "必须区分同宫、对宫、三方四正、夹宫和会照，不得混写。"
    ], "补当前盘关系结构样例，验证权重是否清楚。"),
    dimension(star, "transformation-trigger", "四化触发", "needs-more-detail", [
      "transformation-target-combination-catalog",
      "transformation-layer-depth-catalog"
    ], [
      star.transformationFocus,
      "必须写清谁的四化、来源天干、目标星、目标宫和盘层继承。"
    ], "补目标宫位差异和多层四化叠加样例。"),
    dimension(star, "dynamic-flow-boundary", "动态盘边界", "ready", [
      "dynamic-flow-inheritance-catalog",
      "periodic-star-flow-layer-catalog"
    ], [
      star.dynamicFocus,
      "原盘、大限、流年、流月、流日、流时必须分层降权。"
    ], "后续用实际盘例复核短周期是否被过度放大。"),
    dimension(star, "current-chart-output", "当前盘输出", "needs-more-detail", [
      "current-pattern-synthesis-depth-catalog",
      "palace-topic-synthesis-depth-catalog",
      "detailed-analysis-builder"
    ], [
      star.outputFocus,
      "当前盘只显示命中的证据和解释，未命中字典资料隐藏。"
    ], "补人工样例和输出段落质量复核。")
  ]
}

function dimension(
  star: ReviewedMainStarDraft,
  dimensionId: ZiweiStarDictionaryReviewDimensionId,
  label: string,
  status: ZiweiStarDictionaryReviewStatus,
  existingEvidenceRefs: string[],
  requiredReadingFields: string[],
  nextAction: string
): ZiweiStarDictionaryReviewDimension {
  return {
    dimensionId,
    label,
    status,
    existingEvidenceRefs,
    requiredReadingFields,
    missingDetailNotes: star.missingDetailNotes[dimensionId] ?? [
      `${star.starLabel}${label}已有基础资料，后续主要补人工样例、来源复核和更细的宫位差异。`
    ],
    nextAction
  }
}

export function getAllZiweiStarDictionarySampleReviewProfiles():
  ZiweiStarDictionarySampleReviewProfile[] {
  return ZIWEI_STAR_DICTIONARY_SAMPLE_REVIEW_PROFILES
}

export function getZiweiStarDictionarySampleReviewProfile(
  starId: ZiweiStarId
): ZiweiStarDictionarySampleReviewProfile | undefined {
  return ZIWEI_STAR_DICTIONARY_SAMPLE_REVIEW_PROFILES.find((profile) => profile.starId === starId)
}
