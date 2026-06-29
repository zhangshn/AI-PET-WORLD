import type {
  ZiweiStarCategory,
  ZiweiStarDefinition,
  ZiweiStarId
} from "../contracts"
import { STAR_CATEGORY_LABELS } from "../page-view/labels"
import { getZiweiStarDefinition, ziweiStarCatalog } from "../star-catalog"

import { getStarCategoryInterpretationProfile } from "./star-keywords"

export interface ZiweiStarInterpretationProfile {
  starId: ZiweiStarId
  label: string
  category: Exclude<ZiweiStarCategory, "empty">
  summary: string
  tags: string[]
}

const STAR_PROFILE_OVERRIDES: Record<
  ZiweiStarId,
  Pick<ZiweiStarInterpretationProfile, "summary" | "tags">
> = {
  "ziwei.main.ziwei": {
    summary: "紫微偏向统筹、定序和核心主导，落宫常作为该领域的组织中心观察。",
    tags: ["统筹", "主导", "秩序"]
  },
  "ziwei.main.tanlang": {
    summary: "贪狼偏向欲望、社交、才艺和变化，落宫多看体验感与资源流动。",
    tags: ["欲望", "社交", "变化"]
  },
  "ziwei.main.jumen": {
    summary: "巨门偏向表达、辨析和疑虑，落宫多看沟通成本与是非议题。",
    tags: ["表达", "辨析", "是非"]
  },
  "ziwei.main.lianzhen": {
    summary: "廉贞偏向原则、边界和自我要求，落宫多看规范感与取舍压力。",
    tags: ["原则", "边界", "取舍"]
  },
  "ziwei.main.wuqu": {
    summary: "武曲偏向执行、财务和现实掌控，落宫多看资源管理与落实能力。",
    tags: ["执行", "财务", "落实"]
  },
  "ziwei.main.pojun": {
    summary: "破军偏向破旧立新和大幅调整，落宫多看变动、开创和重组。",
    tags: ["突破", "重组", "变动"]
  },
  "ziwei.main.tianfu": {
    summary: "天府偏向承载、储备和稳定资源，落宫多看积累、守成与调度。",
    tags: ["承载", "储备", "稳定"]
  },
  "ziwei.main.tianji": {
    summary: "天机偏向机巧、策划和快速应变，落宫多看思路变化与方案能力。",
    tags: ["策划", "应变", "机巧"]
  },
  "ziwei.main.tianxiang": {
    summary: "天相偏向秩序、协调和制度支持，落宫多看配合、体面和中介能力。",
    tags: ["协调", "制度", "配合"]
  },
  "ziwei.main.tianliang": {
    summary: "天梁偏向庇护、原则和长辈性支持，落宫多看保护、责任与修正。",
    tags: ["庇护", "责任", "修正"]
  },
  "ziwei.main.tiantong": {
    summary: "天同偏向安逸、感受和缓冲，落宫多看舒适度、情绪和福分。",
    tags: ["安逸", "感受", "缓冲"]
  },
  "ziwei.main.qisha": {
    summary: "七杀偏向决断、竞争和高压行动，落宫多看冲刺、担当与风险。",
    tags: ["决断", "竞争", "高压"]
  },
  "ziwei.main.taiyang": {
    summary: "太阳偏向外放、照拂和公开行动，落宫多看能见度、付出和名声。",
    tags: ["外放", "照拂", "公开"]
  },
  "ziwei.main.taiyin": {
    summary: "太阴偏向细腻、积累和内在安全感，落宫多看照顾、资产和感受。",
    tags: ["细腻", "积累", "安全感"]
  },
  "ziwei.assistant.zuofu": {
    summary: "左辅代表外部协助和顺手资源，落宫提示可借力之处。",
    tags: ["助力", "协作", "资源"]
  },
  "ziwei.assistant.youbi": {
    summary: "右弼代表配合、支持和补位，落宫提示人际助缘与辅助条件。",
    tags: ["配合", "补位", "助缘"]
  },
  "ziwei.assistant.wenchang": {
    summary: "文昌偏向文书、表达和条理，落宫提示学习、记录和沟通优势。",
    tags: ["文书", "表达", "条理"]
  },
  "ziwei.assistant.wenqu": {
    summary: "文曲偏向审美、感受和表达技巧，落宫提示才艺、修饰和细腻表达。",
    tags: ["审美", "才艺", "表达"]
  },
  "ziwei.assistant.tiankui": {
    summary: "天魁代表贵人提携和正向机会，落宫提示可被看见的助力。",
    tags: ["贵人", "提携", "机会"]
  },
  "ziwei.assistant.tianyue": {
    summary: "天钺代表贵人辅助和转圜条件，落宫提示可缓冲困难的助缘。",
    tags: ["贵人", "转圜", "缓冲"]
  },
  "ziwei.assistant.lucun": {
    summary: "禄存代表禄气、资源和守成能力，落宫提示稳定收益与积累。",
    tags: ["禄气", "资源", "守成"]
  },
  "ziwei.assistant.tianma": {
    summary: "天马代表移动、奔波和变化机会，落宫提示流动性与外出行动。",
    tags: ["移动", "奔波", "机会"]
  },
  "ziwei.malefic.qingyang": {
    summary: "擎羊代表锋利、冲突和直接压力，落宫提示需要处理硬碰硬的问题。",
    tags: ["冲突", "锋利", "压力"]
  },
  "ziwei.malefic.tuoluo": {
    summary: "陀罗代表拖延、牵制和慢性阻力，落宫提示长期磨耗与卡点。",
    tags: ["牵制", "拖延", "磨耗"]
  },
  "ziwei.malefic.huoxing": {
    summary: "火星代表急促、爆发和突发刺激，落宫提示冲动和快速变化。",
    tags: ["爆发", "急促", "突发"]
  },
  "ziwei.malefic.lingxing": {
    summary: "铃星代表惊扰、反复和暗中压力，落宫提示不稳定与细碎干扰。",
    tags: ["惊扰", "反复", "干扰"]
  },
  "ziwei.malefic.dikong": {
    summary: "地空代表落空、抽离和虚耗，落宫提示预期与现实之间的缺口。",
    tags: ["落空", "虚耗", "抽离"]
  },
  "ziwei.malefic.dijie": {
    summary: "地劫代表损耗、截断和资源流失，落宫提示需要防范破耗。",
    tags: ["损耗", "截断", "破耗"]
  },
  "ziwei.transformation.hualu": {
    summary: "化禄代表资源增加、机会和顺势流入，落宫提示较容易形成收益。",
    tags: ["资源", "机会", "收益"]
  },
  "ziwei.transformation.huaquan": {
    summary: "化权代表推动、掌控和责任加重，落宫提示主动权与压力并存。",
    tags: ["推动", "掌控", "责任"]
  },
  "ziwei.transformation.huake": {
    summary: "化科代表名声、秩序和缓和，落宫提示可通过规范与表达改善局面。",
    tags: ["名声", "秩序", "缓和"]
  },
  "ziwei.transformation.huaji": {
    summary: "化忌代表执着、阻滞和反复牵挂，落宫提示需要重点复盘和化解。",
    tags: ["阻滞", "执着", "复盘"]
  },
  "ziwei.misc.hongluan": {
    summary: "红鸾代表缘分、喜庆和情感触发，落宫提示人际或情绪面的牵动。",
    tags: ["缘分", "喜庆", "情感"]
  },
  "ziwei.misc.tianxi": {
    summary: "天喜代表喜事、和合和愉悦感，落宫提示较易出现正向互动。",
    tags: ["喜事", "和合", "愉悦"]
  },
  "ziwei.misc.xianchi": {
    summary: "咸池代表桃花、吸引力和感官牵动，落宫提示魅力与分心并存。",
    tags: ["桃花", "吸引", "感官"]
  },
  "ziwei.misc.tianyao": {
    summary: "天姚代表表现力、魅力和情绪波动，落宫提示人际吸引与外在表达。",
    tags: ["魅力", "表现", "波动"]
  },
  "ziwei.misc.taifu": {
    summary: "台辅代表辅助、抬举和平台支持，落宫提示可借助制度或位置加分。",
    tags: ["辅助", "平台", "抬举"]
  },
  "ziwei.misc.fenggao": {
    summary: "封诰代表认可、名位和正式授予，落宫提示身份、评价或称许。",
    tags: ["认可", "名位", "称许"]
  },
  "ziwei.misc.longchi": {
    summary: "龙池代表仪态、声望和外在修饰，落宫提示形象与资源包装。",
    tags: ["声望", "形象", "修饰"]
  },
  "ziwei.misc.fengge": {
    summary: "凤阁代表文雅、装饰和才艺呈现，落宫提示审美与表达加成。",
    tags: ["文雅", "才艺", "审美"]
  },
  "ziwei.misc.tianwu": {
    summary: "天巫代表灵感、媒介和转换，落宫提示感知力与非线性助缘。",
    tags: ["灵感", "媒介", "转换"]
  },
  "ziwei.misc.guchen": {
    summary: "孤辰代表独立、疏离和自我承担，落宫提示关系距离与独处议题。",
    tags: ["独立", "疏离", "承担"]
  },
  "ziwei.misc.guasu": {
    summary: "寡宿代表冷清、孤立和情感收束，落宫提示陪伴感不足或关系淡化。",
    tags: ["冷清", "孤立", "收束"]
  },
  "ziwei.misc.tianxing": {
    summary: "天刑代表规则、约束和惩戒，落宫提示规范边界与是非成本。",
    tags: ["规则", "约束", "是非"]
  },
  "ziwei.misc.posui": {
    summary: "破碎代表破损、分散和不完整，落宫提示计划或资源需要修补。",
    tags: ["破损", "分散", "修补"]
  },
  "ziwei.misc.tianku": {
    summary: "天哭代表忧虑、感伤和压力释放，落宫提示情绪低点和表达出口。",
    tags: ["忧虑", "感伤", "释放"]
  },
  "ziwei.misc.tianxu": {
    summary: "天虚代表虚耗、不实和心理落差，落宫提示期待落空或信心不足。",
    tags: ["虚耗", "落差", "不实"]
  }
}

