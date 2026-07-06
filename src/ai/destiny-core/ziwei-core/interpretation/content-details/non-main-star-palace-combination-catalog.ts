import type { SectorName, ZiweiStarId } from "../../contracts"
import {
  assistantStarCatalog,
  maleficStarCatalog,
  miscStarCatalog
} from "../../star-catalog"

import type {
  ZiweiAssistantStarContentDetail,
  ZiweiContentDictionarySection,
  ZiweiMaleficStarContentDetail,
  ZiweiMiscStarContentDetail,
  ZiweiNonMainStarPalaceCombinationCategory,
  ZiweiNonMainStarPalaceCombinationContentDetail
} from "./content-detail-types"
import {
  getAllAssistantStarContentDetails,
  getAssistantStarContentDetail
} from "./assistant-star-meaning-catalog"
import {
  getAllMaleficStarContentDetails,
  getMaleficStarContentDetail
} from "./malefic-star-meaning-catalog"
import {
  getAllMiscStarContentDetails,
  getMiscStarContentDetail
} from "./misc-star-meaning-catalog"
import {
  getPalaceContentDetail,
  ZIWEI_PALACE_ORDER
} from "./palace-meaning-catalog"
import { buildStarPalaceCombinationSourceReferences } from "./content-source-reference-map"

type NonMainStarDetail =
  | ZiweiAssistantStarContentDetail
  | ZiweiMaleficStarContentDetail
  | ZiweiMiscStarContentDetail

interface NonMainPalaceReadingProfile {
  domainSubjects: string[]
  palaceConversion: string
  samePalaceFocus: string
  oppositePalaceFocus: string
  trineSquareFocus: string
  transformationFocus: string
  brightnessFocus: string
  dynamicFocus: string
  evidenceQuestions: string[]
}

const NON_MAIN_PALACE_READING_PROFILES: Record<
  SectorName,
  NonMainPalaceReadingProfile
