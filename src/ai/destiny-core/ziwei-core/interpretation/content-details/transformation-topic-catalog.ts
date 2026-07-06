import type { HeavenlyStem, ZiweiStarId } from "../../contracts"
import {
  getZiweiStarDefinition,
  TRANSFORMATION_STAR_IDS
} from "../../star-catalog"
import {
  NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM,
  type TransformationKind
} from "../../star-placement/transformations"

import type { ZiweiTransformationTopicContentDetail } from "./content-detail-types"
import { buildTransformationTopicSourceReferences } from "./content-source-reference-map"

const TRANSFORMATION_KIND_ORDER: TransformationKind[] = [
  TRANSFORMATION_STAR_IDS.hualu,
  TRANSFORMATION_STAR_IDS.huaquan,
  TRANSFORMATION_STAR_IDS.huake,
  TRANSFORMATION_STAR_IDS.huaji
]

const STEM_ORDER: HeavenlyStem[] = [
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

const STEM_LABELS: Record<HeavenlyStem, string> = {
  jia: "甲",
  yi: "乙",
  bing: "丙",
  ding: "丁",
  wu: "戊",
  ji: "己",
  geng: "庚",
  xin: "辛",
  ren: "壬",
  gui: "癸"
}

const FLOW_TOPICS = [
  {
    topicId: "transformation.flow.natal",
    label: "本命四化",
    aliases: ["生年四化", "原盘四化"],
    relatedFlowType: "natal",
    scope: "以出生年干触发，作为原盘固定四化结构。",
    nature:
      "本命四化是原盘长期存在的资源、权责、名誉和牵挂结构，用来观察一个人底盘中哪些星曜被生年天干永久标记。它不是流年事件，也不会因为点击流动时间而消失。",
    flowUsage: [
      "本命盘默认显示本命四化。",
      "切到大限或流年时，本命四化仍是底盘承接，但当前盘层解释要标明正在看哪一层。",
      "本命四化适合进入命盘主轴、长期习惯和底层结构分析。"
    ]
  },
  {
    topicId: "transformation.flow.daYun",
    label: "大限四化",
    aliases: ["十年四化", "大运四化"],
    relatedFlowType: "daYun",
    scope: "以当前大限宫干或大限流干语境触发，作为十年阶段四化结构。",
    nature:
      "大限四化描述十年阶段里被推到前台的资源、权责、名誉和牵挂。它叠在本命盘上观察，但不能改写本命固定星曜。",
    flowUsage: [
      "点击大限后，当前格局和关系线以大限命宫为视角。",
      "大限四化用于判断阶段性主题，不直接替代本命四化。",
      "大限取消后，页面和分析应回到本命原盘状态。"
    ]
  },
  {
    topicId: "transformation.flow.liuNian",
    label: "流年四化",
    aliases: ["年度四化", "太岁四化"],
    relatedFlowType: "liuNian",
    scope: "以当前流年天干触发，作为年度层级四化结构。",
    nature:
      "流年四化描述一年内被触发的资源入口、责任压力、名誉文书和牵挂卡点。它要与大限背景和本命承接一起看。",
    flowUsage: [
      "点击流年后，流年四化进入当前盘层。",
      "流年四化需要保留所属大限背景，不应把大限标记隐藏掉。",
      "流年四化只代表年度触发，不应写成永久结构。"
    ]
  },
  {
    topicId: "transformation.flow.liuYue",
    label: "流月四化",
    aliases: ["月度四化", "月盘四化"],
    relatedFlowType: "liuYue",
    scope: "以当前流月语境触发，作为月度短周期四化结构。",
    nature:
      "流月四化用于观察一个月内的短周期推进、情绪变化、任务压力和局部牵挂。它必须降权处理，不能覆盖本命、大限和流年主线。",
    flowUsage: [
      "点击流月后，页面应累计显示本命、大限、流年和流月层级标记。",
      "流月四化用于短期事件气候。",
      "流月四化不适合直接输出长期结论。"
    ]
  },
  {
    topicId: "transformation.flow.liuRi",
    label: "流日四化",
    aliases: ["日盘四化", "日层四化"],
    relatedFlowType: "liuRi",
    scope: "以当前流日语境触发，作为日层即时四化结构。",
    nature:
      "流日四化用于观察当天触发点、临时压力、短时资源和即时牵挂。它更适合提示复核，不适合做长期断语。",
    flowUsage: [
      "流日四化要归入日层，不混成本命或年度结构。",
      "流日触发可辅助看当天办事顺逆和注意事项。",
      "流日结果必须保留上级流月、流年和大限背景。"
    ]
  },
  {
    topicId: "transformation.flow.liuShi",
    label: "流时四化",
    aliases: ["时盘四化", "时层四化"],
    relatedFlowType: "liuShi",
    scope: "以当前流时语境触发，作为时辰层即时四化结构。",
    nature:
      "流时四化是最短周期的触发资料，只适合观察当下状态、临场阻力、即时资源和短暂牵挂，不应扩写成命运结论。",
    flowUsage: [
      "流时四化只作为即时提示。",
      "流时解释必须降权，并保留上级流日、流月、流年和大限背景。",
      "流时四化适合用于页面点验和短周期校盘。"
    ]
  }
] as const

export const ZIWEI_TRANSFORMATION_TOPIC_DETAILS: ZiweiTransformationTopicContentDetail[] = [
  ...TRANSFORMATION_KIND_ORDER.map(buildTransformationKindTopic),
  ...STEM_ORDER.map(buildStemTriggerTopic),
  ...FLOW_TOPICS.map(buildFlowLayerTopic)
]

export function getAllTransformationTopicContentDetails(): ZiweiTransformationTopicContentDetail[] {
  return ZIWEI_TRANSFORMATION_TOPIC_DETAILS
}

export function getTransformationTopicContentDetail(
  topicId: string
): ZiweiTransformationTopicContentDetail | undefined {
  return ZIWEI_TRANSFORMATION_TOPIC_DETAILS.find((detail) => detail.topicId === topicId)
}

function buildTransformationKindTopic(starId: TransformationKind): ZiweiTransformationTopicContentDetail {
  const label = starLabel(starId)
  const profiles: Record<TransformationKind, {
    aliases: string[]
    scope: string
    nature: string
    targetUsage: string[]
    combinationUsage: string[]
    cautions: string[]
  }> = {
    [TRANSFORMATION_STAR_IDS.hualu]: {
      aliases: ["禄化", "化禄象"],
      scope: "观察资源流入、机会打开、欲望滋养和关系润滑。",
      nature:
        "化禄代表资源、机会、获得感和滋养力。读化禄时要问资源从哪里来、落到哪颗目标星、进入哪个宫位、是否能被承接，而不是只把它当作绝对吉。",
      targetUsage: [
        "目标星决定资源以什么方式表现。",
        "目标宫决定资源进入哪个生活主题。",
        "目标星落陷或会煞忌时，资源也可能变成欲望、依赖或牵挂。"
      ],
      combinationUsage: [
        "化禄会禄存、天马时，可观察存量与流动如何互补。",
        "化禄与化忌纠缠时，要看得失、欲望和代价是否同源。",
        "化禄进入格局时多作加吉，但仍需看主星承接。"
      ],
      cautions: [
        "化禄不是一定发财。",
        "不要忽略目标星和目标宫。",
        "化禄遇空劫、煞忌时要看落空和资源损耗。"
      ]
    },
    [TRANSFORMATION_STAR_IDS.huaquan]: {
      aliases: ["权化", "化权象"],
      scope: "观察权责上升、推动加压、主导欲和执行强度。",
      nature:
        "化权代表推动、掌控、责任和执行压力。读化权时要同时看主导力与责任成本，不能只解释成权力。",
      targetUsage: [
        "目标星决定用什么能力承担权责。",
        "目标宫决定权责落在哪个生活领域。",
        "目标星弱或受煞忌时，化权可能表现为急迫、强压或冲突。"
      ],
      combinationUsage: [
        "化权会左右魁钺时，推动力更容易得到协作。",
        "化权遇煞忌时，要看冲突、控制欲和责任过载。",
        "化权入格局可作主导增强，也可成为破格压力。"
      ],
      cautions: [
        "化权不是单纯权力。",
        "不要把推动力和结果成功混为一谈。",
        "化权短周期触发时不应写成长期强势。"
      ]
    },
    [TRANSFORMATION_STAR_IDS.huake]: {
      aliases: ["科化", "化科象"],
      scope: "观察名誉、文书、规范、体面、缓和与可解释性。",
      nature:
        "化科代表名声修饰、规范化、文书表达和降温缓冲。读化科时要看它是否真的解决问题，还是只让问题变得可说明、可整理、可缓和。",
      targetUsage: [
        "目标星决定名誉和表达通过什么能力呈现。",
        "目标宫决定化科落到哪类文书、评价、名声或修复主题。",
        "目标星受煞忌时，化科可能变成解释成本和体面压力。"
      ],
      combinationUsage: [
        "化科会昌曲魁钺时，文书、专业和名誉信号更清楚。",
        "化科遇化忌时，要看解释、名誉、文书和复核成本。",
        "化科可缓和煞象，但不能完全抵消强煞或化忌。"
      ],
      cautions: [
        "化科不是直接资源。",
        "不要把有名声等同现实收益。",
        "化科只能缓和，不一定彻底化解。"
      ]
    },
    [TRANSFORMATION_STAR_IDS.huaji]: {
      aliases: ["忌化", "化忌象"],
      scope: "观察阻滞、执着、牵挂、代价、反复和修复入口。",
      nature:
        "化忌代表卡点、纠结、亏欠、执念和需要修复的结。读化忌时要找清楚牵挂从哪里来、卡在哪颗目标星、落在哪个宫位、是否被煞曜放大。",
      targetUsage: [
        "目标星决定卡点的性质。",
        "目标宫决定牵挂落入的生活领域。",
        "目标星自身状态稳定时较能承受压力，状态弱或会煞时修复成本提高。"
      ],
      combinationUsage: [
        "化忌会羊陀火铃空劫时，破格或风险信号增强。",
        "化忌与化禄纠缠时，要看得失同源和欲望牵挂。",
        "化忌进入格局必须有明确同宫、会照、夹宫或目标星证据。"
      ],
      cautions: [
        "化忌不是直接灾祸。",
        "不要用恐吓式断语。",
        "化忌必须说明目标星、目标宫和修复路径。"
      ]
    }
  }

  const profile = profiles[starId]

  return detail({
    topicId: `transformation.kind.${starId.split(".").at(-1)}`,
    kind: "transformation-kind",
    label,
    aliases: profile.aliases,
    scope: profile.scope,
    nature: profile.nature,
    sourceUsage: [
      "先确认触发四化的来源天干。",
      "再确认四化属于本命、大限、流年、流月、流日还是流时。",
      "同一颗四化在不同盘层含义不同，必须保留来源标签。"
    ],
    targetUsage: profile.targetUsage,
    palaceUsage: [
      "目标宫位决定四化进入的人事主题。",
      "本宫、对宫、三方四正和夹宫用于判断四化如何扩散。",
      "四化解释要落回宫位，不只停留在星曜名称。"
    ],
    flowUsage: [
      "本命四化看长期底盘。",
      "大限四化看十年阶段。",
      "流年、流月、流日、流时四化按时间层级逐级降权。"
    ],
    combinationUsage: profile.combinationUsage,
    evidenceFields: [
      "transformationStarId",
      "sourceStem",
      "sourceFlowType",
      "targetStarId",
      "targetPalace",
      "sourceRuleIds"
    ],
    cautions: profile.cautions,
    relatedTransformationStarIds: [starId]
  })
}

function buildStemTriggerTopic(stem: HeavenlyStem): ZiweiTransformationTopicContentDetail {
  const rules = NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM[stem]
  const label = `${STEM_LABELS[stem]}干四化`
  const ruleLines = rules.map((rule) => {
    return `${starLabel(rule.transformationStarId)} -> ${starLabel(rule.targetStarId)}`
  })

  return detail({
    topicId: `transformation.stem.${stem}`,
    kind: "stem-trigger",
    label,
    aliases: [`${STEM_LABELS[stem]}干禄权科忌`, `${STEM_LABELS[stem]}年干四化`],
    scope: `${STEM_LABELS[stem]}干触发的化禄、化权、化科、化忌目标星组合。`,
    nature:
      `${label}用于确认“谁触发四化”和“四化落到哪颗目标星”。它是四化解释的来源层，不是独立断语；必须继续回到目标星、目标宫、盘层和关系结构。`,
    sourceUsage: [
      "天干是四化触发来源，必须保留在解释证据中。",
      "本命使用出生年干，动态盘使用当前流层对应的天干语境。",
      "同一目标星在不同天干下被不同四化触发，不能混用。"
    ],
    targetUsage: [
      ...ruleLines,
      "目标星决定四化的承接方式，目标宫决定四化进入的生活主题。",
      "若目标星没有落入当前盘中或来源缺失，需要标记为待复核。"
    ],
    palaceUsage: [
      "目标星所在宫位是解释四化的第一落点。",
      "目标宫的对宫和三方四正用于复核四化扩散范围。",
      "宫干语境可辅助解释，但不替代目标星和盘层。"
    ],
    flowUsage: [
      "本命层使用出生年干触发。",
      "大限、流年、流月、流日、流时层要标明对应盘层。",
      "短周期四化不能改写本命长期结构。"
    ],
    combinationUsage: [
      "禄权科同会可作加吉增强。",
      "化忌同宫、会照或夹宫需要进入破格复核。",
      "四化组合必须逐条确认目标星，不用数量概括代替证据。"
    ],
    evidenceFields: [
      "stem",
      "rules",
      "transformationStarId",
      "targetStarId",
      "targetPalace",
      "sourceRuleIds"
    ],
    cautions: [
      "不要把天干五行直接当成四化结论。",
      "不要把本命年干四化和流年四化混在一起。",
      "不要重新定义四化目标表。"
    ],
    relatedTransformationStarIds: rules.map((rule) => rule.transformationStarId),
    relatedStem: stem
  })
}

function buildFlowLayerTopic(input: (typeof FLOW_TOPICS)[number]): ZiweiTransformationTopicContentDetail {
  return detail({
    topicId: input.topicId,
    kind: "flow-layer",
    label: input.label,
    aliases: [...input.aliases],
    scope: input.scope,
    nature: input.nature,
    sourceUsage: [
      "先确认当前查看盘层。",
      "再确认该盘层使用的天干来源。",
      "同一页面可以展示上级盘层标记，但当前分析必须有唯一主视角。"
    ],
    targetUsage: [
      "四化必须落到目标星。",
      "目标星必须再落到目标宫。",
      "目标星、目标宫和来源盘层缺一不可。"
    ],
    palaceUsage: [
      "目标宫位决定四化进入的主题。",
      "动态命宫决定当前盘层的主视角。",
      "本命宫位提供底盘承接，动态宫位提供时间触发。"
    ],
    flowUsage: [...input.flowUsage],
    combinationUsage: [
      "当前盘层四化可参与当前盘层格局判断。",
      "上级盘层四化可作为背景，不应覆盖当前盘层主视角。",
      "多层四化同见时，按本命、大限、流年、流月、流日、流时分层展示。"
    ],
    evidenceFields: [
      "flowType",
      "flowLabel",
      "sourceStem",
      "transformationStarId",
      "targetStarId",
      "targetPalace",
      "sourceRuleIds"
    ],
    cautions: [
      "不要未选择流年却显示流年四化为当前层。",
      "不要把短周期四化写成长期结论。",
      "不要隐藏上级盘层背景。"
    ],
    relatedTransformationStarIds: [...TRANSFORMATION_KIND_ORDER],
    relatedFlowType: input.relatedFlowType
  })
}

function detail(
  input: Omit<ZiweiTransformationTopicContentDetail, "sections" | "sourceReferences">
): ZiweiTransformationTopicContentDetail {
  const sourceReferences = buildTransformationTopicSourceReferences()

  return {
    ...input,
    sourceReferences,
    sections: [
      {
        title: "四化专题本体",
        items: [input.nature, `适用范围：${input.scope}`]
      },
      {
        title: "来源用法",
        items: input.sourceUsage
      },
      {
        title: "目标星用法",
        items: input.targetUsage
      },
      {
        title: "目标宫用法",
        items: input.palaceUsage
      },
      {
        title: "盘层用法",
        items: input.flowUsage
      },
      {
        title: "组合与格局",
        items: input.combinationUsage
      },
      {
        title: "证据字段",
        items: input.evidenceFields
      },
      {
        title: "误读边界",
        items: input.cautions
      }
    ]
  }
}

function starLabel(starId: ZiweiStarId): string {
  return getZiweiStarDefinition(starId)?.label ?? starId
}

