import type {
  BranchPalace,
  ZiweiPalaceDetailView,
  ZiweiPlacementRuleId,
  ZiweiStarBrightnessLevel,
  ZiweiStarView
} from "@/ai/destiny-core/ziwei-core/contracts"

export type ZiweiPatternStatus = "hit" | "miss" | "pending"

export type ZiweiPatternStrength =
  | "core"
  | "enhanced"
  | "broken"
  | "review"
  | "none"

export type ZiweiPatternCategory =
  | "literary"
  | "assistant"
  | "mainCombo"
  | "wealthPower"
  | "malefic"
  | "misc"
  | "adverse"
  | "pending"

export interface ZiweiPatternDefinition {
  id: string
  label: string
  category: ZiweiPatternCategory
  conditionText: string
  starIds: readonly string[]
  match:
    | { type: "life-scope-all" }
    | {
        type: "life-scope-all-with-brightness"
        brightnessLevels: readonly ZiweiStarBrightnessLevel[]
      }
    | { type: "life-scope-at-least"; count: number }
    | { type: "same-palace-all" }
    | { type: "same-palace-all-in-branches"; branches: readonly BranchPalace[] }
    | {
        type: "life-branch-with-stars"
        branch: BranchPalace
        starIds: readonly string[]
      }
    | {
        type: "life-branch-with-scope-stars"
        branches: readonly BranchPalace[]
        lifeStarIds: readonly string[]
        scopeStarIds: readonly string[]
        blockedScopeStarIds?: readonly string[]
      }
    | {
        type: "life-stars-with-scope-at-least"
        branches?: readonly BranchPalace[]
        lifeStarIds: readonly string[]
        scopeStarIds: readonly string[]
        count: number
        lifeBrightnessLevels?: readonly ZiweiStarBrightnessLevel[]
        blockedScopeStarIds?: readonly string[]
      }
    | {
        type: "life-stars-with-adjacent-star-sets"
        lifeStarIds: readonly string[]
        adjacentStarSets: readonly {
          allOf?: readonly string[]
          anyOf?: readonly string[]
        }[]
      }
    | {
        type: "star-branches"
        placements: readonly {
          starId: string
          branches: readonly BranchPalace[]
        }[]
      }
    | { type: "life-adjacent-pair" }
    | { type: "pending" }
}

export interface ZiweiPatternMatchView {
  id: string
  label: string
  category: ZiweiPatternCategory
  categoryLabel: string
  status: ZiweiPatternStatus
  strength: ZiweiPatternStrength
  strengthLabel: string
  conditionText: string
  starLabels: string[]
  evidenceLines: string[]
  strengthReasonLines: string[]
  matchedPalaces: {
    branch: BranchPalace
    label: string
  }[]
  matchedPalaceLabels: string[]
  missingStarLabels: string[]
  sourceRuleIds: ZiweiPlacementRuleId[]
}

export interface ZiweiPatternSummary {
  totalCount: number
  hitCount: number
  enhancedCount: number
  brokenCount: number
  pendingCount: number
  categoryCount: number
}

const STAR_IDS = {
  ziwei: "ziwei.main.ziwei",
  tanlang: "ziwei.main.tanlang",
  jumen: "ziwei.main.jumen",
  lianzhen: "ziwei.main.lianzhen",
  wuqu: "ziwei.main.wuqu",
  pojun: "ziwei.main.pojun",
  tianfu: "ziwei.main.tianfu",
  tianji: "ziwei.main.tianji",
  tianxiang: "ziwei.main.tianxiang",
  tianliang: "ziwei.main.tianliang",
  tiantong: "ziwei.main.tiantong",
  qisha: "ziwei.main.qisha",
  taiyang: "ziwei.main.taiyang",
  taiyin: "ziwei.main.taiyin",
  zuofu: "ziwei.assistant.zuofu",
  youbi: "ziwei.assistant.youbi",
  wenchang: "ziwei.assistant.wenchang",
  wenqu: "ziwei.assistant.wenqu",
  tiankui: "ziwei.assistant.tiankui",
  tianyue: "ziwei.assistant.tianyue",
  lucun: "ziwei.assistant.lucun",
  tianma: "ziwei.assistant.tianma",
  qingyang: "ziwei.malefic.qingyang",
  tuoluo: "ziwei.malefic.tuoluo",
  huoxing: "ziwei.malefic.huoxing",
  lingxing: "ziwei.malefic.lingxing",
  dikong: "ziwei.malefic.dikong",
  dijie: "ziwei.malefic.dijie",
  hualu: "ziwei.transformation.hualu",
  huaquan: "ziwei.transformation.huaquan",
  huake: "ziwei.transformation.huake",
  huaji: "ziwei.transformation.huaji",
  hongluan: "ziwei.misc.hongluan",
  tianxi: "ziwei.misc.tianxi",
  xianchi: "ziwei.misc.xianchi",
  tianyao: "ziwei.misc.tianyao",
  taifu: "ziwei.misc.taifu",
  fenggao: "ziwei.misc.fenggao",
  longchi: "ziwei.misc.longchi",
  fengge: "ziwei.misc.fengge",
  guchen: "ziwei.misc.guchen",
  guasu: "ziwei.misc.guasu",
  tianxing: "ziwei.misc.tianxing",
  santai: "ziwei.daily-hourly.santai",
  bazuo: "ziwei.daily-hourly.bazuo",
  enguang: "ziwei.daily-hourly.enguang",
  tiangui: "ziwei.daily-hourly.tiangui"
} as const

export const ZIWEI_PATTERN_CATEGORY_LABELS: Record<
  ZiweiPatternCategory,
  string
> = {
  literary: "文曜科名",
  assistant: "辅佐贵人",
  mainCombo: "主星组合",
  wealthPower: "禄马权科",
  malefic: "煞曜结构",
  misc: "杂曜结构",
  adverse: "凶格破格",
  pending: "待校准"
}

export const ZIWEI_PATTERN_STRENGTH_LABELS: Record<
  ZiweiPatternStrength,
  string
> = {
  core: "核心成格",
  enhanced: "加吉增强",
  broken: "煞忌破格",
  review: "待人工复核",
  none: "未成格"
}

const ENHANCING_STAR_ID_LIST = [
  STAR_IDS.hualu,
  STAR_IDS.huaquan,
  STAR_IDS.huake,
  STAR_IDS.lucun,
  STAR_IDS.zuofu,
  STAR_IDS.youbi,
  STAR_IDS.wenchang,
  STAR_IDS.wenqu,
  STAR_IDS.tiankui,
  STAR_IDS.tianyue
] as const

const ENHANCING_STAR_IDS = new Set<string>(ENHANCING_STAR_ID_LIST)

const SIX_AUSPICIOUS_STAR_IDS = [
  STAR_IDS.zuofu,
  STAR_IDS.youbi,
  STAR_IDS.wenchang,
  STAR_IDS.wenqu,
  STAR_IDS.tiankui,
  STAR_IDS.tianyue
] as const

const FAVORABLE_BRIGHTNESS_LEVELS: readonly ZiweiStarBrightnessLevel[] = [
  "miao",
  "wang",
  "de",
  "li"
]

const FOUR_MALEFIC_STAR_IDS = [
  STAR_IDS.qingyang,
  STAR_IDS.tuoluo,
  STAR_IDS.huoxing,
  STAR_IDS.lingxing
] as const

const EMPTY_ROBBERY_STAR_IDS = [STAR_IDS.dikong, STAR_IDS.dijie] as const

const MAJOR_MALEFIC_STAR_IDS = [
  ...FOUR_MALEFIC_STAR_IDS,
  ...EMPTY_ROBBERY_STAR_IDS
] as const

const MAJOR_MALEFIC_AND_JI_STAR_IDS = [
  ...MAJOR_MALEFIC_STAR_IDS,
  STAR_IDS.huaji
] as const

const TRANSFORMATION_STAR_IDS = [
  STAR_IDS.hualu,
  STAR_IDS.huaquan,
  STAR_IDS.huake,
  STAR_IDS.huaji
] as const

const AUSPICIOUS_TRANSFORMATION_STAR_IDS = [
  STAR_IDS.hualu,
  STAR_IDS.huaquan,
  STAR_IDS.huake
] as const

const ROMANCE_STAR_IDS = [
  STAR_IDS.hongluan,
  STAR_IDS.tianxi,
  STAR_IDS.xianchi,
  STAR_IDS.tianyao
] as const

const SOLITARY_STAR_IDS = [STAR_IDS.guchen, STAR_IDS.guasu] as const