> = {
  life: {
    domainSubjects: ["自我主轴", "决策方式", "命身承接", "长期底色"],
    palaceConversion: "非主星入命宫时，只补充本人主轴的助力、压力或细节气氛，不能替代命宫主星和身宫判断。",
    samePalaceFocus: "同宫非主星先看是否贴着命宫主星发挥；辅曜补支援，煞曜提示承压，杂曜补个性气氛和特殊触发。",
    oppositePalaceFocus: "对宫迁移会把非主星作用带到外部环境，需看外界反馈是否反过来影响本人判断。",
    trineSquareFocus: "三方四正看非主星是否参与财官迁移等结构，决定它是局部细节还是整盘主轴旁证。",
    transformationFocus: "四化入命或会命时，非主星只作触发环境和辅助证据，四化目标星才是主线。",
    brightnessFocus: "有亮度定义的辅煞星才看庙旺落陷；无亮度定义的杂曜不强行套庙旺。",
    dynamicFocus: "动态命宫见非主星，重点看该阶段个人状态的助力、压力或临时触发。",
    evidenceQuestions: ["它是同宫贴身还是三方会入？", "命宫主星能否承接？", "是否只是短期动态触发？"]
  },
  siblings: {
    domainSubjects: ["手足", "同辈", "近身协作", "横向支持"],
    palaceConversion: "非主星入兄弟宫时，转成同辈协作、人际摩擦、支援窗口或圈层细节。",
    samePalaceFocus: "同宫看手足同辈里的具体助力、口舌、竞争、贵助或情绪气氛。",
    oppositePalaceFocus: "对宫交友决定外部团队是否放大兄弟宫的协作或压力。",
    trineSquareFocus: "三方四正看同辈关系是否牵动资源、事业和家庭承接。",
    transformationFocus: "四化触发时，看同辈分工、利益往来、沟通牵挂和团队责任。",
    brightnessFocus: "辅煞亮度只修正助力或压力强弱，杂曜仍以主题触发为主。",
    dynamicFocus: "动态触发时，多看同事同学、手足消息、团队分工和沟通事件。",
    evidenceQuestions: ["同辈关系是助力还是竞争？", "是否有利益牵挂？", "外部团队是否参与？"]
  },
  spouse: {
    domainSubjects: ["伴侣", "一对一合作", "契约关系", "亲密互动"],
    palaceConversion: "非主星入夫妻宫时，转成关系中的助力、摩擦、吸引、边界、文书或细节触发。",
    samePalaceFocus: "同宫看伴侣互动里的直接气氛，辅曜看协调，煞曜看冲突，杂曜看桃花、仪饰、孤寡或特殊情绪。",
    oppositePalaceFocus: "对宫官禄说明事业责任和公共角色如何影响关系。",
    trineSquareFocus: "三方四正看福德、迁移和命宫是否支援关系稳定。",
    transformationFocus: "四化触发夫妻宫时，看关系中的资源、责任、名誉和牵挂。",
    brightnessFocus: "不要把杂曜桃花硬套庙旺；煞曜有亮度时只看冲突强弱和修复难度。",
    dynamicFocus: "动态触发时，多看伴侣、合作、合同、边界沟通和短期互动。",
    evidenceQuestions: ["关系主轴由哪颗主星承担？", "非主星是助力、压力还是桃花细节？", "官禄对宫是否施压？"]
  },
  children: {
    domainSubjects: ["子女", "作品", "创造延伸", "照护对象"],
    palaceConversion: "非主星入子女宫时，转成作品成果、照护压力、学生下属、创造项目和短期反馈。",
    samePalaceFocus: "同宫看创造延伸的细节，辅曜主协助，煞曜主反复和压力，杂曜主情绪、喜庆或特殊触发。",
    oppositePalaceFocus: "对宫田宅说明家庭根基和生活空间如何承接子女或作品。",
    trineSquareFocus: "三方四正看成果是否能变成资源、名声、项目或稳定结构。",
    transformationFocus: "四化触发时，看子女、作品、学生下属或项目交付中的得失牵动。",
    brightnessFocus: "辅煞亮度只修正助力或压力；杂曜不作生育数量判断。",
    dynamicFocus: "动态触发时，多看作品推进、照护安排、成果反馈和下属学生事务。",
    evidenceQuestions: ["该宫主题是子女还是作品？", "成果是否有承接？", "压力是否来自照护或交付？"]
  },
  wealth: {
    domainSubjects: ["收入", "现金流", "资源配置", "价值交换"],
    palaceConversion: "非主星入财帛宫时，转成资源助力、成本压力、现金流细节、消费诱因和财务风险提示。",
    samePalaceFocus: "同宫看财务模式里的辅助或干扰，禄马类看流通，煞曜看损耗，杂曜看消费和关系诱因。",
    oppositePalaceFocus: "对宫福德说明享受欲望和内在满足如何牵动财务。",
    trineSquareFocus: "三方四正看事业、命宫、迁移是否能把资源机会落实。",
    transformationFocus: "四化触发时，看资源进入、支出责任、名誉换利和牵挂损耗。",
    brightnessFocus: "有亮度的辅煞星只修正财务助力或压力强弱，不直接断财富总额。",
    dynamicFocus: "动态触发时，多看付款、预算、合同、临时机会和资源调配。",
    evidenceQuestions: ["财源主轴是什么？", "非主星是增益还是损耗？", "财福线是否互相拉扯？"]
  },
  health: {
    domainSubjects: ["身体状态", "压力承接", "隐患", "修复节奏"],
    palaceConversion: "非主星入疾厄宫时，只作身心压力、修复资源、生活节奏和风险提醒，不作医疗诊断。",
    samePalaceFocus: "同宫看压力细节，辅曜主缓冲，煞曜主过载，杂曜主情绪、虚耗或特殊症候提示。",
    oppositePalaceFocus: "对宫父母说明背景、制度、长辈和文书如何形成身心压力。",
    trineSquareFocus: "三方四正看工作、家庭、福德和生活节奏是否共同加压。",
    transformationFocus: "四化触发时，看压力牵挂、修复资源、作息结构和现实检查需求。",
    brightnessFocus: "煞曜亮度只用于判断压力强弱，不输出病名；杂曜不套庙旺。",
    dynamicFocus: "动态触发时，只作疲劳、压力、作息和风险边界提醒。",
    evidenceQuestions: ["压力来源是哪条宫线？", "是否有修复资源？", "是否需要现实健康检查？"]
  },
  travel: {
    domainSubjects: ["外部环境", "迁动", "出行", "对外发展"],
    palaceConversion: "非主星入迁移宫时，转成外部助力、奔波压力、出行风险、异地资源和临场触发。",
    samePalaceFocus: "同宫看人在外的细节，辅曜主外部帮助，煞曜主奔波和风险，杂曜主人缘、声名或情绪气氛。",
    oppositePalaceFocus: "对宫命宫说明外部环境如何反过来影响本人主轴。",
    trineSquareFocus: "三方四正看外部机会是否连接财务、事业和关系。",
    transformationFocus: "四化触发时，看外部资源、权责、名声曝光和出行牵挂。",
    brightnessFocus: "天马、辅煞等有规则时按自身规则，不把所有动象都写成迁移结论。",
    dynamicFocus: "动态触发时，多看出行、搬迁、外地合作、环境变化和短期奔波。",
    evidenceQuestions: ["动象是否成立？", "外部环境是助力还是压力？", "命迁线是否一致？"]
  },
  friends: {
    domainSubjects: ["朋友", "团队", "社群", "外部协作"],
    palaceConversion: "非主星入交友宫时，转成团队助力、客户资源、社群气氛、协作摩擦或人脉成本。",
    samePalaceFocus: "同宫看外部协作的具体表现，辅曜主贵人和支持，煞曜主内耗，杂曜主社交气氛和特殊关系。",
    oppositePalaceFocus: "对宫兄弟说明近身同辈和外部团队是否互相呼应。",
    trineSquareFocus: "三方四正看团队是否影响事业、财务、迁移和阶段机会。",
    transformationFocus: "四化触发时，看团队、人脉、客户、朋友中的资源和牵挂。",
    brightnessFocus: "辅煞亮度用于判断支援或压力强弱，杂曜只作社群细节。",
    dynamicFocus: "动态触发时，多看合作对象、客户、团队变动、社群活动和临时支持。",
    evidenceQuestions: ["团队能否帮事？", "人脉是否带成本？", "兄弟交友是否互证？"]
  },
  career: {
    domainSubjects: ["事业定位", "职责", "职业路径", "公共表现"],
    palaceConversion: "非主星入官禄宫时，转成事业里的助力、竞争、考核、名誉、文书和执行压力。",
    samePalaceFocus: "同宫看事业主轴旁边的支援或压力，辅曜主平台资源，煞曜主竞争和改革，杂曜主名声文书和细节触发。",
    oppositePalaceFocus: "对宫夫妻说明事业责任如何影响伴侣和一对一合作。",
    trineSquareFocus: "三方四正看命宫、财帛、迁移是否共同支撑事业落地。",
    transformationFocus: "四化触发时，看职务、权责、名誉、考核和事业牵挂。",
    brightnessFocus: "辅煞亮度只修正事业助力或压力，不单独决定职业高低。",
    dynamicFocus: "动态触发时，多看职位、项目、升迁、转型、考试、会议和交付。",
    evidenceQuestions: ["事业主轴由哪颗主星承担？", "非主星是平台还是压力？", "财官线是否成形？"]
  },
  property: {
    domainSubjects: ["家庭根基", "居住环境", "不动产", "长期承载"],
    palaceConversion: "非主星入田宅宫时，转成家庭环境、居住细节、资产辅助、修缮压力和家事触发。",
    samePalaceFocus: "同宫看家宅细节，辅曜主承接和帮助，煞曜主修缮变动，杂曜主气氛、仪饰或家庭情绪。",
    oppositePalaceFocus: "对宫子女说明家庭根基如何承接作品、子女和创造延伸。",
    trineSquareFocus: "三方四正看家宅是否影响财务、福德、事业和长期稳定。",
    transformationFocus: "四化触发时，看房产、家事、长期资产和家庭责任的流向。",
    brightnessFocus: "辅煞亮度只看家宅压力或支援强弱，杂曜不直接断房产数量。",
    dynamicFocus: "动态触发时，多看搬家、装修、家中事务、不动产和居住安排。",
    evidenceQuestions: ["根基是否稳定？", "非主星是修饰还是破耗？", "田宅子女线是否被触发？"]
  },
  fortune: {
    domainSubjects: ["精神状态", "内在满足", "享受能力", "长期福分"],
    palaceConversion: "非主星入福德宫时，转成精神助力、内耗压力、享受诱因、信念细节和修复提醒。",
    samePalaceFocus: "同宫看内在状态的细节，辅曜主缓冲，煞曜主焦虑和压力，杂曜主情绪、桃花或孤寡气氛。",
    oppositePalaceFocus: "对宫财帛说明现实资源和消费欲望如何牵动精神状态。",
    trineSquareFocus: "三方四正看命宫、夫妻、迁移等外部压力如何影响内在稳定。",
    transformationFocus: "四化触发时，看享受、信念、情绪、资源欲望和精神牵挂。",
    brightnessFocus: "有亮度定义时只修正缓冲或压力强弱，不输出心理诊断。",
    dynamicFocus: "动态触发时，多看休息、睡眠、兴趣、情绪和短期修复。",
    evidenceQuestions: ["精神余裕是否足够？", "财福是否互相拉扯？", "压力是否有修复路径？"]
  },
  parents: {
    domainSubjects: ["父母长辈", "背景支持", "文书制度", "上级关系"],
    palaceConversion: "非主星入父母宫时，转成长辈背景、文书证照、上级反馈、制度支援或制度卡点。",
    samePalaceFocus: "同宫看背景规范细节，辅曜主文书贵助，煞曜主卡点压力，杂曜主名声、仪饰或情绪触发。",
    oppositePalaceFocus: "对宫疾厄说明背景制度如何影响身心承压。",
    trineSquareFocus: "三方四正看长辈资源、文书制度、事业、田宅和福德的牵动。",
    transformationFocus: "四化触发时，看上级、文件、长辈、制度责任和背景资源变化。",
    brightnessFocus: "辅煞亮度只看制度助力或压力强弱，杂曜不作家庭关系绝对判断。",
    dynamicFocus: "动态触发时，多看父母长辈、上级反馈、审批证件、合同文书和制度流程。",
    evidenceQuestions: ["背景是助力还是压力？", "文书制度是否顺畅？", "父母疾厄线是否互相牵动？"]
  }
}

