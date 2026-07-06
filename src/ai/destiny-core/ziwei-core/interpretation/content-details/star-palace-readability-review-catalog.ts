import type { SectorName, ZiweiStarId } from "../../contracts"
import { MAIN_STAR_IDS } from "../../star-catalog"

export const ZIWEI_STAR_PALACE_READABILITY_REVIEW_PALACES = [
  "life",
  "spouse",
  "wealth",
  "career",
  "travel",
  "health"
] as const satisfies readonly SectorName[]

export type ZiweiStarPalaceReadabilityReviewPalaceId =
  typeof ZIWEI_STAR_PALACE_READABILITY_REVIEW_PALACES[number]

export interface ZiweiStarPalaceReadabilityReviewSection {
  title: string
  items: string[]
}

export interface ZiweiStarPalaceReadabilityReviewProfile {
  reviewId: string
  starId: ZiweiStarId
  starLabel: string
  palaceId: ZiweiStarPalaceReadabilityReviewPalaceId
  palaceLabel: string
  coreQuestion: string
  bodyToPalaceConversion: string
  samePalaceReading: string
  oppositeTrineSquareReading: string
  transformationReading: string
  dynamicLayerReading: string
  currentChartEvidenceRules: string[]
  readabilityChecklist: string[]
  insufficientDataPolicy: string[]
  nextReviewAction: string
  sections: ZiweiStarPalaceReadabilityReviewSection[]
}

interface StarReadabilitySeed {
  starId: ZiweiStarId
  starLabel: string
  bodyLine: string
  favorableLine: string
  riskLine: string
  relationLine: string
  transformationLine: string
  dynamicLine: string
}

interface PalaceReadabilitySeed {
  palaceId: ZiweiStarPalaceReadabilityReviewPalaceId
  palaceLabel: string
  topicLine: string
  keyQuestions: string[]
  oppositeLine: string
  trineSquareLine: string
  dynamicBoundary: string
}