export const ZIWEI_PATTERN_DEFINITIONS: readonly ZiweiPatternDefinition[] = [
  {
    id: "pattern.literary.wenchang-wenqu-arch-life",
    label: "文星拱命格",
    category: "literary",
    conditionText: "文昌、文曲进入命宫三方四正范围。",
    starIds: [STAR_IDS.wenchang, STAR_IDS.wenqu],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.literary.chang-qu-same-palace",
    label: "昌曲同宫格",
    category: "literary",
    conditionText: "文昌、文曲同落一宫。",
    starIds: [STAR_IDS.wenchang, STAR_IDS.wenqu],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.literary.chang-qu-bright-life",
    label: "昌曲庙旺会命格",
    category: "literary",
    conditionText: "文昌、文曲进入命宫三方四正，且庙旺得利不陷。",
    starIds: [STAR_IDS.wenchang, STAR_IDS.wenqu],
    match: {
      type: "life-scope-all-with-brightness",
      brightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS
    }
  },
  {
    id: "pattern.literary.chang-qu-adjacent-life",
    label: "昌曲夹命格",
    category: "literary",
    conditionText: "文昌、文曲分居命宫左右邻宫。",
    starIds: [STAR_IDS.wenchang, STAR_IDS.wenqu],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.literary.ke-chang-qu-life",
    label: "科文会命格",
    category: "literary",
    conditionText: "文昌、文曲、化科至少两项进入命宫三方四正。",
    starIds: [STAR_IDS.wenchang, STAR_IDS.wenqu, STAR_IDS.huake],
    match: { type: "life-scope-at-least", count: 2 }
  },
  {
    id: "pattern.assistant.zuo-you-life",
    label: "左右会命格",
    category: "assistant",
    conditionText: "左辅、右弼进入命宫三方四正范围。",
    starIds: [STAR_IDS.zuofu, STAR_IDS.youbi],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.assistant.zuo-you-same-palace",
    label: "左右同宫格",
    category: "assistant",
    conditionText: "左辅、右弼同落一宫。",
    starIds: [STAR_IDS.zuofu, STAR_IDS.youbi],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.assistant.zuo-you-adjacent-life",
    label: "左右夹命格",
    category: "assistant",
    conditionText: "左辅、右弼分居命宫左右邻宫。",
    starIds: [STAR_IDS.zuofu, STAR_IDS.youbi],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.assistant.kui-yue-life",
    label: "魁钺会命格",
    category: "assistant",
    conditionText: "天魁、天钺进入命宫三方四正范围。",
    starIds: [STAR_IDS.tiankui, STAR_IDS.tianyue],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.assistant.kui-yue-adjacent-life",
    label: "魁钺夹命格",
    category: "assistant",
    conditionText: "天魁、天钺分居命宫左右邻宫。",
    starIds: [STAR_IDS.tiankui, STAR_IDS.tianyue],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.main.zi-fu-same-palace",
    label: "紫府同宫格",
    category: "mainCombo",
    conditionText: "紫微、天府同落一宫。",
    starIds: [STAR_IDS.ziwei, STAR_IDS.tianfu],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.ziwei-life",
    label: "紫微守命格",
    category: "mainCombo",
    conditionText: "紫微落入命宫。",
    starIds: [STAR_IDS.ziwei],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.ziwei],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.ziwei-bright-life",
    label: "紫微庙旺守命格",
    category: "mainCombo",
    conditionText: "紫微落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.ziwei],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.ziwei],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.ziwei-bright-assisted-clean-life",
    label: "紫微庙旺加吉格",
    category: "mainCombo",
    conditionText: "紫微庙旺得利守命，三方四正至少见两项禄权科、禄存、左右、昌曲、魁钺等加吉，并不见主要煞忌。",
    starIds: [STAR_IDS.ziwei, ...ENHANCING_STAR_ID_LIST],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.ziwei],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: ENHANCING_STAR_ID_LIST,
      count: 2,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.tianfu-life",
    label: "天府守命格",
    category: "mainCombo",
    conditionText: "天府落入命宫。",
    starIds: [STAR_IDS.tianfu],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianfu],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tianfu-bright-life",
    label: "天府庙旺守命格",
    category: "mainCombo",
    conditionText: "天府落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.tianfu],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianfu],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tianfu-bright-assisted-clean-life",
    label: "天府庙旺加吉格",
    category: "mainCombo",
    conditionText: "天府庙旺得利守命，三方四正至少见两项禄权科、禄存、左右、昌曲、魁钺等加吉，并不见主要煞忌。",
    starIds: [STAR_IDS.tianfu, ...ENHANCING_STAR_ID_LIST],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianfu],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: ENHANCING_STAR_ID_LIST,
      count: 2,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.tianxiang-life",
    label: "天相守命格",
    category: "mainCombo",
    conditionText: "天相落入命宫。",
    starIds: [STAR_IDS.tianxiang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianxiang],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tianxiang-bright-assisted-clean-life",
    label: "天相庙旺加吉格",
    category: "mainCombo",
    conditionText: "天相庙旺得利守命，三方四正至少见两项禄权科、禄存、左右、昌曲、魁钺等加吉，并不见主要煞忌。",
    starIds: [STAR_IDS.tianxiang, ...ENHANCING_STAR_ID_LIST],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianxiang],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: ENHANCING_STAR_ID_LIST,
      count: 2,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.taiyang-life",
    label: "太阳守命格",
    category: "mainCombo",
    conditionText: "太阳落入命宫。",
    starIds: [STAR_IDS.taiyang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyang],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.taiyang-bright-life",
    label: "太阳庙旺守命格",
    category: "mainCombo",
    conditionText: "太阳落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.taiyang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyang],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.taiyang-bright-assisted-clean-life",
    label: "太阳庙旺加吉格",
    category: "mainCombo",
    conditionText: "太阳庙旺得利守命，三方四正至少见一项禄权科、禄存、左右、昌曲、魁钺等加吉，并不见主要煞忌。",
    starIds: [STAR_IDS.taiyang, ...ENHANCING_STAR_ID_LIST],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyang],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: ENHANCING_STAR_ID_LIST,
      count: 1,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.taiyin-life",
    label: "太阴守命格",
    category: "mainCombo",
    conditionText: "太阴落入命宫。",
    starIds: [STAR_IDS.taiyin],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyin],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.taiyin-bright-life",
    label: "太阴庙旺守命格",
    category: "mainCombo",
    conditionText: "太阴落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.taiyin],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyin],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.taiyin-bright-assisted-clean-life",
    label: "太阴庙旺加吉格",
    category: "mainCombo",
    conditionText: "太阴庙旺得利守命，三方四正至少见一项禄权科、禄存、左右、昌曲、魁钺等加吉，并不见主要煞忌。",
    starIds: [STAR_IDS.taiyin, ...ENHANCING_STAR_ID_LIST],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyin],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: ENHANCING_STAR_ID_LIST,
      count: 1,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.wuqu-life",
    label: "武曲守命格",
    category: "mainCombo",
    conditionText: "武曲落入命宫。",
    starIds: [STAR_IDS.wuqu],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.wuqu],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.wuqu-bright-life",
    label: "武曲庙旺守命格",
    category: "mainCombo",
    conditionText: "武曲落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.wuqu],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.wuqu],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.wuqu-bright-assisted-clean-life",
    label: "武曲庙旺加吉格",
    category: "mainCombo",
    conditionText: "武曲庙旺得利守命，三方四正至少见一项禄权科、禄存、左右、昌曲、魁钺等加吉，并不见主要煞忌。",
    starIds: [STAR_IDS.wuqu, ...ENHANCING_STAR_ID_LIST],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.wuqu],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: ENHANCING_STAR_ID_LIST,
      count: 1,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.fu-xiang-life",
    label: "府相朝垣格",
    category: "mainCombo",
    conditionText: "天府、天相进入命宫三方四正范围。",
    starIds: [STAR_IDS.tianfu, STAR_IDS.tianxiang],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.main.fu-xiang-bright-life",
    label: "府相庙旺朝垣格",
    category: "mainCombo",
    conditionText: "天府、天相进入命宫三方四正，且庙旺得利不陷。",
    starIds: [STAR_IDS.tianfu, STAR_IDS.tianxiang],
    match: {
      type: "life-scope-all-with-brightness",
      brightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS
    }
  },
  {
    id: "pattern.main.fu-xiang-adjacent-life",
    label: "府相夹命格",
    category: "mainCombo",
    conditionText: "天府、天相分居命宫左右邻宫。",
    starIds: [STAR_IDS.tianfu, STAR_IDS.tianxiang],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.main.sun-moon-adjacent-life",
    label: "日月夹命格",
    category: "mainCombo",
    conditionText: "太阳、太阴分居命宫左右邻宫。",
    starIds: [STAR_IDS.taiyang, STAR_IDS.taiyin],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.main.zi-xiang-life",
    label: "紫相会命格",
    category: "mainCombo",
    conditionText: "紫微、天相进入命宫三方四正范围。",
    starIds: [STAR_IDS.ziwei, STAR_IDS.tianxiang],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.main.zi-sha-life",
    label: "紫杀会命格",
    category: "mainCombo",
    conditionText: "紫微、七杀进入命宫三方四正范围。",
    starIds: [STAR_IDS.ziwei, STAR_IDS.qisha],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.main.ji-yue-tong-liang",
    label: "机月同梁格",
    category: "mainCombo",
    conditionText: "天机、太阴、天同、天梁进入命宫三方四正范围。",
    starIds: [
      STAR_IDS.tianji,
      STAR_IDS.taiyin,
      STAR_IDS.tiantong,
      STAR_IDS.tianliang
    ],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.main.sha-po-lang",
    label: "杀破狼格",
    category: "mainCombo",
    conditionText: "七杀、破军、贪狼进入命宫三方四正范围。",
    starIds: [STAR_IDS.qisha, STAR_IDS.pojun, STAR_IDS.tanlang],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.main.sun-moon-life",
    label: "日月并明格",
    category: "mainCombo",
    conditionText: "太阳、太阴进入命宫三方四正范围。",
    starIds: [STAR_IDS.taiyang, STAR_IDS.taiyin],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.main.sun-moon-bright-life",
    label: "日月庙旺并明格",
    category: "mainCombo",
    conditionText: "太阳、太阴进入命宫三方四正，且庙旺得利不陷。",
    starIds: [STAR_IDS.taiyang, STAR_IDS.taiyin],
    match: {
      type: "life-scope-all-with-brightness",
      brightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS
    }
  },
  {
    id: "pattern.main.sun-moon-same-palace",
    label: "日月同宫格",
    category: "mainCombo",
    conditionText: "太阳、太阴同落一宫。",
    starIds: [STAR_IDS.taiyang, STAR_IDS.taiyin],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.ju-ri-same-palace",
    label: "巨日同宫格",
    category: "mainCombo",
    conditionText: "巨门、太阳同落一宫。",
    starIds: [STAR_IDS.jumen, STAR_IDS.taiyang],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.tong-liang-same-palace",
    label: "同梁同宫格",
    category: "mainCombo",
    conditionText: "天同、天梁同落一宫。",
    starIds: [STAR_IDS.tiantong, STAR_IDS.tianliang],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.tianji-life",
    label: "天机守命格",
    category: "mainCombo",
    conditionText: "天机落入命宫。",
    starIds: [STAR_IDS.tianji],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianji],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tianji-bright-life",
    label: "天机庙旺守命格",
    category: "mainCombo",
    conditionText: "天机落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.tianji],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianji],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tiantong-life",
    label: "天同守命格",
    category: "mainCombo",
    conditionText: "天同落入命宫。",
    starIds: [STAR_IDS.tiantong],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tiantong],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tiantong-bright-life",
    label: "天同庙旺守命格",
    category: "mainCombo",
    conditionText: "天同落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.tiantong],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tiantong],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.lianzhen-life",
    label: "廉贞守命格",
    category: "mainCombo",
    conditionText: "廉贞落入命宫。",
    starIds: [STAR_IDS.lianzhen],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.lianzhen],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.lianzhen-bright-life",
    label: "廉贞庙旺守命格",
    category: "mainCombo",
    conditionText: "廉贞落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.lianzhen],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.lianzhen],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tianliang-life",
    label: "天梁守命格",
    category: "mainCombo",
    conditionText: "天梁落入命宫。",
    starIds: [STAR_IDS.tianliang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianliang],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tianliang-bright-life",
    label: "天梁庙旺守命格",
    category: "mainCombo",
    conditionText: "天梁落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.tianliang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianliang],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.qisha-life",
    label: "七杀守命格",
    category: "mainCombo",
    conditionText: "七杀落入命宫。",
    starIds: [STAR_IDS.qisha],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.qisha],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.qisha-bright-life",
    label: "七杀庙旺守命格",
    category: "mainCombo",
    conditionText: "七杀落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.qisha],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.qisha],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.pojun-life",
    label: "破军守命格",
    category: "mainCombo",
    conditionText: "破军落入命宫。",
    starIds: [STAR_IDS.pojun],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.pojun],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.pojun-bright-life",
    label: "破军庙旺守命格",
    category: "mainCombo",
    conditionText: "破军落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.pojun],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.pojun],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tanlang-life",
    label: "贪狼守命格",
    category: "mainCombo",
    conditionText: "贪狼落入命宫。",
    starIds: [STAR_IDS.tanlang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tanlang],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.tanlang-bright-life",
    label: "贪狼庙旺守命格",
    category: "mainCombo",
    conditionText: "贪狼落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.tanlang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tanlang],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.jumen-life",
    label: "巨门守命格",
    category: "mainCombo",
    conditionText: "巨门落入命宫。",
    starIds: [STAR_IDS.jumen],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.jumen],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.jumen-bright-life",
    label: "巨门庙旺守命格",
    category: "mainCombo",
    conditionText: "巨门落入命宫，且庙旺得利不陷。",
    starIds: [STAR_IDS.jumen],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.jumen],
      lifeBrightnessLevels: FAVORABLE_BRIGHTNESS_LEVELS,
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.main.zi-tan-same-palace",
    label: "紫贪同宫格",
    category: "mainCombo",
    conditionText: "紫微、贪狼同落一宫。",
    starIds: [STAR_IDS.ziwei, STAR_IDS.tanlang],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.zi-po-same-palace",
    label: "紫破同宫格",
    category: "mainCombo",
    conditionText: "紫微、破军同落一宫。",
    starIds: [STAR_IDS.ziwei, STAR_IDS.pojun],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.zi-sha-same-palace",
    label: "紫杀同宫格",
    category: "mainCombo",
    conditionText: "紫微、七杀同落一宫。",
    starIds: [STAR_IDS.ziwei, STAR_IDS.qisha],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.wu-fu-same-palace",
    label: "武府同宫格",
    category: "mainCombo",
    conditionText: "武曲、天府同落一宫。",
    starIds: [STAR_IDS.wuqu, STAR_IDS.tianfu],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.wu-xiang-same-palace",
    label: "武相同宫格",
    category: "mainCombo",
    conditionText: "武曲、天相同落一宫。",
    starIds: [STAR_IDS.wuqu, STAR_IDS.tianxiang],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.wu-tan-same-palace",
    label: "武贪同宫格",
    category: "mainCombo",
    conditionText: "武曲、贪狼同落一宫。",
    starIds: [STAR_IDS.wuqu, STAR_IDS.tanlang],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.lian-sha-same-palace",
    label: "廉杀同宫格",
    category: "mainCombo",
    conditionText: "廉贞、七杀同落一宫。",
    starIds: [STAR_IDS.lianzhen, STAR_IDS.qisha],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.lian-po-same-palace",
    label: "廉破同宫格",
    category: "mainCombo",
    conditionText: "廉贞、破军同落一宫。",
    starIds: [STAR_IDS.lianzhen, STAR_IDS.pojun],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.lian-tan-same-palace",
    label: "廉贪同宫格",
    category: "mainCombo",
    conditionText: "廉贞、贪狼同落一宫。",
    starIds: [STAR_IDS.lianzhen, STAR_IDS.tanlang],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.ji-ju-same-palace",
    label: "机巨同宫格",
    category: "mainCombo",
    conditionText: "天机、巨门同落一宫。",
    starIds: [STAR_IDS.tianji, STAR_IDS.jumen],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.ji-liang-same-palace",
    label: "机梁同宫格",
    category: "mainCombo",
    conditionText: "天机、天梁同落一宫。",
    starIds: [STAR_IDS.tianji, STAR_IDS.tianliang],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.ji-yin-same-palace",
    label: "机阴同宫格",
    category: "mainCombo",
    conditionText: "天机、太阴同落一宫。",
    starIds: [STAR_IDS.tianji, STAR_IDS.taiyin],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.tong-yin-same-palace",
    label: "同阴同宫格",
    category: "mainCombo",
    conditionText: "天同、太阴同落一宫。",
    starIds: [STAR_IDS.tiantong, STAR_IDS.taiyin],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.wealth.lu-ma-life",
    label: "禄马交驰格",
    category: "wealthPower",
    conditionText: "禄存、天马进入命宫三方四正范围。",
    starIds: [STAR_IDS.lucun, STAR_IDS.tianma],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.wealth.san-qi-life",
    label: "三奇嘉会格",
    category: "wealthPower",
    conditionText: "化禄、化权、化科进入命宫三方四正范围。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huaquan, STAR_IDS.huake],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.wealth.lu-quan-life",
    label: "禄权会命格",
    category: "wealthPower",
    conditionText: "化禄、化权进入命宫三方四正范围。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huaquan],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.wealth.lu-ke-life",
    label: "禄科会命格",
    category: "wealthPower",
    conditionText: "化禄、化科进入命宫三方四正范围。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huake],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.wealth.quan-ke-life",
    label: "权科会命格",
    category: "wealthPower",
    conditionText: "化权、化科进入命宫三方四正范围。",
    starIds: [STAR_IDS.huaquan, STAR_IDS.huake],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.wealth.double-lu-life",
    label: "双禄会命格",
    category: "wealthPower",
    conditionText: "化禄、禄存进入命宫三方四正范围。",
    starIds: [STAR_IDS.hualu, STAR_IDS.lucun],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.wealth.four-transformations-life",
    label: "四化会命格",
    category: "wealthPower",
    conditionText: "化禄、化权、化科、化忌全部进入命宫三方四正范围，作为四化交会结构单独列出。",
    starIds: TRANSFORMATION_STAR_IDS,
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.wealth.lu-quan-same-palace",
    label: "禄权同宫格",
    category: "wealthPower",
    conditionText: "化禄、化权同落一宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huaquan],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.wealth.lu-ke-same-palace",
    label: "禄科同宫格",
    category: "wealthPower",
    conditionText: "化禄、化科同落一宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huake],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.wealth.quan-ke-same-palace",
    label: "权科同宫格",
    category: "wealthPower",
    conditionText: "化权、化科同落一宫。",
    starIds: [STAR_IDS.huaquan, STAR_IDS.huake],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.wealth.san-qi-same-palace",
    label: "三奇同宫格",
    category: "wealthPower",
    conditionText: "化禄、化权、化科同落一宫。",
    starIds: AUSPICIOUS_TRANSFORMATION_STAR_IDS,
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.wealth.double-lu-same-palace",
    label: "双禄同宫格",
    category: "wealthPower",
    conditionText: "化禄、禄存同落一宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.lucun],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.wealth.huo-tan-tomb",
    label: "火贪格",
    category: "wealthPower",
    conditionText: "贪狼、火星同宫，且同宫位置在辰、戌、丑、未四墓宫。",
    starIds: [STAR_IDS.tanlang, STAR_IDS.huoxing],
    match: {
      type: "same-palace-all-in-branches",
      branches: ["chen", "xu", "chou", "wei"]
    }
  },
  {
    id: "pattern.wealth.ling-tan-tomb",
    label: "铃贪格",
    category: "wealthPower",
    conditionText: "贪狼、铃星同宫，且同宫位置在辰、戌、丑、未四墓宫。",
    starIds: [STAR_IDS.tanlang, STAR_IDS.lingxing],
    match: {
      type: "same-palace-all-in-branches",
      branches: ["chen", "xu", "chou", "wei"]
    }
  },
  {
    id: "pattern.wealth.huo-ling-tan-tomb",
    label: "火铃贪格",
    category: "wealthPower",
    conditionText: "贪狼、火星、铃星同宫，且同宫位置在辰、戌、丑、未四墓宫。",
    starIds: [STAR_IDS.tanlang, STAR_IDS.huoxing, STAR_IDS.lingxing],
    match: {
      type: "same-palace-all-in-branches",
      branches: ["chen", "xu", "chou", "wei"]
    }
  },
  {
    id: "pattern.literary.yang-liang-chang-lu",
    label: "阳梁昌禄格",
    category: "literary",
    conditionText: "太阳、天梁、文昌、禄存进入命宫三方四正范围。",
    starIds: [
      STAR_IDS.taiyang,
      STAR_IDS.tianliang,
      STAR_IDS.wenchang,
      STAR_IDS.lucun
    ],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.main.sun-thunder-gate",
    label: "日照雷门格",
    category: "mainCombo",
    conditionText: "太阳落卯宫。",
    starIds: [STAR_IDS.taiyang],
    match: {
      type: "star-branches",
      placements: [{ starId: STAR_IDS.taiyang, branches: ["mao"] }]
    }
  },
  {
    id: "pattern.main.moon-heaven-gate",
    label: "月朗天门格",
    category: "mainCombo",
    conditionText: "太阴落亥宫。",
    starIds: [STAR_IDS.taiyin],
    match: {
      type: "star-branches",
      placements: [{ starId: STAR_IDS.taiyin, branches: ["hai"] }]
    }
  },
  {
    id: "pattern.main.pearl-sea",
    label: "明珠出海格",
    category: "mainCombo",
    conditionText: "太阳落卯宫、太阴落亥宫。",
    starIds: [STAR_IDS.taiyang, STAR_IDS.taiyin],
    match: {
      type: "star-branches",
      placements: [
        { starId: STAR_IDS.taiyang, branches: ["mao"] },
        { starId: STAR_IDS.taiyin, branches: ["hai"] }
      ]
    }
  },
  {
    id: "pattern.wealth.cai-yin-jia-yin",
    label: "财荫夹印格",
    category: "wealthPower",
    conditionText: "天相守命，命宫左右邻宫见天梁，以及巨门与化禄同宫构成财荫夹印。",
    starIds: [
      STAR_IDS.tianxiang,
      STAR_IDS.tianliang,
      STAR_IDS.jumen,
      STAR_IDS.hualu
    ],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.tianxiang],
      adjacentStarSets: [
        { allOf: [STAR_IDS.tianliang] },
        { allOf: [STAR_IDS.jumen, STAR_IDS.hualu] }
      ]
    }
  },
  {
    id: "pattern.malefic.xing-qiu-jia-yin",
    label: "刑囚夹印格",
    category: "malefic",
    conditionText: "天相守命，命宫左右邻宫见廉贞，并见擎羊或天刑构成刑囚夹印。",
    starIds: [
      STAR_IDS.tianxiang,
      STAR_IDS.lianzhen,
      STAR_IDS.qingyang,
      STAR_IDS.tianxing
    ],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.tianxiang],
      adjacentStarSets: [
        { allOf: [STAR_IDS.lianzhen] },
        { anyOf: [STAR_IDS.qingyang, STAR_IDS.tianxing] }
      ]
    }
  },
  {
    id: "pattern.malefic.ling-chang-tuo-wu",
    label: "铃昌陀武格",
    category: "malefic",
    conditionText: "命宫在辰或戌，武曲守命，三方四正会铃星、文昌、陀罗。",
    starIds: [
      STAR_IDS.wuqu,
      STAR_IDS.lingxing,
      STAR_IDS.wenchang,
      STAR_IDS.tuoluo
    ],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["chen", "xu"],
      lifeStarIds: [STAR_IDS.wuqu],
      scopeStarIds: [STAR_IDS.lingxing, STAR_IDS.wenchang, STAR_IDS.tuoluo]
    }
  },
  {
    id: "pattern.malefic.ma-tou-dai-jian",
    label: "马头带箭格",
    category: "malefic",
    conditionText: "命宫在午宫，擎羊同守命宫。",
    starIds: [STAR_IDS.qingyang],
    match: {
      type: "life-branch-with-stars",
      branch: "wu",
      starIds: [STAR_IDS.qingyang]
    }
  },
  {
    id: "pattern.malefic.yang-tuo-adjacent-life",
    label: "羊陀夹命格",
    category: "malefic",
    conditionText: "擎羊、陀罗分居命宫左右邻宫。",
    starIds: [STAR_IDS.qingyang, STAR_IDS.tuoluo],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.malefic.huo-ling-adjacent-life",
    label: "火铃夹命格",
    category: "malefic",
    conditionText: "火星、铃星分居命宫左右邻宫。",
    starIds: [STAR_IDS.huoxing, STAR_IDS.lingxing],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.malefic.kong-jie-adjacent-life",
    label: "空劫夹命格",
    category: "malefic",
    conditionText: "地空、地劫分居命宫左右邻宫。",
    starIds: [STAR_IDS.dikong, STAR_IDS.dijie],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.adverse.qing-yang-life",
    label: "擎羊守命格",
    category: "adverse",
    conditionText: "擎羊落入命宫，作为命宫不利结构单独列出。",
    starIds: [STAR_IDS.qingyang],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.qingyang],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.adverse.tuo-luo-life",
    label: "陀罗守命格",
    category: "adverse",
    conditionText: "陀罗落入命宫，作为命宫不利结构单独列出。",
    starIds: [STAR_IDS.tuoluo],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tuoluo],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.adverse.huo-xing-life",
    label: "火星守命格",
    category: "adverse",
    conditionText: "火星落入命宫，作为命宫不利结构单独列出。",
    starIds: [STAR_IDS.huoxing],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.huoxing],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.adverse.ling-xing-life",
    label: "铃星守命格",
    category: "adverse",
    conditionText: "铃星落入命宫，作为命宫不利结构单独列出。",
    starIds: [STAR_IDS.lingxing],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.lingxing],
      scopeStarIds: [],
      count: 0
    }
  },
  {
    id: "pattern.adverse.yang-tuo-life-scope",
    label: "羊陀会命格",
    category: "adverse",
    conditionText: "擎羊、陀罗进入命宫三方四正范围。",
    starIds: [STAR_IDS.qingyang, STAR_IDS.tuoluo],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.huo-ling-life-scope",
    label: "火铃会命格",
    category: "adverse",
    conditionText: "火星、铃星进入命宫三方四正范围。",
    starIds: [STAR_IDS.huoxing, STAR_IDS.lingxing],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.kong-jie-life-scope",
    label: "空劫会命格",
    category: "adverse",
    conditionText: "地空、地劫进入命宫三方四正范围。",
    starIds: [STAR_IDS.dikong, STAR_IDS.dijie],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.four-malefics-life-scope",
    label: "四煞会命格",
    category: "adverse",
    conditionText: "擎羊、陀罗、火星、铃星至少三项进入命宫三方四正范围。",
    starIds: FOUR_MALEFIC_STAR_IDS,
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.adverse.six-malefics-life-scope",
    label: "六煞会命格",
    category: "adverse",
    conditionText: "擎羊、陀罗、火星、铃星、地空、地劫至少四项进入命宫三方四正范围。",
    starIds: MAJOR_MALEFIC_STAR_IDS,
    match: { type: "life-scope-at-least", count: 4 }
  },
  {
    id: "pattern.adverse.malefic-ji-life-scope",
    label: "煞忌交冲命格",
    category: "adverse",
    conditionText: "主要煞曜与化忌至少三项进入命宫三方四正范围。",
    starIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.adverse.hua-ji-life-scope",
    label: "化忌会命格",
    category: "adverse",
    conditionText: "化忌进入命宫三方四正范围。",
    starIds: [STAR_IDS.huaji],
    match: { type: "life-scope-at-least", count: 1 }
  },
  {
    id: "pattern.adverse.lu-ji-life-scope",
    label: "禄忌会命格",
    category: "adverse",
    conditionText: "化禄、化忌同时进入命宫三方四正范围。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huaji],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.quan-ji-life-scope",
    label: "权忌会命格",
    category: "adverse",
    conditionText: "化权、化忌同时进入命宫三方四正范围。",
    starIds: [STAR_IDS.huaquan, STAR_IDS.huaji],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.ke-ji-life-scope",
    label: "科忌会命格",
    category: "adverse",
    conditionText: "化科、化忌同时进入命宫三方四正范围。",
    starIds: [STAR_IDS.huake, STAR_IDS.huaji],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.lu-ji-same-palace",
    label: "禄忌同宫格",
    category: "adverse",
    conditionText: "化禄、化忌同落一宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.quan-ji-same-palace",
    label: "权忌同宫格",
    category: "adverse",
    conditionText: "化权、化忌同落一宫。",
    starIds: [STAR_IDS.huaquan, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.ke-ji-same-palace",
    label: "科忌同宫格",
    category: "adverse",
    conditionText: "化科、化忌同落一宫。",
    starIds: [STAR_IDS.huake, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.lu-ji-adjacent-life",
    label: "禄忌夹命格",
    category: "adverse",
    conditionText: "化禄、化忌分居命宫左右邻宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huaji],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.adverse.quan-ji-adjacent-life",
    label: "权忌夹命格",
    category: "adverse",
    conditionText: "化权、化忌分居命宫左右邻宫。",
    starIds: [STAR_IDS.huaquan, STAR_IDS.huaji],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.adverse.ke-ji-adjacent-life",
    label: "科忌夹命格",
    category: "adverse",
    conditionText: "化科、化忌分居命宫左右邻宫。",
    starIds: [STAR_IDS.huake, STAR_IDS.huaji],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.adverse.yang-huo-same-palace",
    label: "羊火同宫格",
    category: "adverse",
    conditionText: "擎羊、火星同落一宫。",
    starIds: [STAR_IDS.qingyang, STAR_IDS.huoxing],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.yang-ling-same-palace",
    label: "羊铃同宫格",
    category: "adverse",
    conditionText: "擎羊、铃星同落一宫。",
    starIds: [STAR_IDS.qingyang, STAR_IDS.lingxing],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tuo-huo-same-palace",
    label: "陀火同宫格",
    category: "adverse",
    conditionText: "陀罗、火星同落一宫。",
    starIds: [STAR_IDS.tuoluo, STAR_IDS.huoxing],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tuo-ling-same-palace",
    label: "陀铃同宫格",
    category: "adverse",
    conditionText: "陀罗、铃星同落一宫。",
    starIds: [STAR_IDS.tuoluo, STAR_IDS.lingxing],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.huo-ling-same-palace",
    label: "火铃同宫格",
    category: "adverse",
    conditionText: "火星、铃星同落一宫。",
    starIds: [STAR_IDS.huoxing, STAR_IDS.lingxing],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.kong-jie-same-palace",
    label: "空劫同宫格",
    category: "adverse",
    conditionText: "地空、地劫同落一宫。",
    starIds: [STAR_IDS.dikong, STAR_IDS.dijie],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.kong-jie-hua-ji-life-scope",
    label: "空劫化忌会命格",
    category: "adverse",
    conditionText: "地空、地劫、化忌同时进入命宫三方四正范围。",
    starIds: [...EMPTY_ROBBERY_STAR_IDS, STAR_IDS.huaji],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.qing-yang-hua-ji-same-palace",
    label: "羊忌同宫格",
    category: "adverse",
    conditionText: "擎羊与化忌同落一宫。",
    starIds: [STAR_IDS.qingyang, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tuo-luo-hua-ji-same-palace",
    label: "陀忌同宫格",
    category: "adverse",
    conditionText: "陀罗与化忌同落一宫。",
    starIds: [STAR_IDS.tuoluo, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.huo-xing-hua-ji-same-palace",
    label: "火忌同宫格",
    category: "adverse",
    conditionText: "火星与化忌同落一宫。",
    starIds: [STAR_IDS.huoxing, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.ling-xing-hua-ji-same-palace",
    label: "铃忌同宫格",
    category: "adverse",
    conditionText: "铃星与化忌同落一宫。",
    starIds: [STAR_IDS.lingxing, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.di-kong-hua-ji-same-palace",
    label: "空忌同宫格",
    category: "adverse",
    conditionText: "地空与化忌同落一宫。",
    starIds: [STAR_IDS.dikong, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.di-jie-hua-ji-same-palace",
    label: "劫忌同宫格",
    category: "adverse",
    conditionText: "地劫与化忌同落一宫。",
    starIds: [STAR_IDS.dijie, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.ju-men-hua-ji",
    label: "巨门化忌同宫格",
    category: "adverse",
    conditionText: "巨门与化忌同落一宫。",
    starIds: [STAR_IDS.jumen, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.lian-zhen-hua-ji",
    label: "廉贞化忌同宫格",
    category: "adverse",
    conditionText: "廉贞与化忌同落一宫。",
    starIds: [STAR_IDS.lianzhen, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.wu-qu-hua-ji",
    label: "武曲化忌同宫格",
    category: "adverse",
    conditionText: "武曲与化忌同落一宫。",
    starIds: [STAR_IDS.wuqu, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tian-ji-hua-ji",
    label: "天机化忌同宫格",
    category: "adverse",
    conditionText: "天机与化忌同落一宫。",
    starIds: [STAR_IDS.tianji, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tai-yang-hua-ji",
    label: "太阳化忌同宫格",
    category: "adverse",
    conditionText: "太阳与化忌同落一宫。",
    starIds: [STAR_IDS.taiyang, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tai-yin-hua-ji",
    label: "太阴化忌同宫格",
    category: "adverse",
    conditionText: "太阴与化忌同落一宫。",
    starIds: [STAR_IDS.taiyin, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tan-lang-hua-ji",
    label: "贪狼化忌同宫格",
    category: "adverse",
    conditionText: "贪狼与化忌同落一宫。",
    starIds: [STAR_IDS.tanlang, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.po-jun-hua-ji",
    label: "破军化忌同宫格",
    category: "adverse",
    conditionText: "破军与化忌同落一宫。",
    starIds: [STAR_IDS.pojun, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.ju-men-malefic-ji-life",
    label: "巨门遇煞忌格",
    category: "adverse",
    conditionText: "巨门守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.jumen, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.jumen],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.lian-zhen-malefic-ji-life",
    label: "廉贞遇煞忌格",
    category: "adverse",
    conditionText: "廉贞守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.lianzhen, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.lianzhen],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.wu-qu-malefic-ji-life",
    label: "武曲遇煞忌格",
    category: "adverse",
    conditionText: "武曲守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.wuqu, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.wuqu],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.qi-sha-malefic-ji-life",
    label: "七杀遇煞忌格",
    category: "adverse",
    conditionText: "七杀守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.qisha, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.qisha],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.po-jun-malefic-ji-life",
    label: "破军遇煞忌格",
    category: "adverse",
    conditionText: "破军守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.pojun, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.pojun],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.tan-lang-malefic-ji-life",
    label: "贪狼遇煞忌格",
    category: "adverse",
    conditionText: "贪狼守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.tanlang, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tanlang],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.ziwei-malefic-ji-life",
    label: "紫微遇煞忌格",
    category: "adverse",
    conditionText: "紫微守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.ziwei, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.ziwei],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.tianfu-malefic-ji-life",
    label: "天府遇煞忌格",
    category: "adverse",
    conditionText: "天府守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.tianfu, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianfu],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.tianxiang-malefic-ji-life",
    label: "天相遇煞忌格",
    category: "adverse",
    conditionText: "天相守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.tianxiang, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianxiang],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.tianji-malefic-ji-life",
    label: "天机遇煞忌格",
    category: "adverse",
    conditionText: "天机守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.tianji, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianji],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.tiantong-malefic-ji-life",
    label: "天同遇煞忌格",
    category: "adverse",
    conditionText: "天同守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.tiantong, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tiantong],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.tianliang-malefic-ji-life",
    label: "天梁遇煞忌格",
    category: "adverse",
    conditionText: "天梁守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.tianliang, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianliang],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.taiyang-malefic-ji-life",
    label: "太阳遇煞忌格",
    category: "adverse",
    conditionText: "太阳守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.taiyang, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyang],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.taiyin-malefic-ji-life",
    label: "太阴遇煞忌格",
    category: "adverse",
    conditionText: "太阴守命，命宫三方四正至少见两项主要煞曜或化忌。",
    starIds: [STAR_IDS.taiyin, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.taiyin],
      scopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS,
      count: 2
    }
  },
  {
    id: "pattern.adverse.romance-life-scope",
    label: "桃花杂曜会命格",
    category: "adverse",
    conditionText: "红鸾、天喜、咸池、天姚至少三项进入命宫三方四正范围。",
    starIds: ROMANCE_STAR_IDS,
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.adverse.romance-malefic-life-scope",
    label: "桃花煞会命格",
    category: "adverse",
    conditionText: "咸池、天姚与主要煞曜或化忌至少三项进入命宫三方四正范围。",
    starIds: [
      STAR_IDS.xianchi,
      STAR_IDS.tianyao,
      ...MAJOR_MALEFIC_AND_JI_STAR_IDS
    ],
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.adverse.xian-chi-hua-ji-same-palace",
    label: "咸池化忌同宫格",
    category: "adverse",
    conditionText: "咸池与化忌同落一宫。",
    starIds: [STAR_IDS.xianchi, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tian-yao-hua-ji-same-palace",
    label: "天姚化忌同宫格",
    category: "adverse",
    conditionText: "天姚与化忌同落一宫。",
    starIds: [STAR_IDS.tianyao, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.solitary-malefic-life-scope",
    label: "孤寡煞会命格",
    category: "adverse",
    conditionText: "孤辰、寡宿与主要煞曜或化忌至少三项进入命宫三方四正范围。",
    starIds: [...SOLITARY_STAR_IDS, ...MAJOR_MALEFIC_AND_JI_STAR_IDS],
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.adverse.hong-luan-hua-ji-same-palace",
    label: "红鸾化忌同宫格",
    category: "adverse",
    conditionText: "红鸾与化忌同落一宫。",
    starIds: [STAR_IDS.hongluan, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.adverse.tian-xi-hua-ji-same-palace",
    label: "天喜化忌同宫格",
    category: "adverse",
    conditionText: "天喜与化忌同落一宫。",
    starIds: [STAR_IDS.tianxi, STAR_IDS.huaji],
    match: { type: "same-palace-all" }
  },
  {
    id: "pattern.main.ziwei-zi-wu-clean-life",
    label: "紫微子午清格",
    category: "mainCombo",
    conditionText: "紫微守命子宫或午宫，命宫三方四正不见主要煞曜与化忌。",
    starIds: [STAR_IDS.ziwei],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["zi", "wu"],
      lifeStarIds: [STAR_IDS.ziwei],
      scopeStarIds: [],
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.tianfu-chou-wei-clean-life",
    label: "天府丑未清格",
    category: "mainCombo",
    conditionText: "天府守命丑宫或未宫，命宫三方四正不见主要煞曜与化忌。",
    starIds: [STAR_IDS.tianfu],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["chou", "wei"],
      lifeStarIds: [STAR_IDS.tianfu],
      scopeStarIds: [],
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.taiyang-mao-clean-life",
    label: "太阳卯宫清格",
    category: "mainCombo",
    conditionText: "太阳守命卯宫，命宫三方四正不见主要煞曜与化忌。",
    starIds: [STAR_IDS.taiyang],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["mao"],
      lifeStarIds: [STAR_IDS.taiyang],
      scopeStarIds: [],
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.taiyin-hai-clean-life",
    label: "太阴亥宫清格",
    category: "mainCombo",
    conditionText: "太阴守命亥宫，命宫三方四正不见主要煞曜与化忌。",
    starIds: [STAR_IDS.taiyin],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["hai"],
      lifeStarIds: [STAR_IDS.taiyin],
      scopeStarIds: [],
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.wuqu-chen-xu-clean-life",
    label: "武曲辰戌清格",
    category: "mainCombo",
    conditionText: "武曲守命辰宫或戌宫，命宫三方四正不见主要煞曜与化忌。",
    starIds: [STAR_IDS.wuqu],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["chen", "xu"],
      lifeStarIds: [STAR_IDS.wuqu],
      scopeStarIds: [],
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.tianliang-wu-clean-life",
    label: "天梁午宫清格",
    category: "mainCombo",
    conditionText: "天梁守命午宫，命宫三方四正不见主要煞曜与化忌。",
    starIds: [STAR_IDS.tianliang],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["wu"],
      lifeStarIds: [STAR_IDS.tianliang],
      scopeStarIds: [],
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.xiong-su-chao-yuan",
    label: "雄宿朝元格",
    category: "mainCombo",
    conditionText: "廉贞守命寅或申，命宫三方四正不见主要煞忌。",
    starIds: [STAR_IDS.lianzhen],
    match: {
      type: "life-branch-with-scope-stars",
      branches: ["yin", "shen"],
      lifeStarIds: [STAR_IDS.lianzhen],
      scopeStarIds: [],
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.shi-zhong-yin-yu",
    label: "石中隐玉格",
    category: "mainCombo",
    conditionText: "巨门守命子或午，三方四正至少见禄权科、禄存或辅曜一项，并不见主要煞忌。",
    starIds: [
      STAR_IDS.jumen,
      STAR_IDS.hualu,
      STAR_IDS.huaquan,
      STAR_IDS.huake,
      STAR_IDS.lucun,
      STAR_IDS.zuofu,
      STAR_IDS.youbi,
      STAR_IDS.wenchang,
      STAR_IDS.wenqu,
      STAR_IDS.tiankui,
      STAR_IDS.tianyue
    ],
    match: {
      type: "life-stars-with-scope-at-least",
      branches: ["zi", "wu"],
      lifeStarIds: [STAR_IDS.jumen],
      scopeStarIds: [
        STAR_IDS.hualu,
        STAR_IDS.huaquan,
        STAR_IDS.huake,
        STAR_IDS.lucun,
        STAR_IDS.zuofu,
        STAR_IDS.youbi,
        STAR_IDS.wenchang,
        STAR_IDS.wenqu,
        STAR_IDS.tiankui,
        STAR_IDS.tianyue
      ],
      count: 1,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.main.jun-chen-qing-hui",
    label: "君臣庆会格",
    category: "assistant",
    conditionText: "紫微守命，三方四正会天府、天相、左辅、右弼、文昌、文曲、天魁、天钺至少四项，且不见主要煞忌。",
    starIds: [
      STAR_IDS.ziwei,
      STAR_IDS.tianfu,
      STAR_IDS.tianxiang,
      STAR_IDS.zuofu,
      STAR_IDS.youbi,
      STAR_IDS.wenchang,
      STAR_IDS.wenqu,
      STAR_IDS.tiankui,
      STAR_IDS.tianyue
    ],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.ziwei],
      scopeStarIds: [
        STAR_IDS.tianfu,
        STAR_IDS.tianxiang,
        STAR_IDS.zuofu,
        STAR_IDS.youbi,
        STAR_IDS.wenchang,
        STAR_IDS.wenqu,
        STAR_IDS.tiankui,
        STAR_IDS.tianyue
      ],
      count: 4,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.assistant.six-auspicious-life-scope",
    label: "六吉会命格",
    category: "assistant",
    conditionText: "左辅、右弼、文昌、文曲、天魁、天钺至少四项进入命宫三方四正范围。",
    starIds: SIX_AUSPICIOUS_STAR_IDS,
    match: { type: "life-scope-at-least", count: 4 }
  },
  {
    id: "pattern.assistant.six-auspicious-full-life",
    label: "六吉朝垣格",
    category: "assistant",
    conditionText: "左辅、右弼、文昌、文曲、天魁、天钺全部进入命宫三方四正范围。",
    starIds: SIX_AUSPICIOUS_STAR_IDS,
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.assistant.ziwei-zuo-you-adjacent-life",
    label: "紫微左右夹命格",
    category: "assistant",
    conditionText: "紫微守命，左辅、右弼分居命宫左右邻宫。",
    starIds: [STAR_IDS.ziwei, STAR_IDS.zuofu, STAR_IDS.youbi],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.ziwei],
      adjacentStarSets: [
        { allOf: [STAR_IDS.zuofu] },
        { allOf: [STAR_IDS.youbi] }
      ]
    }
  },
  {
    id: "pattern.assistant.tianfu-zuo-you-adjacent-life",
    label: "天府左右夹命格",
    category: "assistant",
    conditionText: "天府守命，左辅、右弼分居命宫左右邻宫。",
    starIds: [STAR_IDS.tianfu, STAR_IDS.zuofu, STAR_IDS.youbi],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.tianfu],
      adjacentStarSets: [
        { allOf: [STAR_IDS.zuofu] },
        { allOf: [STAR_IDS.youbi] }
      ]
    }
  },
  {
    id: "pattern.assistant.tianxiang-zuo-you-adjacent-life",
    label: "天相左右夹命格",
    category: "assistant",
    conditionText: "天相守命，左辅、右弼分居命宫左右邻宫。",
    starIds: [STAR_IDS.tianxiang, STAR_IDS.zuofu, STAR_IDS.youbi],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.tianxiang],
      adjacentStarSets: [
        { allOf: [STAR_IDS.zuofu] },
        { allOf: [STAR_IDS.youbi] }
      ]
    }
  },
  {
    id: "pattern.literary.taiyang-chang-qu-adjacent-life",
    label: "太阳昌曲夹命格",
    category: "literary",
    conditionText: "太阳守命，文昌、文曲分居命宫左右邻宫。",
    starIds: [STAR_IDS.taiyang, STAR_IDS.wenchang, STAR_IDS.wenqu],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.taiyang],
      adjacentStarSets: [
        { allOf: [STAR_IDS.wenchang] },
        { allOf: [STAR_IDS.wenqu] }
      ]
    }
  },
  {
    id: "pattern.literary.taiyin-chang-qu-adjacent-life",
    label: "太阴昌曲夹命格",
    category: "literary",
    conditionText: "太阴守命，文昌、文曲分居命宫左右邻宫。",
    starIds: [STAR_IDS.taiyin, STAR_IDS.wenchang, STAR_IDS.wenqu],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.taiyin],
      adjacentStarSets: [
        { allOf: [STAR_IDS.wenchang] },
        { allOf: [STAR_IDS.wenqu] }
      ]
    }
  },
  {
    id: "pattern.literary.tianliang-chang-qu-adjacent-life",
    label: "天梁昌曲夹命格",
    category: "literary",
    conditionText: "天梁守命，文昌、文曲分居命宫左右邻宫。",
    starIds: [STAR_IDS.tianliang, STAR_IDS.wenchang, STAR_IDS.wenqu],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.tianliang],
      adjacentStarSets: [
        { allOf: [STAR_IDS.wenchang] },
        { allOf: [STAR_IDS.wenqu] }
      ]
    }
  },
  {
    id: "pattern.assistant.wuqu-kui-yue-adjacent-life",
    label: "武曲魁钺夹命格",
    category: "assistant",
    conditionText: "武曲守命，天魁、天钺分居命宫左右邻宫。",
    starIds: [STAR_IDS.wuqu, STAR_IDS.tiankui, STAR_IDS.tianyue],
    match: {
      type: "life-stars-with-adjacent-star-sets",
      lifeStarIds: [STAR_IDS.wuqu],
      adjacentStarSets: [
        { allOf: [STAR_IDS.tiankui] },
        { allOf: [STAR_IDS.tianyue] }
      ]
    }
  },
  {
    id: "pattern.wealth.lu-ma-adjacent-life",
    label: "禄马夹命格",
    category: "wealthPower",
    conditionText: "禄存、天马分居命宫左右邻宫。",
    starIds: [STAR_IDS.lucun, STAR_IDS.tianma],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.wealth.lu-quan-adjacent-life",
    label: "禄权夹命格",
    category: "wealthPower",
    conditionText: "化禄、化权分居命宫左右邻宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huaquan],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.wealth.lu-ke-adjacent-life",
    label: "禄科夹命格",
    category: "wealthPower",
    conditionText: "化禄、化科分居命宫左右邻宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.huake],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.wealth.quan-ke-adjacent-life",
    label: "权科夹命格",
    category: "wealthPower",
    conditionText: "化权、化科分居命宫左右邻宫。",
    starIds: [STAR_IDS.huaquan, STAR_IDS.huake],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.wealth.double-lu-adjacent-life",
    label: "双禄夹命格",
    category: "wealthPower",
    conditionText: "化禄、禄存分居命宫左右邻宫。",
    starIds: [STAR_IDS.hualu, STAR_IDS.lucun],
    match: { type: "life-adjacent-pair" }
  },
  {
    id: "pattern.misc.tai-fu-feng-gao-life",
    label: "台辅封诰会命格",
    category: "misc",
    conditionText: "台辅、封诰进入命宫三方四正范围。",
    starIds: [STAR_IDS.taifu, STAR_IDS.fenggao],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.misc.long-chi-feng-ge-life",
    label: "龙池凤阁会命格",
    category: "misc",
    conditionText: "龙池、凤阁进入命宫三方四正范围。",
    starIds: [STAR_IDS.longchi, STAR_IDS.fengge],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.misc.san-tai-ba-zuo-life",
    label: "三台八座会命格",
    category: "misc",
    conditionText: "三台、八座进入命宫三方四正范围。",
    starIds: [STAR_IDS.santai, STAR_IDS.bazuo],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.misc.en-guang-tian-gui-life",
    label: "恩光天贵会命格",
    category: "misc",
    conditionText: "恩光、天贵进入命宫三方四正范围。",
    starIds: [STAR_IDS.enguang, STAR_IDS.tiangui],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.misc.hong-luan-tian-xi-life",
    label: "红鸾天喜会命格",
    category: "misc",
    conditionText: "红鸾、天喜进入命宫三方四正范围。",
    starIds: [STAR_IDS.hongluan, STAR_IDS.tianxi],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.misc.xian-chi-tian-yao-life",
    label: "咸池天姚会命格",
    category: "misc",
    conditionText: "咸池、天姚进入命宫三方四正范围。",
    starIds: [STAR_IDS.xianchi, STAR_IDS.tianyao],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.xian-yao-life-scope",
    label: "咸姚会命格",
    category: "adverse",
    conditionText: "咸池、天姚进入命宫三方四正范围，作为桃花杂曜偏重的复核项。",
    starIds: [STAR_IDS.xianchi, STAR_IDS.tianyao],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.adverse.gu-chen-gua-su-life-scope",
    label: "孤辰寡宿会命格",
    category: "adverse",
    conditionText: "孤辰、寡宿进入命宫三方四正范围，作为孤寡杂曜偏重的复核项。",
    starIds: [STAR_IDS.guchen, STAR_IDS.guasu],
    match: { type: "life-scope-all" }
  },
  {
    id: "pattern.assistant.fu-bi-chang-qu-life",
    label: "辅弼昌曲会命格",
    category: "assistant",
    conditionText: "左辅、右弼、文昌、文曲至少三项进入命宫三方四正范围。",
    starIds: [
      STAR_IDS.zuofu,
      STAR_IDS.youbi,
      STAR_IDS.wenchang,
      STAR_IDS.wenqu
    ],
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.assistant.fu-bi-kui-yue-life",
    label: "辅弼魁钺会命格",
    category: "assistant",
    conditionText: "左辅、右弼、天魁、天钺至少三项进入命宫三方四正范围。",
    starIds: [
      STAR_IDS.zuofu,
      STAR_IDS.youbi,
      STAR_IDS.tiankui,
      STAR_IDS.tianyue
    ],
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.literary.chang-qu-kui-yue-life",
    label: "昌曲魁钺会命格",
    category: "literary",
    conditionText: "文昌、文曲、天魁、天钺至少三项进入命宫三方四正范围。",
    starIds: [
      STAR_IDS.wenchang,
      STAR_IDS.wenqu,
      STAR_IDS.tiankui,
      STAR_IDS.tianyue
    ],
    match: { type: "life-scope-at-least", count: 3 }
  },
  {
    id: "pattern.wealth.lu-ma-pei-yin",
    label: "禄马佩印格",
    category: "wealthPower",
    conditionText: "天相守命，禄存、天马进入命宫三方四正范围，且不见主要煞忌。",
    starIds: [STAR_IDS.tianxiang, STAR_IDS.lucun, STAR_IDS.tianma],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianxiang],
      scopeStarIds: [STAR_IDS.lucun, STAR_IDS.tianma],
      count: 2,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.wealth.fu-lu-ma-life",
    label: "府禄马会命格",
    category: "wealthPower",
    conditionText: "天府守命，禄存、天马进入命宫三方四正范围，且不见主要煞忌。",
    starIds: [STAR_IDS.tianfu, STAR_IDS.lucun, STAR_IDS.tianma],
    match: {
      type: "life-stars-with-scope-at-least",
      lifeStarIds: [STAR_IDS.tianfu],
      scopeStarIds: [STAR_IDS.lucun, STAR_IDS.tianma],
      count: 2,
      blockedScopeStarIds: MAJOR_MALEFIC_AND_JI_STAR_IDS
    }
  },
  {
    id: "pattern.wealth.ma-lu-quan-life",
    label: "马禄权会命格",
    category: "wealthPower",
    conditionText: "天马、化禄、化权进入命宫三方四正范围。",
    starIds: [STAR_IDS.tianma, STAR_IDS.hualu, STAR_IDS.huaquan],
    match: { type: "life-scope-all" }
  }
]

export function buildZiweiPatternMatches(
  palaces: ZiweiPalaceDetailView[]
): ZiweiPatternMatchView[] {
  const context = buildPatternContext(palaces)

  return ZIWEI_PATTERN_DEFINITIONS.map((definition) => {
    return buildPatternMatch(definition, context)
  })
}

export function summarizeZiweiPatterns(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternSummary {
  return {
    totalCount: matches.length,
    hitCount: matches.filter((match) => match.status === "hit").length,
    enhancedCount: matches.filter((match) => match.strength === "enhanced")
      .length,
    brokenCount: matches.filter((match) => match.strength === "broken").length,
    pendingCount: matches.filter((match) => match.status === "pending").length,
    categoryCount: new Set(matches.map((match) => match.category)).size
  }
}

interface PatternContext {
  lifeBranch?: BranchPalace
  lifeScopeBranches: Set<BranchPalace>
  adjacentBranches: BranchPalace[]
  starsById: Map<string, StarPosition[]>
}

interface StarPosition {
  palace: ZiweiPalaceDetailView
  star: ZiweiStarView
}

function buildPatternContext(
  palaces: ZiweiPalaceDetailView[]
): PatternContext {
  const lifePalace = palaces.find((palace) => palace.isLifePalace)
  const lifeScopeBranches = new Set<BranchPalace>(
    (lifePalace?.relations ?? [])
      .filter((relation) => relation.kind !== "adjacent")
      .map((relation) => relation.branch)
  )
  const adjacentBranches = (lifePalace?.relations ?? [])
    .filter((relation) => relation.kind === "adjacent")
    .map((relation) => relation.branch)
  const starsById = new Map<string, StarPosition[]>()

  palaces.forEach((palace) => {
    palace.starGroups.forEach((group) => {
      group.stars.forEach((star) => {
        starsById.set(star.starId, [
          ...(starsById.get(star.starId) ?? []),
          { palace, star }
        ])
      })
    })
  })

  return {
    lifeBranch: lifePalace?.branch,
    lifeScopeBranches,
    adjacentBranches,
    starsById
  }
}

function buildPatternMatch(
  definition: ZiweiPatternDefinition,
  context: PatternContext
): ZiweiPatternMatchView {
  if (definition.match.type === "pending") {
    return {
      id: definition.id,
      label: definition.label,
      category: definition.category,
      categoryLabel: ZIWEI_PATTERN_CATEGORY_LABELS[definition.category],
      status: "pending",
      strength: "review",
      strengthLabel: ZIWEI_PATTERN_STRENGTH_LABELS.review,
      conditionText: definition.conditionText,
      starLabels: [],
      evidenceLines: ["待补充正式判定条件"],
      strengthReasonLines: ["待人工复核格局条件"],
      matchedPalaces: [],
      matchedPalaceLabels: [],
      missingStarLabels: [],
      sourceRuleIds: []
    }
  }

  const positions = definition.starIds.flatMap((starId) => {
    return context.starsById.get(starId) ?? []
  })
  const sourceRuleIds = unique(
    positions.map((position) => position.star.placementRuleId)
  )
  const starLabels = definition.starIds.map((starId) => {
    return context.starsById.get(starId)?.[0]?.star.label ?? starId
  })
  const missingStarLabels = definition.starIds
    .filter((starId) => !context.starsById.has(starId))
    .map((starId) => starId)
  const result = evaluateDefinition(definition, context)

  return {
    id: definition.id,
    label: definition.label,
    category: definition.category,
    categoryLabel: ZIWEI_PATTERN_CATEGORY_LABELS[definition.category],
    status: result.hit ? "hit" : "miss",
    strength: result.strength,
    strengthLabel: ZIWEI_PATTERN_STRENGTH_LABELS[result.strength],
    conditionText: definition.conditionText,
    starLabels,
    evidenceLines: result.evidenceLines,
    strengthReasonLines: result.strengthReasonLines,
    matchedPalaces: result.matchedPalaces,
    matchedPalaceLabels: result.matchedPalaceLabels,
    missingStarLabels,
    sourceRuleIds
  }
}

function evaluateDefinition(
  definition: ZiweiPatternDefinition,
  context: PatternContext
): {
  hit: boolean
  strength: ZiweiPatternStrength
  evidenceLines: string[]
  strengthReasonLines: string[]
  matchedPalaces: {
    branch: BranchPalace
    label: string
  }[]
  matchedPalaceLabels: string[]
} {
  if (definition.match.type === "life-scope-all") {
    const matched = definition.starIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, context.lifeScopeBranches)
    })
    const matchedStarIds = new Set(matched.map((item) => item.star.starId))
    const hit = definition.starIds.every((starId) => matchedStarIds.has(starId))

    return buildEvaluatedResult({
      hit,
      matched,
      fallbackText: "未全部进入命宫三方四正"
    })
  }

  if (definition.match.type === "life-scope-all-with-brightness") {
    const brightnessLevels = definition.match.brightnessLevels
    const matched = definition.starIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, context.lifeScopeBranches)
    })
    const brightMatched = matched.filter((position) => {
      return isBrightnessInLevels(position, brightnessLevels)
    })
    const brightMatchedStarIds = new Set(
      brightMatched.map((item) => item.star.starId)
    )
    const hit = definition.starIds.every((starId) => {
      return brightMatchedStarIds.has(starId)
    })

    return buildEvaluatedResult({
      hit,
      matched: brightMatched,
      fallbackText: "未全部进入命宫三方四正，或亮度未达庙旺得利",
      strengthReasonLines: hit
        ? [`亮度达标：${formatBrightnessEvidence(brightMatched)}`]
        : undefined
    })
  }

  if (definition.match.type === "life-scope-at-least") {
    const matched = definition.starIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, context.lifeScopeBranches)
    })
    const matchedStarIds = new Set(matched.map((item) => item.star.starId))

    return buildEvaluatedResult({
      hit: matchedStarIds.size >= definition.match.count,
      matched,
      fallbackText: `命宫三方四正命中不足 ${definition.match.count} 项`
    })
  }

  if (definition.match.type === "same-palace-all") {
    const commonPalace = findCommonPalace(definition.starIds, context)
    const matched = commonPalace
      ? definition.starIds.flatMap((starId) => {
          return getPositionsInBranches(
            starId,
            context,
            new Set([commonPalace.branch])
          )
        })
      : []

    return buildEvaluatedResult({
      hit: Boolean(commonPalace),
      matched,
      fallbackText: "未同落一宫"
    })
  }

  if (definition.match.type === "same-palace-all-in-branches") {
    const commonPalace = findCommonPalace(definition.starIds, context)
    const allowedBranches = new Set(definition.match.branches)
    const matched =
      commonPalace && allowedBranches.has(commonPalace.branch)
        ? definition.starIds.flatMap((starId) => {
            return getPositionsInBranches(
              starId,
              context,
              new Set([commonPalace.branch])
            )
          })
        : []

    return buildEvaluatedResult({
      hit: Boolean(commonPalace && allowedBranches.has(commonPalace.branch)),
      matched,
      fallbackText: "未同落指定地支宫位"
    })
  }

  if (definition.match.type === "life-branch-with-stars") {
    const targetBranch = new Set([definition.match.branch])
    const matched = definition.match.starIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, targetBranch)
    })
    const matchedStarIds = new Set(matched.map((item) => item.star.starId))
    const hit =
      context.lifeBranch === definition.match.branch &&
      definition.match.starIds.every((starId) => matchedStarIds.has(starId))

    return buildEvaluatedResult({
      hit,
      matched,
      fallbackText: "命宫未在指定地支或指定星曜未守命"
    })
  }

  if (definition.match.type === "life-branch-with-scope-stars") {
    const lifeBranch = context.lifeBranch
    const lifeBranches = new Set(lifeBranch ? [lifeBranch] : [])
    const lifeMatched = definition.match.lifeStarIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, lifeBranches)
    })
    const scopeMatched = definition.match.scopeStarIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, context.lifeScopeBranches)
    })
    const matched = [...lifeMatched, ...scopeMatched]
    const lifeMatchedStarIds = new Set(
      lifeMatched.map((item) => item.star.starId)
    )
    const scopeMatchedStarIds = new Set(
      scopeMatched.map((item) => item.star.starId)
    )
    const blockedMatched = (definition.match.blockedScopeStarIds ?? []).flatMap(
      (starId) => {
        return getPositionsInBranches(starId, context, context.lifeScopeBranches)
      }
    )
    const coreHit =
      Boolean(lifeBranch && definition.match.branches.includes(lifeBranch)) &&
      definition.match.lifeStarIds.every((starId) => {
        return lifeMatchedStarIds.has(starId)
      }) &&
      definition.match.scopeStarIds.every((starId) => {
        return scopeMatchedStarIds.has(starId)
      })

    return buildEvaluatedResult({
      hit: coreHit && blockedMatched.length === 0,
      coreHit,
      matched: [...matched, ...blockedMatched],
      blockedMatched,
      fallbackText: "命宫地支、守命星、会照星或避煞忌条件未满足"
    })
  }

  if (definition.match.type === "life-stars-with-scope-at-least") {
    const lifeBranch = context.lifeBranch
    const lifeBranches = new Set(lifeBranch ? [lifeBranch] : [])
    const lifeMatched = definition.match.lifeStarIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, lifeBranches)
    })
    const scopeMatched = definition.match.scopeStarIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, context.lifeScopeBranches)
    })
    const lifeMatchedStarIds = new Set(
      lifeMatched.map((item) => item.star.starId)
    )
    const scopeMatchedStarIds = new Set(
      scopeMatched.map((item) => item.star.starId)
    )
    const lifeBrightnessLevels = definition.match.lifeBrightnessLevels
    const brightnessMatched = lifeBrightnessLevels
      ? lifeMatched.filter((position) => {
          return isBrightnessInLevels(position, lifeBrightnessLevels)
        })
      : lifeMatched
    const brightnessMatchedStarIds = new Set(
      brightnessMatched.map((item) => item.star.starId)
    )
    const blockedMatched = (definition.match.blockedScopeStarIds ?? []).flatMap(
      (starId) => {
        return getPositionsInBranches(starId, context, context.lifeScopeBranches)
      }
    )
    const branchMatched =
      !definition.match.branches ||
      Boolean(lifeBranch && definition.match.branches.includes(lifeBranch))
    const coreHit =
      branchMatched &&
      definition.match.lifeStarIds.every((starId) => {
        return lifeMatchedStarIds.has(starId)
      }) &&
      scopeMatchedStarIds.size >= definition.match.count
    const brightnessHit = definition.match.lifeStarIds.every((starId) => {
      return brightnessMatchedStarIds.has(starId)
    })

    return buildEvaluatedResult({
      hit: coreHit && brightnessHit && blockedMatched.length === 0,
      coreHit: coreHit && brightnessHit,
      matched: [...lifeMatched, ...scopeMatched, ...blockedMatched],
      blockedMatched,
      fallbackText: `命宫地支、守命星、会照数量、亮度或避煞忌条件未满足`,
      strengthReasonLines:
        coreHit && brightnessHit && lifeBrightnessLevels
          ? [`守命亮度达标：${formatBrightnessEvidence(brightnessMatched)}`]
          : undefined
    })
  }

  if (definition.match.type === "life-stars-with-adjacent-star-sets") {
    const lifeBranch = context.lifeBranch
    const lifeBranches = new Set(lifeBranch ? [lifeBranch] : [])
    const lifeMatched = definition.match.lifeStarIds.flatMap((starId) => {
      return getPositionsInBranches(starId, context, lifeBranches)
    })
    const lifeMatchedStarIds = new Set(
      lifeMatched.map((item) => item.star.starId)
    )
    const adjacentSetMatches = definition.match.adjacentStarSets.map((set) => {
      return getAdjacentStarSetPositions(set, context)
    })
    const adjacentMatched = adjacentSetMatches.flat()
    const adjacentMatchedBranches = new Set(
      adjacentMatched.map((item) => item.palace.branch)
    )
    const requiredAdjacentBranchCount = Math.min(
      definition.match.adjacentStarSets.length,
      context.adjacentBranches.length
    )
    const hit =
      definition.match.lifeStarIds.every((starId) => {
        return lifeMatchedStarIds.has(starId)
      }) &&
      adjacentSetMatches.every((matches) => matches.length > 0) &&
      adjacentMatchedBranches.size >= requiredAdjacentBranchCount

    return buildEvaluatedResult({
      hit,
      matched: [...lifeMatched, ...adjacentMatched],
      fallbackText: "命宫守星或左右夹星条件未满足"
    })
  }

  if (definition.match.type === "star-branches") {
    const matched = definition.match.placements.flatMap((placement) => {
      return getPositionsInBranches(
        placement.starId,
        context,
        new Set(placement.branches)
      )
    })
    const matchedStarIds = new Set(matched.map((item) => item.star.starId))
    const hit = definition.match.placements.every((placement) => {
      return matchedStarIds.has(placement.starId)
    })

    return buildEvaluatedResult({
      hit,
      matched,
      fallbackText: "星曜未落入指定地支"
    })
  }

  const matched = definition.starIds.flatMap((starId) => {
    return getPositionsInBranches(
      starId,
      context,
      new Set(context.adjacentBranches)
    )
  })
  const adjacentSet = new Set(matched.map((item) => item.palace.branch))
  const matchedStarIds = new Set(matched.map((item) => item.star.starId))
  const hit =
    definition.starIds.every((starId) => matchedStarIds.has(starId)) &&
    context.adjacentBranches.every((branch) => adjacentSet.has(branch))

  return buildEvaluatedResult({
    hit,
    matched,
    fallbackText: "未分居命宫左右邻宫"
  })
}