export const ZIWEI_NON_MAIN_STAR_PALACE_COMBINATION_DETAILS: Record<
  string,
  ZiweiNonMainStarPalaceCombinationContentDetail
> = Object.fromEntries(
  getAllNonMainStarIds().flatMap((starId) => {
    return ZIWEI_PALACE_ORDER.map((sectorName) => {
      const detail = buildNonMainStarPalaceCombinationDetail(starId, sectorName)

      return [detail.combinationId, detail]
    })
  })
)

export function getNonMainStarPalaceCombinationContentDetail(
  starId: ZiweiStarId,
  sectorName: SectorName
): ZiweiNonMainStarPalaceCombinationContentDetail | null {
  return ZIWEI_NON_MAIN_STAR_PALACE_COMBINATION_DETAILS[
    buildNonMainStarPalaceCombinationId(starId, sectorName)
  ] ?? null
}

export function getAllNonMainStarPalaceCombinationContentDetails(): ZiweiNonMainStarPalaceCombinationContentDetail[] {
  return getAllNonMainStarIds().flatMap((starId) => {
    return ZIWEI_PALACE_ORDER.map((sectorName) => {
      const detail = getNonMainStarPalaceCombinationContentDetail(starId, sectorName)

      if (!detail) {
        throw new Error(`Missing non-main star palace combination: ${starId} ${sectorName}`)
      }

      return detail
    })
  })
}

