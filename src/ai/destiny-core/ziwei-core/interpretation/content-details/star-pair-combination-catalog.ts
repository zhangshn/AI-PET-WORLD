import type { ZiweiStarId } from "../../contracts"

import type {
  ZiweiContentDictionarySection,
  ZiweiStarContentDetail,
  ZiweiStarPairCombinationCategory,
  ZiweiStarPairCombinationContentDetail,
  ZiweiStarPairCombinationGroup
} from "./content-detail-types"
import { getAllAssistantStarContentDetails } from "./assistant-star-meaning-catalog"
import { getAllMainStarContentDetails } from "./main-star-meaning-catalog"
import { getAllMaleficStarContentDetails } from "./malefic-star-meaning-catalog"
import { getAllMiscStarContentDetails } from "./misc-star-meaning-catalog"
import { buildStarPairCombinationSourceReferences } from "./content-source-reference-map"
import {
  ASSISTANT_STAR_IDS,
  MAIN_STAR_IDS,
  MALEFIC_STAR_IDS,
  MISC_STAR_IDS
} from "../../star-catalog"

interface StarPairSourceDetail extends ZiweiStarContentDetail {
  category: ZiweiStarPairCombinationCategory
}

interface SpecificStarPairCombinationProfile {
  label: string
  coreReading: string
  interactionMode: string
  supportiveSignals: string[]
  pressureSignals: string[]
  palaceRelationUsage: string[]
  dynamicUsage: string[]
  cautions: string[]
}

interface StarPairGroupProfile {
  label: string
  role: string
  supportiveTheme: string
  pressureTheme: string
  primaryRule: (starA: string, starB: string) => string
  supportiveSignal: (starA: string, starB: string) => string
  pressureSignal: (starA: string, starB: string) => string
}

export function getAllStarPairCombinationContentDetails(): ZiweiStarPairCombinationContentDetail[] {
  return getAllFixedStarPairSourceDetails().flatMap((starA, starAIndex, stars) => {
    return stars.slice(starAIndex + 1).map((starB) => {
      const detail = getStarPairCombinationContentDetail(starA.starId, starB.starId)

      if (!detail) {
        throw new Error(`Missing star pair combination: ${starA.starId} ${starB.starId}`)
      }

      return detail
    })
  })
}

export function getStarPairCombinationContentDetail(
  starAId: ZiweiStarId,
  starBId: ZiweiStarId
): ZiweiStarPairCombinationContentDetail | null {
  const details = getStarPairCombinationDetailMap()

  return (
    details[buildStarPairCombinationId(starAId, starBId)] ??
    details[buildStarPairCombinationId(starBId, starAId)] ??
    null
  )
}

export function getSpecificStarPairCombinationContentDetailsForStar(
  starId: ZiweiStarId
): ZiweiStarPairCombinationContentDetail[] {
  return SPECIFIC_STAR_PAIR_COMBINATION_STAR_ID_PAIRS.flatMap(
    ([starAId, starBId]) => {
      if (starAId !== starId && starBId !== starId) {
        return []
      }

      const detail = getStarPairCombinationContentDetail(starAId, starBId)

      return detail ? [detail] : []
    }
  )
}

export function getAllFixedStarPairSourceDetails(): StarPairSourceDetail[] {
  return [
    ...getAllMainStarContentDetails().map((detail) => withCategory(detail, "main")),
    ...getAllAssistantStarContentDetails().map((detail) => withCategory(detail, "assistant")),
    ...getAllMaleficStarContentDetails().map((detail) => withCategory(detail, "malefic")),
    ...getAllMiscStarContentDetails().map((detail) => withCategory(detail, "misc"))
  ]
}

function buildStarPairCombinationContentDetail(
  starA: StarPairSourceDetail,
  starB: StarPairSourceDetail
): ZiweiStarPairCombinationContentDetail {
  const group = getStarPairCombinationGroup(starA.category, starB.category)
  const profile = getStarPairGroupProfile(group)
  const combinationId = buildStarPairCombinationId(starA.starId, starB.starId)
  const sourceReferences = buildStarPairCombinationSourceReferences()
  const specificProfile = getSpecificStarPairCombinationProfile(
    starA.starId,
    starB.starId
  )
  const coreReading = specificProfile
    ? `${specificProfile.coreReading} 读该专条时仍要回到落宫主题、同宫对宫、三方四正、夹宫会照、四化来源、庙旺落陷和动态盘层；专条只说明组合倾向，不等于当前盘已经形成完整结论。`
    : `${starA.label}与${starB.label}组合时，先保留两颗星各自的本体：` +
      `${starA.label}重${starA.coreThemes.join("、")}，${starB.label}重${starB.coreThemes.join("、")}。` +
      `再看它们是同宫、对宫、三方四正、夹宫还是动态叠盘关系，不能脱离宫位、四化、庙旺和盘层直接下结论。` +
      `若组合进入当前盘解释，必须说明命中宫位、来源盘层、关系类型、支援或压力来源，以及是否有相同主题在三方四正重复出现。`
  const interactionMode = specificProfile
    ? `${specificProfile.interactionMode} 解释时必须进一步区分同宫、对宫、三方四正、夹宫会照和动态叠盘：同宫看共同主题，对宫看内外牵引，三方四正看结构支援，动态盘看时间触发。`
    : buildInteractionMode(starA, starB, profile)
  const readingOrder = [
    `先定关系范围：同宫权重最高，对宫看对象和外部反馈，三方四正看会照与格局，夹宫看左右夹持。`,
    `再定主次：${profile.primaryRule(starA.label, starB.label)}。`,
    `再看宫位主题：组合落入命、财、官、迁、夫、福等宫时，必须转译到该宫的人事问题。`,
    `再看四化、庙旺和煞忌：四化决定触发方向，庙旺决定承接层次，煞忌决定代价和修复入口。`,
    `再看同宫、对宫、三方四正是否同时出现相同主题；同一主题重复出现时提高权重，相互矛盾时进入复核。`,
    `最后才进入当前盘解释：只引用当前盘实际命中的星曜、宫位、盘层和关系，不把总字典说明当成已经发生的结论。`
  ]
  const supportiveSignals = [
    `${starA.label}的优势是${starA.strengths.join("、")}；${starB.label}的优势是${starB.strengths.join("、")}。两者能互相承接时，组合更容易形成${profile.supportiveTheme}。`,
    ...starA.favorableSignals.slice(0, 2).map((signal) => `${starA.label}侧助力：${signal}。`),
    ...starB.favorableSignals.slice(0, 2).map((signal) => `${starB.label}侧助力：${signal}。`),
    profile.supportiveSignal(starA.label, starB.label),
    ...(specificProfile?.supportiveSignals ?? [])
  ]
  const pressureSignals = [
    `${starA.label}的风险是${starA.risks.join("、")}；${starB.label}的风险是${starB.risks.join("、")}。两者互相牵制时，要先识别${profile.pressureTheme}。`,
    ...starA.unfavorableSignals.slice(0, 2).map((signal) => `${starA.label}侧压力：${signal}。`),
    ...starB.unfavorableSignals.slice(0, 2).map((signal) => `${starB.label}侧压力：${signal}。`),
    profile.pressureSignal(starA.label, starB.label),
    ...(specificProfile?.pressureSignals ?? [])
  ]
  const palaceRelationUsage = [
    `同宫时把${starA.label}和${starB.label}作为同一宫主题里的共同语气，先看谁承担主轴、谁提供助力或压力。`,
    `对宫时把${starA.label}和${starB.label}分成内外、主客、自我与对象之间的牵引，不把对宫照会误写成同宫。`,
    `三方四正时把组合当成结构证据，可参与成格、加吉、加煞和破格复核。`,
    `夹宫时重点看左右两宫是否对目标宫形成保护、拉扯、挤压或补强。`,
    `会照时要标明来源宫位和被会照宫位，只能说明主题被牵动，不能自动等同于同宫并坐。`,
    `邻宫时只作背景和过渡，不应直接替代本宫星曜；若邻宫同时为夹宫结构，才提高解释权重。`,
    `空宫借对宫时，要先确认本宫无主星，再把对宫${starA.label}${starB.label}作为借入资料，并保留借宫权重较低的标记。`,
    `若组合参与格局、破格或主题链，必须同时保留原始关系类型，避免把格局名反向套回所有宫位。`,
    ...(specificProfile?.palaceRelationUsage ?? [])
  ]
  const dynamicUsage = [
    `本命盘见${starA.label}${starB.label}组合，读长期结构和命盘底盘。`,
    `大限见该组合，读十年阶段的主题转向和承接压力。`,
    `流年见该组合，读年度触发；流月、流日、流时只作短周期气候和复核提醒。`,
    `动态叠盘时必须标明来源盘层，不把流年、流月、流日、流时的组合写成本命固定结构。`,
    `大限与流年同见时，大限为阶段背景，流年为年度触发；年度解释不能删除大限背景。`,
    `流月、流日、流时若命中同一组合，只能说明该周期内主题被再次点亮，必须回看本命和大限是否有承接。`,
    `动态组合若只出现在短周期，不宜写成长期性格或终身格局，只能作为时间窗口、事件气候和复核线索。`,
    ...(specificProfile?.dynamicUsage ?? [])
  ]
  const evidenceFields = [
    "starAId",
    "starBId",
    "starACategory",
    "starBCategory",
    "relationType",
    "sectorName",
    "oppositeSectorName",
    "trineSquareSectorNames",
    "brightnessA",
    "brightnessB",
    "transformationStarIds",
    "transformationSourceStem",
    "transformationLayer",
    "samePalaceStarIds",
    "oppositePalaceStarIds",
    "leftRightNeighborSectorNames",
    "palaceThemeId",
    "patternHitIds",
    "maleficPressureIds",
    "assistantSupportIds",
    "flowType",
    "flowLayerInheritance",
    "sourceRuleIds"
  ]
  const cautions = [
    `不要把“${starA.label}${starB.label}组合”写成固定断语；必须看落宫、关系范围、四化、庙旺、煞忌和盘层。`,
    `不要把三方会照、对宫冲照、左右夹宫都当成同宫；关系不同，权重不同。`,
    `不要把${profile.label}直接改写成现实结论；资料层只提供可复核的解释入口。`,
    `不要把短周期流月、流日、流时的组合反推为本命长期结构。`,
    `不要把杂曜组合升格为主星组合；杂曜只能补气氛、触发和细节，必须回到主星与宫位主题。`,
    `不要给没有庙旺落陷资料的星曜硬套庙旺；亮度只在资料表存在时使用。`,
    `不要把四化写成星曜自身庙旺；四化必须说明来源天干、目标星、盘层和触发方向。`,
    ...(specificProfile?.cautions ?? []),
    ...starA.readingNotes.slice(0, 1),
    ...starB.readingNotes.slice(0, 1)
  ]

  return {
    combinationId,
    sourceReferences,
    group,
    starAId: starA.starId,
    starALabel: starA.label,
    starACategory: starA.category,
    starBId: starB.starId,
    starBLabel: starB.label,
    starBCategory: starB.category,
    coreReading,
    groupRole: specificProfile
      ? `${profile.role}本组合已补专条：${specificProfile.label}。`
      : profile.role,
    interactionMode,
    readingOrder,
    supportiveSignals,
    pressureSignals,
    palaceRelationUsage,
    dynamicUsage,
    evidenceFields,
    cautions,
    sections: buildSections({
      starALabel: starA.label,
      starBLabel: starB.label,
      groupLabel: profile.label,
      coreReading,
      groupRole: profile.role,
      interactionMode,
      readingOrder,
      supportiveSignals,
      pressureSignals,
      palaceRelationUsage,
      dynamicUsage,
      evidenceFields,
      cautions
    })
  }
}

function withCategory(
  detail: ZiweiStarContentDetail,
  category: ZiweiStarPairCombinationCategory
): StarPairSourceDetail {
  return {
    ...detail,
    category
  }
}

function getStarPairCombinationGroup(
  categoryA: ZiweiStarPairCombinationCategory,
  categoryB: ZiweiStarPairCombinationCategory
): ZiweiStarPairCombinationGroup {
  const pair = [categoryA, categoryB].sort(categoryOrder) as [
    ZiweiStarPairCombinationCategory,
    ZiweiStarPairCombinationCategory
  ]

  return `${pair[0]}-${pair[1]}` as ZiweiStarPairCombinationGroup
}