function getPositionsInBranches(
  starId: string,
  context: PatternContext,
  branches: Set<BranchPalace>
): StarPosition[] {
  return (context.starsById.get(starId) ?? []).filter((position) => {
    return branches.has(position.palace.branch)
  })
}

function isBrightnessInLevels(
  position: StarPosition,
  levels: readonly ZiweiStarBrightnessLevel[]
): boolean {
  return Boolean(
    position.star.brightness && levels.includes(position.star.brightness.level)
  )
}

function formatBrightnessEvidence(positions: StarPosition[]): string {
  if (positions.length === 0) {
    return "无达标亮度"
  }

  return positions
    .map((position) => {
      return `${position.star.label}${position.star.brightness?.label ?? "未定"}`
    })
    .join(" / ")
}

function getAdjacentStarSetPositions(
  set: {
    allOf?: readonly string[]
    anyOf?: readonly string[]
  },
  context: PatternContext
): StarPosition[] {
  const adjacentBranches = new Set(context.adjacentBranches)

  return context.adjacentBranches.flatMap((branch) => {
    const branchSet = new Set([branch])
    const requiredPositions = (set.allOf ?? []).flatMap((starId) => {
      return getPositionsInBranches(starId, context, branchSet)
    })
    const optionalPositions = (set.anyOf ?? []).flatMap((starId) => {
      return getPositionsInBranches(starId, context, branchSet)
    })
    const hasAllRequired = (set.allOf ?? []).every((starId) => {
      return getPositionsInBranches(starId, context, branchSet).length > 0
    })
    const hasAnyOptional =
      !set.anyOf || optionalPositions.some((position) => {
        return adjacentBranches.has(position.palace.branch)
      })

    if (!hasAllRequired || !hasAnyOptional) {
      return []
    }

    return [...requiredPositions, ...optionalPositions]
  })
}