export function getAllNonMainStarIds(): ZiweiStarId[] {
  return [
    ...assistantStarCatalog.map((star) => star.starId),
    ...maleficStarCatalog.map((star) => star.starId),
    ...miscStarCatalog.map((star) => star.starId)
  ]
}

function buildNonMainStarPalaceCombinationDetail(
  starId: ZiweiStarId,
  sectorName: SectorName
): ZiweiNonMainStarPalaceCombinationContentDetail {
  const star = getNonMainStarContentDetail(starId)
  const palace = getPalaceContentDetail(sectorName)

  if (!star || !palace) {
    throw new Error(`Cannot build non-main star palace combination: ${starId} ${sectorName}`)
  }

  const category = getNonMainStarCategory(starId)
  const categoryProfile = getCategoryProfile(category)
  const palaceProfile = NON_MAIN_PALACE_READING_PROFILES[sectorName]
  const combinationId = buildNonMainStarPalaceCombinationId(starId, sectorName)
  const sourceReferences = buildStarPalaceCombinationSourceReferences()
  const coreReading =
    `${star.label}入${palace.label}时，先把${star.label}的${star.coreThemes.join("、")}放入${palace.corePosition}观察。` +
    `它不是该宫主轴，而是补充${palace.label}的${categoryProfile.shortRole}。${palaceProfile.palaceConversion}` +
    `当前盘必须回到主星、四化、宫位关系、庙旺落陷和盘层证据一起判断。`
  const analysisFocus = [
    `${star.palaceFocus}放在${palace.label}时，先回答：${palace.primaryQuestions[0]}`,
    `${palace.label}的主题范围包括${palaceProfile.domainSubjects.join("、")}，${star.label}只能补充这些主题中的助力、压力或细节。`,
    `看${star.label}的优势是否能补强${palace.label}：${star.strengths.join("、")}。`,
    `看${star.label}的风险是否会干扰${palace.label}：${star.risks.join("、")}。`,
    `${palaceProfile.samePalaceFocus}`,
    `${palaceProfile.oppositePalaceFocus}`,
    `${palaceProfile.trineSquareFocus}`,
    `按${categoryProfile.label}规则降权读取，不把${star.label}单独写成该宫最终结论。`
  ]
  const supportiveSignals = [
    ...star.favorableSignals.map((signal) => `${star.label}入${palace.label}时，${signal}。`),
    categoryProfile.supportiveSignal(star.label, palace.label),
    categoryProfile.chartEvidenceUse(star.label, palace.label),
    `若${palace.label}主星清楚、四化不冲突、三方四正有承接，${star.label}可作为该宫的增强证据。`
  ]
  const pressureSignals = [
    ...star.unfavorableSignals.map((signal) => `${star.label}入${palace.label}时，${signal}。`),
    categoryProfile.pressureSignal(star.label, palace.label),
    `若${palace.label}主星失承、对宫冲击、三方煞忌叠加，${star.label}要优先进入复核和降权，不直接放大结论。`
  ]
  const relationUsage = [
    `${star.label}在${palace.label}同宫时先看同宫主星是否承接；若只在对宫或三方四正会入，则作为外部补充证据。`,
    `${palace.relationUsage[0]}因此${star.label}不能脱离对宫、三方四正、夹宫和动态叠盘单独解释。`,
    categoryProfile.relationUsage(star.label, palace.label),
    palaceProfile.samePalaceFocus,
    palaceProfile.trineSquareFocus
  ]
  const dynamicUsage = [
    `${palace.dynamicUsage[0]}动态盘见${star.label}入${palace.label}时，只作为该时间层的触发气候。`,
    "本命层权重最高，大限看十年阶段，流年看年度触发，流月、流日、流时只作短周期提示。",
    categoryProfile.dynamicUsage(star.label),
    palaceProfile.dynamicFocus,
    `若${star.label}只出现在流月、流日或流时，不反推为本命长期结构。`
  ]
  const evidenceFields = [
    "starId",
    "starCategory",
    "sectorName",
    "samePalaceMainStars",
    "samePalaceTransformations",
    "oppositePalaceStars",
    "trineSquareStars",
    "flowType",
    "sourceRuleIds"
  ]
  const cautions = [
    `不要把“${star.label}入${palace.label}”写成单句断语，必须看主星、四化、宫位关系和盘层。`,
    categoryProfile.caution(star.label),
    categoryProfile.brightnessUse(star.label),
    palaceProfile.transformationFocus,
    palaceProfile.brightnessFocus,
    ...palaceProfile.evidenceQuestions.map((question) => `当前盘复核问题：${question}`),
    ...star.readingNotes,
    ...palace.commonMisreads.slice(0, 2)
  ]

  return {
    combinationId,
    sourceReferences,
    category,
    starId,
    starLabel: star.label,
    sectorName,
    palaceLabel: palace.label,
    coreReading,
    categoryRole: categoryProfile.role,
    analysisFocus,
    supportiveSignals,
    pressureSignals,
    relationUsage,
    dynamicUsage,
    evidenceFields,
    cautions,
    sections: buildSections({
      coreReading,
      categoryRole: categoryProfile.role,
      analysisFocus,
      supportiveSignals,
      pressureSignals,
      relationUsage,
      dynamicUsage,
      evidenceFields,
      cautions,
      categoryLabel: categoryProfile.label,
      palaceProfile,
      categoryProfile
    })
  }
}

