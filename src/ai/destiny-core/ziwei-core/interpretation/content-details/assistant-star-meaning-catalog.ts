import type { ZiweiStarId } from "../../contracts"
import { ASSISTANT_STAR_IDS } from "../../star-catalog"

import type { ZiweiAssistantStarContentDetail } from "./content-detail-types"

export const ZIWEI_ASSISTANT_STAR_CONTENT_DETAILS: Record<
  (typeof ASSISTANT_STAR_IDS)[keyof typeof ASSISTANT_STAR_IDS],
  ZiweiAssistantStarContentDetail
> = {
  [ASSISTANT_STAR_IDS.zuofu]: {
    starId: ASSISTANT_STAR_IDS.zuofu,
    label: "左辅",
    yinYang: "yang",
    element: "earth",
    nature: "辅佐、外援、助力之星，重视协作、贵助和把事情扶上正轨。",
    coreThemes: ["助力", "协作", "扶持", "补强"],
    strengths: ["容易得到帮手", "能把资源组织起来", "适合补位和协同推进"],
    risks: ["过度依赖外援", "容易替别人收拾局面", "主星弱时助力难成主轴"],
    favorableSignals: ["与右弼同会则左右成对", "夹命或会命可增强稳定支援", "会主星庙旺时助力更能落地"],
    unfavorableSignals: ["会煞忌则帮手变压力", "空劫同会则助力落空", "孤寡重时协作不易持续"],
    palaceFocus: "看该宫可借助的人手、制度支援、协作资源和补强条件。",
    personalityTendency: "倾向通过协作和外部支援完成目标。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["左辅重外显扶助，需看是否有主星承接。", "左右成对时助力稳定度明显上升。"]
  },
  [ASSISTANT_STAR_IDS.youbi]: {
    starId: ASSISTANT_STAR_IDS.youbi,
    label: "右弼",
    yinYang: "yin",
    element: "water",
    nature: "补位、配合、内援之星，重视柔性支持、关系缓冲和后方协助。",
    coreThemes: ["补位", "配合", "内援", "缓冲"],
    strengths: ["善于配合", "能修补关系", "适合幕后协调和补足缺口"],
    risks: ["容易退到幕后", "主见不足时随人而动", "关系压力会影响判断"],
    favorableSignals: ["与左辅同会则支援成局", "化科或会文曜时协调表达更顺", "夹命可增强命宫承接力"],
    unfavorableSignals: ["会忌则关系牵挂", "会煞则配合变冲突", "空劫同会则支持不稳定"],
    palaceFocus: "看该宫的配合者、幕后支持、关系修复和柔性资源。",
    personalityTendency: "倾向先补足关系和细节，再推动目标。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["右弼不只是贵人，也代表补位能力。", "与左辅分看时，一个偏外援，一个偏内援。"]
  },
  [ASSISTANT_STAR_IDS.wenchang]: {
    starId: ASSISTANT_STAR_IDS.wenchang,
    label: "文昌",
    yinYang: "yang",
    element: "metal",
    nature: "文书、条理、考试之星，重视清晰表达、记录和制度化文字。",
    coreThemes: ["文书", "条理", "学习", "表达"],
    strengths: ["逻辑清楚", "善记录", "适合学习、写作和规整信息"],
    risks: ["过度讲规则", "容易拘泥文字", "遇忌时表达卡顿或文书出错"],
    favorableSignals: ["与文曲同会则文艺表达增强", "化科或会魁钺利名誉考试", "庙旺时条理更清楚"],
    unfavorableSignals: ["化忌时文书、沟通和学习受阻", "会火铃陀武等结构需防规则冲突", "落陷时表达失序"],
    palaceFocus: "看该宫的文书、学习、逻辑、证照、记录和沟通条理。",
    personalityTendency: "倾向用文字、规则和清晰步骤处理问题。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["文昌偏条理和文字，不等同文曲的审美。", "化忌时优先查文书错误和表达阻滞。"]
  },
  [ASSISTANT_STAR_IDS.wenqu]: {
    starId: ASSISTANT_STAR_IDS.wenqu,
    label: "文曲",
    yinYang: "yin",
    element: "water",
    nature: "才艺、审美、感受表达之星，重视韵味、修饰和情感表达。",
    coreThemes: ["审美", "才艺", "感受", "修饰"],
    strengths: ["表达细腻", "有审美", "适合艺术、设计和柔性沟通"],
    risks: ["情绪化表达", "容易重形式", "遇忌时感受和沟通纠缠"],
    favorableSignals: ["与文昌同会则文艺兼具", "化科利名声修饰", "会魁钺则作品更易被看见"],
    unfavorableSignals: ["化忌时情感文字或审美判断受阻", "会桃花煞则感情和感官议题加重", "落陷时表达散乱"],
    palaceFocus: "看该宫的才艺、审美、感受表达、修饰包装和柔性沟通。",
    personalityTendency: "倾向通过感受和表达技巧建立连接。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["文曲偏审美与感受，不宜只按文书看。", "化忌时需区分情绪纠缠和表达误差。"]
  },
  [ASSISTANT_STAR_IDS.tiankui]: {
    starId: ASSISTANT_STAR_IDS.tiankui,
    label: "天魁",
    yinYang: "yang",
    element: "fire",
    nature: "贵人、提携、正向机会之星，重视被看见、被提拔和关键帮助。",
    coreThemes: ["贵人", "提携", "机会", "认可"],
    strengths: ["容易遇到关键支持", "能被上级或制度看见", "适合争取正式机会"],
    risks: ["过度期待贵人", "机会来时承接不足", "主星弱时提携难持续"],
    favorableSignals: ["与天钺同会则贵人一前一后", "会昌曲利考试名誉", "夹命或会命增强机会承接"],
    unfavorableSignals: ["会空劫则机会落空", "会煞忌则贵人变压力或要求", "孤寡重时帮助不易亲近"],
    palaceFocus: "看该宫的正式帮助、提携机会、上级资源和关键转机。",
    personalityTendency: "倾向相信正向机会，并愿意进入较正式的规则场域。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天魁偏明显提携，天钺偏转圜辅助。", "贵人星要看承接能力，不是自动顺利。"]
  },
  [ASSISTANT_STAR_IDS.tianyue]: {
    starId: ASSISTANT_STAR_IDS.tianyue,
    label: "天钺",
    yinYang: "yin",
    element: "fire",
    nature: "贵助、转圜、缓冲之星，重视暗中帮助、协调和难处中的支援。",
    coreThemes: ["贵助", "转圜", "缓冲", "协调"],
    strengths: ["困难中有转机", "善借助柔性资源", "能得到旁路支持"],
    risks: ["助力不一定显性", "容易等别人调停", "承接不足时机会变弱"],
    favorableSignals: ["与天魁同会则贵人结构完整", "会左右则支援网络增强", "会科星利名誉缓和"],
    unfavorableSignals: ["会煞忌则转圜成本高", "空劫同会则帮助不稳定", "落入压力宫位时需看真实可用性"],
    palaceFocus: "看该宫的暗助、调停、关系转圜和缓冲资源。",
    personalityTendency: "倾向通过协调、缓和和借力降低阻力。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天钺的帮助常不如天魁显性。", "魁钺成对时要看是否落入命宫三方四正。"]
  },
  [ASSISTANT_STAR_IDS.lucun]: {
    starId: ASSISTANT_STAR_IDS.lucun,
    label: "禄存",
    yinYang: "yin",
    element: "earth",
    nature: "禄气、存量、守成之星，重视稳定资源、积累和可持续供应。",
    coreThemes: ["禄气", "资源", "守成", "积累"],
    strengths: ["能守资源", "重稳定收益", "适合长期积累和储备"],
    risks: ["保守", "怕损耗", "资源被夹煞时压力明显"],
    favorableSignals: ["会天马成禄马结构", "会化禄则资源流入增强", "入财田等宫位利存量观察"],
    unfavorableSignals: ["羊陀夹禄需防资源压力", "会空劫则禄气落空", "会忌则资源牵挂加重"],
    palaceFocus: "看该宫的稳定资源、存量、收入基础和守成能力。",
    personalityTendency: "倾向先保住资源，再考虑扩张和流动。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["禄存重存量，不等同化禄的流入。", "与羊陀关系要重点复核。"]
  },
  [ASSISTANT_STAR_IDS.tianma]: {
    starId: ASSISTANT_STAR_IDS.tianma,
    label: "天马",
    yinYang: "yang",
    element: "fire",
    nature: "迁动、奔波、流动之星，重视移动、变化和外部机会。",
    coreThemes: ["迁动", "奔波", "流动", "机会"],
    strengths: ["行动快", "能打开外部路径", "适合流动资源和远方机会"],
    risks: ["不稳定", "劳碌奔波", "资源难以沉淀"],
    favorableSignals: ["与禄存或化禄同会成禄马流动", "会吉曜则动中有助", "落迁移官禄等宫位行动性强"],
    unfavorableSignals: ["会煞忌则奔波带风险", "空劫同会则动而无获", "马逢冲动需防失控"],
    palaceFocus: "看该宫的移动、外出、变化机会、奔波成本和资源流通。",
    personalityTendency: "倾向通过行动和位置变化寻找机会。",
    worldBehaviorHint: "用于盘面报告时，重点回到落宫、同宫、对宫、三方四正、四化和格局证据进行分析。",
    readingNotes: ["天马要看是否有禄承接。", "动不一定吉，需看动中收益还是动中消耗。"]
  }
}

export function getAssistantStarContentDetail(
  starId: ZiweiStarId
): ZiweiAssistantStarContentDetail | null {
  return ZIWEI_ASSISTANT_STAR_CONTENT_DETAILS[
    starId as keyof typeof ZIWEI_ASSISTANT_STAR_CONTENT_DETAILS
  ] ?? null
}

export function getAllAssistantStarContentDetails(): ZiweiAssistantStarContentDetail[] {
  return Object.values(ZIWEI_ASSISTANT_STAR_CONTENT_DETAILS)
}

