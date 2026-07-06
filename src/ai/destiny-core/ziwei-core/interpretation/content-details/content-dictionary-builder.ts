import type {
  ZiweiStarCategory,
  ZiweiStarDefinition,
  ZiweiStarId
} from "../../contracts"

import type {
  ZiweiContentDictionarySection,
  ZiweiContentElement,
  ZiweiContentYinYang,
  ZiweiPatternContentDetailInput,
  ZiweiPatternContentDictionaryDetail,
  ZiweiStarContentDictionaryDetail,
  ZiweiStarContentDetail
} from "./content-detail-types"
import { getStarContentDetail } from "./content-detail-resolver"
import { getPatternContentDetail } from "./pattern-meaning-catalog"
import {
  getPalaceContentDetail,
  ZIWEI_PALACE_ORDER
} from "./palace-meaning-catalog"
import {
  buildPatternDictionarySourceReferences,
  buildStarDictionarySourceReferences
} from "./content-source-reference-map"
import { getSpecificStarPairCombinationContentDetailsForStar } from "./star-pair-combination-catalog"

interface StarCategoryDictionaryProfile {
  yinYang: ZiweiContentYinYang
  element: ZiweiContentElement
  nature: string
  coreThemes: string[]
  strengths: string[]
  risks: string[]
  favorableSignals: string[]
  unfavorableSignals: string[]
  palaceFocus: string
  personalityTendency: string
  worldBehaviorHint: string
  readingNotes: string[]
  symbolicMeanings: string[]
  functionalRole: string[]
  palaceUsage: string[]
  brightnessUsage: string[]
  combinationUsage: string[]
  interpretationSteps: string[]
  cautions: string[]
  reusableScenes: string[]
}

const STAR_CATEGORY_DICTIONARY_PROFILES: Record<
  ZiweiStarCategory,
  StarCategoryDictionaryProfile