function findCommonPalace(
  starIds: readonly string[],
  context: PatternContext
): ZiweiPalaceDetailView | undefined {
  const firstPositions = context.starsById.get(starIds[0] ?? "") ?? []

  return firstPositions.find((position) => {
    return starIds.every((starId) => {
      return (context.starsById.get(starId) ?? []).some((candidate) => {
        return candidate.palace.branch === position.palace.branch
      })
    })
  })?.palace
}

function buildEvaluatedResult(params: {
  hit: boolean
  matched: StarPosition[]
  fallbackText: string
  blockedMatched?: StarPosition[]
  coreHit?: boolean
  strengthReasonLines?: string[]
}): {
  hit: boolean
  strength: ZiweiPatternStrength
  evidenceLines: string[]
  strengthReasonLines: string[]
  matchedPalaces: {
    branch: BranchPalace
    label: string
  }[]
  matchedPalaceLabels: string[]
} {
  if (params.coreHit && params.blockedMatched && params.blockedMatched.length > 0) {
    const matchedPalaces = buildMatchedPalaces(params.matched)

    return {
      hit: false,
      strength: "broken",
      evidenceLines: formatEvidenceLines(params.matched),
      strengthReasonLines: [
        `三方四正见主要煞忌：${formatUniqueStarLabels(params.blockedMatched)}`
      ],
      matchedPalaces,
      matchedPalaceLabels: matchedPalaces.map((palace) => palace.label)
    }
  }

  if (!params.hit) {
    const matchedPalaces = buildMatchedPalaces(params.matched)

    return {
      hit: false,
      strength: "none",
      evidenceLines: [params.fallbackText],
      strengthReasonLines: params.strengthReasonLines ?? ["核心条件未满足"],
      matchedPalaces,
      matchedPalaceLabels: matchedPalaces.map((palace) => palace.label)
    }
  }

  const enhancementLines = buildEnhancementLines(params.matched)
  const matchedPalaces = buildMatchedPalaces(params.matched)

  return {
    hit: true,
    strength: enhancementLines.length > 0 ? "enhanced" : "core",
    evidenceLines: formatEvidenceLines(params.matched),
    strengthReasonLines:
      params.strengthReasonLines ??
      (enhancementLines.length > 0 ? enhancementLines : ["核心条件满足"]),
    matchedPalaces,
    matchedPalaceLabels: matchedPalaces.map((palace) => palace.label)
  }
}