function categoryOrder(
  categoryA: ZiweiStarPairCombinationCategory,
  categoryB: ZiweiStarPairCombinationCategory
): number {
  const order: Record<ZiweiStarPairCombinationCategory, number> = {
    main: 0,
    assistant: 1,
    malefic: 2,
    misc: 3
  }

  return order[categoryA] - order[categoryB]
}

function getSpecificStarPairCombinationProfile(
  starAId: ZiweiStarId,
  starBId: ZiweiStarId
): SpecificStarPairCombinationProfile | null {
  return SPECIFIC_STAR_PAIR_COMBINATION_PROFILES[
    buildSpecificStarPairKey(starAId, starBId)
  ] ?? null
}

function buildSpecificStarPairKey(
  starAId: ZiweiStarId,
  starBId: ZiweiStarId
): string {
  return [starAId, starBId].sort().join("::")
}

const SPECIFIC_STAR_PAIR_COMBINATION_PROFILES: Record<
  string,
  SpecificStarPairCombinationProfile
> = {
  [buildSpecificStarPairKey(MAIN_STAR_IDS.ziwei, MAIN_STAR_IDS.qisha)]: {
    label: "紫微七杀",
    coreReading:
      "紫微七杀组合一边是帝座统筹，一边是肃杀开创，核心不是温和稳定，而是以中心秩序驾驭变动、压力、决断和开疆。读此组合先看紫微能否定序，再看七杀是否有方向；若无辅曜和四化承接，容易只剩压力与孤决。",
    interactionMode:
      "紫微提供中枢、名分和整合，七杀提供切割、突破和执行压力。同宫时读成强主轴、强决断；对宫时读成内外拉扯；三方会照时读成结构中有统筹与开创并行。",
    supportiveSignals: [
      "会左辅右弼、天魁天钺、文昌文曲时，紫微的统筹有资源承接，七杀的决断较不孤立。",
      "见化权、化科或禄存时，可把强硬开创转成职责、名位、制度或资源配置。",
      "庙旺得地时，适合看重大责任、阶段突破、组织重整和高压任务承接。"
    ],
    pressureSignals: [
      "会擎羊、陀罗、火铃、空劫或化忌时，要重点看权责过重、孤军推进、决策过急和破耗风险。",
      "紫微无辅佐而七杀过强时，容易形成有权责无支援、有目标无缓冲的结构。",
      "落在夫妻、交友等关系宫时，要谨慎看强势、距离、控制感和关系边界。"
    ],
    palaceRelationUsage: [
      "入命官迁财等现实宫位时，优先看承担、开创、调度和风险边界。",
      "入福德、夫妻、田宅等内在或关系宫位时，要看高压结构是否进入情绪、关系或家庭承载。"
    ],
    dynamicUsage: [
      "大限见紫微七杀，常提示十年阶段进入重整、开创、承担和压力集中的周期。",
      "流年见紫微七杀，年度事件多从职责变化、权责上升、项目重组或环境逼迫中显现。"
    ],
    cautions: [
      "紫微七杀不能只按贵格或凶格断，必须同时看辅佐、煞忌、庙旺和宫位是否能承接高压。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.lianzhen, MAIN_STAR_IDS.tanlang)]: {
    label: "廉贞贪狼",
    coreReading:
      "廉贞贪狼组合一边重边界、规则、欲望筛选和是非辨别，一边重欲望、人缘、变化、才艺和资源流动。读此组合要同时看规范与欲望、关系与边界、吸引与风险，不可只写桃花或才艺。",
    interactionMode:
      "廉贞负责辨别、约束和边界，贪狼负责吸引、扩张和变化。同宫时欲望与规则直接混合，对宫时关系对象和自我边界互相拉扯，三方会照时常参与人际、资源、才艺、名声和是非结构。",
    supportiveSignals: [
      "会昌曲、魁钺、禄存、化禄或化科时，才艺、人缘、表达和资源吸引较容易被制度化。",
      "落在官禄、财帛、迁移等宫且有吉曜承接时，可看资源经营、社交能力、创意表达和对外机会。",
      "庙旺时较能把欲望转换成计划，把关系转换成可用资源。"
    ],
    pressureSignals: [
      "会煞忌、空劫或落陷时，要重点看欲望失衡、关系纠缠、名声是非、规则冲突和反复成本。",
      "入夫妻、交友、福德时，尤其要看关系边界、情感牵制、欲望管理和外界评价。",
      "若四化牵动化忌，需标记牵挂、误解、亏欠、纠缠或因关系与资源产生的阻滞。"
    ],
    palaceRelationUsage: [
      "在命宫和福德看欲望结构、审美倾向和自我约束，在夫妻交友看吸引与边界，在财官迁看资源、名声和外部机会。",
      "三方若再见桃花杂曜，不能直接断情感事件，要看宫位职责、煞忌和现实承接。"
    ],
    dynamicUsage: [
      "大限见廉贞贪狼，阶段主题常围绕关系、资源、欲望、名声和规则重组。",
      "流年流月见廉贞贪狼，短期更适合看社交、合作、曝光、消费、审美和边界事件。"
    ],
    cautions: [
      "廉贞贪狼不可简单等同桃花，必须保留廉贞的规则与边界，也保留贪狼的资源与变化。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.wuqu, MAIN_STAR_IDS.pojun)]: {
    label: "武曲破军",
    coreReading:
      "武曲破军组合一边重财务、执行、纪律和现实资源，一边重破旧、更新、冲击和重新配置。读此组合要看资源如何被重组、旧结构如何被打破，以及成本、损耗和执行边界。",
    interactionMode:
      "武曲负责现实计算和执行硬度，破军负责拆解、更新和变局推动。同宫时常见强执行加重组压力，对宫时看现实资源与变化环境对冲，三方会照时参与财务、事业、迁动和结构转换。",
    supportiveSignals: [
      "会禄存、化禄、化权、天府、天相或辅曜时，破旧立新较有资源承接，适合看制度改革、资源重配和执行突破。",
      "落在财帛、官禄、迁移时，若庙旺得地，可看高强度执行、项目改造、现金流调整和现实目标推进。",
      "有吉化时，破军的变动不一定是损耗，也可能是主动更新和止损。"
    ],
    pressureSignals: [
      "会煞忌、空劫或落陷时，优先看财务压力、执行失衡、破耗、硬碰硬、项目反复和旧账被打开。",
      "入田宅、福德、夫妻等承载宫时，要看变化是否影响家庭、情绪、关系或长期稳定。",
      "若无主星或吉曜承接，容易形成先破后难立、资源被消耗、执行过硬而缺缓冲。"
    ],
    palaceRelationUsage: [
      "在财帛宫看现金流、成本和资源重组，在官禄宫看工作制度和职责变化，在迁移宫看外部环境变动。",
      "三方若会天马或四马地，变动性增强；若会四墓库地，要看旧结构、库存、债务或沉积问题被打开。"
    ],
    dynamicUsage: [
      "大限见武曲破军，常提示十年阶段有资源结构、职业结构或生活承载方式的重组。",
      "流年见武曲破军，年度重点多与收支、项目调整、换环境、止损和重新规划有关。"
    ],
    cautions: [
      "武曲破军不能只断破财，也可能是主动重组；必须看是否有禄、府、相、辅曜和四化承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.taiyang, MAIN_STAR_IDS.taiyin)]: {
    label: "太阳太阴",
    coreReading:
      "太阳太阴组合是日月并明或日月互照的资料入口，一边看公开、行动、照拂和外部评价，一边看内在、积累、照护和细腻承接。读此组合重点是阴阳平衡、内外协调、昼夜亮度和宫位承接。",
    interactionMode:
      "太阳偏外放与主动承担，太阴偏内收与资源滋养。同宫时看内外能否同调，对宫时看公开与内在互相照见，三方会照时看名声、资源、关系和情绪结构是否成形。",
    supportiveSignals: [
      "太阳太阴庙旺且会昌曲、魁钺、禄权科时，较利名声、文书、资源承接和内外协调。",
      "落在命身、官禄、财帛、迁移等宫时，可看公开表现与资源积累并行。",
      "日月状态分明时，解释要分别说明太阳的外部发挥和太阴的内部承接。"
    ],
    pressureSignals: [
      "太阳落陷或太阴落陷时，要分别看外部光力不足、资源承接不足、情绪消耗或付出不被接住。",
      "会煞忌、空劫时，常见名声误解、资源落空、内外不一致或照顾责任过重。",
      "日月互相牵制时，可能出现外部承担与内在需求不一致，需要看福德和迁移承接。"
    ],
    palaceRelationUsage: [
      "入命宫看内外主轴，入官禄看名声和职责，入财帛看资源明暗流动，入夫妻看照顾、回应和关系节奏。",
      "三方若同时见禄权科，组合层次提高；若见煞忌空劫，优先看失衡和修复。"
    ],
    dynamicUsage: [
      "大限见太阳太阴，阶段主题常围绕内外平衡、名声资源、付出承接和家庭事业两端协调。",
      "流年流月见太阳太阴，可看公开事务、资源安排、关系回应和情绪照护的短期变化。"
    ],
    cautions: [
      "太阳太阴必须结合昼夜、庙旺落陷和宫位，不能只因日月同见就直接断为吉。"
    ]
  },
  [buildSpecificStarPairKey(ASSISTANT_STAR_IDS.wenchang, ASSISTANT_STAR_IDS.wenqu)]: {
    label: "文昌文曲",
    coreReading:
      "文昌文曲组合是文曜成组资料，重点看文书、表达、学习、审美、制度文字、证照、名誉修饰和沟通能力。昌曲同见不是单纯聪明，而是信息能否被整理、表达和承接。",
    interactionMode:
      "文昌偏条理、制度、文字和考试，文曲偏表达、曲艺、修饰和感受。同宫时文气集中，对宫或三方会照时形成文曜拱照，夹宫时可作夹辅文书资料。",
    supportiveSignals: [
      "会化科、魁钺、禄存或主星庙旺时，利文书、表达、名誉、考试、资格、方案整理和报告输出。",
      "入命、官禄、财帛、迁移时，可看表达能力、专业文书、对外沟通和名声修饰。",
      "在格局中可作为加吉和文星拱命类资料，但必须看是否真正会照命宫或重点宫。"
    ],
    pressureSignals: [
      "会化忌、空劫、火铃或落入压力宫时，需看文字误解、文书反复、表达失真、名声压力和资料落空。",
      "昌曲太重而缺执行星承接时，可能只有表达与想法，落地不足。",
      "入夫妻、交友时，要看沟通修饰是否变成误解、暧昧或关系话术。"
    ],
    palaceRelationUsage: [
      "同宫重直接表达和文书承接，三方会照重文曜支援，夹命或夹官时可看文书名誉对主轴的帮助。",
      "若只在远关系宫出现而不照重点宫，不能放大成整盘文昌文曲格。"
    ],
    dynamicUsage: [
      "大限见昌曲，阶段可看学习、证照、文字、表达、名誉和制度资料。",
      "流年流月见昌曲，短期多看考试、签约、汇报、沟通、宣传和文书往返。"
    ],
    cautions: [
      "昌曲不等于一定科名，必须结合化科、命官迁财、庙旺和煞忌。"
    ]
  },
  [buildSpecificStarPairKey(ASSISTANT_STAR_IDS.tiankui, ASSISTANT_STAR_IDS.tianyue)]: {
    label: "天魁天钺",
    coreReading:
      "天魁天钺组合是贵人星成组资料，重点看贵人、提携、制度内帮助、关键节点的引荐和资源入口。魁钺要看是否能照到命宫、官禄、迁移、财帛或当前动态重点宫。",
    interactionMode:
      "天魁偏阳贵、前端引荐和显性帮助，天钺偏阴贵、后端支持和隐性承接。同宫时贵气集中，三方会照时成结构支援，夹宫时可看左右提携。",
    supportiveSignals: [
      "会主星庙旺、禄权科、昌曲或左右时，贵人帮助更容易落成制度、名誉、职位、文书或资源。",
      "照命官迁财时，可作为外部支援、上级提携、专业认可和关键机会的证据。",
      "动态盘见魁钺，常看该时间层是否有人帮助、制度放行或关键资料补齐。"
    ],
    pressureSignals: [
      "魁钺落空、会煞忌或主星无力时，贵人可能只是机会入口，未必能替代自身承接。",
      "若宫位主题本身压力重，要看贵人能否制化压力，而不是直接断无忧。",
      "魁钺不照重点宫时，权重需降低。"
    ],
    palaceRelationUsage: [
      "同宫看直接支援，三方看贵人会照，对宫看外部对象端帮助，夹宫看旁侧提携。",
      "入父母、官禄、迁移、交友时尤其要看制度、长辈、上级、平台和外部资源。"
    ],
    dynamicUsage: [
      "大限见魁钺，阶段可看贵人和制度资源增加。",
      "流年流月见魁钺，短期多看帮助、推荐、审核、手续、面试、合作和关键人。"
    ],
    cautions: [
      "魁钺是助力资料，不是包办结果；仍要看主星、宫位、煞忌和自身承接。"
    ]
  },
  [buildSpecificStarPairKey(MALEFIC_STAR_IDS.qingyang, MALEFIC_STAR_IDS.tuoluo)]: {
    label: "擎羊陀罗",
    coreReading:
      "擎羊陀罗组合是羊陀压力资料，擎羊偏锐利、冲撞、切割和急性压力，陀罗偏拖延、缠绕、阻滞和慢性压力。羊陀同见要看急慢压力并存，不可只写单一凶象。",
    interactionMode:
      "擎羊像刀锋，陀罗像缠结。同宫时压力直接压在本宫，对宫时形成内外冲阻，三方会照时进入结构压力，夹宫时容易形成夹煞。",
    supportiveSignals: [
      "若主星强、庙旺且有禄权科或辅曜制化，羊陀可转成边界、切割、执行压力和风险意识。",
      "落在需要断舍离、纪律、技术、外科式处理或强执行的宫位时，可看压力转为行动。"
    ],
    pressureSignals: [
      "羊陀会化忌、空劫、火铃或落陷时，需重点看冲突、拖延、损耗、卡顿、反复和身心压力。",
      "入夫妻、交友、父母等关系宫时，要看口舌、距离、误解、纠缠和边界冲突。",
      "夹命、夹官或夹财时，需标记主轴、事业或资源被压力夹持。"
    ],
    palaceRelationUsage: [
      "同宫权重最高，三方会照次之；夹宫成立时要明确左右两宫证据，不可泛称羊陀夹。",
      "若羊陀只在非重点远宫，不宜放大成整盘凶断。"
    ],
    dynamicUsage: [
      "大限见羊陀，阶段需看压力管理、边界重建和长期阻滞。",
      "流年流月见羊陀，短期多看冲突、延误、修复、手续卡点和行动代价。"
    ],
    cautions: [
      "羊陀不是绝对坏事，但必须降调输出，先给风险边界，再看制化。"
    ]
  },
  [buildSpecificStarPairKey(MALEFIC_STAR_IDS.huoxing, MALEFIC_STAR_IDS.lingxing)]: {
    label: "火星铃星",
    coreReading:
      "火星铃星组合是火铃压力资料，火星偏突然、爆发、急躁和外放冲击，铃星偏暗响、惊扰、持续紧张和内在震荡。火铃同见要看热度、突发和不安是否被主星承接。",
    interactionMode:
      "火星像明火，铃星像暗响。同宫时突发性强，对宫时外部冲击明显，三方会照时把热度和惊扰带入结构，夹宫时可能形成两侧催逼。",
    supportiveSignals: [
      "若会强主星、化权、禄存或明确行动目标，火铃可转成快速推进、突破惯性和应急能力。",
      "与贪狼等星在合适条件下可参与爆发型格局，但必须复核宫位、库地、庙旺和煞忌。"
    ],
    pressureSignals: [
      "火铃会化忌、空劫或落陷时，要看突发、失控、口舌、焦躁、事故风险、情绪震荡和进度反复。",
      "入疾厄、福德、夫妻等宫时，要特别降调，看压力、作息、情绪和关系中的急性触发。",
      "火铃过旺而缺水土承接时，容易热度过高、行动过急、后续难稳。"
    ],
    palaceRelationUsage: [
      "同宫看直接爆发，三方看结构热度，对宫看外部冲击，夹宫看旁侧催动。",
      "火铃只作为压力与触发资料，不单独决定具体事故。"
    ],
    dynamicUsage: [
      "大限见火铃，阶段多看急迫、变化、冲突和行动压力。",
      "流年流月见火铃，短期多看突发、催促、争执、赶工和应急处理。"
    ],
    cautions: [
      "火铃不能脱离现实证据做危险断语，只能作为压力和突发倾向复核。"
    ]
  },
  [buildSpecificStarPairKey(MALEFIC_STAR_IDS.dikong, MALEFIC_STAR_IDS.dijie)]: {
    label: "地空地劫",
    coreReading:
      "地空地劫组合是空劫资料，地空偏空、虚、落空、抽离和观念层断裂，地劫偏劫夺、破耗、损失感和现实层被截断。空劫同见要看虚实落差、资源破口和计划落空。",
    interactionMode:
      "地空削弱实感，地劫削弱保存。同宫时本宫主题易出现空耗或断裂，对宫时外部反馈不稳，三方会照时结构中存在虚耗点，夹宫时形成旁侧抽空。",
    supportiveSignals: [
      "若会化科、昌曲、天机或修行、研究、创作类宫位承接，可转向抽象思考、断舍离、创意和非物质价值。",
      "有强主星和稳定资源时，空劫可作为提醒：该宫不宜过度执着，需要留退路和弹性。"
    ],
    pressureSignals: [
      "会化忌、煞曜或落在财帛、田宅、官禄等现实承载宫时，要重点看破耗、落空、资源截断、计划变更和保存困难。",
      "入夫妻、交友时，要看关系落差、期待落空、疏离感或承诺不稳。",
      "空劫同会而无承接时，容易出现想法悬空、资源漏损和结果不实。"
    ],
    palaceRelationUsage: [
      "同宫空耗最直接，三方会照表示结构中有虚耗来源，对宫表示对象或环境带来落差。",
      "空劫不能只断失去，也要看是否代表放下、抽离、转念、创作或非实体资源。"
    ],
    dynamicUsage: [
      "大限见空劫，阶段要看旧结构落空、资源重估和价值转向。",
      "流年流月见空劫，短期多看计划变化、损耗、失约、空跑和预期修正。"
    ],
    cautions: [
      "空劫不等于必然破败，必须区分现实资源、心理期待、抽象创作和修行抽离。"
    ]
  },
  [buildSpecificStarPairKey(ASSISTANT_STAR_IDS.lucun, ASSISTANT_STAR_IDS.tianma)]: {
    label: "禄存天马",
    coreReading:
      "禄存天马组合是禄马资料，禄存重资源、保存、收入和稳定来源，天马重移动、奔波、转场和行动路线。禄马同见要看资源是否因移动而来，或移动是否带来成本。",
    interactionMode:
      "禄存负责资源入口和保存，天马负责流动和迁动。同宫时资源与行动直接结合，对宫时内外资源因环境变化被牵动，三方会照时形成流动资源结构。",
    supportiveSignals: [
      "入财帛、官禄、迁移、命宫且会吉曜时，可看行动带财、外部机会、奔走得利和资源流通。",
      "与四马地、迁移宫、大限流年动宫同触发时，动象更明显。",
      "会化禄或主星庙旺时，禄马较容易成为可用资源和行动机会。"
    ],
    pressureSignals: [
      "会煞忌、空劫或主星无力时，奔波可能带成本，资源未必能保存。",
      "入福德、疾厄等宫时，要看为资源而动是否造成疲劳、压力和节奏失衡。",
      "禄存受冲或天马受制时，要看机会来去、现金流波动和行动延误。"
    ],
    palaceRelationUsage: [
      "同宫看直接因动得禄或因禄而动，三方会照看资源流动路线，对宫看外部环境是否带来机会。",
      "若禄马不照财官迁命等重点宫，不能直接放大成禄马交驰。"
    ],
    dynamicUsage: [
      "大限见禄马，阶段多看外出发展、资源流动、换环境和行动机会。",
      "流年流月见禄马，短期多看出行、合同、收支、机会到来和奔波成本。"
    ],
    cautions: [
      "禄马不是一定发财，必须看禄能否守、马是否受制、宫位是否承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tianji, MAIN_STAR_IDS.taiyin)]: {
    label: "天机太阴",
    coreReading:
      "天机太阴组合一边重机谋、方法、变化和规划，一边重资源、内在、细腻承接和积累。读此组合要看计划能否落入资源，思路能否沉淀成成果，不能只写聪明或敏感。",
    interactionMode:
      "天机负责变动、方案和技术处理，太阴负责滋养、储备和内在承接。同宫时看谋划与资源直接混合，对宫时看想法与现实承接互相拉扯，三方会照时看计划、财务、情绪和居住资源的结构关系。",
    supportiveSignals: [
      "会昌曲、魁钺、禄存、化科或化禄时，利策划、研究、文书、资源整理和细致经营。",
      "入财帛、田宅、福德、官禄时，较适合看资源规划、长期积累、方案设计和幕后经营。",
      "太阴庙旺且天机不受忌时，计划较能落地，资源也较能被细腻管理。"
    ],
    pressureSignals: [
      "天机化忌或太阴落陷时，要看多思、反复、情绪牵挂、资源不稳和计划延迟。",
      "会空劫、火铃、羊陀时，容易出现想法悬空、资料反复、资源漏损或内在焦虑。",
      "入夫妻、交友时，要看沟通猜测、情绪累积和关系中的安全感问题。"
    ],
    palaceRelationUsage: [
      "入命福看思虑与内在承接，入财田看资源规划，入官迁看方案执行和外部变化。",
      "三方若有禄科辅曜，组合成色提高；三方若煞忌重，先看反复和承接不足。"
    ],
    dynamicUsage: [
      "大限见天机太阴，阶段主题常围绕规划、学习、资源整理、居住变化和内在安全感。",
      "流年流月见天机太阴，短期多看方案调整、财务安排、资料整理、情绪波动和家庭事务。"
    ],
    cautions: [
      "天机太阴不能只按聪明或阴柔判断，必须说明计划、资源、情绪和宫位承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tianji, MAIN_STAR_IDS.jumen)]: {
    label: "天机巨门",
    coreReading:
      "天机巨门组合一边重思路、变化、策略和技术，一边重口舌、辨析、疑问和遮蔽。读此组合要看思考如何进入表达、争议如何被处理，以及信息是否清楚。",
    interactionMode:
      "天机负责想法与变动，巨门负责语言、判断和疑点。同宫时思辨性强，对宫时内外信息互相质疑，三方会照时常把沟通、文书、争议和方案牵入结构。",
    supportiveSignals: [
      "会昌曲、化科、魁钺时，利研究、咨询、写作、辩证、方案表达和复杂问题拆解。",
      "入官禄、迁移、交友时，可看专业沟通、技术说明、谈判和信息处理。",
      "若庙旺得地且有辅曜承接，巨门的疑问可转为辨析力，天机的变化可转为方法。"
    ],
    pressureSignals: [
      "会化忌、羊陀、火铃或空劫时，要看口舌、误解、反复、疑虑、文书争议和方案被推翻。",
      "巨门重而无化科时，表达可能变成遮蔽或争辩；天机弱时则多想少定。",
      "入夫妻、父母、兄弟、交友时，要特别看沟通裂缝、信任问题和言语成本。"
    ],
    palaceRelationUsage: [
      "入命官迁看思辨表达，入父母看文书制度，入夫妻交友看沟通与疑虑，入疾厄福德看思虑压力。",
      "三方四正若见化科文曜，可提高表达质量；若见化忌煞曜，优先标记争议和误读。"
    ],
    dynamicUsage: [
      "大限见天机巨门，阶段主题常围绕学习、沟通、争议、方案和制度文字。",
      "流年流月见天机巨门，短期多看谈判、解释、文件、误会、咨询和反复确认。"
    ],
    cautions: [
      "天机巨门不能只断口舌，好的结构也可代表研究、咨询、分析和专业表达。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tiantong, MAIN_STAR_IDS.taiyin)]: {
    label: "天同太阴",
    coreReading:
      "天同太阴组合一边重福气、感受、缓冲和舒适，一边重滋养、资源、细腻和内在承接。读此组合要看生活感、照护、情绪安全和资源保存。",
    interactionMode:
      "天同负责缓和与感受，太阴负责滋养与积累。同宫时重安稳和照护，对宫时看外部责任与内在舒适的拉扯，三方会照时看福德、财田、关系和情绪结构。",
    supportiveSignals: [
      "会禄存、化禄、魁钺、昌曲或主星庙旺时，利生活品质、资源积累、照护关系和内在稳定。",
      "入福德、田宅、财帛、夫妻时，可看舒适感、家庭资源、情绪承接和关系照顾。",
      "太阴明亮且天同有吉曜时，较容易形成温和、可持续的承接结构。"
    ],
    pressureSignals: [
      "会煞忌、空劫或落陷时，要看依赖、逃避、情绪消耗、资源不足和舒适感被破坏。",
      "天同过弱时缓冲不足，太阴落陷时滋养不足，二者同弱容易感受重而承接少。",
      "入官禄、迁移等需要外放执行的宫位时，要复核行动力和现实压力。"
    ],
    palaceRelationUsage: [
      "入福田财看资源与生活承载，入夫妻子女看照护关系，入命身看感受与安全感主轴。",
      "三方若有煞忌，应把舒适、照顾和情绪安全放入压力复核，不做单纯福气断。"
    ],
    dynamicUsage: [
      "大限见天同太阴，阶段主题常围绕生活品质、家庭资源、情绪照护和稳定需求。",
      "流年流月见天同太阴，短期多看休息、家宅、财务安排、关系照顾和情绪恢复。"
    ],
    cautions: [
      "天同太阴不能只按福厚判断，必须看是否有行动承接和现实资源。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tiantong, MAIN_STAR_IDS.jumen)]: {
    label: "天同巨门",
    coreReading:
      "天同巨门组合一边重感受、福气、缓冲和舒适，一边重语言、疑问、遮蔽和辨析。读此组合要看情绪如何通过语言表达，舒适需求是否被误解或争议打断。",
    interactionMode:
      "天同想缓和，巨门会追问。同宫时感受与言语直接混合，对宫时情绪和外部质疑互相牵动，三方会照时把口舌、福德、关系和承压结构连起来。",
    supportiveSignals: [
      "会化科、昌曲、魁钺时，可看温和表达、咨询、调解、教学、沟通修复和情绪说明。",
      "入福德、夫妻、兄弟、交友时，若有吉曜，可看沟通带来理解和缓冲。",
      "天同得地且巨门得化时，疑问可被说清，感受也较能被接住。"
    ],
    pressureSignals: [
      "会化忌、煞曜或落陷时，容易出现委屈、误解、口舌、抱怨、逃避和情绪化沟通。",
      "巨门压力过重时，天同的缓冲会被反复质疑消耗。",
      "入疾厄、福德时，要看思虑、睡眠、压力表达和内在不安。"
    ],
    palaceRelationUsage: [
      "入关系宫看感受与沟通，入福疾看情绪和压力，入父母官禄看制度文字与解释成本。",
      "三方若有文曜化科，可转成表达修复；若有化忌煞曜，优先看误会和口舌。"
    ],
    dynamicUsage: [
      "大限见天同巨门，阶段主题常围绕情绪表达、关系沟通、制度解释和舒适感被挑战。",
      "流年流月见天同巨门，短期多看谈话、误会、调解、抱怨、说明和情绪修复。"
    ],
    cautions: [
      "天同巨门不是只主口舌，也可代表用语言处理感受；关键看化科、化忌和宫位承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tianfu, MAIN_STAR_IDS.lianzhen)]: {
    label: "天府廉贞",
    coreReading:
      "天府廉贞组合一边重库府、资源、稳定和承载，一边重规则、边界、欲望筛选和是非辨别。读此组合要看资源如何被制度管理，边界如何保护库藏。",
    interactionMode:
      "天府负责保存与承载，廉贞负责规范与筛选。同宫时资源和规则直接结合，对宫时稳定与边界互相照见，三方会照时常参与财务、制度、关系和责任结构。",
    supportiveSignals: [
      "会禄存、化禄、魁钺、左右时，利资源管理、制度承接、职位职责和稳定经营。",
      "入财帛、田宅、官禄时，可看库藏、资产、管理、制度和长期承载。",
      "廉贞得制化时，可把欲望和边界纳入天府的稳定结构。"
    ],
    pressureSignals: [
      "会煞忌、空劫或廉贞失衡时，要看资源被规则卡住、名声是非、关系边界和库藏破口。",
      "天府弱或被冲时，资源保存不足；廉贞受忌时，边界容易变成纠缠或是非。",
      "入夫妻、交友时，要看资源、信任、约定和关系规则。"
    ],
    palaceRelationUsage: [
      "入财田官看管理和承载，入夫妻交友看边界与信任，入福德看欲望与安全感结构。",
      "三方若见禄权科，资源管理成色提高；若见煞忌空劫，先看库藏破损和规则纠纷。"
    ],
    dynamicUsage: [
      "大限见天府廉贞，阶段主题常围绕资源管理、制度责任、关系边界和长期承载。",
      "流年流月见天府廉贞，短期多看合同、资产、规则、审核、关系约定和资源安排。"
    ],
    cautions: [
      "天府廉贞不能只按财库或桃花断，必须同时看资源保存与边界规则。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tianxiang, MAIN_STAR_IDS.lianzhen)]: {
    label: "天相廉贞",
    coreReading:
      "天相廉贞组合一边重辅佐、制度、平衡和形象，一边重规则、边界、欲望筛选和是非。读此组合要看制度关系、名分角色、边界判断和协调成本。",
    interactionMode:
      "天相负责协调与秩序，廉贞负责辨别与界线。同宫时制度与边界混合，对宫时角色与欲望互相牵动，三方会照时参与官禄、夫妻、父母、交友等制度关系结构。",
    supportiveSignals: [
      "会魁钺、左右、昌曲、化科时，利制度协调、形象修饰、职位角色、文书审核和关系调停。",
      "入官禄、父母、夫妻、交友时，可看契约、制度、角色和礼法边界。",
      "天相有辅佐而廉贞得制时，较能把是非边界转成秩序和规则。"
    ],
    pressureSignals: [
      "会化忌、煞曜或空劫时，要看制度卡关、名分争议、关系边界、形象受损和协调失衡。",
      "天相弱时协调不足，廉贞强时边界锋利，容易出现表面和气、内里拉扯。",
      "入夫妻交友时，要特别看承诺、契约、信任和公平感。"
    ],
    palaceRelationUsage: [
      "入官父看制度和文书，入夫妻交友看角色边界，入命身看秩序感和自我约束。",
      "三方若见煞忌，制度关系要降权复核；若见吉曜化科，调解和名誉修复能力增强。"
    ],
    dynamicUsage: [
      "大限见天相廉贞，阶段主题常围绕制度身份、关系边界、协调责任和名誉修复。",
      "流年流月见天相廉贞，短期多看合同、审核、协调、关系规则和公开形象。"
    ],
    cautions: [
      "天相廉贞不能只看好坏，要同时写出制度承接、角色边界和协调成本。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.qisha, MAIN_STAR_IDS.pojun)]: {
    label: "七杀破军",
    coreReading:
      "七杀破军组合一边重决断、肃杀、压力和开创，一边重破旧、变化、重组和冲击。读此组合要看高压变局、切割更新、风险边界和是否有资源承接。",
    interactionMode:
      "七杀负责决断和压力方向，破军负责拆旧和重组。同宫时变动强烈，对宫时内外冲击明显，三方会照时常成为结构变革和破格复核的重要证据。",
    supportiveSignals: [
      "会紫微、天府、天相、禄权科或辅曜时，变动较有秩序和资源承接。",
      "入官禄、迁移、财帛时，可看职业调整、环境转换、项目重组和高压突破。",
      "庙旺有吉化时，七杀破军可转为断旧立新、危机处理和强执行。"
    ],
    pressureSignals: [
      "会煞忌、空劫或落陷时，要看冲动破耗、决策过急、损失扩大、关系断裂和后续难稳。",
      "入夫妻、田宅、福德时，要看变动对关系、家庭和内在稳定的冲击。",
      "若无资源承接，破局之后可能难以立局。"
    ],
    palaceRelationUsage: [
      "入现实宫位看变革执行，入关系宫位看断裂和边界，入福疾看压力和身心承载。",
      "三方若会禄府相，变动可被承接；三方若会空劫化忌，破耗和落空需优先复核。"
    ],
    dynamicUsage: [
      "大限见七杀破军，阶段常有环境重组、职责变化、断舍离和高压推进。",
      "流年流月见七杀破军，短期多看调整、冲突、拆改、换场和风险控制。"
    ],
    cautions: [
      "七杀破军不能只断动荡，也可代表必要改革；关键看是否有秩序、资源和后续承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.ziwei, MAIN_STAR_IDS.tianfu)]: {
    label: "紫微天府",
    coreReading:
      "紫微天府组合一边重帝座、中枢、统筹和名分，一边重库府、保存、资源和稳定承载。读此组合要看中心如何调度资源，资源是否能支撑中枢秩序。",
    interactionMode:
      "紫微负责定序和统筹，天府负责承载和库藏。同宫时中枢与资源直接结合，对宫时权责与资源互相照见，三方会照时常参与组织、财务、官禄和长期稳定。",
    supportiveSignals: [
      "会左右、魁钺、昌曲、禄权科时，利组织管理、资源配置、名位承接和稳定格局。",
      "入命官财田时，可看管理能力、资源平台、长期承载和制度化发展。",
      "庙旺得地时，较容易形成中心明确、资源充足、责任可承接的结构。"
    ],
    pressureSignals: [
      "会煞忌、空劫或天府受冲时，要看权责过重、资源被耗、库藏破口和管理压力。",
      "紫微无辅佐时中心孤立，天府无动能时资源保守，二者都需看执行星和动态触发。",
      "入关系宫时，要看控制感、资源分配和责任承担是否失衡。"
    ],
    palaceRelationUsage: [
      "入命官财田权重较高，入福德看安全感与责任，入夫妻交友看资源关系和角色分配。",
      "三方若有禄权科辅曜，组合成色上升；若有空劫煞忌，先看资源和名分被冲。"
    ],
    dynamicUsage: [
      "大限见紫微天府，阶段主题常围绕管理、平台、资源承接和责任稳定。",
      "流年流月见紫微天府，短期多看资源安排、职位角色、家宅资产和组织事务。"
    ],
    cautions: [
      "紫微天府不能只按富贵断，必须看是否有执行、外部环境和煞忌破坏。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.ziwei, MAIN_STAR_IDS.tanlang)]: {
    label: "紫微贪狼",
    coreReading:
      "紫微贪狼组合一边重中枢、统筹、名分和秩序，一边重欲望、人缘、才艺、资源流动和变化。读此组合要看中心如何驾驭欲望与资源，名分如何承接社交和变化。",
    interactionMode:
      "紫微负责定序，贪狼负责吸引和扩张。同宫时中心与欲望直接混合，对宫时名分和外部诱因互相拉扯，三方会照时常参与人际、资源、名声和格局变化。",
    supportiveSignals: [
      "会魁钺、左右、昌曲、禄权科时，可把人缘、才艺和资源流动纳入组织和名分。",
      "入官禄、迁移、财帛时，可看平台资源、社交经营、对外吸引和创意发展。",
      "紫微能定序时，贪狼的变化不散乱，反而成为资源拓展。"
    ],
    pressureSignals: [
      "会煞忌、桃花杂曜过重或空劫时，要看欲望失衡、名声压力、资源诱惑和中心失控。",
      "紫微无辅而贪狼过强时，容易中心被欲望牵走，秩序被变化冲散。",
      "入夫妻、交友、福德时，要看关系边界、欲望管理和外界评价。"
    ],
    palaceRelationUsage: [
      "入命官迁财看资源拓展和名分平台，入夫妻交友看吸引与边界，入福德看欲望和内在秩序。",
      "三方若有文贵禄曜，组合较能成事；若有煞忌空劫，先看破格和名声风险。"
    ],
    dynamicUsage: [
      "大限见紫微贪狼，阶段主题常围绕资源扩张、社交名声、欲望管理和平台变化。",
      "流年流月见紫微贪狼，短期多看曝光、合作、应酬、消费、机会和关系诱因。"
    ],
    cautions: [
      "紫微贪狼不能只写桃花，也不能只写贵气，要同时看秩序与欲望的承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.taiyang, MAIN_STAR_IDS.jumen)]: {
    label: "太阳巨门",
    coreReading:
      "太阳巨门组合一边重公开、行动、照拂和外部评价，一边重语言、疑问、遮蔽和辨析。读此组合要看公开表达、名声争议、说明责任和外部误解。",
    interactionMode:
      "太阳负责照明和承担，巨门负责言语和疑问。同宫时公开表达直接成主题，对宫时外部评价和内部解释互相拉扯，三方会照时把名声、沟通、官禄和迁移联动起来。",
    supportiveSignals: [
      "会化科、昌曲、魁钺时，利公开说明、教学、宣传、咨询、辩证和专业表达。",
      "太阳庙旺时，巨门的疑问更容易被照明，表达有公开度和说服力。",
      "入官禄、迁移、父母时，可看制度说明、对外沟通、公开职责和文书表达。"
    ],
    pressureSignals: [
      "太阳落陷或巨门化忌时，要看名声误解、口舌、争议、说明成本和付出不被理解。",
      "会煞忌、空劫时，公开表达容易被打断、扭曲或引发反复争辩。",
      "入夫妻、交友时，要看关系中的说法、误会、评价和沟通压力。"
    ],
    palaceRelationUsage: [
      "入命迁官父看公开表达和制度沟通，入夫妻交友看言语与评价，入福疾看思虑和压力。",
      "三方若有化科文曜，可转成名声和表达优势；若有化忌煞曜，先看口舌和误解。"
    ],
    dynamicUsage: [
      "大限见太阳巨门，阶段主题常围绕公开表达、名声评价、说明责任和制度沟通。",
      "流年流月见太阳巨门，短期多看公告、争议、解释、宣传、谈判和外部评价。"
    ],
    cautions: [
      "太阳巨门不能只断口舌，也可能是公开说明和专业表达；要看太阳亮度与巨门四化。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tianji, MAIN_STAR_IDS.tianliang)]: {
    label: "天机天梁",
    coreReading:
      "天机天梁组合一边重机谋、方法、变化和规划，一边重荫护、原则、长辈、制度和修复。读此组合要看变化是否有原则承接，方案是否能服务于保护、制度和长期修补。",
    interactionMode:
      "天机负责变化与方法，天梁负责原则与庇护。同宫时谋略与守护直接混合，对宫时变动和规则互相拉扯，三方会照时常牵动父母、官禄、疾厄、福德和制度保护。",
    supportiveSignals: [
      "会昌曲、魁钺、化科时，利研究、顾问、制度设计、教学、咨询、修复和方案校准。",
      "入父母、官禄、疾厄、福德时，可看制度保护、长辈资源、专业方案和风险修复。",
      "天梁得地且天机不受忌时，变化较有原则，计划较能用于解决旧问题。"
    ],
    pressureSignals: [
      "天机化忌或天梁受煞时，要看反复、原则压力、长辈制度卡点、修复拖延和方案难定。",
      "会空劫、羊陀、火铃时，容易出现方案被打断、制度压力增加或保护机制失灵。",
      "入夫妻、交友时，要看说教感、原则差异、沟通修复和彼此边界。"
    ],
    palaceRelationUsage: [
      "入官父疾福看制度、保护和修复，入命迁看策略与外部规则，入财田看资源规划和长期承载。",
      "三方有科曜辅曜时，组合可转为专业支援；三方煞忌重时，先看压力来源和修复成本。"
    ],
    dynamicUsage: [
      "大限见天机天梁，阶段主题常围绕学习规划、制度调整、长辈资源、健康修复和旧事处理。",
      "流年流月见天机天梁，短期多看方案修改、手续制度、咨询协助、修复安排和原则沟通。"
    ],
    cautions: [
      "天机天梁不能只按聪明或长辈缘判断，要同时看变化、原则、修复和制度承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tiantong, MAIN_STAR_IDS.tianliang)]: {
    label: "天同天梁",
    coreReading:
      "天同天梁组合一边重福气、感受、缓冲和舒适，一边重荫护、原则、长辈、修复和庇护。读此组合要看福荫、照护、保护、修复和舒适感是否能被制度或长辈资源承接。",
    interactionMode:
      "天同负责感受与缓冲，天梁负责原则与保护。同宫时福气与庇护直接混合，对宫时舒适需求和外部规则互相牵动，三方会照时常连到福德、疾厄、父母和田宅。",
    supportiveSignals: [
      "会魁钺、左右、化科、禄存时，利照护、修复、缓冲、长辈帮助和制度保护。",
      "入福德、疾厄、父母、田宅时，可看生活修复、身心调养、家庭保护和长期照顾。",
      "天梁有力时，天同的舒适不只是逃避，而能变成恢复和承接。"
    ],
    pressureSignals: [
      "会煞忌、空劫或落陷时，要看依赖、逃避、保护失灵、照护压力和旧问题拖延。",
      "天同弱时缓冲不足，天梁受冲时保护不足，二者同弱容易把压力转成委屈和耗弱。",
      "入官禄、迁移等外放宫位时，要复核行动力、责任压力和制度束缚。"
    ],
    palaceRelationUsage: [
      "入福疾父田看保护和修复，入夫妻子女看照护责任，入命身看福荫和安全感主轴。",
      "三方若有吉曜，修复资源清楚；三方若煞忌重，先看照护成本和承接不足。"
    ],
    dynamicUsage: [
      "大限见天同天梁，阶段主题常围绕休养、修复、长辈制度、照护关系和生活节奏。",
      "流年流月见天同天梁，短期多看休息、检查、调养、协助、家庭事务和保护机制。"
    ],
    cautions: [
      "天同天梁不能只断福气，要看是否形成有效修复，而不是停留在依赖和拖延。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.wuqu, MAIN_STAR_IDS.tianfu)]: {
    label: "武曲天府",
    coreReading:
      "武曲天府组合一边重财务、执行、纪律和现实资源，一边重库府、保存、承载和稳定。读此组合要看资源如何被计算、保存、配置和长期管理。",
    interactionMode:
      "武曲负责执行和财务硬度，天府负责库藏和稳定承载。同宫时资源管理直接成形，对宫时收入执行与保存承载互相照见，三方会照时常参与财帛、田宅、官禄和长期资产。",
    supportiveSignals: [
      "会禄存、化禄、化权、左右、魁钺时，利财务制度、资源管理、资产保存和稳定经营。",
      "入财帛、田宅、官禄时，可看现金流、资产库、预算纪律和现实承接。",
      "庙旺得地时，武曲的执行能帮助天府守库，天府的稳定能缓冲武曲刚性。"
    ],
    pressureSignals: [
      "会煞忌、空劫或天府被冲时，要看财务压力、库藏破口、成本失控和资源保存困难。",
      "武曲过刚而天府不足时，容易有执行压力但缺稳定承接。",
      "入夫妻、交友时，要看资源分配、现实条件和关系中的利益边界。"
    ],
    palaceRelationUsage: [
      "入财田官权重较高，入福德看安全感和资源焦虑，入迁移看外部资源和行动成本。",
      "三方若会禄权科，资源层次提高；三方若会空劫化忌，优先复核破耗。"
    ],
    dynamicUsage: [
      "大限见武曲天府，阶段主题常围绕财务整理、资产累积、制度经营和资源稳定。",
      "流年流月见武曲天府，短期多看收支、预算、合同、资产安排和资源保管。"
    ],
    cautions: [
      "武曲天府不能直接断财富大小，只能说明资源管理结构，仍要看禄忌、宫位和三方承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.wuqu, MAIN_STAR_IDS.tianxiang)]: {
    label: "武曲天相",
    coreReading:
      "武曲天相组合一边重执行、财务、规则和现实结果，一边重辅佐、制度、协调和形象。读此组合要看执行是否合乎制度，资源是否通过角色、平台和协作来落实。",
    interactionMode:
      "武曲负责硬执行和现实计算，天相负责协调、秩序和名分。同宫时执行与制度直接结合，对宫时结果和角色互相牵动，三方会照时常连到官禄、财帛、父母和交友。",
    supportiveSignals: [
      "会魁钺、左右、昌曲、化科、化权时，利制度执行、职位责任、财务管理、文书审核和协作平台。",
      "入官禄、财帛、父母时，可看职业规范、财务制度、审核流程和责任分配。",
      "天相能调和武曲刚性时，执行更容易被制度和团队接住。"
    ],
    pressureSignals: [
      "会煞忌、空劫时，要看制度卡关、执行冲突、资源分配不均、审核压力和形象受损。",
      "武曲过强而天相弱时，容易硬碰硬；天相过弱时，协调和缓冲不足。",
      "入夫妻交友时，要看现实条件、角色边界、资源分配和公平感。"
    ],
    palaceRelationUsage: [
      "入官财父看制度执行，入交友看团队资源，入夫妻看现实条件和关系角色。",
      "三方若见禄权科辅曜，执行结构清楚；三方煞忌重时，先看制度与利益冲突。"
    ],
    dynamicUsage: [
      "大限见武曲天相，阶段主题常围绕职责、制度、财务、合作和资源执行。",
      "流年流月见武曲天相，短期多看审核、付款、职责调整、合同协作和现实成果。"
    ],
    cautions: [
      "武曲天相不能只看事业或财务，还要写出制度角色和协调成本。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.lianzhen, MAIN_STAR_IDS.qisha)]: {
    label: "廉贞七杀",
    coreReading:
      "廉贞七杀组合一边重规则、边界、欲望筛选和是非辨别，一边重决断、肃杀、压力和开创。读此组合要看边界如何进入高压决断，规则如何处理冲突和风险。",
    interactionMode:
      "廉贞负责辨别与界线，七杀负责决断与突破。同宫时边界和压力直接混合，对宫时规则与外部冲击互相拉扯，三方会照时常参与官禄、迁移、夫妻、交友和风险结构。",
    supportiveSignals: [
      "会紫微、天府、天相、魁钺、左右或禄权科时，可把强压力转成纪律、职责、改革和边界管理。",
      "入官禄、迁移、财帛时，可看高压任务、风险决策、制度整顿和资源边界。",
      "廉贞得制、七杀有方向时，组合可表现为清晰切割和强执行。"
    ],
    pressureSignals: [
      "会煞忌、空劫或落陷时，要看冲突、是非、法律规则、关系断裂、冒险和孤决。",
      "入夫妻、交友时，要特别看关系中的强硬、猜疑、边界争执和信任压力。",
      "廉贞受忌而七杀过强时，容易从规则问题变成冲突问题。"
    ],
    palaceRelationUsage: [
      "入官迁财看高压执行和风险控制，入夫妻交友看边界与冲突，入疾福看压力承接。",
      "三方若有吉曜制化，可转成纪律和改革；三方煞忌重时，先看破格和代价。"
    ],
    dynamicUsage: [
      "大限见廉贞七杀，阶段主题常围绕强压力、规则边界、风险决断和关系重整。",
      "流年流月见廉贞七杀，短期多看冲突处理、合同边界、风险决策、切割和修复。"
    ],
    cautions: [
      "廉贞七杀必须降调复核风险，但不能一概断凶；关键看是否有制度、资源和吉曜制化。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.lianzhen, MAIN_STAR_IDS.pojun)]: {
    label: "廉贞破军",
    coreReading:
      "廉贞破军组合一边重规则、边界、欲望筛选和是非，一边重破旧、更新、冲击和重新配置。读此组合要看旧规则如何被打破，新边界如何建立，以及破耗和重组成本。",
    interactionMode:
      "廉贞负责边界和辨别，破军负责拆旧和重组。同宫时规则与变局直接混合，对宫时旧秩序和新变化拉扯，三方会照时常牵动财务、官禄、关系和环境转换。",
    supportiveSignals: [
      "会禄权科、天府、天相、魁钺或左右时，利制度改革、边界重建、项目重组和资源重新分配。",
      "入官禄、财帛、迁移时，可看职业调整、合同重订、资源重配和环境变化。",
      "破军有承接、廉贞有制化时，破旧不只是破耗，也可能是主动更新。"
    ],
    pressureSignals: [
      "会煞忌、空劫或落陷时，要看关系破裂、规则冲突、财务破耗、名声是非和新局难立。",
      "入夫妻、田宅、福德时，要看变动对关系、家庭、安全感和情绪的冲击。",
      "廉贞受忌时，破军的变动更容易带来纠纷和代价。"
    ],
    palaceRelationUsage: [
      "入现实宫看改革和资源重配，入关系宫看边界重订，入福疾看压力修复。",
      "三方若会禄府相，重组可落地；三方若会空劫化忌，先看破耗与复核。"
    ],
    dynamicUsage: [
      "大限见廉贞破军，阶段主题常围绕旧规则重整、关系边界、资源变局和环境更新。",
      "流年流月见廉贞破军，短期多看拆改、合同变动、关系调整、支出和止损。"
    ],
    cautions: [
      "廉贞破军不能只断破败，也可能是必要重组；必须写清楚破什么、立什么、谁来承接。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tanlang, MAIN_STAR_IDS.pojun)]: {
    label: "贪狼破军",
    coreReading:
      "贪狼破军组合一边重欲望、人缘、才艺、资源流动和变化，一边重破旧、更新、冲击和重新配置。读此组合要看欲望如何推动变化，变化是否带来机会、消耗或失控。",
    interactionMode:
      "贪狼负责吸引与扩张，破军负责拆解与重组。同宫时欲望和变局直接混合，对宫时诱因与外部变化互相牵引，三方会照时常参与社交、资源、迁移和财务变动。",
    supportiveSignals: [
      "会禄存、化禄、魁钺、昌曲或强主星时，可看创意变现、资源更新、外部机会和项目转型。",
      "入迁移、财帛、官禄、交友时，可看市场变化、人际资源、消费投资和新机会。",
      "有吉曜承接时，贪狼的吸引力可成为破军重组后的资源入口。"
    ],
    pressureSignals: [
      "会煞忌、空劫或桃花杂曜过重时，要看欲望失控、破耗、关系纠缠、资源浪费和变动成瘾。",
      "入夫妻、福德时，要看情感诱因、消费欲望、情绪波动和安全感被冲击。",
      "若缺稳定主星和资源承接，容易机会很多但保存困难。"
    ],
    palaceRelationUsage: [
      "入财官迁交看资源变化和对外机会，入夫妻福德看欲望与关系边界，入田宅看生活结构变化。",
      "三方若见禄权科可转成创新，三方若见空劫煞忌则优先看破耗。"
    ],
    dynamicUsage: [
      "大限见贪狼破军，阶段主题常围绕欲望扩张、环境转换、资源重组和新旧替换。",
      "流年流月见贪狼破军，短期多看机会、消费、合作变化、关系诱因和项目调整。"
    ],
    cautions: [
      "贪狼破军不能只写桃花或破耗，要看变化是否有资源承接和边界控制。"
    ]
  },
  [buildSpecificStarPairKey(MAIN_STAR_IDS.tianfu, MAIN_STAR_IDS.tianxiang)]: {
    label: "天府天相",
    coreReading:
      "天府天相组合一边重库府、资源、承载和稳定，一边重辅佐、制度、协调和形象。读此组合要看资源如何通过制度角色被管理，稳定结构如何靠协调来维持。",
    interactionMode:
      "天府负责保存和承载，天相负责协调和秩序。同宫时资源与制度直接结合，对宫时库藏与角色互相照见，三方会照时常参与财帛、田宅、官禄、父母和交友。",
    supportiveSignals: [
      "会魁钺、左右、昌曲、禄权科时，利平台资源、制度管理、团队协调、文书审核和长期稳定。",
      "入财帛、田宅、官禄、父母时，可看资产、制度、职位、平台和资源管理。",
      "天府能承载，天相能协调时，组合较易形成稳健的资源和组织结构。"
    ],
    pressureSignals: [
      "会煞忌、空劫或天府被冲时，要看资源被耗、制度卡关、协调失衡和库藏破口。",
      "天相弱时协调不足，天府过重时保守滞留，容易有资源但难流动。",
      "入关系宫时，要看资源分配、角色公平和责任承接。"
    ],
    palaceRelationUsage: [
      "入财田官父看资源制度，入交友看团队平台，入夫妻看角色和资源分配。",
      "三方吉曜多时稳定性提高；三方煞忌重时，先看制度和资源的破口。"
    ],
    dynamicUsage: [
      "大限见天府天相，阶段主题常围绕平台、资产、制度、团队和长期稳定。",
      "流年流月见天府天相，短期多看资源安排、审核协调、家宅资产和组织事务。"
    ],
    cautions: [
      "天府天相不能只按稳断，要看资源是否流动、制度是否有效、责任是否有人承接。"
    ]
  },
  [buildSpecificStarPairKey(MISC_STAR_IDS.hongluan, MISC_STAR_IDS.tianxi)]: {
    label: "红鸾天喜",
    coreReading:
      "红鸾天喜组合是喜庆、人缘、关系触发和情感气氛资料。读此组合要看喜事、人际缘分、关系互动和庆贺气场，但不能脱离主星、宫位和四化直接断婚恋结果。",
    interactionMode:
      "红鸾偏关系牵动和缘分触发，天喜偏喜庆、顺气和气氛活络。同宫时喜庆气氛集中，对宫时对象端更容易牵动，三方会照时可补充关系、人缘、喜事和社交层的细节。",
    supportiveSignals: [
      "会昌曲、魁钺、禄存、化科或主星稳定时，可看关系互动顺畅、喜庆事务、合作氛围和人缘加分。",
      "入夫妻、子女、交友、迁移时，较适合观察关系触发、社交热度、邀约、庆贺和互动气氛。",
      "动态流年流月触发时，常作为短期喜庆、人际邀约、关系推进和气氛转暖的细节证据。"
    ],
    pressureSignals: [
      "会化忌、煞曜、空劫或桃花过重时，要看关系误会、期待落空、情感牵挂和社交成本。",
      "入疾厄、福德时，不宜放大成感情结论，更适合看情绪波动和人际牵动。",
      "若主星结构不稳，红鸾天喜只能表示气氛，不代表关系必然稳定。"
    ],
    palaceRelationUsage: [
      "同宫看直接喜气和关系气氛，三方看外部人缘和社交支援，对宫看对象端回应。",
      "若不照夫妻、命宫、交友或动态重点宫，不宜放大为当前主要事件。"
    ],
    dynamicUsage: [
      "大限见红鸾天喜，阶段人际和关系互动较容易被触发。",
      "流年流月见红鸾天喜，短期多看邀约、庆贺、互动、关系推进和社交活跃。"
    ],
    cautions: [
      "红鸾天喜不是婚恋定论，只是关系和喜庆气氛资料；必须结合夫妻宫、命宫和四化。"
    ]
  },
  [buildSpecificStarPairKey(MISC_STAR_IDS.xianchi, MISC_STAR_IDS.tianyao)]: {
    label: "咸池天姚",
    coreReading:
      "咸池天姚组合是桃花、审美、吸引、欲望气氛和关系诱因资料。读此组合要区分人缘、审美、曝光、欲望和真实关系承诺，不能直接等同感情事件。",
    interactionMode:
      "咸池偏桃花地气和欲望外显，天姚偏姿态、魅力、审美和诱发。同宫时吸引力集中，对宫时对象端牵动明显，三方会照时把人缘、消费、审美、关系气氛带入结构。",
    supportiveSignals: [
      "会昌曲、化科、魁钺或主星稳定时，可转为审美表达、艺术气质、人缘曝光、传播和社交机会。",
      "入迁移、交友、官禄、财帛时，可看形象经营、市场吸引、客户缘和审美资源。",
      "动态盘短期触发时，可作为社交、曝光、邀约、消费和关系气氛增强的证据。"
    ],
    pressureSignals: [
      "会化忌、煞曜、空劫或廉贞贪狼等欲望结构失衡时，要看暧昧、误会、关系成本、名声压力和欲望管理。",
      "入夫妻、福德、疾厄时，需降调看情绪牵动、欲望消耗和关系边界。",
      "若主星无承接，咸池天姚容易只剩气氛和诱因，不代表稳定结果。"
    ],
    palaceRelationUsage: [
      "同宫看直接吸引和审美，三方看人缘气场，对宫看对象反馈，夹宫看旁侧诱因。",
      "与四败地、贪狼、廉贞、红鸾天喜同见时，桃花气氛增强，但仍要看煞忌和宫位。"
    ],
    dynamicUsage: [
      "大限见咸池天姚，阶段关系、审美、曝光和欲望管理议题较明显。",
      "流年流月见咸池天姚，短期多看社交、形象、邀约、消费、暧昧和关系边界。"
    ],
    cautions: [
      "咸池天姚不能直接写成感情吉凶，必须分清人缘、欲望、审美、曝光和关系承诺。"
    ]
  },
  [buildSpecificStarPairKey(MISC_STAR_IDS.guchen, MISC_STAR_IDS.guasu)]: {
    label: "孤辰寡宿",
    coreReading:
      "孤辰寡宿组合是孤寡、距离、独处、迟滞和关系疏离资料。读此组合要看关系距离、内在孤立感、独立承担和人际连接难度，但不能直接断孤独终身。",
    interactionMode:
      "孤辰偏自我独立和孤立气，寡宿偏关系冷清和回应不足。同宫时距离感集中，对宫时对象端疏离，三方会照时把孤独、责任、情绪和关系承接带入结构。",
    supportiveSignals: [
      "会天梁、天府、化科、昌曲或稳定主星时，可转为独立研究、清静修复、自我整理和专注能力。",
      "入福德、命宫、官禄时，可看独立承担、专注工作、安静修复和不喜纷扰。",
      "动态短期触发时，可作为需要独处、减少社交和整理边界的提醒。"
    ],
    pressureSignals: [
      "会化忌、空劫、哭虚或煞曜时，要看关系疏离、情绪低落、沟通断层和支持不足。",
      "入夫妻、交友、兄弟时，要看亲密关系或协作中的距离、冷处理和回应不足。",
      "若三方缺辅曜支援，孤寡感可能更明显，需要复核支援来源。"
    ],
    palaceRelationUsage: [
      "同宫看直接疏离，对宫看对象端距离，三方看支援是否能补足孤寡结构。",
      "不能只凭孤辰寡宿断关系失败，必须看夫妻宫、交友宫、命身和动态层。"
    ],
    dynamicUsage: [
      "大限见孤辰寡宿，阶段可能更重独立、责任、清理关系和自我修复。",
      "流年流月见孤辰寡宿，短期多看疏离、独处、边界、冷静处理和社交减少。"
    ],
    cautions: [
      "孤辰寡宿只提示距离和孤立倾向，不作绝对关系结论。"
    ]
  },
  [buildSpecificStarPairKey(MISC_STAR_IDS.tianku, MISC_STAR_IDS.tianxu)]: {
    label: "天哭天虚",
    coreReading:
      "天哭天虚组合是情绪失落、虚耗、期待落空和心理气氛资料。读此组合要看情绪反应、失望感、空耗和短期低落，不可直接当成现实灾祸结论。",
    interactionMode:
      "天哭偏悲感、哭泣和情绪释放，天虚偏虚空、落差和不实。同宫时情绪虚耗集中，对宫时外部回应落差明显，三方会照时把情绪气候带入结构。",
    supportiveSignals: [
      "会天梁、化科、昌曲或辅曜时，可转为倾诉、修复、反省、艺术表达和情绪整理。",
      "入福德、疾厄时，可作为身心压力提醒，适合看休息、疏导和修复路径。",
      "动态短期触发时，多作为情绪天气和期待修正，不宜放大成长期判断。"
    ],
    pressureSignals: [
      "会化忌、空劫、煞曜或孤辰寡宿时，要看失望、低落、落空、沟通断层和情绪耗损。",
      "入夫妻、交友、子女时，要看关系期待落差和回应不足。",
      "若主星结构也弱，哭虚容易放大该宫主题的空耗感。"
    ],
    palaceRelationUsage: [
      "同宫看直接情绪气氛，三方看情绪来源，对宫看对象回应和期待落差。",
      "哭虚只补气氛，不替代主星和四化，不直接制造凶格。"
    ],
    dynamicUsage: [
      "大限见天哭天虚，阶段需重视情绪修复、期待调整和虚耗来源。",
      "流年流月见天哭天虚，短期多看失望、疲惫、情绪波动、空跑和休整。"
    ],
    cautions: [
      "天哭天虚不能直接做灾祸断语，只能作为情绪、落差和虚耗的复核资料。"
    ]
  },
  [buildSpecificStarPairKey(MISC_STAR_IDS.longchi, MISC_STAR_IDS.fengge)]: {
    label: "龙池凤阁",
    coreReading:
      "龙池凤阁组合是才艺、仪态、文采、审美、名誉修饰和外在气质资料。读此组合要看形象、品味、文艺表达和荣饰气，不单独决定格局高低。",
    interactionMode:
      "龙池偏文采、气派和容饰，凤阁偏审美、仪态和优雅。同宫时气质修饰集中，三方会照时可补充名声、审美、文书和外在表现。",
    supportiveSignals: [
      "会昌曲、化科、魁钺、太阳太阴或主星庙旺时，利文艺、名声、形象、审美、宣传和作品包装。",
      "入官禄、迁移、交友、命宫时，可看外在呈现、公开形象和审美资源。",
      "动态短期触发时，适合看展示、发布、包装、礼仪和形象修饰。"
    ],
    pressureSignals: [
      "会煞忌、空劫或哭虚时，要看名声虚浮、形象落差、审美失衡和包装过度。",
      "若主星无力，龙池凤阁只能修饰外观，难替代实际承接。",
      "入财帛时，要看审美消费、包装成本和资源回收。"
    ],
    palaceRelationUsage: [
      "同宫看直接气质和修饰，三方看名声与审美支援，对宫看外部评价。",
      "与昌曲、科曜同见时文艺名誉增强；与煞忌同见时先看虚名和落差。"
    ],
    dynamicUsage: [
      "大限见龙池凤阁，阶段可看形象经营、作品包装、文艺审美和名誉修饰。",
      "流年流月见龙池凤阁，短期多看展示、宣传、礼仪、作品、装饰和外部评价。"
    ],
    cautions: [
      "龙池凤阁不等于必然名利，只是审美、气质和名誉修饰资料。"
    ]
  },
  [buildSpecificStarPairKey(MISC_STAR_IDS.taifu, MISC_STAR_IDS.fenggao)]: {
    label: "台辅封诰",
    coreReading:
      "台辅封诰组合是辅佐、文书、封授、名分、职位修饰和制度认可资料。读此组合要看辅助身份、文书名分、表彰认可和制度内的支撑。",
    interactionMode:
      "台辅偏辅佐、台阶和辅助位置，封诰偏授命、表彰和名分文书。同宫时文书名分集中，三方会照时可作为制度认可和辅助支撑的细节。",
    supportiveSignals: [
      "会魁钺、昌曲、化科、天相或主星庙旺时，利文书、职称、任命、表彰、审核和制度承认。",
      "入官禄、父母、迁移、命宫时，可看职位名分、文件认可、平台支撑和外部背书。",
      "动态触发时，可作为手续、通知、任命、证书和正式流程的短期证据。"
    ],
    pressureSignals: [
      "会化忌、空劫或煞曜时，要看文书卡关、名分落空、审核延误和表面认可不足。",
      "若主星弱或宫位不承接，台辅封诰只表示形式和名分，未必形成实质资源。",
      "入交友或夫妻时，要看关系中的身份、承诺、名分和正式约定。"
    ],
    palaceRelationUsage: [
      "同宫看直接文书名分，三方看制度支撑，对宫看外部认可和对象端承诺。",
      "与昌曲科曜同见时，文书认可增强；与化忌同见时，优先看手续和名分问题。"
    ],
    dynamicUsage: [
      "大限见台辅封诰，阶段可看职位名分、文书流程、制度认可和辅助资源。",
      "流年流月见台辅封诰，短期多看证书、手续、任命、审核、合同和正式通知。"
    ],
    cautions: [
      "台辅封诰偏文书名分和辅助支撑，不等于实际权力或资源已经完全到位。"
    ]
  },
  [buildSpecificStarPairKey(MISC_STAR_IDS.tianxing, MISC_STAR_IDS.posui)]: {
    label: "天刑破碎",
    coreReading:
      "天刑破碎组合是规则、刑伤、破损、切割、瑕疵和修补成本资料。读此组合要看制度边界、损坏处、修补处和细节破口，不能直接做灾祸断语。",
    interactionMode:
      "天刑偏规则、刑责、切割和约束，破碎偏破损、瑕疵和不完整。同宫时破口与规则直接混合，三方会照时把修补成本带入结构，对宫时看外部对象或环境带来的破损压力。",
    supportiveSignals: [
      "会天梁、化科、天相或强主星时，可转为规则修复、风险边界、专业处理、止损和细节检查。",
      "入官禄、父母、疾厄、财帛时，可看制度、手续、身体压力、维修、账目和细节破口。",
      "动态短期触发时，适合提醒检查、修补、复核、切割和合规处理。"
    ],
    pressureSignals: [
      "会化忌、羊陀、火铃、空劫时，要看破损扩大、手续纠纷、规则压力、损耗和修复成本。",
      "入夫妻、交友时，要看边界冲突、承诺破口和关系中的裂缝。",
      "若主星无承接，天刑破碎容易把该宫主题推向细节损耗和反复修补。"
    ],
    palaceRelationUsage: [
      "同宫看直接破损，三方看破损来源，对宫看外部压力，夹宫看旁侧挤压。",
      "与煞忌同见时需降调提示风险，与吉曜同见时看修复和制度化处理。"
    ],
    dynamicUsage: [
      "大限见天刑破碎，阶段要看规则、修补、合规、损耗和长期破口管理。",
      "流年流月见天刑破碎，短期多看维修、手续、破损、争议、止损和风险复核。"
    ],
    cautions: [
      "天刑破碎只能提示破口和修复成本，不直接替代现实法律、医疗或安全判断。"
    ]
  }
}

const SPECIFIC_STAR_PAIR_COMBINATION_STAR_ID_PAIRS: Array<
  [ZiweiStarId, ZiweiStarId]
> = [
  [MAIN_STAR_IDS.ziwei, MAIN_STAR_IDS.qisha],
  [MAIN_STAR_IDS.lianzhen, MAIN_STAR_IDS.tanlang],
  [MAIN_STAR_IDS.wuqu, MAIN_STAR_IDS.pojun],
  [MAIN_STAR_IDS.taiyang, MAIN_STAR_IDS.taiyin],
  [MAIN_STAR_IDS.tianji, MAIN_STAR_IDS.taiyin],
  [MAIN_STAR_IDS.tianji, MAIN_STAR_IDS.jumen],
  [MAIN_STAR_IDS.tiantong, MAIN_STAR_IDS.taiyin],
  [MAIN_STAR_IDS.tiantong, MAIN_STAR_IDS.jumen],
  [MAIN_STAR_IDS.tianfu, MAIN_STAR_IDS.lianzhen],
  [MAIN_STAR_IDS.tianxiang, MAIN_STAR_IDS.lianzhen],
  [MAIN_STAR_IDS.qisha, MAIN_STAR_IDS.pojun],
  [MAIN_STAR_IDS.ziwei, MAIN_STAR_IDS.tianfu],
  [MAIN_STAR_IDS.ziwei, MAIN_STAR_IDS.tanlang],
  [MAIN_STAR_IDS.taiyang, MAIN_STAR_IDS.jumen],
  [MAIN_STAR_IDS.tianji, MAIN_STAR_IDS.tianliang],
  [MAIN_STAR_IDS.tiantong, MAIN_STAR_IDS.tianliang],
  [MAIN_STAR_IDS.wuqu, MAIN_STAR_IDS.tianfu],
  [MAIN_STAR_IDS.wuqu, MAIN_STAR_IDS.tianxiang],
  [MAIN_STAR_IDS.lianzhen, MAIN_STAR_IDS.qisha],
  [MAIN_STAR_IDS.lianzhen, MAIN_STAR_IDS.pojun],
  [MAIN_STAR_IDS.tanlang, MAIN_STAR_IDS.pojun],
  [MAIN_STAR_IDS.tianfu, MAIN_STAR_IDS.tianxiang],
  [ASSISTANT_STAR_IDS.wenchang, ASSISTANT_STAR_IDS.wenqu],
  [ASSISTANT_STAR_IDS.tiankui, ASSISTANT_STAR_IDS.tianyue],
  [MALEFIC_STAR_IDS.qingyang, MALEFIC_STAR_IDS.tuoluo],
  [MALEFIC_STAR_IDS.huoxing, MALEFIC_STAR_IDS.lingxing],
  [MALEFIC_STAR_IDS.dikong, MALEFIC_STAR_IDS.dijie],
  [ASSISTANT_STAR_IDS.lucun, ASSISTANT_STAR_IDS.tianma],
  [MISC_STAR_IDS.hongluan, MISC_STAR_IDS.tianxi],
  [MISC_STAR_IDS.xianchi, MISC_STAR_IDS.tianyao],
  [MISC_STAR_IDS.guchen, MISC_STAR_IDS.guasu],
  [MISC_STAR_IDS.tianku, MISC_STAR_IDS.tianxu],
  [MISC_STAR_IDS.longchi, MISC_STAR_IDS.fengge],
  [MISC_STAR_IDS.taifu, MISC_STAR_IDS.fenggao],
  [MISC_STAR_IDS.tianxing, MISC_STAR_IDS.posui]
]

let starPairCombinationDetailMapCache: Record<
  string,
  ZiweiStarPairCombinationContentDetail
> | null = null

export const ZIWEI_STAR_PAIR_COMBINATION_DETAILS = new Proxy(
  {} as Record<string, ZiweiStarPairCombinationContentDetail>,
  {
    get(_target, property) {
      if (typeof property !== "string") {
        return undefined
      }

      return getStarPairCombinationDetailMap()[property]
    },
    getOwnPropertyDescriptor(_target, property) {
      if (
        typeof property === "string" &&
        property in getStarPairCombinationDetailMap()
      ) {
        return {
          configurable: true,
          enumerable: true,
          value: getStarPairCombinationDetailMap()[property]
        }
      }

      return undefined
    },
    has(_target, property) {
      return (
        typeof property === "string" &&
        property in getStarPairCombinationDetailMap()
      )
    },
    ownKeys() {
      return Object.keys(getStarPairCombinationDetailMap())
    }
  }
)

function getStarPairCombinationDetailMap(): Record<
  string,
  ZiweiStarPairCombinationContentDetail
> {
  if (starPairCombinationDetailMapCache) {
    return starPairCombinationDetailMapCache
  }

  starPairCombinationDetailMapCache = Object.fromEntries(
    getAllFixedStarPairSourceDetails().flatMap((starA, starAIndex, stars) => {
      return stars.slice(starAIndex + 1).map((starB) => {
        const detail = buildStarPairCombinationContentDetail(starA, starB)

        return [detail.combinationId, detail]
      })
    })
  )

  return starPairCombinationDetailMapCache
}

function getStarPairGroupProfile(group: ZiweiStarPairCombinationGroup): StarPairGroupProfile {
  const profiles = {
    "main-main": {
      label: "主星双星组合",
      role: "主星双星组合用于判断宫位主轴的复合主轴、双核心拉扯和结构层次，是同宫与三方四正读盘的优先资料。",
      supportiveTheme: "双主轴互补、格局清晰、责任与能力同时成形",
      pressureTheme: "双主轴互抢、目标分裂、宫位主题摇摆",
      primaryRule: (starA: string, starB: string) => `${starA}与${starB}都可能成为主轴，需看庙旺、四化和宫位主题决定主次`,
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若会辅曜、禄权科或庙旺有力，可形成较稳定的宫位骨架。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若同陷、同会煞忌或主题相冲，容易出现宫位主轴互相牵制。`
    },
    "main-assistant": {
      label: "主星辅曜组合",
      role: "主星辅曜组合用于判断主轴是否得到资源、文书、贵人、行动或缓冲支持。",
      supportiveTheme: "主轴得助、资源可用、贵人文书或行动条件增强",
      pressureTheme: "支援落空、资源错配、助力无法承接",
      primaryRule: (starA: string, starB: string) => `以主星承担主轴，${starA}${starB}中属于辅曜的一方负责补强和润色`,
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若同宫或会照清楚，常作为加吉、补强和可用资源证据。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若主星弱、煞忌重或空劫冲击，辅曜可能只是期待而非现实支援。`
    },
    "main-malefic": {
      label: "主星煞曜组合",
      role: "主星煞曜组合用于判断主轴承压、冲突代价、执行硬度和修复入口。",
      supportiveTheme: "压力转为行动力、边界、切割、止损或突破",
      pressureTheme: "主轴受冲、代价加重、冲突损耗或风险放大",
      primaryRule: () => "以主星判断主题，以煞曜判断压力、代价和修复入口",
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若有制化、强主星或明确目标，压力可转成推进力和边界感。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若再会化忌、空劫或落陷，需优先标记压力来源和复核路径。`
    },
    "main-misc": {
      label: "主星杂曜组合",
      role: "主星杂曜组合用于判断主轴旁边的气氛、关系触发、名声文书、孤寡桃花和特殊细节。",
      supportiveTheme: "主轴有细节补充、情绪气氛或特殊触发点",
      pressureTheme: "细节干扰主轴、关系纠缠、名声压力或情绪负担",
      primaryRule: () => "以主星定宫位主轴，杂曜只补充气氛和细节，不反客为主",
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若主轴清楚，可作为事件气氛、关系触发和特殊主题的补充证据。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若煞忌空劫重，杂曜细节容易转为纠缠、落空或误读。`
    },
    "assistant-assistant": {
      label: "辅曜双星组合",
      role: "辅曜双星组合用于判断资源、贵人、文书、协作和缓冲条件是否成组出现。",
      supportiveTheme: "助力叠加、文书贵人并见、资源窗口清晰",
      pressureTheme: "助力分散、资源无法落地、期待过高",
      primaryRule: (starA: string, starB: string) => `${starA}${starB}都属于补强层，必须依附主星和宫位主题判断`,
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若夹拱或会照主宫，可作为加吉和补强证据。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若缺主星承接，不宜直接断为贵人或好运。`
    },
    "assistant-malefic": {
      label: "辅曜煞曜组合",
      role: "辅曜煞曜组合用于判断助力能否制化压力，或资源是否被冲突、损耗和阻滞牵制。",
      supportiveTheme: "有助力可制压、压力有缓冲、风险有修复路径",
      pressureTheme: "助力被耗、贵人受阻、资源进入冲突场",
      primaryRule: () => "辅曜看可用帮助，煞曜看压力来源，二者必须一起评估制化是否成立",
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若主星强且四化得宜，常提示有方法处理压力。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若煞曜重而辅曜弱，助力可能不足以抵消代价。`
    },
    "assistant-misc": {
      label: "辅曜杂曜组合",
      role: "辅曜杂曜组合用于判断资源、贵人、文书和细节触发如何互相配合。",
      supportiveTheme: "助力带出细节机会、关系触发或文书名声",
      pressureTheme: "助力被细节牵制、关系气氛复杂、文书名声反复",
      primaryRule: () => "辅曜负责补强，杂曜负责气氛和细节，两者都不替代主星主轴",
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若证据清楚，可作为细节机会和辅助资源同现的资料。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若缺主轴承接，容易只剩气氛而难以落地。`
    },
    "malefic-malefic": {
      label: "煞曜双星组合",
      role: "煞曜双星组合用于判断压力叠加、冲突链、损耗链和必须优先复核的风险入口。",
      supportiveTheme: "压力集中后可形成切割、突破、止损和警觉",
      pressureTheme: "冲突叠加、损耗叠加、急慢压力交错",
      primaryRule: (starA: string, starB: string) => `${starA}${starB}都属于压力层，必须看是否有主星承接、吉曜制化和四化缓冲`,
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若有强主星和明确目标，可转成强执行、断舍离和风险意识。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若再会化忌或落陷，需降调输出并给出复核路径。`
    },
    "malefic-misc": {
      label: "煞曜杂曜组合",
      role: "煞曜杂曜组合用于判断压力事件中的气氛、细节、孤寡桃花、哭虚刑耗或特殊触发。",
      supportiveTheme: "压力中出现提醒、警觉、修复线索或特殊证据",
      pressureTheme: "风险被细节放大、情绪纠缠、名声关系或刑耗主题加重",
      primaryRule: () => "煞曜定压力入口，杂曜补细节气氛，二者都需要主星和宫位承接",
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若有制化，可提示压力背后的提醒、修复线索或边界。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若无制化，容易形成压力细节化和情绪化。`
    },
    "misc-misc": {
      label: "杂曜双星组合",
      role: "杂曜双星组合用于判断细节气氛、关系触发、名声文书、孤寡桃花和特殊象义叠加。",
      supportiveTheme: "细节互相呼应、气氛成形、特殊主题可被复核",
      pressureTheme: "气氛过重、细节互相纠缠、主题被夸大",
      primaryRule: (starA: string, starB: string) => `${starA}${starB}都属于细节层，必须降权读取并回到主星、宫位和关系结构`,
      supportiveSignal: (starA: string, starB: string) => `${starA}${starB}若和主星、宫位主题一致，可作为细节证据和气氛补充。`,
      pressureSignal: (starA: string, starB: string) => `${starA}${starB}若脱离主轴，容易造成过度解读和单点放大。`
    }
  } satisfies Record<
    ZiweiStarPairCombinationGroup,
    {
      label: string
      role: string
      supportiveTheme: string
      pressureTheme: string
      primaryRule: (starA: string, starB: string) => string
      supportiveSignal: (starA: string, starB: string) => string
      pressureSignal: (starA: string, starB: string) => string
    }
  >

  return profiles[group]
}

function buildInteractionMode(
  starA: StarPairSourceDetail,
  starB: StarPairSourceDetail,
  profile: StarPairGroupProfile
): string {
  return `${profile.label}的核心不是把${starA.label}和${starB.label}硬合成一句断语，而是观察${starA.coreThemes[0]}、${starB.coreThemes[0]}两类象义在同宫、会照、夹拱、动态叠盘中如何协同、牵制或互相补强。解释时先分清两星本体和类别权重，再看宫位主题、关系范围、四化来源与盘层，最后才进入当前盘命中的证据链。`
}

function buildStarPairCombinationId(starAId: ZiweiStarId, starBId: ZiweiStarId): string {
  return `star-pair.${starAId}.${starBId}`
}

function buildSections(input: {
  starALabel: string
  starBLabel: string
  groupLabel: string
  coreReading: string
  groupRole: string
  interactionMode: string
  readingOrder: string[]
  supportiveSignals: string[]
  pressureSignals: string[]
  palaceRelationUsage: string[]
  dynamicUsage: string[]
  evidenceFields: string[]
  cautions: string[]
}): ZiweiContentDictionarySection[] {
  return [
    {
      title: "组合本体",
      items: [input.coreReading, input.groupRole, input.interactionMode]
    },
    {
      title: "主次与分工",
      items: [
        `${input.starALabel}与${input.starBLabel}先分开读取本体，再合并为${input.groupLabel}。主星负责主题骨架，辅曜负责资源助力，煞曜负责压力代价，杂曜负责气氛细节。`,
        `若两颗星同属主轴层，要看宫位主题、庙旺落陷和四化决定谁先发声；若一主一辅、一主一煞或一主一杂，则以主星定题，另一颗星定修饰和触发。`,
        `若两颗星都不是主星，组合只能作为支援、压力或细节资料，必须依附本宫主星、对宫和三方四正才能进入当前盘结论。`
      ]
    },
    {
      title: "读盘顺序",
      items: input.readingOrder
    },
    {
      title: "同宫解释",
      items: [
        `同宫代表${input.starALabel}与${input.starBLabel}共同落在同一宫位主题里，解释时要把两颗星视为同一问题场内的并行力量。`,
        `同宫权重最高，但也最需要分主次：先看宫位主星和主轴，再看辅曜是否补强、煞曜是否加压、杂曜是否带出细节。`,
        `同宫组合若同时得禄权科、吉曜和庙旺，通常提高成事与承接权重；若同会煞忌、空劫或落陷，则优先写压力来源和修复条件。`
      ]
    },
    {
      title: "对宫解释",
      items: [
        `对宫代表内外、主客、自我与对象、事件本体与外部反馈之间的牵引，不能把对宫照会写成两星同坐。`,
        `若${input.starALabel}在本宫、${input.starBLabel}在对宫，要分别说明本宫立场和对宫回声，再看两边是否互相支援、冲突或牵制。`,
        `空宫借对宫时，对宫组合可以作为借入资料，但必须保留借宫权重和本宫空宫状态，不可直接升格为本宫同宫组合。`
      ]
    },
    {
      title: "三方四正",
      items: [
        `三方四正用于看结构支援与结构压力，重点不是单颗星漂过，而是命中宫、财帛宫、官禄宫、迁移宫等主题是否互相呼应。`,
        `${input.starALabel}${input.starBLabel}若在三方四正范围内重复支持同一主题，可作为成格、加吉或主题链证据；若一边助力一边破坏，则进入冲突复核。`,
        `三方四正的解释必须带上来源宫位，说明是从财、官、迁、福、夫等哪条宫线提供支援或压力。`
      ]
    },
    {
      title: "夹宫与会照",
      items: [
        `夹宫看左右两宫对目标宫的包围、保护、拉扯或挤压；会照看远端宫位对目标宫的主题牵动。`,
        `${input.starALabel}${input.starBLabel}若形成夹宫，先判断夹的是哪一宫、夹宫星曜是吉助、煞压还是杂曜气氛，再看目标宫是否能承接。`,
        `会照只能说明主题被照入，不能直接等同同宫；若会照同时触发格局、四化或三方四正，才提高解释权重。`
      ]
    },
    {
      title: "四化牵动",
      items: [
        `四化必须说明是谁的天干触发，落在哪个盘层，化禄、化权、化科、化忌分别指向资源、推动、名誉秩序和阻滞牵挂。`,
        `若${input.starALabel}或${input.starBLabel}被四化点中，先看目标星本体，再看化象如何改变组合的重心；四化不是庙旺，也不能替代星曜本体。`,
        `本命四化读长期牵引，大限四化读阶段转向，流年四化读年度触发，流月、流日、流时只作短周期提示。`
      ]
    },
    {
      title: "庙旺落陷",
      items: [
        `庙旺落陷只适用于资料表中有亮度定义的星曜；没有亮度定义的辅曜、杂曜或周期星，不硬套庙旺。`,
        `若两颗星都有亮度，先看主轴星的承接力，再看另一颗星是增强、拖累、触发还是修饰。`,
        `庙旺提高承接层次，落陷提高复核需求；但最终仍要回到宫位主题、同宫对宫、三方四正和四化。`
      ]
    },
    {
      title: "动态盘层级",
      items: input.dynamicUsage
    },
    {
      title: "助力信号",
      items: input.supportiveSignals
    },
    {
      title: "压力信号",
      items: input.pressureSignals
    },
    {
      title: "宫位关系",
      items: input.palaceRelationUsage
    },
    {
      title: "当前盘证据",
      items: input.evidenceFields
    },
    {
      title: "误读边界",
      items: input.cautions
    }
  ]
}