> = {
  empty: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "空类占位不作为正式星曜解释，只用于数据结构兼容和未归类校验。",
    coreThemes: ["占位", "校验", "缺口"],
    strengths: ["方便检查缺项", "避免未分类数据静默丢失"],
    risks: ["不能用于正式断语", "不能替代真实星曜"],
    symbolicMeanings: ["空位", "待校准", "资料缺口"],
    functionalRole: ["提示资料未归类", "提醒后续补齐"],
    palaceUsage: ["只作为异常提示，不参与宫位解释。"],
    brightnessUsage: ["不参与庙旺落陷。"],
    combinationUsage: ["不参与组合判断。"],
    interpretationSteps: ["先确认是否误入空类。", "再回到星曜目录补正式 ID。"],
    cautions: ["不得输出为真实星曜结论。"],
    reusableScenes: ["数据校验", "缺口追踪"]
  }),
  main: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "主星是紫微斗数盘面的骨架星曜，用来判断宫位主轴、命盘重心、十二宫议题和主要承接方式。",
    coreThemes: ["主轴", "宫位重心", "承接", "命盘议题"],
    strengths: ["决定宫位主线", "便于建立解释层级", "可承接格局与四化"],
    risks: ["不能脱离庙旺落陷判断", "不能忽略三方四正和煞忌"],
    symbolicMeanings: ["命盘骨架", "宫位发动机", "主要叙事核心"],
    functionalRole: ["确定宫位主调", "承接辅曜煞曜杂曜", "参与格局成败"],
    palaceUsage: ["先看主星所在宫位的职责，再看主星如何承担该宫位主题。", "同一主星入不同宫时，先换宫位语境，再保留星曜本性。"],
    brightnessUsage: ["主星必须结合庙旺落陷判断层次。", "庙旺时主题更稳定，落陷时主题更费力或表现偏折。"],
    combinationUsage: ["同宫主星看互相调性。", "三方四正看支援、牵制和破格。"],
    interpretationSteps: ["确认主星名称和落宫。", "读取庙旺落陷。", "看同宫辅煞杂曜。", "看三方四正与四化。"],
    cautions: ["不能只凭单颗主星下结论。", "不能把主星含义直接套到所有宫位。"],
    reusableScenes: ["基础命盘解释", "命盘骨架", "宫位分析", "格局分析"]
  }),
  assistant: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "辅曜用于补强、承接、润色和引入外部支持，重点观察助力来源、协作方式和贵人结构。",
    coreThemes: ["助力", "贵人", "协作", "补强"],
    strengths: ["增强主星发挥", "带来支援资源", "改善表达和执行"],
    risks: ["主星无力时助力难承接", "遇煞忌时支援会变成牵挂"],
    symbolicMeanings: ["外部支援", "组织协作", "能力补充"],
    functionalRole: ["辅佐主星", "缓和压力", "提升格局层次"],
    palaceUsage: ["看辅曜帮助哪个宫位完成任务。", "辅曜不单独决定主线，只修饰和增强主轴。"],
    brightnessUsage: ["有庙旺表的辅曜按亮度判断发挥稳定度。", "无固定表者以组合和宫位承接为主。"],
    combinationUsage: ["左右、昌曲、魁钺、禄马等成组出现时优先看协同。", "夹拱和会照要看是否真正支援命宫或重点宫。"],
    interpretationSteps: ["先识别辅曜组别。", "再看它支援的主星。", "最后看是否被煞忌冲破。"],
    cautions: ["不能让辅曜解释压过主星。", "贵人星也要看是否落在能发挥的位置。"],
    reusableScenes: ["助力分析", "贵人分析", "格局加吉", "协作结构"]
  }),
  malefic: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "煞曜代表压力、阻滞、冲突、消耗和必须处理的风险点，不等于绝对凶断，重点看制化和承接。",
    coreThemes: ["压力", "冲突", "风险", "修复"],
    strengths: ["暴露问题边界", "形成行动压力", "推动修复和突破"],
    risks: ["增加冲突成本", "放大急躁和消耗", "形成破格或反复问题"],
    symbolicMeanings: ["阻力", "警讯", "代价", "边界"],
    functionalRole: ["提示风险来源", "测试主星承压能力", "参与破格判断"],
    palaceUsage: ["看煞曜落在哪个宫位，该宫位就是压力和修复入口。", "煞曜入三方四正时要看是否冲击重点宫。"],
    brightnessUsage: ["有亮度表的煞曜按庙陷判断是否可控。", "落陷或叠忌时优先做风险提示。"],
    combinationUsage: ["羊陀、火铃、空劫、煞忌叠加要看层级。", "有吉曜制化时不能直接按坏结果判断。"],
    interpretationSteps: ["确认煞曜类型。", "看是否同宫或会照重点宫。", "看主星能否承压。", "寻找制化和修复路径。"],
    cautions: ["不输出绝对灾断。", "必须同时说明风险来源和化解/承接路径。"],
    reusableScenes: ["风险提示", "破格分析", "压力来源", "修复路线"]
  }),
  transformation: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "四化是星曜被天干触发后的动态属性，用来判断资源、权责、名誉和牵挂的流向。",
    coreThemes: ["触发", "流向", "变化", "牵引"],
    strengths: ["能指出重点星曜", "能连接动态时间", "能解释事件牵引"],
    risks: ["不能脱离目标星曜", "化忌容易被误读为绝对坏事"],
    symbolicMeanings: ["能量转化", "事件焦点", "动态牵引"],
    functionalRole: ["标记被触发的星曜", "连接宫位与时间", "参与格局增强或破格"],
    palaceUsage: ["先看四化落到哪个目标星，再看目标星所在宫位。", "同一四化在不同宫位要换成对应生活领域解释。"],
    brightnessUsage: ["四化不单独按庙旺落陷，重点看目标星曜状态。", "目标星落陷时四化作用更费力。"],
    combinationUsage: ["禄权科可成加吉结构。", "忌与煞曜叠加时进入破格或风险复核。"],
    interpretationSteps: ["确认四化名称。", "确认目标星曜。", "确认目标宫位。", "判断是资源、权责、名誉还是牵挂。"],
    cautions: ["四化不是普通静态星曜。", "必须保留 targetStarId 和来源天干。"],
    reusableScenes: ["动态盘分析", "事件流向", "格局加减分", "时间触发"]
  }),
  misc: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "杂曜负责补充细节、关系气氛、仪式感、孤寡桃花、名位和小型触发点。",
    coreThemes: ["细节", "气氛", "触发", "补充"],
    strengths: ["补足主星未覆盖的细节", "提示关系和情绪气候", "帮助校准特殊结构"],
    risks: ["容易被过度放大", "不能压过主星和宫位主轴"],
    symbolicMeanings: ["细节开关", "关系气候", "小型事件触发"],
    functionalRole: ["补充主星", "提示特殊人际状态", "参与杂曜格局"],
    palaceUsage: ["杂曜入宫先看补充哪类细节。", "桃花、孤寡、刑耗等要结合宫位主题判断。"],
    brightnessUsage: ["多数杂曜不按固定庙旺表判断。", "以同宫、会照和主星承接为主。"],
    combinationUsage: ["成对杂曜优先看组合，如红鸾天喜、龙池凤阁、三台八座。", "遇煞忌时看细节是否转成风险。"],
    interpretationSteps: ["识别杂曜子类。", "看是否成对或成组。", "再看是否支援或干扰主星。"],
    cautions: ["杂曜不是主轴。", "没有成组时解释权重要降低。"],
    reusableScenes: ["细节补充", "关系提示", "仪式感", "杂曜格局"]
  }),
  lifecycle: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "长生十二神描述气势从发生、成长、鼎盛到衰退、收藏、再孕育的生命周期位置。",
    coreThemes: ["生命周期", "气势", "阶段", "起伏"],
    strengths: ["能判断宫位气势阶段", "适合补充主星状态", "帮助看一件事的成熟度"],
    risks: ["不能单独决定吉凶", "容易被误当成具体事件"],
    symbolicMeanings: ["生长阶段", "能量状态", "成熟度"],
    functionalRole: ["标记宫位气势", "辅助判断发展阶段", "补充动态节奏"],
    palaceUsage: ["看该宫主题处在生、旺、衰、藏的哪一段。", "必须回到主星和宫位任务上解释。"],
    brightnessUsage: ["长生十二神不是庙旺落陷表。", "它看气势阶段，不替代星曜亮度。"],
    combinationUsage: ["与主星庙旺同看可判断承接度。", "与煞忌同看可判断压力处于哪个阶段。"],
    interpretationSteps: ["确认长生位。", "翻译成发展阶段。", "结合宫位主题和主星。"],
    cautions: ["不要把阶段词直接断成结果。"],
    reusableScenes: ["气势分析", "阶段判断", "动态节奏"]
  }),
  yearly: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "年系星曜描述流年层面的行政、耗损、喜庆、病符、官符、岁前与将前触发。",
    coreThemes: ["流年", "岁运", "触发", "年度主题"],
    strengths: ["适合解释年度事件焦点", "能补充流年层细节", "帮助区分博士、岁前、将前系统"],
    risks: ["不能套到本命长期结论", "不同年系来源必须保留"],
    symbolicMeanings: ["年度触发", "流年气候", "岁运提示"],
    functionalRole: ["标记流年重点", "补充动态盘", "参与年度风险和机会提示"],
    palaceUsage: ["看年系星曜落入哪个宫位，该宫是年度细节触发区。", "不同流年更换后必须重新落盘。"],
    brightnessUsage: ["年系星曜一般不按本命庙旺表解释。", "以流年层级和来源系统为主。"],
    combinationUsage: ["博士十二神、岁前十二神、将前十二神要分系统看。", "与流年四化、流年命宫同看。"],
    interpretationSteps: ["确认年系来源。", "确认流年落宫。", "结合当前流年命宫和四化。"],
    cautions: ["不能把年系星曜当成本命常驻星曜。"],
    reusableScenes: ["流年盘", "动态盘", "年度提醒", "岁运分析"]
  }),
  monthly: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "月系星曜描述月份层面的短周期情绪、人际、消耗和触发。",
    coreThemes: ["月份", "短周期", "情绪", "触发"],
    strengths: ["适合看月度节奏", "能补充短期事件气氛"],
    risks: ["周期较短，不能放大成长期结论", "必须结合流年背景"],
    symbolicMeanings: ["月度气候", "短期提醒", "情绪波动"],
    functionalRole: ["标记月度重点", "补充流月盘", "提示短期变化"],
    palaceUsage: ["看月系星落入哪个宫位，该宫是本月短期重点。"],
    brightnessUsage: ["月系星曜不替代主星庙旺。"],
    combinationUsage: ["与流月命宫、流月四化、流日触发合看。"],
    interpretationSteps: ["确认流月。", "确认落宫。", "结合年度背景降权解释。"],
    cautions: ["不要把月度星曜解释成本命长期结论。"],
    reusableScenes: ["流月盘", "月度提醒", "短期节奏"]
  }),
  dailyHourly: buildCategoryProfile({
    yinYang: "mixed",
    element: "mixed",
    nature: "日时系星曜描述日、时层面的微周期触发，重点看当下行动、临时状态和细节提示。",
    coreThemes: ["日时", "微周期", "临场", "即时触发"],
    strengths: ["适合做短期提示", "能提示当下行动注意点"],
    risks: ["影响周期很短", "不能上升为长期判断"],
    symbolicMeanings: ["即时气候", "临场提醒", "细节触发"],
    functionalRole: ["标记日时重点", "补充流日流时盘", "辅助即时决策"],
    palaceUsage: ["看日时星落宫所代表的当下注意领域。"],
    brightnessUsage: ["日时系星曜不按长期庙旺解释。"],
    combinationUsage: ["与流日命、流时命和当时四化同看。"],
    interpretationSteps: ["确认流日或流时。", "确认落宫。", "只输出短周期提示。"],
    cautions: ["不要把日时提示解释为长期命格。"],
    reusableScenes: ["流日盘", "流时盘", "即时提醒"]
  })
}