function buildMatchedPalaces(
  positions: StarPosition[]
): {
  branch: BranchPalace
  label: string
}[] {
  const seen = new Set<BranchPalace>()

  return positions
    .filter((position) => {
      if (seen.has(position.palace.branch)) {
        return false
      }

      seen.add(position.palace.branch)
      return true
    })
    .map((position) => {
      return {
        branch: position.palace.branch,
        label: formatPalaceLabel(position)
      }
    })
}

function formatEvidenceLines(positions: StarPosition[]): string[] {
  if (positions.length === 0) {
    return ["核心条件满足"]
  }

  return positions.map((position) => {
    return `${position.star.label} 在 ${formatPalaceLabel(position)}`
  })
}

function buildEnhancementLines(positions: StarPosition[]): string[] {
  const enhancingStars = positions.filter((position) => {
    return ENHANCING_STAR_IDS.has(position.star.starId)
  })

  if (enhancingStars.length === 0) {
    return []
  }

  return [`加吉星曜：${formatUniqueStarLabels(enhancingStars)}`]
}

function formatUniqueStarLabels(positions: StarPosition[]): string {
  return unique(positions.map((position) => position.star.label)).join(" / ")
}

function formatPalaceLabel(position: StarPosition): string {
  return `${position.palace.branchLabel} · ${position.palace.sectorLabel}`
}

function unique<Value>(values: Value[]): Value[] {
  return Array.from(new Set(values))
}