const REVIEW_STARS: StarReadabilitySeed[] = [
  {
    starId: MAIN_STAR_IDS.ziwei,
    starLabel: "紫微",
    bodyLine: "紫微的本体是中枢、帝座、统摄、定序、责任和名分，解释时要先看它是否有辅佐、资源和制度承接。",
    favorableLine: "会左辅、右弼、天魁、天钺、文昌、文曲、禄权科或庙旺时，统御力较容易转成可执行的组织能力。",
    riskLine: "遇煞忌、空劫、落陷或无辅佐时，容易出现孤君、名位压力、权责不对称、中心失灵或自尊过重。",
    relationLine: "紫微看三方四正时，重点不是星名贵不贵，而是辅佐是否到位、权责是否有人承接、对宫是否形成外部牵制。",
    transformationLine: "紫微受四化牵动时，要写清来源天干、盘层、目标宫位和权责名誉的落点，不把化科化权简单写成好。",
    dynamicLine: "动态盘见紫微，原盘看长期主轴，大限看十年阶段中心，流年看年度职责，流月流日流时只看短期调度。"
  },
  {
    starId: MAIN_STAR_IDS.tanlang,
    starLabel: "贪狼",
    bodyLine: "贪狼的本体是欲望、社交、才艺、体验、变化、资源交换和吸引力，解释时必须把资源线和桃花线分开。",
    favorableLine: "会禄存、化禄、昌曲、魁钺或火铃成格时，可看社交资源、才艺表现、资源流动和多元机会。",
    riskLine: "遇忌煞、空劫、桃花过重或缺少现实承接时，容易出现欲望分散、关系纠缠、消费过度和资源混杂。",
    relationLine: "贪狼看三方四正时，要判断扩张是否有承接，社交资源是否能进入财官迁，还是只形成诱因和反复。",
    transformationLine: "贪狼受四化牵动时，要区分欲望被放大、资源被引入、名声被曝光、关系被牵挂或消费被加重。",
    dynamicLine: "动态盘见贪狼，常看社交、消费、合作、曝光、兴趣和短期机会，短周期不能反推成长期情感结论。"
  },
  {
    starId: MAIN_STAR_IDS.jumen,
    starLabel: "巨门",
    bodyLine: "巨门的本体是语言、辨析、疑问、遮蔽、问题揭露、研究和沟通成本，不能只写口舌是非。",
    favorableLine: "会化科、昌曲、魁钺、太阳或庙旺时，可看表达、研究、调查、谈判、教学和问题拆解能力。",
    riskLine: "遇化忌、煞曜、空劫或落陷时，要复核误会、隐情、争议、文书不清、话语压力和反复质疑。",
    relationLine: "巨门看三方四正时，要追问问题从哪条宫线进入，是外部误会、内部疑虑，还是事实需要澄清。",
    transformationLine: "巨门受四化牵动时，要写清话语权、误会、文书、解释、遮蔽和澄清路径，避免直接下负面断语。",
    dynamicLine: "动态盘见巨门，多看沟通、文件、争议、解释、质疑、调查和澄清，流月流日只作事件提醒。"
  },
  {
    starId: MAIN_STAR_IDS.lianzhen,
    starLabel: "廉贞",
    bodyLine: "廉贞的本体是规则、边界、欲望、审美、制度、辨别、纠葛和自我约束，解释时要保留多线结构。",
    favorableLine: "会吉曜、化禄、化科、天府、天相或庙旺时，可看制度意识、审美管理、人际分寸和资源转化。",
    riskLine: "遇煞忌、空劫、落陷或桃花牵动过重时，要复核纠缠、争议、欲望失控、名誉压力和边界混乱。",
    relationLine: "廉贞看三方四正时，要分清是规则力量还是欲望牵引，煞忌是否把边界问题变成破格成本。",
    transformationLine: "廉贞受四化牵动时，要区分制度资源、权责推动、名声修饰、纠缠牵挂和关系边界风险。",
    dynamicLine: "动态盘见廉贞，多看关系边界、制度审查、名声、人情、欲望和规则冲突。"
  },
  {
    starId: MAIN_STAR_IDS.wuqu,
    starLabel: "武曲",
    bodyLine: "武曲的本体是财务、执行、纪律、现实结果、成本控制、技术管理和硬性资源。",
    favorableLine: "会禄权、天府、天相、禄存、辅曜或庙旺时，利资源管理、专业执行、财务结构和可量化成果。",
    riskLine: "遇煞忌、空劫、落陷或同宫压力过重时，要复核刚硬、损耗、现金流压力、资源卡点和关系冷化。",
    relationLine: "武曲看三方四正时，重点看财官迁资源链是否成形，现实资源能否支撑职责和行动。",
    transformationLine: "武曲受四化牵动时，要分别看资源入账、权责执行、财务牵挂和现实压力。",
    dynamicLine: "动态盘见武曲，多看财务、预算、项目执行、合同、成本、资产和现实承接。"
  },
  {
    starId: MAIN_STAR_IDS.pojun,
    starLabel: "破军",
    bodyLine: "破军的本体是破旧立新、结构重组、变动消耗、资源再分配、新旧替换和先破后立。",
    favorableLine: "会禄权、紫微、天府、辅曜或庙旺时，利改革、更新、资源重配、技术拆解和突破旧局。",
    riskLine: "遇煞忌、空劫、落陷或缺少承接时，要复核破耗、失序、反复拆建、关系裂痕和资源流失。",
    relationLine: "破军看三方四正时，要看拆解之后是否能重建，是变动入口、破格点，还是单纯消耗。",
    transformationLine: "破军受四化牵动时，要区分主动更新、强行重组、名声修补、牵挂破耗和止损边界。",
    dynamicLine: "动态盘见破军，多看换环境、改计划、拆旧结构、项目翻修、关系重组和资源重新配置。"
  }
]