export function buildZiweiStarContentDictionaryDetail(
  star: ZiweiStarDefinition
): ZiweiStarContentDictionaryDetail {
  const manualDetail = getStarContentDetail(star.starId)
  const base = manualDetail ?? buildFallbackStarDetail(star)
  const categoryProfile = STAR_CATEGORY_DICTIONARY_PROFILES[star.category]
  const source = manualDetail ? "manual" : "category-fallback"
  const categoryLabel = getStarCategoryDictionaryLabel(star.category)

  return {
    ...base,
    source,
    sourceReferences: buildStarDictionarySourceReferences(),
    aliases: unique([star.label, ...(star.aliases ?? [])]),
    extendedOverview: buildExtendedOverview({
      star,
      base,
      categoryProfile,
      categoryLabel
    }),
    identity: [
      `${star.label} 属于${categoryLabel}，解释时先看星曜本体，再进入宫位、组合和动态盘层。`,
      source === "manual"
        ? "该星曜已有逐星手工细节资料。"
        : "该星曜先使用同类星曜通用资料承接，后续可继续补充逐星专条。"
    ],
    symbolicMeanings: unique([
      ...categoryProfile.symbolicMeanings,
      ...base.coreThemes
    ]),
    functionalRole: categoryProfile.functionalRole,
    palaceUsage: categoryProfile.palaceUsage,
    brightnessUsage: categoryProfile.brightnessUsage,
    combinationUsage: categoryProfile.combinationUsage,
    interpretationSteps: categoryProfile.interpretationSteps,
    cautions: unique([...categoryProfile.cautions, ...base.readingNotes.slice(0, 2)]),
    reusableScenes: categoryProfile.reusableScenes,
    extendedSections: buildExtendedStarSections({
      star,
      base,
      categoryProfile,
      categoryLabel
    }),
    sections: [
      { title: "身份定位", items: [`分类：${categoryLabel}`, ...unique([star.label, ...(star.aliases ?? [])]).map((alias) => `名称：${alias}`)] },
      { title: "核心象义", items: unique([...categoryProfile.symbolicMeanings, ...base.coreThemes]) },
      { title: "入宫用法", items: categoryProfile.palaceUsage },
      { title: "组合用法", items: categoryProfile.combinationUsage },
      { title: "读盘步骤", items: categoryProfile.interpretationSteps },
      { title: "注意事项", items: unique([...categoryProfile.cautions, ...base.readingNotes]) }
    ]
  }
}

