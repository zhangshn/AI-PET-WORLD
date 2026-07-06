import type { HeavenlyStem } from "../../contracts"

import type {
  ZiweiContentDictionarySection,
  ZiweiStemContentDetail
} from "./content-detail-types"
import { buildStemDictionarySourceReferences } from "./content-source-reference-map"

export const ZIWEI_STEM_ORDER: HeavenlyStem[] = [
  "jia",
  "yi",
  "bing",
  "ding",
  "wu",
  "ji",
  "geng",
  "xin",
  "ren",
  "gui"
]

export const ZIWEI_STEM_CONTENT_DETAILS: Record<
  HeavenlyStem,
  ZiweiStemContentDetail
> = {
  jia: stem({
    stem: "jia",
    label: "甲",
    yinYang: "yang",
    element: "wood",
    pairGroup: "甲乙木",
    nature: "甲为阳木，象大树、栋梁、开端、原则和向上生发。紫微斗数中看天干时，甲常用于观察流干四化、宫干触发、阶段起势和规则性生长。",
    symbolicMeanings: ["开端", "栋梁", "原则", "成长", "主干", "向上"],
    transformationUsage: ["甲干触发四化时，要先看化禄、化权、化科、化忌分别落到哪颗星，再回到对应宫位和三方四正。", "甲木阳性强，四化表现常带开局、树立、承担和明确方向的味道。"],
    palaceStemUsage: ["宫干为甲时，该宫主题常带主动生发、定规矩、立主轴和向外展开的倾向。", "若宫内主星稳定，甲干可强化该宫的组织骨架；若煞忌重，则需看原则僵硬和开局压力。"],
    dynamicUsage: ["大限、流年、流月等流干为甲时，观察该层四化是否推动新阶段、新责任或新结构。", "甲干动态不等于必然顺利，它只是提示事件更容易以开端、主导和树立规则的方式出现。"],
    combinationUsage: ["甲木遇火象星曜时常带表现和推动，遇金象压力时要看修剪、规则和冲突。", "甲与庚冲象明显，读盘时可复核木金之间的生长和裁断。"],
    cautions: ["不要把天干五行直接等同于星曜好坏。", "天干必须和四化目标、宫位主题、星曜性质和盘层一起读。"]
  }),
  yi: stem({
    stem: "yi",
    label: "乙",
    yinYang: "yin",
    element: "wood",
    pairGroup: "甲乙木",
    nature: "乙为阴木，象藤蔓、花草、柔性生长、关系连接和细密调整。紫微斗数中，乙干常用于观察四化带来的协调、修饰、转圜和渐进发展。",
    symbolicMeanings: ["柔性", "协调", "修饰", "关系", "渐进", "韧性"],
    transformationUsage: ["乙干四化要看资源、权责、名誉或牵挂是否以柔性协商、文书、人际和细节方式表现。", "乙木不以硬冲为主，常通过关系网络和持续调整来改变盘面。"],
    palaceStemUsage: ["宫干为乙时，该宫主题更重细节经营、关系协调、审美修饰和柔性生长。", "若煞曜同宫，乙木也可能表现为纠缠、绕行、犹豫或反复修补。"],
    dynamicUsage: ["流干为乙时，动态事件常需要耐心铺垫、协调关系、修补文字或处理细碎流程。", "乙干触发到桃花曜、文曜或辅曜时，尤其要看表达、人情和审美。"],
    combinationUsage: ["乙木遇水可看滋养与情绪流动，遇金要看修剪、规范和被限制。", "乙与辛冲象明显，柔性表达和精细裁断之间的拉扯要复核。"],
    cautions: ["乙木柔不等于弱，柔性结构也可能很坚韧。", "读乙干不能只看人际，要回到四化目标星和宫位事实。"]
  }),
  bing: stem({
    stem: "bing",
    label: "丙",
    yinYang: "yang",
    element: "fire",
    pairGroup: "丙丁火",
    nature: "丙为阳火，象太阳、光明、公开、热度和外放表现。紫微斗数中，丙干常用于观察曝光、推动、名声、行动力和事件被看见的程度。",
    symbolicMeanings: ["光明", "公开", "热度", "表现", "推动", "声名"],
    transformationUsage: ["丙干四化要看目标星是否把事件推到台前，是否形成曝光、名誉、行动或情绪热度。", "化忌落在丙火语境下时，常需复核急躁、过热、面子和公开压力。"],
    palaceStemUsage: ["宫干为丙时，该宫主题容易外显、需要表现，也容易受到关注和评价。", "若宫位为官禄、迁移、交友，丙火常让社会场域和表达需求变强。"],
    dynamicUsage: ["流干为丙时，事件常以明显、快速、公开的方式出现，适合观察阶段热度和行动窗口。", "丙火动态遇煞忌时，要复核冲动决策、过度曝光和消耗。"],
    combinationUsage: ["丙火遇木得生，常看推动和扩散；遇水则看冷却、情绪和压力回落。", "丙与壬冲象明显，公开热度和暗流压力之间需要平衡。"],
    cautions: ["丙火不是必然吉，过亮也可能烧灼。", "不要只因丙火就输出名利结论，仍要看目标星和宫位。"]
  }),
  ding: stem({
    stem: "ding",
    label: "丁",
    yinYang: "yin",
    element: "fire",
    pairGroup: "丙丁火",
    nature: "丁为阴火，象灯烛、灵感、专注、细腻热度和持续照明。紫微斗数中，丁干常用于观察精神火光、技术专注、内在热情和小范围影响。",
    symbolicMeanings: ["灯火", "灵感", "专注", "细腻", "温度", "内热"],
    transformationUsage: ["丁干四化要看事件是否由灵感、技术、文书、情感温度或局部聚焦引发。", "丁火的化忌常不一定外爆，可能表现为心火、焦虑、执念或暗中耗神。"],
    palaceStemUsage: ["宫干为丁时，该宫主题常带细腻经营、精神投入、审美温度和局部照明。", "若配文昌文曲化科类信号，可看创作、学习、表达和专业技艺。"],
    dynamicUsage: ["流干为丁时，短周期里要看灵感、专注、夜间事务、文书细节和情感温度。", "丁火触发压力星时，需复核内耗、焦躁和难以放下。"],
    combinationUsage: ["丁火遇木可持续燃烧，遇水则看情绪浸润和火光受制。", "丁与癸冲象明显，内在火光和深水暗流的冲突要看证据。"],
    cautions: ["丁火细不等于轻，它可能是持续消耗的来源。", "不要把丁火只解释成桃花或感情，应看具体宫位和星曜。"]
  }),
  wu: stem({
    stem: "wu",
    label: "戊",
    yinYang: "yang",
    element: "earth",
    pairGroup: "戊己土",
    nature: "戊为阳土，象高山、堤防、承载、边界和稳定结构。紫微斗数中，戊干常用于观察责任、平台、积累、防守和现实承载力。",
    symbolicMeanings: ["承载", "稳定", "边界", "平台", "责任", "防守"],
    transformationUsage: ["戊干四化要看资源和压力是否落到承载、平台、责任、制度和现实安排上。", "戊土语境下的化忌常提示阻滞、沉重、责任压身或旧结构难动。"],
    palaceStemUsage: ["宫干为戊时，该宫主题常需要稳住、承担、建立边界或处理现实平台。", "田宅、财帛、官禄等宫见戊干，尤其要看长期积累和现实责任。"],
    dynamicUsage: ["流干为戊时，事件多与责任确认、平台建设、稳定承接或现实阻力有关。", "戊土动态不是不动，而是动得慢、重视结构和成本。"],
    combinationUsage: ["戊土遇火可得生助，遇木则看开垦、压力和责任被撬动。", "戊与甲有克制关系，原则生长和现实承载之间需要平衡。"],
    cautions: ["戊土稳定不等于停滞，关键看是否有星曜推动。", "不可只凭戊土断地产、财富或保守，要结合宫位。"]
  }),
  ji: stem({
    stem: "ji",
    label: "己",
    yinYang: "yin",
    element: "earth",
    pairGroup: "戊己土",
    nature: "己为阴土，象田园、土壤、包容、消化和细密承载。紫微斗数中，己干常用于观察培育、生活细节、身体承接、资源整理和内在消化。",
    symbolicMeanings: ["土壤", "培育", "包容", "整理", "消化", "生活"],
    transformationUsage: ["己干四化要看资源、权责、名誉和牵挂是否进入生活经营、细节整理或身体承接层面。", "己土化忌时，常需复核纠结、湿滞、反复整理和难以消化的问题。"],
    palaceStemUsage: ["宫干为己时，该宫主题较重实际照料、长期经营、细碎责任和生活化承接。", "福德、疾厄、田宅等宫见己干，要看身体感受、居住环境和内在积累。"],
    dynamicUsage: ["流干为己时，阶段议题常落到生活安排、资源整合、细节收拾和身体反馈。", "己土动态适合观察慢性问题、积累问题和细节修复。"],
    combinationUsage: ["己土遇水要看湿滞和情绪吸收，遇木要看成长是否消耗土壤。", "己与乙关系明显，柔性生长和生活承接之间需要互相校验。"],
    cautions: ["己土包容不等于没有边界。", "读己干时不要忽略身体和生活细节，但也不能替代健康判断。"]
  }),
  geng: stem({
    stem: "geng",
    label: "庚",
    yinYang: "yang",
    element: "metal",
    pairGroup: "庚辛金",
    nature: "庚为阳金，象刀斧、规则、决断、改革和外部压力。紫微斗数中，庚干常用于观察切割、制度、竞争、执行和强制变化。",
    symbolicMeanings: ["决断", "规则", "切割", "竞争", "改革", "执行"],
    transformationUsage: ["庚干四化常把事件推向决断、制度、裁剪、竞争或外部压力。", "庚金触发化忌时，要复核冲突、割裂、强硬和被规则压制。"],
    palaceStemUsage: ["宫干为庚时，该宫主题常需要规则、执行、取舍、竞争或面对外部标准。", "官禄、迁移、财帛等宫见庚干，常要看专业标准、绩效和制度约束。"],
    dynamicUsage: ["流干为庚时，阶段事件容易出现选择、切换、规则压力、竞争或硬性处理。", "庚金动态遇吉辅可成执行力，遇煞忌则需看冲突和损耗。"],
    combinationUsage: ["庚金遇火要看锻炼与压力，遇木则看裁剪和冲突。", "庚与甲冲象明显，开拓主轴和规则裁断之间要复核。"],
    cautions: ["庚金强不等于凶，关键看是否有规则和目标。", "不要把庚金机械解释成刀伤，应回到象义和盘面证据。"]
  }),
  xin: stem({
    stem: "xin",
    label: "辛",
    yinYang: "yin",
    element: "metal",
    pairGroup: "庚辛金",
    nature: "辛为阴金，象珠玉、精修、审美、标准和细致判断。紫微斗数中，辛干常用于观察精细化、评价、审美、财务细节和修整能力。",
    symbolicMeanings: ["精修", "审美", "标准", "评价", "细节", "珠玉"],
    transformationUsage: ["辛干四化要看事件是否通过精细标准、评价机制、审美判断或财务细节被触发。", "辛金化忌常提示挑剔、紧张、过度修饰、关系冷感或细节压力。"],
    palaceStemUsage: ["宫干为辛时，该宫主题常重品质、审美、标准、细节管理和外部评价。", "夫妻、交友、官禄等宫见辛干，要看关系中的边界、要求和精细互动。"],
    dynamicUsage: ["流干为辛时，适合观察标准更新、审查、财务细节、合同文字和人际评价。", "辛金动态常不是大刀阔斧，而是细密修整和反复校准。"],
    combinationUsage: ["辛金遇水可看表达和流通，遇火要看熔炼、压力和曝光。", "辛与乙冲象明显，柔性关系和精细标准之间易拉扯。"],
    cautions: ["辛金不是单纯桃花或财富，要看落宫和目标星。", "辛金过强时要复核挑剔和冷感，但不能绝对化。"]
  }),
  ren: stem({
    stem: "ren",
    label: "壬",
    yinYang: "yang",
    element: "water",
    pairGroup: "壬癸水",
    nature: "壬为阳水，象江海、大流、远方、信息流和宏观流动。紫微斗数中，壬干常用于观察资源流转、远行、信息扩散和情绪大势。",
    symbolicMeanings: ["江海", "流动", "远方", "信息", "扩散", "大势"],
    transformationUsage: ["壬干四化要看事件是否以流动、跨界、远方、信息、资金或情绪大势表现。", "壬水化忌时，常需复核泛滥、逃避、失控流动和界限模糊。"],
    palaceStemUsage: ["宫干为壬时，该宫主题常带开放、流动、跨界、远方牵引或资源循环。", "迁移、财帛、交友等宫见壬干，尤其要看外部流动与资源交换。"],
    dynamicUsage: ["流干为壬时，阶段事件容易出现信息扩散、远方牵引、资源转移或情绪大流。", "壬水动态遇天马、迁移、四马地时，移动与流动主题更明显。"],
    combinationUsage: ["壬水遇金可看信息渠道和资源来源，遇土要看堤防、边界和现实承载。", "壬与丙冲象明显，暗流和公开热度之间需要平衡。"],
    cautions: ["壬水流动不等于好机会，也可能是失控和消散。", "读壬干必须复核边界、宫位和目标星。"]
  }),
  gui: stem({
    stem: "gui",
    label: "癸",
    yinYang: "yin",
    element: "water",
    pairGroup: "壬癸水",
    nature: "癸为阴水，象雨露、深层情绪、潜意识、滋润和隐性资源。紫微斗数中，癸干常用于观察暗线、情感、细水长流和内在牵挂。",
    symbolicMeanings: ["雨露", "潜流", "滋润", "情绪", "暗线", "细水"],
    transformationUsage: ["癸干四化要看资源、权责、名誉和牵挂是否通过隐性渠道、情绪暗线、细节滋润或长期渗透表现。", "癸水化忌时，常需复核敏感、多思、拖延、隐忧和难以说清的牵挂。"],
    palaceStemUsage: ["宫干为癸时，该宫主题常带隐性流动、情绪感受、暗中滋养和细水长流。", "福德、疾厄、夫妻等宫见癸干，要看内在感受、关系暗线和长期渗透。"],
    dynamicUsage: ["流干为癸时，阶段事件可能不强烈外显，但内在感受、暗线消息和细节牵挂会变重要。", "癸水动态适合观察收尾、酝酿、潜伏和柔性修复。"],
    combinationUsage: ["癸水遇木可看滋养成长，遇土要看湿滞和被承载。", "癸与丁冲象明显，内在暗流和细火执念之间要复核。"],
    cautions: ["癸水隐不等于无事，很多议题会在暗处积累。", "不能把癸水直接等同负面情绪，应看星曜与宫位承接。"]
  })
}

