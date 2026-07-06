import type { SectorName, ZiweiStarId } from "../../contracts"
import {
  DAILY_HOURLY_STAR_IDS,
  LIFECYCLE_STAR_IDS,
  MONTHLY_STAR_IDS,
  YEARLY_STAR_IDS
} from "../../star-catalog"

import type {
  ZiweiContentDictionarySection,
  ZiweiPeriodicStarPalaceCombinationContentDetail,
  ZiweiPeriodicStarPalaceCombinationGroup
} from "./content-detail-types"
import {
  getAllPeriodicStarContentDetails,
  getPeriodicStarContentDetail
} from "./periodic-star-meaning-catalog"
import {
  getPalaceContentDetail,
  ZIWEI_PALACE_ORDER
} from "./palace-meaning-catalog"
import { buildPeriodicStarPalaceCombinationSourceReferences } from "./content-source-reference-map"

const BOSHI_STAR_IDS = [
  YEARLY_STAR_IDS.boshi,
  YEARLY_STAR_IDS.lishi,
  YEARLY_STAR_IDS.qinglong,
  YEARLY_STAR_IDS.xiaohao,
  YEARLY_STAR_IDS.jiangjun,
  YEARLY_STAR_IDS.zoushu,
  YEARLY_STAR_IDS.feilian,
  YEARLY_STAR_IDS.xishen,
  YEARLY_STAR_IDS.bingfu,
  YEARLY_STAR_IDS.dahao,
  YEARLY_STAR_IDS.fubing,
  YEARLY_STAR_IDS.guanfu
] as const

const SUIQIAN_STAR_IDS = [
  YEARLY_STAR_IDS.suijian,
  YEARLY_STAR_IDS.huiqi,
  YEARLY_STAR_IDS.sangmen,
  YEARLY_STAR_IDS.guansuo,
  YEARLY_STAR_IDS.suiGuanfu,
  YEARLY_STAR_IDS.suiXiaohao,
  YEARLY_STAR_IDS.suiDahao,
  YEARLY_STAR_IDS.longde,
  YEARLY_STAR_IDS.baihu,
  YEARLY_STAR_IDS.tiande,
  YEARLY_STAR_IDS.diaoke,
  YEARLY_STAR_IDS.suiBingfu
] as const

const JIANGQIAN_STAR_IDS = [
  YEARLY_STAR_IDS.jiangxing,
  YEARLY_STAR_IDS.panan,
  YEARLY_STAR_IDS.suiyi,
  YEARLY_STAR_IDS.xishenRest,
  YEARLY_STAR_IDS.huagai,
  YEARLY_STAR_IDS.jiesha,
  YEARLY_STAR_IDS.zaisha,
  YEARLY_STAR_IDS.tiansha,
  YEARLY_STAR_IDS.zhibei,
  YEARLY_STAR_IDS.xianchi,
  YEARLY_STAR_IDS.yuesha,
  YEARLY_STAR_IDS.wangshen
] as const