function buildExtendedOverview(params: {
  star: ZiweiStarDefinition
  base: ZiweiStarContentDetail
  categoryProfile: StarCategoryDictionaryProfile
  categoryLabel: string
}): string {
  return [
    `${params.star.label}的本体解释不能只看一句星性，也不能直接套入当前盘的落宫。`,
    `它首先属于${params.categoryLabel}，基础性质是：${params.base.nature}，核心观察面向包括${joinChinese(params.base.coreThemes)}。`,
    `读这颗星时，应先理解它自身的气质、优势、风险和喜忌，再进入十二宫语境、庙旺落陷、同宫会照、四化牵动和整体盘结构。`,
    `原盘看长期底色，大限看十年阶段，流年看年度触发，流月看月度气候，流日和流时只看短周期应事；这些层级不能互相替代。`,
    `因此这里记录的是可跨盘复用的星曜资料，不是某一张盘的最终断语。`
  ].join("")
}

function buildExtendedStarSections(params: {
  star: ZiweiStarDefinition
  base: ZiweiStarContentDetail
  categoryProfile: StarCategoryDictionaryProfile
  categoryLabel: string
}): ZiweiContentDictionarySection[] {
  const { star, base, categoryProfile } = params
  const categoryLabel = params.categoryLabel
  const symbolicMeanings = unique([
    ...categoryProfile.symbolicMeanings,
    ...base.coreThemes
  ])

  return [
    {
      title: "本质定位",
      items: [
        `${star.label}先作为${categoryLabel}理解，它的基础性质是：${base.nature}这表示它在紫微斗数资料中不是孤立的吉凶标签，而是一组稳定的观察角度。`,
        `本体层要先看${joinChinese(base.coreThemes)}这些主题，再看它进入哪一宫、是否庙旺、是否与其他星曜形成组合。若跳过本体层，直接拿当前落宫下结论，容易把星曜资料和具体盘面解释混在一起。`,
        `${star.label}的字典资料要服务于后续分析，但本身不是某张盘的裁断。先建立“这颗星是什么”，再建立“它在某个宫位怎么表达”，最后才进入“这张盘为什么这样表现”。`
      ]
    },
    {
      title: "象义展开",
      items: [
        `${star.label}的通用象义可从${joinChinese(symbolicMeanings)}展开。象义不是固定事件，而是解释方向：它会在命宫表现为气质，在财帛宫表现为资源处理，在官禄宫表现为事业方式，在夫妻宫表现为关系互动。`,
        `同一颗星进入不同宫位时，字面含义不会机械照搬，而是把这些象义转换到该宫的主题中。比如“资源”“秩序”“变化”“压力”“照护”等词，都要回到宫位、组合和盘层后再落成具体解释。`
      ]
    },
    {
      title: "星曜作用与应事倾向",
      items: [
        `${star.label}在盘面中的作用重点是：${base.personalityTendency}这里记录的是星曜在宫位、格局和动态盘层里的应事方向，不是脱离盘面的单独判断。`,
        `若它得到吉曜、庙旺或稳定组合，星曜作用更容易表现为可承接、可落地、可形成结构助力；若遇煞忌、落陷或组合失衡，则要复核阻滞、反复、消耗、破格或修复路径。`
      ]
    },
    {
      title: "能力与正向发挥",
      items: [
        `${star.label}的优势可归纳为${joinChinese(base.strengths)}。这些优势通常需要宫位任务来承接：入命身看个人主轴，入财帛看资源运用，入官禄看工作方式，入迁移看外部表现。`,
        `喜见条件包括${joinChinese(base.favorableSignals)}。这些信号代表星曜更容易发挥稳定、清楚、可被外界接住的一面，但仍要结合三方四正、庙旺落陷和四化判断层次。`
      ]
    },
    {
      title: "风险与失衡表现",
      items: [
        `${star.label}的风险面包括${joinChinese(base.risks)}。风险不是必然结果，而是当星曜缺少承接、组合受冲、煞忌过重或盘层触发时，较容易出现的偏向。`,
        `忌见条件包括${joinChinese(base.unfavorableSignals)}。这些条件出现时，需要优先复核是否存在过度、阻滞、反复、空耗、冲突、误解或失控，而不是直接做绝对凶断。`
      ]
    },
    {
      title: "入十二宫前置原则",
      items: [
        `${star.label}入宫时先看该宫主题，再把星曜本体象义转换进去。${base.palaceFocus}`,
        `${joinChinese(categoryProfile.palaceUsage)}这些规则只是入宫解释的入口，后续还要看该宫主星结构、辅煞杂曜、四化、庙旺落陷和对宫三方。`
      ]
    },
    ...buildTwelvePalaceReadingSections({ star, base, categoryLabel }),
    {
      title: "庙旺落陷与状态判断",
      items: [
        `${joinChinese(categoryProfile.brightnessUsage)}庙旺落陷说明星曜状态和发挥顺逆，不等于单独决定吉凶。`,
        `当${star.label}庙旺或得地时，通常更容易表现为清楚、稳定、可承接的一面；落陷或受冲时，则要看主题是否费力、偏折、迟滞或需要外力补救。`
      ]
    },
    {
      title: "同宫会照与组合原则",
      items: [
        `${joinChinese(categoryProfile.combinationUsage)}组合解释必须分清同宫、对宫、三方四正、夹宫和四化牵动，不能把所有星曜简单相加。`,
        `${star.label}遇到不同星曜时，应先判断对方是主星、辅曜、煞曜、四化、杂曜还是流系星，再看它们是增强、牵制、修饰、触发还是破坏本星的主要主题。`,
        `同宫表示直接混合，对宫表示互相拉扯和照见，三方四正表示结构支援或结构压力，夹宫表示两侧环境塑形，四化表示某个天干把星曜功能触发出来。组合解释要说明关系类型，不能只列星名。`,
        `若与吉曜、贵人、文曜、禄马同会，通常先看支援、资源、名誉、行动和承接；若与煞曜、空劫、化忌同会，则先看压力、破耗、反复、误解和修复路径。吉凶都要回到宫位职责判断。`
      ]
    },
    ...buildSpecificPairCombinationSections(star.starId),
    ...buildCombinationDetailSections({ star, base, categoryLabel }),
    {
      title: "动态盘层解释",
      items: [
        `原盘中的${star.label}表示长期底色和基础结构，重点看命身、十二宫、三方四正、庙旺落陷和原局格局。原盘不因短期流动而消失，它是所有动态判断的底盘。`,
        `大限中的${star.label}表示十年阶段中哪类主题被放大。读大限时要看大限命宫、大限十二宫、大限四化和原盘承接，不能把大限直接当成本命。`,
        `流年中的${star.label}表示该年的触发点，重点看流年命宫、流年四化、流年夫妻、流年财帛等动态宫名，以及它与大限和原盘的叠加关系。`,
        `流月中的${star.label}表示月度气候和短期重点，适合看当月情绪、事务推进、关系波动和补充判断；它必须服从流年主线，不宜放大成长期结论。`,
        `流日与流时中的${star.label}只作为日内、时内的细节提示，适合看临场动作、短期提醒和即时反馈。它们可以帮助微调安排，但不能反推长期命格。`
      ]
    },
    {
      title: "读盘顺序",
      items: [
        `${joinChinese(categoryProfile.interpretationSteps)}这个顺序的目的，是先建立星曜本体，再进入宫位和组合，最后才进入整盘判断。`,
        `若用于具体盘面，应再接入命身宫、十二宫关系、格局命中、破格复核、动态流年和样例校准。星曜字典本身只提供资料，不直接替代完整排盘分析。`
      ]
    },
    {
      title: "资料来源与复核边界",
      items: [
        `${star.label}的字典解释以本项目星曜目录、安星规则、庙旺表、四化规则、十二宫资料、地支资料和格局资料为结构来源，并参考传统紫微斗数术语体系整理。这里保存的是资料化、结构化后的解释口径，不收录现代书籍原文。`,
        `若后续接入古籍资料，应优先保存书名、卷次、条目位置、术语、可复核摘要和来源可信度；具体断语进入盘面前必须经过去重、冲突标记和人工复核，避免把不同流派口径混成一个绝对结论。`,
        `当前字段可用于资料检索、盘面解释和后续分析，但不能脱离排盘证据直接输出最终判断。最终解释必须说明星曜本体、落宫、同宫、对宫、三方四正、四化、庙旺和动态层级。`
      ]
    },
    {
      title: "常见误读",
      items: [
        `${joinChinese(unique([...categoryProfile.cautions, ...base.readingNotes]))}`,
        `最常见的问题是把${star.label}当成一个单句标签，或者只看当前落宫就下结论。正确做法是先读本体，再读入宫，再读组合，再读整盘；这些层次必须分开记录、分开校准。`
      ]
    }
  ].map((section) => {
    return {
      ...section,
      items: section.items.map((item) => ensureExtendedItemLength(item, star.label))
    }
  })
}