export function getStemContentDetail(
  stem: HeavenlyStem
): ZiweiStemContentDetail | null {
  return ZIWEI_STEM_CONTENT_DETAILS[stem] ?? null
}

export function getAllStemContentDetails(): ZiweiStemContentDetail[] {
  return ZIWEI_STEM_ORDER.map((stem) => ZIWEI_STEM_CONTENT_DETAILS[stem])
}

function stem(
  input: Omit<ZiweiStemContentDetail, "sections" | "sourceReferences">
): ZiweiStemContentDetail {
  const sourceReferences = buildStemDictionarySourceReferences()

  return {
    ...input,
    sourceReferences,
    sections: buildStemSections({ ...input, sourceReferences })
  }
}

function buildStemSections(
  detail: Omit<ZiweiStemContentDetail, "sections">
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "天干本体",
      items: [
        `${detail.label}属${detail.yinYang === "yang" ? "阳" : "阴"}${elementLabel(detail.element)}，属于${detail.pairGroup}。${detail.nature}`,
        `核心象义包括：${detail.symbolicMeanings.join("、")}。`
      ]
    },
    {
      title: "四化用法",
      items: detail.transformationUsage
    },
    {
      title: "宫干用法",
      items: detail.palaceStemUsage
    },
    {
      title: "动态流干",
      items: detail.dynamicUsage
    },
    {
      title: "组合边界",
      items: detail.combinationUsage
    },
    {
      title: "误读边界",
      items: detail.cautions
    }
  ]
}

function elementLabel(element: ZiweiStemContentDetail["element"]): string {
  const labels: Record<ZiweiStemContentDetail["element"], string> = {
    wood: "木",
    fire: "火",
    earth: "土",
    metal: "金",
    water: "水"
  }

  return labels[element]
}