const REVIEW_PALACES: PalaceReadabilitySeed[] = [
  {
    palaceId: "life",
    palaceLabel: "命宫",
    topicLine: "命宫看本人主轴、判断方式、行动入口、承接能力和整盘气质，不等同于简单性格标签。",
    keyQuestions: ["这颗星如何形成本人主轴？", "身宫和迁移宫是否补足命宫？", "三方财官迁是否能让命宫能力落地？"],
    oppositeLine: "命宫对宫是迁移，要同时看外部环境如何反向塑造本人表现。",
    trineSquareLine: "命宫三方四正重点看财帛、官禄、迁移是否支撑本人能力、资源和公共表现。",
    dynamicBoundary: "动态命宫落此处时，本层以本人状态和阶段主轴为入口，但仍要保留原盘命宫底色。"
  },
  {
    palaceId: "spouse",
    palaceLabel: "夫妻宫",
    topicLine: "夫妻宫看伴侣关系、一对一合作、亲密互动、契约承诺和关系中的边界成本。",
    keyQuestions: ["这颗星如何表现为关系互动？", "官禄对宫是否把事业责任压入关系？", "福德和迁移是否支撑关系稳定？"],
    oppositeLine: "夫妻宫对宫是官禄，要看事业角色、责任分配和公共身份如何影响关系。",
    trineSquareLine: "夫妻宫三方四正要看命宫、福德、迁移等是否共同支持关系情绪和现实承接。",
    dynamicBoundary: "大限或流年触发夫妻宫时，看阶段关系主题；流月流日流时只看短期互动和合作事件。"
  },
  {
    palaceId: "wealth",
    palaceLabel: "财帛宫",
    topicLine: "财帛宫看收入结构、现金流、消费方式、资源调配、价值交换和现实成本。",
    keyQuestions: ["财源从哪里来？", "资源能否守成？", "消耗、机会和风险是否同时出现？"],
    oppositeLine: "财帛宫对宫是福德，要看欲望、享受和精神满足如何影响资源使用。",
    trineSquareLine: "财帛宫三方四正重点看命宫、官禄、迁移是否能把能力、职责和外部机会转成资源。",
    dynamicBoundary: "动态盘触发财帛宫时，按层级看年度收支、阶段预算、临时付款或资源机会。"
  },
  {
    palaceId: "career",
    palaceLabel: "官禄宫",
    topicLine: "官禄宫看事业定位、职责承担、工作模式、项目角色、公共表现和长期成就。",
    keyQuestions: ["事业靠什么能力承接？", "财官迁是否成链？", "事业责任是否牵动关系和身心？"],
    oppositeLine: "官禄宫对宫是夫妻，要看事业责任如何影响伴侣、合作对象和契约关系。",
    trineSquareLine: "官禄宫三方四正重点看命宫、财帛、迁移是否共同支撑事业落地。",
    dynamicBoundary: "动态盘触发官禄宫时，常看职位、项目、考核、会议、交付、转型和阶段职责。"
  },
  {
    palaceId: "travel",
    palaceLabel: "迁移宫",
    topicLine: "迁移宫看外部环境、出行迁动、异地机会、对外发展、人在外的表现和环境压力。",
    keyQuestions: ["外部环境是助力还是压力？", "动象是否有承接？", "命迁线是否一致？"],
    oppositeLine: "迁移宫对宫是命宫，要看外部环境如何反向影响本人主轴和行动方式。",
    trineSquareLine: "迁移宫三方四正重点看外部机会如何连接事业、财务、关系和行动结果。",
    dynamicBoundary: "动态盘触发迁移宫时，看出行、搬迁、环境变化、外地资源和对外合作，短周期只作事件提醒。"
  },
  {
    palaceId: "health",
    palaceLabel: "疾厄宫",
    topicLine: "疾厄宫看身心承压、作息节奏、压力来源、修复资源和风险提醒，不做医学诊断。",
    keyQuestions: ["压力从哪条宫线进入？", "是否有修复资源？", "是否需要现实健康检查？"],
    oppositeLine: "疾厄宫对宫是父母，要看背景制度、长辈牵动、文书流程和外部规范如何形成压力。",
    trineSquareLine: "疾厄宫三方四正重点看事业、家庭、精神状态和行动节奏是否共同加压。",
    dynamicBoundary: "动态盘触发疾厄宫时，只作身心状态、疲劳、作息和修复节奏提示，不输出医疗结论。"
  }
]

export const ZIWEI_STAR_PALACE_READABILITY_REVIEW_PROFILES:
  ZiweiStarPalaceReadabilityReviewProfile[] = REVIEW_STARS.flatMap((star) => {
    return REVIEW_PALACES.map((palace) => buildReviewProfile(star, palace))
  })