function buildTwelvePalaceReadingSections(params: {
  star: ZiweiStarDefinition
  base: ZiweiStarContentDetail
  categoryLabel: string
}): ZiweiContentDictionarySection[] {
  return [
    {
      title: "十二宫逐宫细则",
      items: ZIWEI_PALACE_ORDER.map((sectorName) => {
        const palace = getPalaceContentDetail(sectorName)

        if (!palace) {
          throw new Error(`Missing palace content detail: ${sectorName}`)
        }

        return [
          `${params.star.label}入${palace.label}时，先把${params.star.label}的${joinChinese(params.base.coreThemes)}转入${palace.corePosition}。`,
          `${palace.label}的本质是：${palace.nature}`,
          `本宫首要问题可从“${palace.primaryQuestions[0]}”切入，再看${params.star.label}是作为${params.categoryLabel}来定主轴、补助力、显压力、引四化，还是只补事件细节。`,
          `${palace.starReadingUsage[0]}若${params.star.label}喜见条件成立，例如${joinChinese(params.base.favorableSignals.slice(0, 2))}，该宫主题较容易被承接；若忌见条件成立，例如${joinChinese(params.base.unfavorableSignals.slice(0, 2))}，则要复核阻滞、耗损、反复或破格。`,
          `逐宫解释不能只停在“${params.star.label}在${palace.label}”这一句，还要接同宫星曜、对宫${palace.relationUsage[0]}、三方四正、庙旺落陷、四化来源和当前盘层。`
        ].join("")
      })
    }
  ]
}