function getNonMainStarContentDetail(starId: ZiweiStarId): NonMainStarDetail | null {
  return (
    getAssistantStarContentDetail(starId) ??
    getMaleficStarContentDetail(starId) ??
    getMiscStarContentDetail(starId)
  )
}

function getNonMainStarCategory(
  starId: ZiweiStarId
): ZiweiNonMainStarPalaceCombinationCategory {
  if (getAllAssistantStarContentDetails().some((detail) => detail.starId === starId)) {
    return "assistant"
  }

  if (getAllMaleficStarContentDetails().some((detail) => detail.starId === starId)) {
    return "malefic"
  }

  if (getAllMiscStarContentDetails().some((detail) => detail.starId === starId)) {
    return "misc"
  }

  throw new Error(`Unsupported non-main star category: ${starId}`)
}

function getCategoryProfile(category: ZiweiNonMainStarPalaceCombinationCategory): {
  label: string
  shortRole: string
  role: string
  supportiveSignal: (starLabel: string, palaceLabel: string) => string
  pressureSignal: (starLabel: string, palaceLabel: string) => string
  relationUsage: (starLabel: string, palaceLabel: string) => string
  dynamicUsage: (starLabel: string) => string
  brightnessUse: (starLabel: string) => string
  chartEvidenceUse: (starLabel: string, palaceLabel: string) => string
  caution: (starLabel: string) => string
} {
  const profiles = {
    assistant: {
      label: "辅曜入宫",
      shortRole: "助力、贵人、文书、资源或行动支援",
      role:
        "辅曜入宫用于观察该宫有没有助力、贵人、文书、资源、行动或缓冲条件；它负责补强主轴，不替代主星。",
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}有主星承接且会吉曜、禄权科或稳定关系线时，${starLabel}的助力更容易落地。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}主轴虚弱、煞忌重或空劫冲击时，${starLabel}的助力可能变成期待落空或支援不足。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}若夹${palaceLabel}、会${palaceLabel}或进入三方四正，可作为补强证据，但要标明不是本宫主星。`,
      dynamicUsage: (starLabel: string) =>
        `动态盘见${starLabel}时，优先判断是否出现可用帮助、资源窗口、文书机会或行动出口。`,
      brightnessUse: (starLabel: string) =>
        `${starLabel}若有庙旺落陷定义，只用来判断助力是否稳固；没有亮度定义时不强行套表。`,
      chartEvidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，必须同时有主星承接、关系线支援或明确动态触发。`,
      caution: (starLabel: string) =>
        `${starLabel}是助力资料，不要写成必然得贵人、必然获利或必然解决问题。`
    },
    malefic: {
      label: "煞曜入宫",
      shortRole: "压力、冲突、阻滞、损耗或修复入口",
      role:
        "煞曜入宫用于观察该宫的压力、冲突、阻滞、损耗、突发和修复入口；它提示风险，不等同恐吓式结论。",
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}有强主星、吉曜制化或明确目标时，${starLabel}的压力可转为执行、警觉、切割或止损能力。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}再会化忌、空劫、羊陀火铃或关系线受冲时，${starLabel}的阻力和代价需要优先复核。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}若围绕${palaceLabel}的对宫、三方四正或夹宫形成压力链，要记录压力来源和是否有制化，不直接放大成结论。`,
      dynamicUsage: (starLabel: string) =>
        `动态盘见${starLabel}时，短周期只提示当前压力和注意点，不写成长期凶断。`,
      brightnessUse: (starLabel: string) =>
        `${starLabel}若有庙旺落陷定义，只修正压力强弱和可制化程度；不得用亮度输出恐吓结论。`,
      chartEvidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，要同时说明压力来源、是否有制化、是否只是短期触发。`,
      caution: (starLabel: string) =>
        `${starLabel}是风险和修复资料，不要输出恐吓、医疗、法律、财务式断语。`
    },
    misc: {
      label: "杂曜入宫",
      shortRole: "细节气氛、关系触发、名声文书、孤寡桃花或特殊语义",
      role:
        "杂曜入宫用于补充该宫的气氛、细节、关系触发、名声文书、孤寡桃花和特殊语义；它是细节层，不替代主轴。",
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}主轴清楚且有关系证据时，${starLabel}可补充事件气氛、细节触发或特殊主题。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}若煞忌空劫重，${starLabel}的细节语义可能转为纠缠、落空、名声压力或情绪负担。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}更适合作为${palaceLabel}的细节证据，需要和同宫主星、对宫、三方四正一起读。`,
      dynamicUsage: (starLabel: string) =>
        `动态盘见${starLabel}时，优先当作气氛、触发点和人工复核提示。`,
      brightnessUse: (starLabel: string) =>
        `${starLabel}通常不强行论庙旺落陷，除非亮度表已有明确来源；重点看主题触发和组合边界。`,
      chartEvidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，必须说明它补的是气氛、关系、名声、文书、孤寡还是桃花细节。`,
      caution: (starLabel: string) =>
        `${starLabel}是细节资料，不要以杂曜单独决定整宫吉凶。`
    }
  } satisfies Record<
    ZiweiNonMainStarPalaceCombinationCategory,
    {
      label: string
      shortRole: string
      role: string
      supportiveSignal: (starLabel: string, palaceLabel: string) => string
      pressureSignal: (starLabel: string, palaceLabel: string) => string
      relationUsage: (starLabel: string, palaceLabel: string) => string
      dynamicUsage: (starLabel: string) => string
      brightnessUse: (starLabel: string) => string
      chartEvidenceUse: (starLabel: string, palaceLabel: string) => string
      caution: (starLabel: string) => string
    }
  >

  return profiles[category]
}