function buildReviewProfile(
  star: StarReadabilitySeed,
  palace: PalaceReadabilitySeed
): ZiweiStarPalaceReadabilityReviewProfile {
  const coreQuestion =
    `${star.starLabel}入${palace.palaceLabel}时，先问：${palace.keyQuestions.join("；")}。`
  const bodyToPalaceConversion =
    `${star.bodyLine}${palace.topicLine}所以解释时要把${star.starLabel}的本体转成${palace.palaceLabel}的具体议题，不能停在星曜名称。`
  const samePalaceReading =
    `同宫先看${star.starLabel}与本宫其他主星、辅曜、煞曜、杂曜的主次。${star.favorableLine}${star.riskLine}同宫解释必须说明是加强本宫主题、修饰本宫主题，还是把压力直接放入本宫。`
  const oppositeTrineSquareReading =
    `${palace.oppositeLine}${palace.trineSquareLine}${star.relationLine}因此${star.starLabel}入${palace.palaceLabel}不能只看本宫，要把对宫、三方四正、夹宫会照分开读。`
  const transformationReading =
    `${star.transformationLine}${palace.palaceLabel}若被四化触发，必须写清谁的四化、来源天干、来源盘层、目标星、目标宫和证据位置。`
  const dynamicLayerReading =
    `${star.dynamicLine}${palace.dynamicBoundary}原盘看底色，大限看十年阶段，流年看年度主题，流月、流日、流时只看短周期触发。`

  const currentChartEvidenceRules = [
    `当前盘必须实际出现${star.starLabel}入${palace.palaceLabel}，否则总字典资料隐藏。`,
    `必须列出${palace.palaceLabel}同宫星曜、对宫星曜、三方四正星曜和四化命中证据。`,
    `必须说明${star.starLabel}在${palace.palaceLabel}是本命、大限、流年、流月、流日还是流时层级。`,
    `若只有流月、流日或流时命中，只能写短期提醒，不反推本命或长期格局。`,
    `若资料不足，只进入复核队列，不用一句泛泛的吉凶断语补齐。`
  ]
  const readabilityChecklist = [
    `能否解释${star.starLabel}为什么要按${palace.palaceLabel}主题读。`,
    `能否区分本宫、同宫、对宫、三方四正和夹宫会照。`,
    `能否说明四化来源和动态盘层级，不把四化当成独立星曜庙旺。`,
    `能否保留${star.starLabel}的优势、风险和修复路径，而不是只写吉凶。`,
    `能否把结论限制在当前盘命中的证据范围内。`
  ]
  const insufficientDataPolicy = [
    "资料不足时先降级输出，不用空泛吉凶补齐。",
    "缺同宫组合时，只输出星曜入宫基础解释，并标记组合待复核。",
    "缺三方四正证据时，不输出成格、破格、加吉或加煞结论。",
    "缺四化来源时，不输出四化结论，只保留盘面命中位置。",
    "涉及疾厄时，只写压力和修复提醒，不写医学诊断。"
  ]
  const nextReviewAction =
    `下一步用真实盘例抽查${star.starLabel}入${palace.palaceLabel}时，输出段落是否能同时交代本体、宫位、同宫、三方四正、四化和动态盘层级。`

  return {
    reviewId: `p36-h6.star-palace-readability.${star.starId}.${palace.palaceId}`,
    starId: star.starId,
    starLabel: star.starLabel,
    palaceId: palace.palaceId,
    palaceLabel: palace.palaceLabel,
    coreQuestion,
    bodyToPalaceConversion,
    samePalaceReading,
    oppositeTrineSquareReading,
    transformationReading,
    dynamicLayerReading,
    currentChartEvidenceRules,
    readabilityChecklist,
    insufficientDataPolicy,
    nextReviewAction,
    sections: [
      { title: "核心问题", items: [coreQuestion] },
      { title: "本体转宫位", items: [bodyToPalaceConversion] },
      { title: "同宫解释", items: [samePalaceReading] },
      { title: "对宫与三方四正", items: [oppositeTrineSquareReading] },
      { title: "四化解释", items: [transformationReading] },
      { title: "动态盘边界", items: [dynamicLayerReading] },
      { title: "当前盘证据", items: currentChartEvidenceRules },
      { title: "可读性检查", items: readabilityChecklist },
      { title: "资料不足处理", items: insufficientDataPolicy },
      { title: "下一步复核", items: [nextReviewAction] }
    ]
  }
}

export function getAllZiweiStarPalaceReadabilityReviewProfiles():
  ZiweiStarPalaceReadabilityReviewProfile[] {
  return ZIWEI_STAR_PALACE_READABILITY_REVIEW_PROFILES
}

export function getZiweiStarPalaceReadabilityReviewProfile(
  starId: ZiweiStarId,
  palaceId: ZiweiStarPalaceReadabilityReviewPalaceId
): ZiweiStarPalaceReadabilityReviewProfile | undefined {
  return ZIWEI_STAR_PALACE_READABILITY_REVIEW_PROFILES.find((profile) => {
    return profile.starId === starId && profile.palaceId === palaceId
  })
}

export function getZiweiStarPalaceReadabilityReviewProfilesByStar(
  starId: ZiweiStarId
): ZiweiStarPalaceReadabilityReviewProfile[] {
  return ZIWEI_STAR_PALACE_READABILITY_REVIEW_PROFILES.filter((profile) => profile.starId === starId)
}

export function getZiweiStarPalaceReadabilityReviewProfilesByPalace(
  palaceId: ZiweiStarPalaceReadabilityReviewPalaceId
): ZiweiStarPalaceReadabilityReviewProfile[] {
  return ZIWEI_STAR_PALACE_READABILITY_REVIEW_PROFILES.filter((profile) => profile.palaceId === palaceId)
}