function buildCombinationDetailSections(params: {
  star: ZiweiStarDefinition
  base: ZiweiStarContentDetail
  categoryLabel: string
}): ZiweiContentDictionarySection[] {
  return [
    {
      title: "同宫组合细则",
      items: [
        `${params.star.label}与主星同宫时，主星通常负责宫位主轴，${params.star.label}作为${params.categoryLabel}参与定调；若${params.star.label}本身就是主星，则要看另一颗主星是同向补强、分工并行，还是形成互相牵制。`,
        `${params.star.label}与辅曜同宫时，先看辅曜是否能让${joinChinese(params.base.coreThemes)}得到承接，例如贵人、文书、协作、资源、名位、行动或缓冲；辅曜不能脱离主星独立决定结果。`,
        `${params.star.label}与煞曜同宫时，先看压力从哪里来：是冲突、损耗、阻滞、孤立、急迫、破耗，还是结构被打断。若同宫也有吉曜、庙旺或吉化，则需要写出制化路径，不做单向凶断。`,
        `${params.star.label}与四化同宫时，必须先确认四化来自哪一个天干、作用到哪颗目标星、落在哪个宫位。化禄看资源与欲望，化权看权责与推动，化科看名誉与修饰，化忌看牵挂与阻滞；四化不是普通星曜，也不套庙旺落陷。`,
        `${params.star.label}与杂曜同宫时，杂曜主要补充事件颜色和细节，例如桃花、喜庆、孤寡、耗损、名位、文书、病符、岁运气候等；杂曜必须依附宫位主题和主星结构，不宜反客为主。`
      ]
    },
    {
      title: "对宫与三方四正细则",
      items: [
        `${params.star.label}看对宫时，对宫不是附属信息，而是冲照、对象、外部环境和反馈面。若本宫无主星，对宫主星尤其重要；若对宫煞忌重，则要看外部压力如何回到本宫主题。`,
        `${params.star.label}看三方四正时，三方不是简单加星名，而是看资源来源、结构支援、格局成色和破格条件。辅曜会照多看支援，煞忌会照多看压力，四化会照多看触发方向。`,
        `${params.star.label}被夹宫时，要看左右两侧是否形成夹辅、夹煞、夹忌、夹空或夹贵。夹宫影响的是环境塑形和旁侧牵引，不等于同宫直接混合。`,
        `${params.star.label}进入格局判断时，先确认核心星曜是否在指定宫位或三方范围，再看是否会吉、会煞、庙旺、落陷、化禄、化权、化科、化忌；成格和破格必须同时记录。`,
        `${params.star.label}若同时受到本宫、对宫、三方和夹宫多重信息影响，解释顺序为本宫直接证据优先，其次对宫冲照，再看三方结构，最后看夹宫和动态层补充。冲突信息不能强行合并，要标记复核。`
      ]
    },
    {
      title: "流层组合细则",
      items: [
        `原盘的${params.star.label}是底层结构，解释长期主题和基础格局；大限的${params.star.label}是十年阶段的放大器，必须说明大限命宫、大限十二宫和原盘承接。`,
        `流年的${params.star.label}是年度触发点，解释时要同时保留大限信息。若切到流年，不删除大限证据，而是写成“大限提供阶段背景，流年提供年度应事”。`,
        `流月的${params.star.label}用于月度气候和短期事务推进，必须服从流年主线；流日和流时只看临场、提醒和微调，不反推原局格局。`,
        `动态盘中若出现“流年命、流年夫妻、流年财帛”等标记，表示当前时间层把对应宫位提到前台。解释时要写清楚是哪一层的哪一宫，不可把流年夫妻误写成本命夫妻。`,
        `当${params.star.label}在原盘、大限、流年、流月、流日、流时多层重复出现时，优先判断是否形成同主题反复触发；若层级互相冲突，则以原盘为底、大限为阶段、流年为年度、月日时为短期细节逐层降权。`
      ]
    }
  ]
}

function buildSpecificPairCombinationSections(
  starId: ZiweiStarId
): ZiweiContentDictionarySection[] {
  const details = getSpecificStarPairCombinationContentDetailsForStar(starId)

  if (details.length === 0) {
    return []
  }

  return [
    {
      title: "常见固定组合专条",
      items: details.flatMap((detail) => {
        return [
          `${detail.starALabel}${detail.starBLabel}：${detail.coreReading}`,
          `组合方式：${detail.interactionMode}`,
          `助力看法：${detail.supportiveSignals.slice(-3).join("")}`,
          `破格看法：${detail.pressureSignals.slice(-3).join("")}`,
          `动态看法：${detail.dynamicUsage.slice(-2).join("")}`,
          `复核边界：${detail.cautions.slice(0, 2).join("")}`
        ]
      })
    }
  ]
}

