import type { ZiweiStarId } from "../../contracts"
import { TRANSFORMATION_STAR_IDS } from "../../star-catalog"

import type { ZiweiTransformationContentDetail } from "./content-detail-types"

export const ZIWEI_TRANSFORMATION_CONTENT_DETAILS: Record<
  (typeof TRANSFORMATION_STAR_IDS)[keyof typeof TRANSFORMATION_STAR_IDS],
  ZiweiTransformationContentDetail
> = {
  [TRANSFORMATION_STAR_IDS.hualu]: {
    starId: TRANSFORMATION_STAR_IDS.hualu,
    label: "化禄",
    yinYang: "yang",
    element: "wood",
    nature: "资源流入、机会打开、欲望滋养之化，重视获得感、顺势增长和关系润滑。",
    coreThemes: ["资源", "机会", "滋养", "获得感"],
    strengths: ["能放大目标星的可用资源", "容易带来人缘与机会", "适合启动积累、交换和正向反馈"],
    risks: ["容易因顺势而贪多", "对舒适和回报产生依赖", "遇忌煞时资源入口也可能变成牵挂"],
    favorableSignals: ["目标星庙旺时资源更容易落地", "会禄存或天马时流动与存量互补", "入财帛、官禄、田宅时资源主题更明显"],
    unfavorableSignals: ["与化忌同宫或相夹时得失纠缠", "会空劫时资源有落空感", "会煞曜时机会伴随竞争或损耗"],
    palaceFocus: "看该宫被打开的资源入口、关系助力、利益交换、欲望增长和可积累的机会。",
    personalityTendency: "盘面上用于观察资源入口、利益交换、关系助力和可积累机会。",
    worldBehaviorHint: "用于盘面报告时，重点说明化禄落宫、目标星承接、资源来源和是否被煞忌牵制。",
    readingNotes: ["化禄重资源流入，不等同禄存的稳定存量。", "判断化禄要同时看目标星承接力和宫位能否把资源落地。"]
  },
  [TRANSFORMATION_STAR_IDS.huaquan]: {
    starId: TRANSFORMATION_STAR_IDS.huaquan,
    label: "化权",
    yinYang: "yang",
    element: "fire",
    nature: "权责上升、推动加压、主导强化之化，重视行动力、掌控感和责任承担。",
    coreThemes: ["权责", "推动", "掌控", "行动力"],
    strengths: ["能强化目标星的执行与主导", "适合争取位置和推动决策", "在压力场景中更容易承担责任"],
    risks: ["容易变得强势急迫", "权责增加带来压力", "遇煞忌时掌控欲可能引发冲突"],
    favorableSignals: ["目标星庙旺时权责较能转成成果", "会左辅右弼时推动更有协作", "入官禄、迁移、命宫时主导性明显"],
    unfavorableSignals: ["会擎羊火铃时冲突升级快", "与化忌同会时权责变成执念压力", "目标星陷弱时容易有力难施"],
    palaceFocus: "看该宫的主导权、责任加重、推动压力、竞争状态和必须亲自处理的议题。",
    personalityTendency: "盘面上用于观察权责加重、主导关系、推动压力和必须承担的事项。",
    worldBehaviorHint: "用于盘面报告时，重点说明化权落宫、目标星承压、权责来源和是否形成冲突。",
    readingNotes: ["化权不是单纯权力，也包含责任和压力。", "化权遇煞忌时要重点看是否从推动变成强压或冲突。"]
  },
  [TRANSFORMATION_STAR_IDS.huake]: {
    starId: TRANSFORMATION_STAR_IDS.huake,
    label: "化科",
    yinYang: "yin",
    element: "water",
    nature: "名声修饰、秩序缓和、文采规范之化，重视表达、认证、体面和问题降温。",
    coreThemes: ["名声", "修饰", "秩序", "缓和"],
    strengths: ["能提升目标星的可理解度", "有利文书、名誉和专业表达", "适合把复杂问题制度化、温和化"],
    risks: ["容易过度重视体面", "处理问题偏慢", "遇忌煞时名声与文书反成压力点"],
    favorableSignals: ["会昌曲魁钺时名誉和表达更顺", "目标星庙旺时专业形象稳定", "入官禄、命宫、福德时声誉修饰明显"],
    unfavorableSignals: ["会化忌时文书、名誉、解释成本升高", "会空劫时名声虚浮", "会煞曜时缓和力被冲突打断"],
    palaceFocus: "看该宫的名誉、表达、认证、文书、缓冲机制和能否把问题处理得体。",
    personalityTendency: "盘面上用于观察名誉、文书、认证、缓冲和问题得以制度化处理的条件。",
    worldBehaviorHint: "用于盘面报告时，重点说明化科落宫、目标星是否得力、文书名誉是否能缓和冲突。",
    readingNotes: ["化科重修饰与规范，不等同直接资源。", "化科可解部分粗糙冲突，但不能完全抵消强煞或化忌。"]
  },
  [TRANSFORMATION_STAR_IDS.huaji]: {
    starId: TRANSFORMATION_STAR_IDS.huaji,
    label: "化忌",
    yinYang: "yin",
    element: "water",
    nature: "执着阻滞、反复牵挂、亏欠回流之化，重视卡点、代价、焦虑和需要修复的结。",
    coreThemes: ["阻滞", "执着", "牵挂", "代价"],
    strengths: ["能暴露真正卡点", "适合深度复盘和修补漏洞", "让目标星的问题无法被轻易忽略"],
    risks: ["容易反复纠结", "带来损耗和心理压力", "遇煞曜时阻滞可能变成冲突、伤耗或破局"],
    favorableSignals: ["有吉曜制化时可转为专注修复", "目标星庙旺时较能承受压力", "入疾厄、福德、财帛时提醒身心或资源亏欠"],
    unfavorableSignals: ["会羊陀火铃时冲突和阻力加重", "会空劫时落空与亏欠感增强", "与禄权科纠缠时得失、权责、名誉问题反复"],
    palaceFocus: "看该宫的卡点、亏欠、牵挂、反复问题、代价来源和必须长期修复的结。",
    personalityTendency: "盘面上用于观察卡点、亏欠、牵挂、反复成本和必须处理的阻滞来源。",
    worldBehaviorHint: "用于盘面报告时，重点说明化忌落宫、目标星受损程度、煞曜叠加和修复路径。",
    readingNotes: ["化忌不是直接等同灾祸，重点是阻滞、牵挂和修复成本。", "所有化忌格局必须由明确同宫、会照、夹宫等结构触发，不能用含糊数量替代。"]
  }
}

export function getTransformationContentDetail(
  starId: ZiweiStarId
): ZiweiTransformationContentDetail | null {
  const detail = ZIWEI_TRANSFORMATION_CONTENT_DETAILS[
    starId as keyof typeof ZIWEI_TRANSFORMATION_CONTENT_DETAILS
  ] ?? null

  return detail ? withTransformationReadingBoundary(detail) : null
}

export function getAllTransformationContentDetails(): ZiweiTransformationContentDetail[] {
  return Object.values(ZIWEI_TRANSFORMATION_CONTENT_DETAILS).map((detail) => {
    return withTransformationReadingBoundary(detail)
  })
}

function withTransformationReadingBoundary(
  detail: ZiweiTransformationContentDetail
): ZiweiTransformationContentDetail {
  return {
    ...detail,
    readingNotes: [
      ...detail.readingNotes,
      "四化读盘必须标明来源天干、所属盘层、目标星和目标宫；四化不是庙旺落陷，不能把化禄、化权、化科、化忌写成星曜亮度。"
    ]
  }
}