const LIFECYCLE_SUMMARIES: Record<string, string> = {
  长生: "长生代表生发和起点，落宫提示该领域有启动和成长空间。",
  沐浴: "沐浴代表润泽和感受增强，落宫提示体验、人际和外界影响较明显。",
  冠带: "冠带代表整理和成形，落宫提示形象、规范和准备阶段。",
  临官: "临官代表进入位置和承担事务，落宫提示执行力和实际表现。",
  帝旺: "帝旺代表气势最盛，落宫提示该领域能量集中但也容易过满。",
  衰: "衰代表气势回落，落宫提示需要节制、复盘和保存实力。",
  病: "病代表消耗和不适，落宫提示弱点、隐患和修复需求。",
  死: "死代表停顿和收束，落宫提示结束、定局或需要转换方式。",
  墓: "墓代表收藏和封存，落宫提示资源入库、隐性积累或不易外显。",
  绝: "绝代表断点和转折，落宫提示旧模式中断后重新寻找路径。",
  胎: "胎代表孕育和未成形，落宫提示潜力存在但仍需时间。",
  养: "养代表涵养和恢复，落宫提示照料、培养和慢慢成局。"
}

export function getZiweiStarInterpretationProfile(
  starId: ZiweiStarId
): ZiweiStarInterpretationProfile | null {
  const definition = getZiweiStarDefinition(starId)

  if (!definition || definition.category === "empty") {
    return null
  }

  return buildStarProfile(definition)
}