export function buildZiweiPatternContentDictionaryDetail(
  input: ZiweiPatternContentDetailInput
): ZiweiPatternContentDictionaryDetail {
  const detail = getPatternContentDetail(input)

  return {
    ...detail,
    source: "category-derived",
    sourceReferences: buildPatternDictionarySourceReferences(),
    identity: [
      `${detail.label} 属于${detail.category}类格局。`,
      `格局 ID：${detail.patternId}`,
      `格局性质：${detail.nature}`,
      `格局总字典只解释${detail.label}本身的结构、成格条件、破格条件和读盘边界；当前盘解释必须另行引用盘中命中证据。`
    ],
    formationLogic: [
      `原始判定条件：${input.conditionText}`,
      "先确认核心星曜、目标宫位、三方四正或夹拱范围，再判断加吉、加煞、破格和层次。",
      "成格必须有明确命中范围：同宫、对宫、三方四正、夹宫、会照、空宫借对宫或动态盘叠入都要分开标记。",
      "若格局依赖主星组合，要先看主星是否实际落入条件范围；若依赖辅曜或杂曜，要降权为加吉、气氛或细节证据。",
      "若格局依赖四化，必须写明来源天干、化星、目标星、目标宫位和盘层，不把四化当成星曜庙旺。",
      "若格局依赖庙旺落陷，只能使用已有亮度表中存在的星曜，不给无亮度资料的杂曜硬套庙旺。"
    ],
    evidenceChecklist: [
      "命中星曜是否在指定宫位或指定范围。",
      "三方四正、同宫、夹宫等关系是否明确。",
      "来源规则和当前盘层是否一致。",
      "命中宫位是否对应格局要求的命、财、官、迁、福、夫等主题。",
      "是否有同宫主星、对宫照会、三方四正支援或夹宫结构共同指向同一主题。",
      "是否存在化禄、化权、化科、化忌的来源天干和目标星证据。",
      "是否存在煞忌、空劫、落陷、孤寡、桃花或刑耗等破格复核信号。",
      "是否能从 sourceRuleIds、conditionText、matchedPalaces 和 flowType 回查原始命中链。"
    ],
    strengthChecklist: [
      ...detail.enhancementSignals,
      "核心星曜在指定宫位或三方四正范围内重复出现同一主题。",
      "主星庙旺、有辅曜承接，并且煞忌不直接冲破核心条件。",
      "禄权科与格局主题同向，资源、权责、名誉或秩序能被本宫任务承接。",
      "大限或流年触发时，上级盘层已有同类结构，动态盘只是点亮而不是凭空生成。"
    ],
    breakageChecklist: [
      ...detail.breakSignals,
      "核心星曜不在指定范围，只有外围会照或短周期触发。",
      "煞曜、化忌、空劫或落陷直接冲入核心条件位置。",
      "格局所需主星缺承接，只有杂曜或辅曜形成气氛。",
      "动态盘短周期出现但本命和大限没有支撑，不应升格为长期格局。"
    ],
    interpretationSteps: [
      "先确认是否命中核心条件。",
      "再看加吉、庙旺和辅佐结构。",
      "再看煞忌、空劫、落陷和破格。",
      "再看格局落在哪个宫位主题，并把格局语言转译为该宫的人事范围。",
      "再看三方四正是否同向支援，还是由财、官、迁、福等宫线带来结构压力。",
      "再看动态盘层级：本命为底盘，大限为阶段，流年为年度触发，流月、流日、流时只作短周期提示。",
      "最后结合当前盘证据输出解释；未命中的格局只留在总字典，不进入当前盘结果。"
    ],
    cautions: [
      "格局解释不能脱离当前盘中证据。",
      "未命中的格局不进入结果展示。",
      "凶格和破格必须同时给出复核路径。",
      "不要把总字典的格局说明直接写成某张盘已经发生的结论。",
      "不要把流月、流日、流时短周期格局反推成本命长期结构。",
      "不要复制外部网站或现代资料的成套断语，只保留项目自有结构化解释和来源元信息。",
      "不要把人格化、行为映射或现实事件结论混入格局总字典。"
    ],
    reusableScenes: [
      "格局总览",
      "命中解释",
      "破格分析",
      "盘面报告",
      "知识检索",
      "动态盘格局复核",
      "三方四正结构分析",
      "人工校验队列"
    ],
    sections: [
      { title: "格局本体", items: [`格局 ID：${detail.patternId}`, `分类：${detail.category}`, detail.nature] },
      { title: "核心主题", items: detail.coreThemes },
      {
        title: "成格条件",
        items: [
          `原始判定条件：${input.conditionText}`,
          "先确认核心星曜、目标宫位、三方四正或夹拱范围，再判断加吉、加煞、破格和层次。",
          "成格必须有明确命中范围：同宫、对宫、三方四正、夹宫、会照、空宫借对宫或动态盘叠入都要分开标记。",
          "若格局依赖四化，必须写明来源天干、化星、目标星、目标宫位和盘层。"
        ]
      },
      {
        title: "成格逻辑",
        items: [
          `先确认${detail.label}的核心星曜、宫位范围、关系结构和盘层来源。`,
          "同宫为直接命中，对宫为照会或借宫，三方四正为结构支援，夹宫为左右包围，会照为远端牵动。",
          "成格后仍要看强弱：主星承接、辅曜加吉、四化同向、庙旺有力时层次提高；煞忌空劫冲破时转入破格复核。"
        ]
      },
      { title: "命中证据", items: [
        "当前盘必须能回查 patternId、conditionText、matchedPalaces、sourceRuleIds、flowType 和命中星曜。",
        "页面只显示盘中实际命中的格局；总字典中的未命中格局不进入结果列表。",
        "若命中来自动态盘，必须标明本命、大限、流年、流月、流日或流时，不跨层级放大。"
      ] },
      { title: "加吉增强", items: [
        ...detail.enhancementSignals,
        "加吉只提高格局承接力，不自动替代核心成格条件。",
        "辅曜、禄权科、庙旺和三方同向支援要分别记录，不能混成一个笼统吉象。"
      ] },
      { title: "加煞破格", items: [
        ...detail.breakSignals,
        "破格要区分核心条件被破、层次下降、短周期受扰、证据不足四种情况。",
        "凶格或破格命中时，输出必须带复核路径和修复入口，不做绝对化断语。"
      ] },
      { title: "宫位关系", items: [
        "命宫格局重本体主轴，财帛宫重资源与得失，官禄宫重事业责任，迁移宫重外部环境。",
        "夫妻、子女、兄弟、父母、交友等人际宫位要转译为关系对象和互动结构，不直接写成人格结论。",
        "福德、田宅、疾厄等宫位要分别转译为精神承接、居住资产和身体风险，不混用同一套断语。"
      ] },
      { title: "三方四正", items: [
        "三方四正用于判断格局是否有结构支援或结构压力。",
        "同一主题在本宫、对宫和三方宫重复出现时，可提高格局权重。",
        "若三方一边加吉一边加煞，要进入冲突复核，不能只取有利或不利一边。"
      ] },
      { title: "四化与庙旺", items: [
        "四化必须写明来源天干、化星、目标星、目标宫和盘层；四化不是庙旺。",
        "庙旺落陷只给有亮度资料的星曜使用，杂曜和周期星没有资料时不能硬套。",
        "化禄、化权、化科、化忌分别看资源、推动、名誉秩序和阻滞牵挂，并回到格局条件复核。"
      ] },
      { title: "动态盘层级", items: [
        "本命盘格局读长期结构，大限格局读十年阶段，流年格局读年度触发。",
        "流月、流日、流时只作短周期提示，必须继承本命、大限和流年的背景。",
        "动态盘命中格局时，页面说明要保留上级盘层，不删除大限或本命背景。"
      ] },
      { title: "当前盘解释边界", items: [
        "总字典解释格局本身，当前盘解释只解释已经命中的格局。",
        "当前盘解释必须结合实际宫位、星曜组合、四化、三方四正和破格证据。",
        "未命中、弱承接或待校准格局只进入复核队列，不进入正式结果。"
      ] },
      { title: "复核路径", items: [
        "先复核原始条件，再复核星曜位置，再复核宫位关系，再复核四化和庙旺。",
        "若命中结果与总盘主题冲突，优先查看是否是动态短周期、外围会照或破格条件。",
        "人工复核时保留来源规则、命中字段、冲突字段和最终采用理由。"
      ] },
      { title: "误读边界", items: [
        ...detail.readingNotes,
        "不把格局名直接翻译成现实结果。",
        "不把凶格写成必然灾祸，也不把吉格写成必然成功。",
        "不把总字典内容当成当前盘命中结果。"
      ] }
    ]
  }
}