interface PeriodicPalaceReadingProfile {
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

interface PeriodicGroupProfile {
  label: string
  shortRole: string
  role: string
  timingUsage: (starLabel: string, palaceLabel: string) => string
  supportiveSignal: (starLabel: string, palaceLabel: string) => string
  pressureSignal: (starLabel: string, palaceLabel: string) => string
  relationUsage: (starLabel: string, palaceLabel: string) => string
  dynamicUsage: (starLabel: string) => string
  layerBoundary: (starLabel: string) => string
  evidenceUse: (starLabel: string, palaceLabel: string) => string
  caution: (starLabel: string) => string
}

const PERIODIC_PALACE_READING_PROFILES: Record<
  SectorName,
  PeriodicPalaceReadingProfile
> = {
  life: {
    domainSubjects: ["自我主轴", "决策方式", "命身承接", "阶段状态"],
    palaceConversion: "周期星入命宫时，只提示该时间层的本人状态、阶段气候和短期触发，不改写本命命宫结构。",
    samePalaceFocus: "同宫先看本命或当前动态命宫主星，再看周期星是在加重、缓和、推进还是提醒。",
    oppositePalaceFocus: "对宫迁移说明外部环境如何触发这一时间层的本人状态。",
    trineSquareFocus: "三方四正看时间气候是否牵动财务、事业、外部行动和命身承接。",
    transformationFocus: "若同层四化也触发命宫，先看四化目标星，再把周期星当作时间气候和复核入口。",
    brightnessFocus: "周期星不套主星庙旺落陷；长生看气势阶段，年/月/日时星看盘层来源。",
    dynamicFocus: "动态命宫见周期星时，必须标明原盘、大限、流年、流月、流日或流时层级。",
    evidenceQuestions: ["它属于哪一层盘？", "是否只是一时气候？", "有没有上级盘层共同支持？"]
  },
  siblings: {
    domainSubjects: ["手足", "同辈", "近身协作", "横向沟通"],
    palaceConversion: "周期星入兄弟宫时，提示该时间层的同辈协作、沟通气候、手足事务或团队近身互动。",
    samePalaceFocus: "同宫看同辈议题是否被本层时间星启动，不能直接写成长期手足关系。",
    oppositePalaceFocus: "对宫交友说明外部团队和近身同辈是否在该时间层互相牵动。",
    trineSquareFocus: "三方四正看同辈议题是否牵动资源、事业、家宅或沟通压力。",
    transformationFocus: "同层四化触发时，看同辈分工、文书、利益往来和沟通牵挂。",
    brightnessFocus: "周期星不按兄弟宫单独定吉凶，只看时间层级和主星承接。",
    dynamicFocus: "年系看年度同辈事务，月系看当月沟通，日时系只看临时互动。",
    evidenceQuestions: ["是年度团队事还是短期沟通？", "同辈主轴由什么星承接？", "对宫交友是否参与？"]
  },
  spouse: {
    domainSubjects: ["伴侣", "一对一合作", "契约关系", "亲密互动"],
    palaceConversion: "周期星入夫妻宫时，提示该时间层的关系气候、合作触发、契约进退或短期互动状态。",
    samePalaceFocus: "同宫先看夫妻宫主星和本层四化，再看周期星是加强关系议题还是只作气氛提醒。",
    oppositePalaceFocus: "对宫官禄说明事业责任和公共角色如何在该时间层影响关系。",
    trineSquareFocus: "三方四正看福德、迁移、命宫是否支撑或干扰关系气候。",
    transformationFocus: "同层四化触发时，看关系里的资源、责任、名誉和牵挂。",
    brightnessFocus: "周期星不直接判断婚姻结果；桃花、煞类年星也必须降权复核。",
    dynamicFocus: "流年看年度关系主题，流月看当月互动，流日流时只看临场沟通。",
    evidenceQuestions: ["关系议题是否被上级盘层支持？", "是合作契约还是亲密互动？", "官禄对宫是否施压？"]
  },
  children: {
    domainSubjects: ["子女", "作品", "创造延伸", "照护对象"],
    palaceConversion: "周期星入子女宫时，提示该时间层的作品推进、子女照护、创造反馈或下属学生事务。",
    samePalaceFocus: "同宫看时间星是否触发成果交付、照护安排、作品节奏或短期反馈。",
    oppositePalaceFocus: "对宫田宅说明家庭根基和生活空间是否承接该时间层的子女或作品议题。",
    trineSquareFocus: "三方四正看成果是否牵动资源、名声、项目和家庭结构。",
    transformationFocus: "同层四化触发时，看作品、子女、下属和照护中的得失牵动。",
    brightnessFocus: "周期星不用于判断生育数量，只作阶段或时间触发。",
    dynamicFocus: "年系看年度产出与照护，月日时看短期交付和反馈。",
    evidenceQuestions: ["它指向子女还是作品？", "成果能否被上层盘承接？", "家庭根基是否参与？"]
  },
  wealth: {
    domainSubjects: ["收入", "现金流", "资源配置", "价值交换"],
    palaceConversion: "周期星入财帛宫时，提示该时间层的收支气候、资源调配、临时成本或年度财务事件。",
    samePalaceFocus: "同宫看财务主星和四化，再判断周期星是资源窗口、耗损提醒还是短期付款。",
    oppositePalaceFocus: "对宫福德说明享受欲望和内在满足如何在该时间层牵动收支。",
    trineSquareFocus: "三方四正看事业、命宫、迁移是否把资源机会转成实际现金流。",
    transformationFocus: "同层四化触发时，看收入、支出、权责成本、名誉换利和牵挂损耗。",
    brightnessFocus: "周期星不直接断财富总额；耗星也只作该时间层成本提示。",
    dynamicFocus: "流年看年度预算和大项，流月看当月收支，流日流时看临时付款与资源调度。",
    evidenceQuestions: ["这是年度成本还是短期花费？", "财务主轴是否稳定？", "财福线是否互相拉扯？"]
  },
  health: {
    domainSubjects: ["身体状态", "压力承接", "隐患", "修复节奏"],
    palaceConversion: "周期星入疾厄宫时，只作该时间层的压力、疲劳、修复、作息和健康管理提醒，不作医疗诊断。",
    samePalaceFocus: "同宫看疾厄主星、煞忌和周期星是否共同提示短期承压或年度保养。",
    oppositePalaceFocus: "对宫父母说明制度、长辈、文书和背景压力是否影响身心承接。",
    trineSquareFocus: "三方四正看工作、家庭、福德和生活节奏是否共同加压。",
    transformationFocus: "同层四化触发时，看压力牵挂、修复资源、作息和现实检查需求。",
    brightnessFocus: "病符类、病耗类只作风险提醒，不输出病名；长生看气势，不等于诊断。",
    dynamicFocus: "年系看年度健康管理，月系看当月疲劳，日时系只看当天临时状态。",
    evidenceQuestions: ["压力属于哪一层级？", "有没有修复资源？", "是否需要现实健康检查？"]
  },
  travel: {
    domainSubjects: ["外部环境", "迁动", "出行", "对外发展"],
    palaceConversion: "周期星入迁移宫时，提示该时间层的出行、迁动、外部环境、异地机会和短期奔波。",
    samePalaceFocus: "同宫看人在外的主星表现，再看周期星是行动窗口、奔波压力还是环境气候。",
    oppositePalaceFocus: "对宫命宫说明外部环境如何反向影响本人状态。",
    trineSquareFocus: "三方四正看外部机会是否连接财务、事业、关系和行动结果。",
    transformationFocus: "同层四化触发时，看外部资源、权责、名声曝光和出行牵挂。",
    brightnessFocus: "周期星不直接断搬迁，必须有动象、四马、天马或动态命宫证据支持。",
    dynamicFocus: "年系看年度迁动，月系看当月出行，日时系只看短程临场变化。",
    evidenceQuestions: ["动象证据是否足够？", "迁移是否由上层盘支持？", "命迁线是否一致？"]
  },
  friends: {
    domainSubjects: ["朋友", "团队", "社群", "外部协作"],
    palaceConversion: "周期星入交友宫时，提示该时间层的团队变动、人脉活动、客户协作或社群气候。",
    samePalaceFocus: "同宫看交友主星与时间星是否共同触发团队支持、内耗、聚会或合作窗口。",
    oppositePalaceFocus: "对宫兄弟说明近身同辈与外部社群是否互相牵动。",
    trineSquareFocus: "三方四正看人脉是否影响事业、财务、迁移和阶段机会。",
    transformationFocus: "同层四化触发时，看团队、人脉、客户、朋友中的资源和牵挂。",
    brightnessFocus: "周期星不直接断朋友好坏，只看该时间层社群事件和团队气候。",
    dynamicFocus: "年系看年度团队主线，月系看当月社群活动，日时系看临时协作。",
    evidenceQuestions: ["团队事属于哪一层？", "人脉是助力还是成本？", "兄弟交友是否互证？"]
  },
  career: {
    domainSubjects: ["事业定位", "职责", "职业路径", "公共表现"],
    palaceConversion: "周期星入官禄宫时，提示该时间层的工作节点、考核、职责变化、项目推进和公共评价。",
    samePalaceFocus: "同宫先看官禄主星和四化，再看周期星是年度事务、月度节点还是临场任务。",
    oppositePalaceFocus: "对宫夫妻说明事业责任如何影响合作和一对一关系。",
    trineSquareFocus: "三方四正看命宫、财帛、迁移是否共同支撑事业落地。",
    transformationFocus: "同层四化触发时，看职务、权责、名誉、考核和事业牵挂。",
    brightnessFocus: "周期星不直接断职业高低，只提示该时间层的事业气候。",
    dynamicFocus: "流年看年度事业主题，流月看项目节点，流日流时看会议、交付和反馈。",
    evidenceQuestions: ["事业主轴由哪颗星承担？", "这是年度转折还是短期节点？", "财官线是否成形？"]
  },
  property: {
    domainSubjects: ["家庭根基", "居住环境", "不动产", "长期承载"],
    palaceConversion: "周期星入田宅宫时，提示该时间层的家宅事务、居住安排、资产维护和家庭气候。",
    samePalaceFocus: "同宫看田宅主星，再判断周期星是家事启动、修缮压力、搬动气候还是短期整理。",
    oppositePalaceFocus: "对宫子女说明家庭根基如何承接作品、子女和创造延伸。",
    trineSquareFocus: "三方四正看家宅是否影响财务、福德、事业和长期稳定。",
    transformationFocus: "同层四化触发时，看房产、家事、长期资产和家庭责任流向。",
    brightnessFocus: "周期星不直接断房产数量；耗损类只作该时间层成本提示。",
    dynamicFocus: "年系看年度家宅事务，月系看当月空间安排，日时系看临时家事。",
    evidenceQuestions: ["家宅议题属于哪一层？", "是资产还是居住安排？", "田宅子女线是否触发？"]
  },
  fortune: {
    domainSubjects: ["精神状态", "内在满足", "享受能力", "长期福分"],
    palaceConversion: "周期星入福德宫时，提示该时间层的精神气候、休息状态、情绪波动、信念和修复节奏。",
    samePalaceFocus: "同宫看福德主星，再判断周期星是舒缓、内耗、享受、独处还是短期情绪触发。",
    oppositePalaceFocus: "对宫财帛说明资源和消费欲望如何影响精神状态。",
    trineSquareFocus: "三方四正看命宫、夫妻、迁移等外部压力如何影响内在稳定。",
    transformationFocus: "同层四化触发时，看享受、信念、情绪、资源欲望和精神牵挂。",
    brightnessFocus: "周期星不作心理诊断；只说明该时间层的精神气候和修复边界。",
    dynamicFocus: "年系看年度精神主题，月系看当月心境，日时系看临场情绪和休息状态。",
    evidenceQuestions: ["精神气候是否由上层盘支持？", "财福是否拉扯？", "是否有修复路径？"]
  },
  parents: {
    domainSubjects: ["父母长辈", "背景支持", "文书制度", "上级关系"],
    palaceConversion: "周期星入父母宫时，提示该时间层的长辈事务、上级反馈、文书证照、审批流程和制度气候。",
    samePalaceFocus: "同宫看父母宫主星和四化，再判断周期星是文书窗口、制度压力还是长辈消息。",
    oppositePalaceFocus: "对宫疾厄说明背景制度如何影响身心承压。",
    trineSquareFocus: "三方四正看长辈资源、文书制度、事业、田宅和福德的牵动。",
    transformationFocus: "同层四化触发时，看上级、文件、长辈、制度责任和背景资源变化。",
    brightnessFocus: "周期星不直接断家庭关系，只看该时间层的文书、制度和长辈触发。",
    dynamicFocus: "年系看年度文书制度，月系看当月审批消息，日时系看即时反馈。",
    evidenceQuestions: ["是长辈事还是文书制度？", "父母疾厄线是否互相牵动？", "是否只是短期消息？"]
  }
}

export const ZIWEI_PERIODIC_STAR_PALACE_COMBINATION_DETAILS: Record<
  string,
  ZiweiPeriodicStarPalaceCombinationContentDetail
> = Object.fromEntries(
  getAllPeriodicStarContentDetails().flatMap((star) => {
    return ZIWEI_PALACE_ORDER.map((sectorName) => {
      const detail = buildPeriodicStarPalaceCombinationDetail(star.starId, sectorName)

      return [detail.combinationId, detail]
    })
  })
)

export function getPeriodicStarPalaceCombinationContentDetail(
  starId: ZiweiStarId,
  sectorName: SectorName
): ZiweiPeriodicStarPalaceCombinationContentDetail | null {
  return ZIWEI_PERIODIC_STAR_PALACE_COMBINATION_DETAILS[
    buildPeriodicStarPalaceCombinationId(starId, sectorName)
  ] ?? null
}

export function getAllPeriodicStarPalaceCombinationContentDetails(): ZiweiPeriodicStarPalaceCombinationContentDetail[] {
  return getAllPeriodicStarContentDetails().flatMap((star) => {
    return ZIWEI_PALACE_ORDER.map((sectorName) => {
      const detail = getPeriodicStarPalaceCombinationContentDetail(star.starId, sectorName)

      if (!detail) {
        throw new Error(`Missing periodic star palace combination: ${star.starId} ${sectorName}`)
      }

      return detail
    })
  })
}

function buildPeriodicStarPalaceCombinationDetail(
  starId: ZiweiStarId,
  sectorName: SectorName
): ZiweiPeriodicStarPalaceCombinationContentDetail {
  const star = getPeriodicStarContentDetail(starId)
  const palace = getPalaceContentDetail(sectorName)

  if (!star || !palace) {
    throw new Error(`Cannot build periodic star palace combination: ${starId} ${sectorName}`)
  }

  const group = getPeriodicGroup(starId)
  const groupProfile = getGroupProfile(group)
  const palaceProfile = PERIODIC_PALACE_READING_PROFILES[sectorName]
  const combinationId = buildPeriodicStarPalaceCombinationId(starId, sectorName)
  const sourceReferences = buildPeriodicStarPalaceCombinationSourceReferences()
  const coreReading =
    `${star.label}入${palace.label}时，先把${star.label}的${star.coreThemes.join("、")}转译到${palace.corePosition}。` +
    `它属于${groupProfile.label}，作用是提示${palace.label}在对应时间层的${groupProfile.shortRole}，不是本命主轴。${palaceProfile.palaceConversion}`
  const timingUsage = [
    groupProfile.timingUsage(star.label, palace.label),
    "必须保留 placement source、flowType、sourceRuleIds 和当前查看盘层。",
    "短周期星曜只能降权作提示，不能替代本命、大限和流年主线。",
    groupProfile.layerBoundary(star.label)
  ]
  const analysisFocus = [
    `${star.palaceFocus}放在${palace.label}时，先回答：${palace.primaryQuestions[0]}`,
    `${palace.label}的主题范围包括${palaceProfile.domainSubjects.join("、")}，周期星只能说明这些主题在当前时间层的气候。`,
    `看${star.label}的阶段或流动语义是否能服务${palace.label}：${star.strengths.join("、")}。`,
    `看${star.label}的风险是否会变成${palace.label}的短期压力：${star.risks.join("、")}。`,
    palaceProfile.samePalaceFocus,
    palaceProfile.oppositePalaceFocus,
    palaceProfile.trineSquareFocus,
    `按${groupProfile.label}层级读取，不把周期流系星曜写成固定命格。`
  ]
  const supportiveSignals = [
    ...star.favorableSignals.map((signal) => `${star.label}入${palace.label}时，${signal}。`),
    groupProfile.supportiveSignal(star.label, palace.label),
    groupProfile.evidenceUse(star.label, palace.label),
    `若${palace.label}的本命主星、大限背景和当前流层互相支持，${star.label}可作为该时间层的增强证据。`
  ]
  const pressureSignals = [
    ...star.unfavorableSignals.map((signal) => `${star.label}入${palace.label}时，${signal}。`),
    groupProfile.pressureSignal(star.label, palace.label),
    `若${palace.label}的上级盘层不支持，或只在流日流时短暂出现，${star.label}必须降权为提醒和复核入口。`
  ]
  const relationUsage = [
    `${star.label}在${palace.label}同宫时先看当前盘层是否启用；会入对宫或三方四正时，只作为该时间层的补充证据。`,
    `${palace.relationUsage[0]}因此${star.label}必须和命宫、大限命宫、流年命宫或当前动态命宫一起复核。`,
    groupProfile.relationUsage(star.label, palace.label),
    palaceProfile.samePalaceFocus,
    palaceProfile.trineSquareFocus
  ]
  const dynamicUsage = [
    `${palace.dynamicUsage[0]}周期流系星曜必须按照来源盘层读取。`,
    groupProfile.dynamicUsage(star.label),
    palaceProfile.dynamicFocus,
    "流月、流日、流时只提示短周期气候和复核入口，不输出长期结论。",
    `当前查看盘层若不是${groupProfile.label}对应层级，${star.label}只保留为资料字典内容，不进入当前盘强结论。`
  ]
  const evidenceFields = [
    "starId",
    "periodicGroup",
    "sectorName",
    "flowType",
    "placementSource",
    "sourceRuleIds",
    "samePalaceMainStars",
    "samePalaceTransformations",
    "oppositePalaceStars",
    "trineSquareStars"
  ]
  const cautions = [
    `不要把“${star.label}入${palace.label}”写成本命长期断语。`,
    groupProfile.caution(star.label),
    palaceProfile.transformationFocus,
    palaceProfile.brightnessFocus,
    ...palaceProfile.evidenceQuestions.map((question) => `当前盘复核问题：${question}`),
    ...star.readingNotes,
    ...palace.commonMisreads.slice(0, 2)
  ]

  return {
    combinationId,
    sourceReferences,
    group,
    starId,
    starLabel: star.label,
    sectorName,
    palaceLabel: palace.label,
    coreReading,
    groupRole: groupProfile.role,
    timingUsage,
    analysisFocus,
    supportiveSignals,
    pressureSignals,
    relationUsage,
    dynamicUsage,
    evidenceFields,
    cautions,
    sections: buildSections({
      coreReading,
      groupRole: groupProfile.role,
      timingUsage,
      analysisFocus,
      supportiveSignals,
      pressureSignals,
      relationUsage,
      dynamicUsage,
      evidenceFields,
      cautions,
      groupLabel: groupProfile.label,
      groupProfile,
      palaceProfile
    })
  }
}

function getPeriodicGroup(starId: ZiweiStarId): ZiweiPeriodicStarPalaceCombinationGroup {
  if (Object.values(LIFECYCLE_STAR_IDS).includes(starId as never)) {
    return "lifecycle"
  }

  if ((BOSHI_STAR_IDS as readonly string[]).includes(starId)) {
    return "boshi"
  }

  if ((SUIQIAN_STAR_IDS as readonly string[]).includes(starId)) {
    return "suiqian"
  }

  if ((JIANGQIAN_STAR_IDS as readonly string[]).includes(starId)) {
    return "jiangqian"
  }

  if (Object.values(MONTHLY_STAR_IDS).includes(starId as never)) {
    return "monthly"
  }

  if (Object.values(DAILY_HOURLY_STAR_IDS).includes(starId as never)) {
    return "dailyHourly"
  }

  throw new Error(`Unsupported periodic star group: ${starId}`)
}

function getGroupProfile(
  group: ZiweiPeriodicStarPalaceCombinationGroup
): PeriodicGroupProfile {
  const profiles = {
    lifecycle: {
      label: "长生十二神入宫",
      shortRole: "气势阶段、成熟度和生命周期提示",
      role: "长生十二神入宫用于观察该宫主题的发生、成长、旺盛、衰退、收藏和再孕育阶段。",
      timingUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}主要提示该宫主题的气势阶段和成熟度。`,
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}主星稳定且关系线清楚时，${starLabel}可帮助判断主题推进阶段。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}煞忌空劫重时，${starLabel}的阶段语义可能表现为卡顿、衰退或转折压力。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}要和${palaceLabel}的三方四正一起看气势是否能流通。`,
      dynamicUsage: (starLabel: string) =>
        `${starLabel}在动态盘中只说明该时间层的阶段气候，不改变本命星曜。`,
      layerBoundary: (starLabel: string) =>
        `${starLabel}属于气势阶段资料，可用于本命或动态盘的阶段辅助，但不能替代主星和四化。`,
      evidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，必须说明该宫主题处于发生、旺盛、衰退、收藏还是再孕育。`,
      caution: (starLabel: string) =>
        `${starLabel}是阶段资料，不要把阶段词直接写成吉凶结果。`
    },
    boshi: {
      label: "博士十二神入宫",
      shortRole: "年度资源、行政事务、文书、耗损和事务细节",
      role: "博士十二神入宫用于观察流年禄存系带来的年度事务、资源、文书、耗损和行政细节。",
      timingUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}必须按流年层读取，适合提示该宫年度事务。`,
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}流年主线清楚且会吉化时，${starLabel}的年度事务更容易落地。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}会流年忌煞时，${starLabel}可能提示年度事务压力或成本。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}要和${palaceLabel}的流年命宫、流年四化和年度关系线一起复核。`,
      dynamicUsage: (starLabel: string) =>
        `${starLabel}只在年度语境中加权，不写成本命固定习惯。`,
      layerBoundary: (starLabel: string) =>
        `${starLabel}属于流年禄存系年度资料，只进入流年和年度复核，不进入本命长期定性。`,
      evidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，要说明年度事务、文书、资源、耗损或行政细节。`,
      caution: (starLabel: string) =>
        `${starLabel}是流年事务资料，不要脱离流年盘层。`
    },
    suiqian: {
      label: "岁前十二神入宫",
      shortRole: "太岁环境、年度气候、外部触发和修复边界",
      role: "岁前十二神入宫用于观察太岁前后带来的年度环境气候、外部压力、贵德修复和岁运提醒。",
      timingUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}提示年度外部环境如何触发该宫主题。`,
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}有吉曜、德曜或化科缓和时，${starLabel}的环境压力较容易转化。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}受煞忌冲击时，${starLabel}的岁运气候需要列为复核重点。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}要和${palaceLabel}的太岁、流年命宫和三方四正一起看。`,
      dynamicUsage: (starLabel: string) =>
        `${starLabel}用于年度环境提示，不用于长期命盘判断。`,
      layerBoundary: (starLabel: string) =>
        `${starLabel}属于岁前年度环境资料，只说明太岁气候和外部触发。`,
      evidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，要说明外部环境、岁运气候、贵德修复或压力来源。`,
      caution: (starLabel: string) =>
        `${starLabel}是岁运气候资料，遇不利词也不能直接做灾断。`
    },
    jiangqian: {
      label: "将前十二神入宫",
      shortRole: "年度行动、迁动、人际暗线、桃花孤高和风险提示",
      role: "将前十二神入宫用于观察流年三合将星系统带来的行动、迁动、人际暗线和风险提示。",
      timingUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}提示年度行动线、人际暗线或风险线索。`,
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}主星能承接且行动线清楚时，${starLabel}可帮助判断年度推进方式。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}会煞忌或关系线混乱时，${starLabel}可能提示隐藏压力和边界问题。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}要按将前系统和${palaceLabel}的三方四正一起看，不和博士、岁前混读。`,
      dynamicUsage: (starLabel: string) =>
        `${starLabel}只作为年度行动与风险补充，不替代流年主线。`,
      layerBoundary: (starLabel: string) =>
        `${starLabel}属于将前年度行动线资料，必须按三合将星系统和流年主线降权读取。`,
      evidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，要说明年度行动、迁动、人际暗线或风险线索。`,
      caution: (starLabel: string) =>
        `${starLabel}是将前系统资料，不要把桃花、孤寡、煞类词绝对化。`
    },
    monthly: {
      label: "月系星曜入宫",
      shortRole: "月度短周期、情绪气候、短期修复和月度压力",
      role: "月系星曜入宫用于观察流月层面的短期情绪、修复、牵动和压力。",
      timingUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}只按流月层读取，提示当月该宫状态。`,
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}流月吉化或上级盘层稳定时，${starLabel}可作为短期缓冲或提醒。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}流月忌煞重时，${starLabel}提示当月压力和情绪波动。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}要和${palaceLabel}的流月命宫、流年背景和大限背景一起降权读取。`,
      dynamicUsage: (starLabel: string) =>
        `${starLabel}用于月度提醒，不写成年度或本命结论。`,
      layerBoundary: (starLabel: string) =>
        `${starLabel}属于流月资料，只说明当月短周期状态，必须服从流年和大限。`,
      evidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，要说明当月情绪、修复、牵动或短期压力。`,
      caution: (starLabel: string) =>
        `${starLabel}是月度资料，不能放大为长期命格。`
    },
    dailyHourly: {
      label: "日时系星曜入宫",
      shortRole: "日时微周期、临场反馈、即时帮助和短时扰动",
      role: "日时系星曜入宫用于观察流日、流时层面的临场反馈、即时协助和短时干扰。",
      timingUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}只按流日或流时读取，提示即时气候。`,
      supportiveSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}短周期关系线清楚时，${starLabel}可作为临场顺手或即时帮助。`,
      pressureSignal: (starLabel: string, palaceLabel: string) =>
        `${palaceLabel}短周期受冲时，${starLabel}提示临时干扰和需要降速。`,
      relationUsage: (starLabel: string, palaceLabel: string) =>
        `${starLabel}要和${palaceLabel}的流日、流时命宫和即时三方四正一起看。`,
      dynamicUsage: (starLabel: string) =>
        `${starLabel}只做即时提示，不进入长期报告主结论。`,
      layerBoundary: (starLabel: string) =>
        `${starLabel}属于流日或流时资料，只说明临场反馈和微周期扰动。`,
      evidenceUse: (starLabel: string, palaceLabel: string) =>
        `${starLabel}在${palaceLabel}成有效证据时，只能说明即时帮助、临场反馈或短时干扰。`,
      caution: (starLabel: string) =>
        `${starLabel}是微周期资料，不能上升为长期判断。`
    }
  } satisfies Record<ZiweiPeriodicStarPalaceCombinationGroup, PeriodicGroupProfile>

  return profiles[group]
}

function buildPeriodicStarPalaceCombinationId(
  starId: ZiweiStarId,
  sectorName: SectorName
): string {
  return `periodic-star-palace.${starId}.${sectorName}`
}

function buildSections(input: {
  coreReading: string
  groupRole: string
  timingUsage: string[]
  analysisFocus: string[]
  supportiveSignals: string[]
  pressureSignals: string[]
  relationUsage: string[]
  dynamicUsage: string[]
  evidenceFields: string[]
  cautions: string[]
  groupLabel: string
  groupProfile: PeriodicGroupProfile
  palaceProfile: PeriodicPalaceReadingProfile
}): ZiweiContentDictionarySection[] {
  return [
    {
      title: "组合本体",
      items: [input.coreReading, input.groupRole]
    },
    {
      title: "时间层级",
      items: input.timingUsage
    },
    {
      title: "落宫转换",
      items: [
        input.palaceProfile.palaceConversion,
        `${input.groupLabel}进入该宫时，先确认盘层，再把时间气候转成该宫的阶段、年度、月度或临场议题。`,
        `该宫主题包括${input.palaceProfile.domainSubjects.join("、")}，周期星只解释这些主题在时间层里的触发。`
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
        "同宫看当前盘层的直接触发，对宫看对象、外部反馈和互相牵制；周期星不能越级替代本宫主星。"
      ]
    },
    {
      title: "三方四正",
      items: [
        input.palaceProfile.trineSquareFocus,
        "三方四正用于判断时间气候是否进入结构层；只有单点短周期证据时，必须降权为提醒。",
        "年系会照看年度结构，月日时会照只作短周期复核。"
      ]
    },
    {
      title: "四化与庙旺",
      items: [
        input.palaceProfile.transformationFocus,
        input.palaceProfile.brightnessFocus,
        input.groupProfile.layerBoundary("该星")
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
          return `当前盘解释周期星入宫时需要复核：${question}`
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