function buildNonMainStarPalaceCombinationId(
  starId: ZiweiStarId,
  sectorName: SectorName
): string {
  return `non-main-star-palace.${starId}.${sectorName}`
}

function buildSections(input: {
  coreReading: string
  categoryRole: string
  analysisFocus: string[]
  supportiveSignals: string[]
  pressureSignals: string[]
  relationUsage: string[]
  dynamicUsage: string[]
  evidenceFields: string[]
  cautions: string[]
  categoryLabel: string
  palaceProfile: NonMainPalaceReadingProfile
  categoryProfile: ReturnType<typeof getCategoryProfile>
}): ZiweiContentDictionarySection[] {
  return [
    {
      title: "组合本体",
      items: [input.coreReading, input.categoryRole]
    },
    {
      title: "落宫转换",
      items: [
        input.palaceProfile.palaceConversion,
        `${input.categoryLabel}进入该宫时，先降权为辅助证据，再看它补的是助力、压力还是细节。`,
        `该宫主题包括${input.palaceProfile.domainSubjects.join("、")}，不能脱离宫位主题单独解释。`
      ]
    },
    {
      title: "分析重点",
      items: input.analysisFocus
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
      title: "同宫与对宫",
      items: [
        input.palaceProfile.samePalaceFocus,
        input.palaceProfile.oppositePalaceFocus,
        "同宫权重大于会照；对宫表示对象、外部反馈或互相牵制，不能和本宫混成一句。"
      ]
    },
    {
      title: "三方四正",
      items: [
        input.palaceProfile.trineSquareFocus,
        "三方四正用于判断非主星是否只是单点细节，还是已经进入该宫的结构支援或结构压力。",
        "辅曜会照多看支援，煞曜会照多看压力，杂曜会照多看主题气氛和事件触发。"
      ]
    },
    {
      title: "四化与庙旺",
      items: [
        input.palaceProfile.transformationFocus,
        input.palaceProfile.brightnessFocus,
        input.categoryProfile.brightnessUse("该星")
      ]
    },
    {
      title: "宫位关系",
      items: input.relationUsage
    },
    {
      title: "动态盘层级",
      items: input.dynamicUsage
    },
    {
      title: "当前盘证据",
      items: [
        ...input.palaceProfile.evidenceQuestions.map((question) => {
          return `当前盘解释非主星入宫时需要复核：${question}`
        }),
        `证据字段包括：${input.evidenceFields.join("、")}。`
      ]
    },
    {
      title: "误读边界",
      items: input.cautions
    }
  ]
}