export function getAllZiweiStarInterpretationProfiles(): ZiweiStarInterpretationProfile[] {
  return ziweiStarCatalog.flatMap((definition) => {
    if (definition.category === "empty") {
      return []
    }

    return [buildStarProfile(definition)]
  })
}

function buildStarProfile(
  definition: ZiweiStarDefinition
): ZiweiStarInterpretationProfile {
  const category = definition.category as Exclude<ZiweiStarCategory, "empty">
  const categoryProfile = getStarCategoryInterpretationProfile(category)
  const override = STAR_PROFILE_OVERRIDES[definition.starId]
  const lifecycleSummary =
    category === "lifecycle" ? LIFECYCLE_SUMMARIES[definition.label] : undefined

  return {
    starId: definition.starId,
    label: definition.label,
    category,
    summary:
      override?.summary ??
      lifecycleSummary ??
      `${definition.label} 属于${STAR_CATEGORY_LABELS[category]}，用于补充${categoryProfile.tags.join("、")}层面的判断。`,
    tags: buildProfileTags(definition.label, categoryProfile.tags, override, lifecycleSummary)
  }
}

function buildProfileTags(
  label: string,
  categoryTags: string[],
  override:
    | Pick<ZiweiStarInterpretationProfile, "summary" | "tags">
    | undefined,
  lifecycleSummary: string | undefined
): string[] {
  if (override) {
    return override.tags
  }

  if (lifecycleSummary) {
    return categoryTags
  }

  return [label, ...categoryTags]
}