export function getStarCategoryDictionaryProfile(
  category: ZiweiStarCategory
): StarCategoryDictionaryProfile {
  return STAR_CATEGORY_DICTIONARY_PROFILES[category]
}

function buildFallbackStarDetail(
  star: ZiweiStarDefinition
): ZiweiStarContentDetail {
  const profile = STAR_CATEGORY_DICTIONARY_PROFILES[star.category]

  return {
    starId: star.starId,
    label: star.label,
    yinYang: profile.yinYang,
    element: profile.element,
    nature: `${star.label}：${profile.nature}`,
    coreThemes: profile.coreThemes,
    strengths: profile.strengths,
    risks: profile.risks,
    favorableSignals: profile.favorableSignals,
    unfavorableSignals: profile.unfavorableSignals,
    palaceFocus: profile.palaceFocus,
    personalityTendency: profile.personalityTendency,
    worldBehaviorHint: profile.worldBehaviorHint,
    readingNotes: profile.readingNotes
  }
}

function buildCategoryProfile(
  input: Omit<
    StarCategoryDictionaryProfile,
    | "favorableSignals"
    | "unfavorableSignals"
    | "palaceFocus"
    | "personalityTendency"
    | "worldBehaviorHint"
    | "readingNotes"
  > & {
    favorableSignals?: string[]
    unfavorableSignals?: string[]
    palaceFocus?: string
    personalityTendency?: string
    worldBehaviorHint?: string
    readingNotes?: string[]
  }
): StarCategoryDictionaryProfile {
  return {
    ...input,
    favorableSignals: input.favorableSignals ?? input.strengths,
    unfavorableSignals: input.unfavorableSignals ?? input.risks,
    palaceFocus:
      input.palaceFocus ??
      "先看星曜所在宫位的主题，再把星曜象义转换到该宫位的具体领域。",
    personalityTendency:
      input.personalityTendency ??
      "该类星曜用于补充盘面主题，不单独决定完整结论。",
    worldBehaviorHint:
      input.worldBehaviorHint ??
      "可作为盘面解释、报告生成和知识检索的通用语义来源。",
    readingNotes:
      input.readingNotes ??
      ["必须结合宫位、主星、四化和三方四正。", "不能脱离当前盘层孤立断语。"]
  }
}

function getStarCategoryDictionaryLabel(category: ZiweiStarCategory): string {
  if (category === "main") return "主星"
  if (category === "assistant") return "辅曜"
  if (category === "malefic") return "煞曜"
  if (category === "transformation") return "四化"
  if (category === "misc") return "杂曜"
  if (category === "lifecycle") return "长生十二神"
  if (category === "yearly") return "年系星曜"
  if (category === "monthly") return "月系星曜"
  if (category === "dailyHourly") return "日时系星曜"
  return "未归类星曜"
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

function joinChinese(items: string[]): string {
  return unique(items).join("、")
}

function ensureExtendedItemLength(item: string, starLabel: string): string {
  if (item.length >= 40) {
    return item
  }

  return `${item}解释${starLabel}时仍需回到星曜本体、宫位语境、组合结构和盘层证据，不宜单句定论。`
}

