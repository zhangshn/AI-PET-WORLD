import type { ZiweiStarId } from "../../contracts"
import { MALEFIC_STAR_IDS } from "../../star-catalog"

import type { ZiweiMaleficStarContentDetail } from "./content-detail-types"

export const ZIWEI_MALEFIC_STAR_CONTENT_DETAILS: Record<
  (typeof MALEFIC_STAR_IDS)[keyof typeof MALEFIC_STAR_IDS],
  ZiweiMaleficStarContentDetail
> = {
  [MALEFIC_STAR_IDS.qingyang]: {
    starId: MALEFIC_STAR_IDS.qingyang,
    label: "擎羊",
    yinYang: "yang",
    element: "metal",
    nature: "锋刃、冲突、直接破开之星，重视切入、对抗和硬性突破。",
    coreThemes: ["锋利", "冲突", "切入", "破开"],
    strengths: ["能快速切开问题", "敢面对压力", "适合处理需要决断的局面"],
    risks: ["容易硬碰硬", "言行锋利伤人", "损伤和冲突成本较高"],
    favorableSignals: ["有吉曜制化时锋芒可用于执行", "庙旺时行动更有方向", "遇权星时可形成强推动"],
    unfavorableSignals: ["羊陀夹命压力明显", "与化忌同会易形成硬阻滞", "会火铃时冲突升级更快"],
    palaceFocus: "看该宫是否有硬碰硬、切割、损伤、冲突和必须直接处理的问题。",
    personalityTendency: "倾向直面问题，用强动作突破阻碍。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["擎羊不是单纯凶，要看是否有明确目标和制化。", "入命或冲命时要重点看行动边界。"]
  },
  [MALEFIC_STAR_IDS.tuoluo]: {
    starId: MALEFIC_STAR_IDS.tuoluo,
    label: "陀罗",
    yinYang: "yin",
    element: "metal",
    nature: "拖滞、牵制、慢性磨耗之星，重视延迟、纠缠和长期阻力。",
    coreThemes: ["拖延", "牵制", "磨耗", "纠缠"],
    strengths: ["能在慢问题中坚持", "适合处理复杂牵连", "能看见长期阻力"],
    risks: ["推进缓慢", "容易钻牛角尖", "长期压力造成消耗"],
    favorableSignals: ["有吉曜引导时可转为耐性", "与稳重主星同会可增强持久力", "庙旺时阻力较可控"],
    unfavorableSignals: ["与擎羊夹命形成夹制", "会化忌时纠缠加重", "会空劫时拖而无果"],
    palaceFocus: "看该宫的拖延、卡点、慢性压力、难以脱身的关系或事务。",
    personalityTendency: "倾向反复思考和谨慎推进，但容易被阻力拖住。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["陀罗重慢性牵制，不等同擎羊的直接冲突。", "遇忌时要看问题是否反复回到同一处。"]
  },
  [MALEFIC_STAR_IDS.huoxing]: {
    starId: MALEFIC_STAR_IDS.huoxing,
    label: "火星",
    yinYang: "yang",
    element: "fire",
    nature: "急促、爆发、突发刺激之星，重视速度、冲动和瞬间变化。",
    coreThemes: ["爆发", "急促", "冲动", "突发"],
    strengths: ["反应快", "能启动停滞局面", "适合短促攻坚"],
    risks: ["容易急躁", "冲动造成损耗", "突发事件打乱节奏"],
    favorableSignals: ["火贪等结构成格时可化为突破力", "有吉曜制化时行动更有效", "庙旺时爆发较有方向"],
    unfavorableSignals: ["火铃同会惊扰加重", "会化忌时冲动带阻滞", "与羊陀同会时冲突和损伤更明显"],
    palaceFocus: "看该宫的突发、爆发、急躁、快速启动和短时间压力。",
    personalityTendency: "倾向快速反应，先动起来再修正。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["火星要看是否被格局收束。", "无制时重点看冲动、事故和急躁决策。"]
  },
  [MALEFIC_STAR_IDS.lingxing]: {
    starId: MALEFIC_STAR_IDS.lingxing,
    label: "铃星",
    yinYang: "yin",
    element: "fire",
    nature: "惊扰、反复、暗中刺激之星，重视不安、警讯和持续干扰。",
    coreThemes: ["惊扰", "反复", "警讯", "干扰"],
    strengths: ["能捕捉细微信号", "对风险敏感", "适合预警和反复校验"],
    risks: ["焦躁不安", "被细碎干扰牵动", "容易形成心理噪音"],
    favorableSignals: ["铃贪等结构成格时可转为敏锐突破", "会吉曜时警觉有用", "庙旺时反应较精准"],
    unfavorableSignals: ["火铃同会惊扰加倍", "会化忌时反复牵挂", "会空劫时不安感落不到实处"],
    palaceFocus: "看该宫的反复惊扰、暗中压力、细碎干扰和警讯来源。",
    personalityTendency: "倾向对细节和风险保持警觉，但容易过度紧绷。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["铃星偏暗扰，和火星的直接爆发不同。", "会忌时要看是否形成反复焦虑。"]
  },
  [MALEFIC_STAR_IDS.dikong]: {
    starId: MALEFIC_STAR_IDS.dikong,
    label: "地空",
    yinYang: "yin",
    element: "mixed",
    nature: "空缺、抽离、预期落空之星，重视虚位、空耗和非实体化。",
    coreThemes: ["空缺", "抽离", "落空", "虚耗"],
    strengths: ["能跳出执着", "适合清空旧负担", "有抽象和想象空间"],
    risks: ["计划落空", "资源不实", "承诺难落实"],
    favorableSignals: ["有吉曜和主星承接时可转为空间感", "用于断舍离时有利", "与精神性宫位可看抽象能力"],
    unfavorableSignals: ["空劫同会破耗明显", "会化忌时落空牵挂", "入资源宫位需防虚耗"],
    palaceFocus: "看该宫的空缺、预期落差、资源不实、计划落空和抽离感。",
    personalityTendency: "倾向保持距离和抽象思考，但可能难以落实。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["地空不是完全没有，也可能代表腾空和抽象。", "与地劫同会时要重点看破耗。"]
  },
  [MALEFIC_STAR_IDS.dijie]: {
    starId: MALEFIC_STAR_IDS.dijie,
    label: "地劫",
    yinYang: "yang",
    element: "mixed",
    nature: "劫夺、截断、损耗之星，重视资源流失、破口和突然减损。",
    coreThemes: ["损耗", "截断", "破口", "流失"],
    strengths: ["能识别破口", "适合做风险切割", "可促使重新评估资源"],
    risks: ["破财破耗", "成果被截断", "资源难以保存"],
    favorableSignals: ["有吉曜承接时可转为及时止损", "用于淘汰无效资源时有利", "与强主星同会可形成断舍离"],
    unfavorableSignals: ["空劫同会损耗加重", "会化忌时破耗牵挂", "入财田命等宫位需重点复核"],
    palaceFocus: "看该宫的损耗、被截断、资源流失、破口和必须止损的位置。",
    personalityTendency: "倾向快速识别损失并切断风险，但容易有不安全感。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["地劫重实际损耗，地空重落空抽离。", "空劫成对时要看是否有主星和吉曜承接。"]
  }
}

export function getMaleficStarContentDetail(
  starId: ZiweiStarId
): ZiweiMaleficStarContentDetail | null {
  return ZIWEI_MALEFIC_STAR_CONTENT_DETAILS[
    starId as keyof typeof ZIWEI_MALEFIC_STAR_CONTENT_DETAILS
  ] ?? null
}

export function getAllMaleficStarContentDetails(): ZiweiMaleficStarContentDetail[] {
  return Object.values(ZIWEI_MALEFIC_STAR_CONTENT_DETAILS)
}

