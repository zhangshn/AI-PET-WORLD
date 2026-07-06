export type ZiweiCurrentPatternSynthesisProfileId =
  | "favorable-literary-assistant"
  | "main-structure"
  | "wealth-power-resource"
  | "malefic-pressure"
  | "misc-detail"
  | "adverse-breakage"
  | "dynamic-trigger"
  | "pending-review"

export interface ZiweiCurrentPatternSynthesisDepthProfile {
  profileId: ZiweiCurrentPatternSynthesisProfileId
  label: string
  patternCategories: string[]
  dictionaryBoundary: string[]
  hitEvidenceRules: string[]
  strengthRules: string[]
  breakageRules: string[]
  dynamicLayerRules: string[]
  multiPatternPriorityRules: string[]
  paragraphOutputRules: string[]
  hideRules: string[]
  cautions: string[]
}

export const ZIWEI_CURRENT_PATTERN_SYNTHESIS_DEPTH_PROFILES: ZiweiCurrentPatternSynthesisDepthProfile[] =
  [
    {
      profileId: "favorable-literary-assistant",
      label: "文曜辅佐吉格综合",
      patternCategories: ["literary", "assistant"],
      dictionaryBoundary: [
        "总字典解释文曜、辅曜、贵人和名誉结构本身；当前盘只解释已经命中的文曜辅佐类格局。",
        "当前盘必须说明命中位置、命中宫位、参与星曜、三方四正和四化来源。",
        "没有命中的文星、辅曜和贵人结构不得作为当前盘格局展示。"
      ],
      hitEvidenceRules: [
        "必须有明确的文昌、文曲、左辅、右弼、天魁、天钺、化科或相关辅曜证据。",
        "必须说明这些星曜是同宫、对宫、三方四正、夹宫还是会照。",
        "必须说明命中的是原盘、大限、流年、流月、流日还是流时。"
      ],
      strengthRules: [
        "文曜辅佐类格局遇化科、化禄、庙旺主星、魁钺左右同会时，解释为名誉、文书、学习、贵人和组织支援增强。",
        "主星能承接时，辅曜才提高格局层次；主星弱时，只写为有支援但承接不足。",
        "三方四正清爽且少煞忌时，可写成证据链较完整。"
      ],
      breakageRules: [
        "文昌文曲化忌、空劫同会、羊陀火铃冲破时，文曜优势要转为文书反复、表达压力、名誉争议或支援中断。",
        "辅曜多但主星无力时，不写成高格，只写为外援存在但主轴不足。",
        "短周期才出现的文曜辅佐，只能作为当期帮助，不写成长期格局。"
      ],
      dynamicLayerRules: [
        "原盘命中看长期学习、表达、名誉和贵人结构。",
        "大限命中看十年阶段的文书、证照、平台和外援。",
        "流年命中看年度考试、申请、审核、作品、证书和名誉事件。",
        "流月以下只看短期文书、沟通、协助和流程。"
      ],
      multiPatternPriorityRules: [
        "若同时命中主星组合格局，先读主星结构，再读文曜辅佐对主结构的增强。",
        "若同时命中煞忌破格，必须先写文曜是否能制化压力。",
        "若文曜辅佐和桃花杂曜同见，先区分名誉表达和社交吸引，不混写。"
      ],
      paragraphOutputRules: [
        "第一句说明当前盘命中的文曜辅佐类格局名称和盘层。",
        "第二段列命中证据：星曜、宫位、同宫关系、三方四正、四化和来源规则。",
        "第三段写成色：增强、承接不足、受压或待复核。",
        "第四段写边界：不把总字典解释当作当前盘结论。"
      ],
      hideRules: [
        "没有 patternId 或命中宫位时隐藏。",
        "只有单颗文曜但未形成格局时，不显示为格局结果。",
        "短周期未启用时隐藏流月、流日、流时格局段。"
      ],
      cautions: [
        "不能把文星直接写成必定考试成功。",
        "不能把贵人星写成现实中一定有人帮助。"
      ]
    },
    {
      profileId: "main-structure",
      label: "主星骨架格局综合",
      patternCategories: ["mainCombo"],
      dictionaryBoundary: [
        "总字典解释主星组合的结构含义；当前盘解释这张盘中主星组合如何落宫、会照和承接。",
        "主星骨架必须结合宫位主题、庙旺落陷、四化、三方四正和动态盘层级。",
        "主星组合不能脱离本宫和关系宫位独立下结论。"
      ],
      hitEvidenceRules: [
        "必须有明确主星组合或主星格局命中。",
        "必须说明主星落在哪个宫、是否同宫、是否对照、是否三方会照。",
        "必须列出主星亮度、同宫辅煞杂和四化修正。"
      ],
      strengthRules: [
        "主星庙旺、三方有吉辅、四化顺承、格局少煞忌时，主星骨架较清楚。",
        "命宫、官禄、财帛、迁移能互相承接时，主星结构更容易落到现实主题。",
        "大限或流年重复触发原盘主星结构时，阶段主题更集中。"
      ],
      breakageRules: [
        "主星落陷、煞忌同宫、空劫夹耗、三方受冲时，主星优势要降权。",
        "主星强但财官迁承接不足时，只写主轴强，不写现实落地充分。",
        "主星组合在短周期才出现时，不写成终身格局。"
      ],
      dynamicLayerRules: [
        "原盘主星格局看长期骨架。",
        "大限主星格局看十年阶段主轴。",
        "流年主星格局看年度触发和应期。",
        "流月、流日、流时只看局部事件窗口。"
      ],
      multiPatternPriorityRules: [
        "多格局同盘时，主星骨架优先级高于杂曜细节。",
        "若凶格破格命中，必须先看它是否破坏主星骨架。",
        "若文曜辅佐命中，把它作为主星骨架的增强，不单独盖过主格。"
      ],
      paragraphOutputRules: [
        "先说明主星骨架和所在宫位。",
        "再说明三方四正、对宫和同宫组合。",
        "再说明四化庙旺和动态盘层级。",
        "最后说明成色、破口和复核边界。"
      ],
      hideRules: [
        "没有主星组合命中时隐藏。",
        "只有字典中存在但当前盘未触发时隐藏。",
        "没有宫位证据时不输出主星格局段。"
      ],
      cautions: [
        "不能把主星组合写成现代人格标签。",
        "不能忽略煞忌和四化对主星骨架的修正。"
      ]
    },
    {
      profileId: "wealth-power-resource",
      label: "禄马权科资源格局综合",
      patternCategories: ["wealthPower"],
      dictionaryBoundary: [
        "总字典解释禄、马、权、科等资源和行动结构；当前盘只解释盘中实际命中的资源流动。",
        "资源格局必须说明资源入口、行动路径、权责压力和名誉文书。",
        "不能把禄权科直接写成现实收益、升迁或名誉确定发生。"
      ],
      hitEvidenceRules: [
        "必须有化禄、禄存、天马、化权、化科或相关格局命中。",
        "必须说明资源落在哪个宫位，并和财帛、官禄、迁移、命宫合看。",
        "必须说明是否同时见化忌、空劫、煞曜或破格信号。"
      ],
      strengthRules: [
        "禄与财帛、官禄、迁移承接良好时，资源路径较清楚。",
        "化权有化科或吉辅缓冲时，责任较容易规范化。",
        "天马与四马地、迁移、化禄同见时，行动和流动资源增强。"
      ],
      breakageRules: [
        "禄忌同见时，必须同时写资源入口和牵挂代价。",
        "化权遇煞忌时，权责容易变成压力、控制或争议。",
        "天马遇空劫和煞忌时，行动可能变成奔波、空跑和消耗。"
      ],
      dynamicLayerRules: [
        "原盘命中看长期资源结构。",
        "大限命中看十年资源与责任阶段。",
        "流年命中看年度收支、合同、机会和行动窗口。",
        "流月以下只看短期收付、出行、审核和任务节点。"
      ],
      multiPatternPriorityRules: [
        "若同时有财帛和官禄证据，先读资源来源，再读责任承接。",
        "若同时有凶格破格，先写资源是否被耗散或卡住。",
        "若同时有文曜辅佐，补充文书、证照、名誉和流程。"
      ],
      paragraphOutputRules: [
        "先写资源格局命中盘层和命中宫位。",
        "再写资源从哪里来、靠什么行动、由哪个宫承接。",
        "再写化忌、煞曜、空劫是否造成成本。",
        "最后写不得替代现实财务、法律和职业判断。"
      ],
      hideRules: [
        "没有命中的资源格局不展示。",
        "只有化禄但没有宫位承接时，不写成资源成功。",
        "未启用动态层时隐藏动态资源段。"
      ],
      cautions: [
        "不能输出投资建议。",
        "不能把化权直接写成升职或掌权。"
      ]
    },
    {
      profileId: "malefic-pressure",
      label: "煞曜压力格局综合",
      patternCategories: ["malefic"],
      dictionaryBoundary: [
        "总字典解释煞曜结构和压力类型；当前盘只解释盘中实际命中的煞曜压力格局。",
        "煞曜格局必须同时给制化和修复路径，不输出恐吓式结论。",
        "煞曜压力要结合主星承接、吉曜制化、宫位主题和动态盘层级。"
      ],
      hitEvidenceRules: [
        "必须有擎羊、陀罗、火星、铃星、地空、地劫、化忌或相关煞曜格局命中。",
        "必须说明煞曜是同宫、夹宫、对宫、三方四正还是动态触发。",
        "必须说明受压宫位和影响主题。"
      ],
      strengthRules: [
        "主星庙旺、有化科、左右魁钺、天梁等制化时，压力可以转为纪律、执行或风险意识。",
        "官禄、迁移、财帛等现实宫位能承接时，可解释为高压任务而非纯阻碍。",
        "原盘有制化而流年再触发时，优先写阶段处理和复核。"
      ],
      breakageRules: [
        "煞忌叠加、空劫同会、主星落陷、三方受冲时，破格风险提高。",
        "煞曜进入夫妻、疾厄、财帛、田宅时，必须降级为风险提醒和复核路径。",
        "短周期煞曜只写临时阻滞、冲突或疲劳，不写长期凶断。"
      ],
      dynamicLayerRules: [
        "原盘煞曜格局看长期压力来源。",
        "大限煞曜格局看阶段压力和修复课题。",
        "流年煞曜格局看年度风险触发。",
        "流月、流日、流时只作短周期注意事项。"
      ],
      multiPatternPriorityRules: [
        "煞曜破坏主星格局时，先写主格受压，再写制化。",
        "煞曜与资源格局同见时，要写成本、风险和责任。",
        "煞曜与文曜辅佐同见时，看文书、规则和解释是否能制化。"
      ],
      paragraphOutputRules: [
        "先写压力来源和受压宫位。",
        "再写煞曜关系类型和三方四正。",
        "再写是否有吉曜、化科、庙旺主星制化。",
        "最后写复核边界，不输出灾断。"
      ],
      hideRules: [
        "没有煞曜格局命中时隐藏。",
        "只有单颗煞曜但未形成结构时，不显示为格局。",
        "短周期未启用时隐藏流日流时压力段。"
      ],
      cautions: [
        "不能把煞曜写成必然灾祸。",
        "涉及健康、法律、财务时只作提醒。"
      ]
    },
    {
      profileId: "misc-detail",
      label: "杂曜细节格局综合",
      patternCategories: ["misc"],
      dictionaryBoundary: [
        "总字典解释杂曜主题；当前盘只解释盘中实际形成的杂曜结构。",
        "杂曜格局是细节补充，不能覆盖主星骨架和宫位主轴。",
        "杂曜必须按主题分组，例如喜庆、桃花、名位、声名、孤寡、刑伤、哭虚等。"
      ],
      hitEvidenceRules: [
        "必须有明确杂曜组合、杂曜成对、杂曜会照或杂曜参与格局。",
        "必须说明杂曜属于哪个主题组。",
        "必须说明它是增强、修饰、牵制、破口还是短期提示。"
      ],
      strengthRules: [
        "红鸾天喜同见可增强喜庆和关系触发，但仍需看夫妻、福德和三方四正。",
        "台辅封诰、龙池凤阁同见可增强名位、仪饰和声名，但要看官禄和文曜承接。",
        "杂曜遇吉辅和主星承接时，可提高为有效细节证据。"
      ],
      breakageRules: [
        "桃花遇忌煞要写边界、误会、名声压力和关系成本。",
        "孤寡哭虚遇空劫化忌要写疏离、落空、情绪耗损和复核。",
        "天刑破碎遇煞忌要写规则、修补、破口和风险提醒。"
      ],
      dynamicLayerRules: [
        "原盘杂曜格局看长期细节倾向。",
        "大限杂曜格局看十年阶段的细节主题。",
        "流年杂曜格局看年度事件气氛。",
        "流月以下只看短期触发，不反推原盘。"
      ],
      multiPatternPriorityRules: [
        "杂曜格局低于主星骨架和四化主线。",
        "杂曜与凶格同见时，先写杂曜如何加重或缓和破口。",
        "杂曜与文曜辅佐同见时，先区分声名、名位、才艺和社交。"
      ],
      paragraphOutputRules: [
        "先写杂曜主题组和命中盘层。",
        "再写落宫、同宫、三方四正和相关主星。",
        "再写它是细节增强还是风险提示。",
        "最后写不可覆盖主星主轴。"
      ],
      hideRules: [
        "没有杂曜组合命中时隐藏。",
        "单颗杂曜只作为星曜解释，不显示为格局。",
        "没有当前盘证据时不引用总字典杂曜格局。"
      ],
      cautions: [
        "不能把杂曜当主星。",
        "不能给杂曜强行套庙旺落陷。"
      ]
    },
    {
      profileId: "adverse-breakage",
      label: "凶格破格综合",
      patternCategories: ["adverse"],
      dictionaryBoundary: [
        "总字典解释凶格和破格结构；当前盘只显示已经命中的凶格或破格。",
        "凶格破格必须带明确证据、破坏对象和修复路径。",
        "未命中的凶格不得进入当前盘结果。"
      ],
      hitEvidenceRules: [
        "必须有 patternId、conditionText、matchedPalaces 和 sourceRuleIds。",
        "必须说明破坏的是主星骨架、文曜辅佐、资源格局、关系结构还是动态盘成色。",
        "必须说明煞忌、落陷、空劫、桃花忌、孤寡煞忌等具体证据。"
      ],
      strengthRules: [
        "凶格中若有化科、吉辅、庙旺主星和清楚宫位承接，可写成有修复路径。",
        "原盘压力大但大限或流年有制化时，可写成阶段改善或可处理。",
        "破格证据少且只在短周期出现时，应降权为临时提醒。"
      ],
      breakageRules: [
        "煞忌叠加且无制化时，破格权重提高。",
        "主星落陷、三方受冲、空劫夹耗时，成格质量下降。",
        "化忌打到命宫、夫妻、财帛、官禄、疾厄等关键宫时，必须写复核。"
      ],
      dynamicLayerRules: [
        "原盘凶格看长期结构压力。",
        "大限凶格看十年阶段风险。",
        "流年凶格看年度触发。",
        "流月以下只写短周期风险提醒和复核点。"
      ],
      multiPatternPriorityRules: [
        "凶格破格优先标记风险，但不能覆盖所有吉格。",
        "若吉格和凶格同命中，要写吉格在哪里可用、凶格在哪里破坏。",
        "若多个凶格同时命中，按命宫、三方四正、关键宫和动态层级排序。"
      ],
      paragraphOutputRules: [
        "先写破格名称和盘层。",
        "再写破坏对象和证据。",
        "再写是否有制化和修复。",
        "最后写风险提醒，避免恐吓式断语。"
      ],
      hideRules: [
        "没有明确命中证据时隐藏。",
        "只有总字典说明但当前盘未命中时隐藏。",
        "没有破坏对象时不输出破格段。"
      ],
      cautions: [
        "不能输出灾断。",
        "不能把凶格写成人生定论。"
      ]
    },
    {
      profileId: "dynamic-trigger",
      label: "动态盘触发格局综合",
      patternCategories: ["dynamic"],
      dictionaryBoundary: [
        "动态盘格局解释的是当前时间层的触发，不重写原盘格局。",
        "动态盘必须继承上层：原盘、大限、流年、流月、流日、流时逐级降权。",
        "当前盘解释必须标明格局属于哪一层。"
      ],
      hitEvidenceRules: [
        "必须说明格局命中盘层。",
        "必须说明该层命宫、该层十二宫、该层四化和该层星曜。",
        "必须说明上层背景是否承接。"
      ],
      strengthRules: [
        "动态层与原盘结构一致时，主题集中。",
        "大限和流年同时触发同类格局时，阶段和年度主题更明显。",
        "流月以下只作为应期或短期窗口。"
      ],
      breakageRules: [
        "动态层冲击原盘弱点时，要写阶段触发和复核，不改写原盘。",
        "大限受压而流年再触发时，年度压力加重。",
        "短周期煞忌触发只写临时阻滞。"
      ],
      dynamicLayerRules: [
        "大限格局必须保留原盘底色。",
        "流年格局必须保留大限背景。",
        "流月格局必须保留流年背景。",
        "流日流时格局只作短时提示。"
      ],
      multiPatternPriorityRules: [
        "动态格局先按层级排序：原盘高于大限，大限高于流年，流年高于流月，流月高于流日和流时。",
        "同层多个格局时，优先看命宫、官禄、财帛、夫妻、疾厄等关键宫。",
        "短周期命中不能盖过原盘和大限。"
      ],
      paragraphOutputRules: [
        "先写当前选择的动态层。",
        "再写继承了哪些上层背景。",
        "再写本层格局命中证据。",
        "最后写本层有效期和降权边界。"
      ],
      hideRules: [
        "未选择对应动态层时隐藏。",
        "没有本层格局命中时隐藏。",
        "上层背景不完整时只显示复核提示。"
      ],
      cautions: [
        "不能切到流年后删除大限背景。",
        "不能用流日流时改写原盘结构。"
      ]
    },
    {
      profileId: "pending-review",
      label: "待复核格局综合",
      patternCategories: ["pending"],
      dictionaryBoundary: [
        "待复核格局只保留目录、来源和复核入口，不进入正式当前盘结论。",
        "规则、样例、来源或边界未闭合时，不能显示为已成格。",
        "待复核资料用于后续人工校盘和规则补齐。"
      ],
      hitEvidenceRules: [
        "必须记录缺少的是条件、来源、样例、盘层还是命中证据。",
        "必须标明复核队列编号或来源规则缺口。",
        "必须禁止进入正式段落。"
      ],
      strengthRules: [
        "补齐规则、来源和样例以后才可转为正式格局。",
        "同类资料多源一致时，可提高复核优先级。",
        "人工样例验证通过后再考虑进入正式目录。"
      ],
      breakageRules: [
        "来源冲突、规则不清、样例不足时继续保留待复核。",
        "无法追溯来源的断语不得进入正式字典。",
        "现代资料正文不能直接入库。"
      ],
      dynamicLayerRules: [
        "待复核格局不参与动态盘当前结论。",
        "如仅动态盘触发但无原盘承接，应继续待复核。",
        "短周期触发不能作为正式成格依据。",
        "动态层来源、命宫、四化或命中宫位缺失时，不得显示为当前盘格局。"
      ],
      multiPatternPriorityRules: [
        "待复核格局优先级低于所有正式命中格局。",
        "待复核项不得破坏已命中的正式格局。",
        "待复核项只在复核面板或资料字典中出现。"
      ],
      paragraphOutputRules: [
        "只输出待复核原因。",
        "列出缺失字段。",
        "列出下一步复核动作。",
        "不输出命盘结论。"
      ],
      hideRules: [
        "当前盘结果隐藏待复核格局。",
        "用户未打开资料字典或复核面板时隐藏。",
        "无来源编号时隐藏。"
      ],
      cautions: [
        "不能把待复核内容写成正式断语。",
        "不能用自由发挥补齐缺失规则。"
      ]
    }
  ]

export function getAllZiweiCurrentPatternSynthesisDepthProfiles(): ZiweiCurrentPatternSynthesisDepthProfile[] {
  return ZIWEI_CURRENT_PATTERN_SYNTHESIS_DEPTH_PROFILES
}

export function getZiweiCurrentPatternSynthesisDepthProfile(
  profileId: ZiweiCurrentPatternSynthesisProfileId
): ZiweiCurrentPatternSynthesisDepthProfile | undefined {
  return ZIWEI_CURRENT_PATTERN_SYNTHESIS_DEPTH_PROFILES.find(
    (profile) => profile.profileId === profileId
  )
}
