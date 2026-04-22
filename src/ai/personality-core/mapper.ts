/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Mapper
 * ======================================================
 *
 * 【文件定位】
 * 这是“人格生成层”。
 *
 * 它只负责：
 * 1. 接收 calculator.ts 输出的 BirthPattern
 * 2. 根据主星、support 星、借星，计算人格
 * 3. 计算：
 *    - CorePersonality（核心 5 维）
 *    - PersonalityTraits（行为层 traits）
 *    - summaries（摘要）
 *    - tags（标签）
 *    - debug（调试信息）
 *
 * ------------------------------------------------------
 * 【这个文件不负责什么】
 * 不负责：
 * - 阳历转农历
 * - 命宫/身宫公式
 * - 五行局
 * - 紫微/天府定位
 * - 14 主星安放
 *
 * 这些都应该在：
 *   - lunar.ts
 *   - ziwei-engine.ts
 *   - calculator.ts
 *
 * ------------------------------------------------------
 * 【当前人格计算原则】
 *
 * 1. 命宫主星 = 核心人格（权重最高）
 * 2. 三方四正 / support 星 = 支撑人格（中权重）
 * 3. 命宫为空时，借星参与，但权重更低
 * 4. 如果命宫为空，最终人格整体会有“虚化”衰减
 * 5. 双星组合会进一步拉开 traits 差异
 *
 * ------------------------------------------------------
 * 【当前权重】
 * - 命宫主星：1.0
 * - support 星：0.4
 * - 借星：0.6
 * - 空宫虚化：0.85
 *
 * ------------------------------------------------------
 * 【当前输出】
 * 输出：
 *   PersonalityProfile
 *
 * 这是 personality-gateway.ts 和测试页最终会使用的结构。
 * ======================================================
 */

import type {
  BirthPattern,
  CorePersonality,
  MatchedPairResult,
  PersonalityProfile,
  PersonalityTraits,
  StarId
} from "./schema"

import {
  BORROWED_STAR_WEIGHT,
  DEFAULT_TRAIT_VALUE,
  EMPTY_PRIMARY_ATTENUATION,
  MAX_TRAIT_VALUE,
  MIN_TRAIT_VALUE,
  PRIMARY_STAR_WEIGHT,
  SUPPORT_STAR_WEIGHT
} from "./constants"

/**
 * ======================================================
 * 单星人格资料结构
 * ======================================================
 */
type StarProfile = {
  label: string
  core: Partial<CorePersonality>
  traits: Partial<PersonalityTraits>
  tags: string[]
  summaries: string[]
}

/**
 * ======================================================
 * 双星组合资料结构
 * ======================================================
 */
type PairProfile = {
  pairLabel: string
  core?: Partial<CorePersonality>
  traits?: Partial<PersonalityTraits>
  tags?: string[]
  summaries?: string[]
}

/**
 * ======================================================
 * 星曜中文标签
 * ======================================================
 */
const STAR_LABELS: Record<StarId, string> = {
  star_00: "空",
  star_01: "紫微",
  star_02: "贪狼",
  star_03: "巨门",
  star_04: "廉贞",
  star_05: "武曲",
  star_06: "破军",
  star_07: "天府",
  star_08: "天机",
  star_09: "天相",
  star_10: "天梁",
  star_11: "天同",
  star_12: "七杀",
  star_13: "太阳",
  star_14: "太阴"
}

/**
 * ======================================================
 * 全量单星人格配置
 * ======================================================
 */
const STAR_PROFILES: Record<StarId, StarProfile> = {
  star_00: {
    label: "空",
    core: {},
    traits: {},
    tags: [],
    summaries: []
  },

  star_01: {
    label: "紫微",
    core: {
      confidence: 0.28,
      dependency: -0.18,
      activity: 0.08
    },
    traits: {
      discipline: 18,
      stability: 14,
      caregiving: 8,
      buildingPreference: 10,
      activity: 6
    },
    tags: ["主导感", "统筹感", "核心意识"],
    summaries: [
      "紫微底色明显",
      "更容易以中心角色理解关系与秩序，重掌控与整体统筹。"
    ]
  },

  star_02: {
    label: "贪狼",
    core: {
      activity: 0.24,
      curiosity: 0.22,
      sensitivity: 0.06
    },
    traits: {
      activity: 20,
      appetite: 18,
      curiosity: 15,
      discipline: -10,
      restPreference: -12
    },
    tags: ["探索欲", "感官性", "扩张性"],
    summaries: [
      "贪狼底色明显",
      "行动欲与尝试欲偏强，更容易被新鲜感、刺激感与欲望驱动。"
    ]
  },

  star_03: {
    label: "巨门",
    core: {
      curiosity: 0.18,
      sensitivity: 0.18,
      confidence: -0.08
    },
    traits: {
      curiosity: 12,
      emotionalSensitivity: 18,
      stability: -10,
      discipline: 4,
      caregiving: -4
    },
    tags: ["思辨", "敏感", "怀疑"],
    summaries: [
      "巨门底色明显",
      "容易从细节和矛盾处进入思考，对外界评价、信息偏差更敏感。"
    ]
  },

  star_04: {
    label: "廉贞",
    core: {
      confidence: 0.14,
      sensitivity: 0.10,
      activity: 0.12
    },
    traits: {
      discipline: 10,
      activity: 10,
      emotionalSensitivity: 8,
      restPreference: -6,
      stability: -4
    },
    tags: ["原则感", "边界感", "欲望张力"],
    summaries: [
      "廉贞底色明显",
      "边界意识和内在原则较强，既会坚持，也容易产生内在拉扯。"
    ]
  },

  star_05: {
    label: "武曲",
    core: {
      confidence: 0.18,
      dependency: -0.22,
      activity: 0.06
    },
    traits: {
      discipline: 22,
      stability: 12,
      appetite: -6,
      caregiving: -8,
      buildingPreference: 12
    },
    tags: ["执行力", "务实", "资源感"],
    summaries: [
      "武曲底色明显",
      "更偏务实、执行、结果导向，对资源与秩序的感知更强。"
    ]
  },

  star_06: {
    label: "破军",
    core: {
      activity: 0.26,
      confidence: 0.10,
      sensitivity: -0.06
    },
    traits: {
      activity: 22,
      curiosity: 12,
      discipline: -14,
      stability: -20,
      buildingPreference: -6
    },
    tags: ["破旧立新", "冲撞", "变动性"],
    summaries: [
      "破军底色明显",
      "更容易通过打破旧状态推进变化，节奏跳跃、稳定性较低。"
    ]
  },

  star_07: {
    label: "天府",
    core: {
      confidence: 0.16,
      sensitivity: 0.04,
      dependency: -0.06
    },
    traits: {
      stability: 18,
      discipline: 14,
      caregiving: 10,
      buildingPreference: 14,
      appetite: 6
    },
    tags: ["稳重", "包容", "承载力"],
    summaries: [
      "天府底色明显",
      "更强调稳妥、承接、容纳与积累，节奏通常比外放型人格更稳。"
    ]
  },

  star_08: {
    label: "天机",
    core: {
      curiosity: 0.28,
      sensitivity: 0.12,
      confidence: -0.06
    },
    traits: {
      curiosity: 22,
      emotionalSensitivity: 8,
      stability: -10,
      discipline: -4,
      activity: 6
    },
    tags: ["思维快", "变化感", "观察力"],
    summaries: [
      "天机底色明显",
      "思维反应快、联想多，更容易从变化、信息与细节中启动自己。"
    ]
  },

  star_09: {
    label: "天相",
    core: {
      sensitivity: 0.10,
      dependency: 0.06,
      confidence: 0.04
    },
    traits: {
      caregiving: 18,
      discipline: 8,
      stability: 6,
      emotionalSensitivity: 8,
      activity: -2
    },
    tags: ["协调", "关系秩序", "照应感"],
    summaries: [
      "天相底色明显",
      "更容易站在关系协调与秩序维护的位置，对公平与分寸更在意。"
    ]
  },

  star_10: {
    label: "天梁",
    core: {
      sensitivity: 0.16,
      dependency: 0.10,
      confidence: 0.06
    },
    traits: {
      caregiving: 22,
      stability: 10,
      discipline: 6,
      emotionalSensitivity: 10,
      restPreference: 8
    },
    tags: ["保护欲", "责任感", "照顾倾向"],
    summaries: [
      "天梁底色明显",
      "保护欲与责任感较强，更容易自然地站到照顾者或撑住局面的位置。"
    ]
  },

  star_11: {
    label: "天同",
    core: {
      dependency: 0.22,
      sensitivity: 0.14,
      confidence: -0.10
    },
    traits: {
      restPreference: 18,
      appetite: 10,
      caregiving: 10,
      discipline: -10,
      activity: -10,
      emotionalSensitivity: 10
    },
    tags: ["温和", "舒适倾向", "依恋感"],
    summaries: [
      "天同底色明显",
      "更追求舒适、和气与被接住的感觉，依恋感和情绪柔软度较强。"
    ]
  },

  star_12: {
    label: "七杀",
    core: {
      confidence: 0.18,
      dependency: -0.20,
      activity: 0.20
    },
    traits: {
      activity: 16,
      discipline: 10,
      stability: -12,
      caregiving: -10,
      restPreference: -10
    },
    tags: ["决断", "硬朗", "冒险性"],
    summaries: [
      "七杀底色明显",
      "更偏决断、硬朗、直接推进，不太依赖温吞的关系缓冲。"
    ]
  },

  star_13: {
    label: "太阳",
    core: {
      confidence: 0.24,
      activity: 0.16,
      dependency: -0.08
    },
    traits: {
      activity: 14,
      caregiving: 8,
      discipline: 6,
      appetite: 4,
      restPreference: -8
    },
    tags: ["外放", "表达欲", "照亮感"],
    summaries: [
      "太阳底色明显",
      "表达欲与外放度更强，更容易通过主动性和存在感影响周围。"
    ]
  },

  star_14: {
    label: "太阴",
    core: {
      sensitivity: 0.24,
      dependency: 0.12,
      curiosity: 0.06
    },
    traits: {
      emotionalSensitivity: 22,
      restPreference: 10,
      stability: 4,
      appetite: 6,
      activity: -8
    },
    tags: ["细腻", "内感", "情绪感知"],
    summaries: [
      "太阴底色明显",
      "细腻、内感、情绪感知更强，容易把外界变化转成内心波动。"
    ]
  }
}

/**
 * ======================================================
 * 双星组合配置
 * ======================================================
 */
const PAIR_PROFILES: Record<string, PairProfile> = {
  "star_10+star_11": {
    pairLabel: "同梁照顾型",
    traits: {
      caregiving: 18,
      emotionalSensitivity: 8,
      stability: 6,
      discipline: -4
    },
    core: {
      dependency: 0.10,
      sensitivity: 0.08
    },
    tags: ["照顾型", "保护欲", "心软倾向"],
    summaries: [
      "保护欲与和气感并存，重照顾、重关系，也容易变得心软而回避冲突。"
    ]
  },

  "star_08+star_14": {
    pairLabel: "机阴敏思型",
    traits: {
      curiosity: 8,
      emotionalSensitivity: 14,
      stability: -6
    },
    core: {
      curiosity: 0.08,
      sensitivity: 0.12
    },
    tags: ["敏思型", "观察细腻", "情绪波动"],
    summaries: [
      "联动结构：思维细腻而敏感，观察入微，容易把外界变化转化为内在情绪波动。"
    ]
  },

  "star_01+star_05": {
    pairLabel: "紫武掌控型",
    traits: {
      discipline: 14,
      stability: 8,
      caregiving: -4
    },
    core: {
      confidence: 0.10,
      dependency: -0.08
    },
    tags: ["掌控力", "执行型"],
    summaries: [
      "主导感与执行力并存，既想掌控方向，也愿意亲手把事情推进到底。"
    ]
  },

  "star_01+star_07": {
    pairLabel: "紫府中枢型",
    traits: {
      stability: 16,
      discipline: 10,
      caregiving: 8
    },
    core: {
      confidence: 0.10
    },
    tags: ["中枢感", "承载力", "稳中带主导"],
    summaries: [
      "中枢气质明显，偏稳中带主导，既想掌控局面，也愿意承接责任。"
    ]
  },

  "star_02+star_06": {
    pairLabel: "贪破冲锋型",
    traits: {
      activity: 18,
      curiosity: 10,
      stability: -18,
      discipline: -8
    },
    core: {
      activity: 0.10
    },
    tags: ["冲锋", "破格", "高刺激"],
    summaries: [
      "刺激感和突破欲都偏强，容易为了变化和新鲜感主动打破旧状态。"
    ]
  },

  "star_03+star_08": {
    pairLabel: "巨机思辨型",
    traits: {
      curiosity: 12,
      emotionalSensitivity: 10,
      stability: -4
    },
    core: {
      curiosity: 0.08,
      sensitivity: 0.06
    },
    tags: ["思辨型", "多想", "分析欲"],
    summaries: [
      "更容易进入分析、推演和反复思考状态，信息处理深但内耗风险也更高。"
    ]
  },

  "star_13+star_05": {
    pairLabel: "阳武执行外放型",
    traits: {
      activity: 12,
      discipline: 12,
      stability: 4
    },
    core: {
      confidence: 0.08
    },
    tags: ["执行外放", "推进感"],
    summaries: [
      "外放表达和执行推进结合得较紧，容易一边表态一边直接上手。"
    ]
  },

  "star_07+star_10": {
    pairLabel: "府梁承托型",
    traits: {
      caregiving: 14,
      stability: 12,
      discipline: 6
    },
    core: {
      sensitivity: 0.06
    },
    tags: ["承托型", "可靠", "责任感"],
    summaries: [
      "承接力和责任感同时增强，更像能撑住局面、也愿意顾及他人的类型。"
    ]
  }
}

/**
 * ======================================================
 * 创建默认核心人格
 * ======================================================
 */
function createBaseCorePersonality(): CorePersonality {
  return {
    activity: 0.5,
    curiosity: 0.5,
    dependency: 0.5,
    confidence: 0.5,
    sensitivity: 0.5
  }
}

/**
 * ======================================================
 * 创建默认 traits
 * ======================================================
 */
function createBaseTraits(): PersonalityTraits {
  return {
    activity: DEFAULT_TRAIT_VALUE,
    restPreference: DEFAULT_TRAIT_VALUE,
    appetite: DEFAULT_TRAIT_VALUE,
    discipline: DEFAULT_TRAIT_VALUE,
    curiosity: DEFAULT_TRAIT_VALUE,
    emotionalSensitivity: DEFAULT_TRAIT_VALUE,
    stability: DEFAULT_TRAIT_VALUE,
    caregiving: DEFAULT_TRAIT_VALUE,
    buildingPreference: DEFAULT_TRAIT_VALUE
  }
}

/**
 * ======================================================
 * 生成 pair key
 * ======================================================
 */
function makePairKey(a: StarId, b: StarId): string {
  return [a, b].sort().join("+")
}

/**
 * ======================================================
 * 限制 core 数值到 0~1
 * ======================================================
 */
function clampCore(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return Number(value.toFixed(4))
}

/**
 * ======================================================
 * 限制 trait 数值到 MIN~MAX
 * ======================================================
 */
function clampTrait(value: number): number {
  if (value < MIN_TRAIT_VALUE) return MIN_TRAIT_VALUE
  if (value > MAX_TRAIT_VALUE) return MAX_TRAIT_VALUE
  return Math.round(value)
}

/**
 * ======================================================
 * 应用 core 增量
 * ======================================================
 */
function applyCoreDelta(
  target: CorePersonality,
  delta: Partial<CorePersonality>,
  weight: number
): void {
  Object.entries(delta).forEach(([key, value]) => {
    if (typeof value !== "number") return
    const traitKey = key as keyof CorePersonality
    target[traitKey] = clampCore(target[traitKey] + value * weight)
  })
}

/**
 * ======================================================
 * 应用 traits 增量
 * ======================================================
 */
function applyTraitDelta(
  target: PersonalityTraits,
  delta: Partial<PersonalityTraits>,
  weight: number
): void {
  Object.entries(delta).forEach(([key, value]) => {
    if (typeof value !== "number") return
    const traitKey = key as keyof PersonalityTraits
    target[traitKey] = clampTrait(target[traitKey] + value * weight)
  })
}

/**
 * ======================================================
 * 为空宫做整体虚化
 * ======================================================
 */
function applyEmptyPrimaryAttenuation(
  core: CorePersonality,
  traits: PersonalityTraits
): void {
  ;(Object.keys(core) as Array<keyof CorePersonality>).forEach((key) => {
    const current = core[key]
    const base = 0.5
    core[key] = clampCore(base + (current - base) * EMPTY_PRIMARY_ATTENUATION)
  })

  ;(Object.keys(traits) as Array<keyof PersonalityTraits>).forEach((key) => {
    const current = traits[key]
    if (typeof current !== "number") return

    const base = DEFAULT_TRAIT_VALUE
    traits[key] = clampTrait(
      base + (current - base) * EMPTY_PRIMARY_ATTENUATION
    )
  })
}

/**
 * ======================================================
 * 检测一组星中的所有 pair
 * ======================================================
 */
function detectPairs(stars: StarId[]): MatchedPairResult[] {
  const deduped = Array.from(new Set(stars)).filter((star) => star !== "star_00")
  const pairs: MatchedPairResult[] = []

  for (let i = 0; i < deduped.length; i++) {
    for (let j = i + 1; j < deduped.length; j++) {
      const a = deduped[i]
      const b = deduped[j]
      const pairKey = makePairKey(a, b)
      const pairProfile = PAIR_PROFILES[pairKey]

      pairs.push({
        pairId: pairKey,
        starIds: [a, b],
        pairLabel:
          pairProfile?.pairLabel ||
          `${STAR_LABELS[a]} + ${STAR_LABELS[b]}`
      })
    }
  }

  return pairs
}

/**
 * ======================================================
 * 对命中的 pair 应用加成
 * ======================================================
 */
function applyPairs(
  pairs: MatchedPairResult[],
  core: CorePersonality,
  traits: PersonalityTraits,
  weight: number,
  tags: Set<string>,
  summaries: string[]
): void {
  pairs.forEach((pair) => {
    const profile = PAIR_PROFILES[pair.pairId]
    if (!profile) return

    if (profile.core) {
      applyCoreDelta(core, profile.core, weight)
    }

    if (profile.traits) {
      applyTraitDelta(traits, profile.traits, weight)
    }

    profile.tags?.forEach((tag) => tags.add(tag))
    profile.summaries?.forEach((summary) => summaries.push(summary))
  })
}

/**
 * ======================================================
 * 应用一组星的单星人格
 * ======================================================
 */
function applyStars(
  stars: StarId[],
  core: CorePersonality,
  traits: PersonalityTraits,
  weight: number,
  tags: Set<string>,
  summaries: string[]
): void {
  const deduped = Array.from(new Set(stars)).filter((star) => star !== "star_00")

  deduped.forEach((starId) => {
    const profile = STAR_PROFILES[starId]
    if (!profile) return

    applyCoreDelta(core, profile.core, weight)
    applyTraitDelta(traits, profile.traits, weight)

    profile.tags.forEach((tag) => tags.add(tag))
    profile.summaries.forEach((summary) => summaries.push(summary))
  })
}

/**
 * ======================================================
 * 根据 traits 追加摘要
 * ======================================================
 */
function appendTraitSummaries(
  traits: PersonalityTraits,
  summaries: string[]
): void {
  if (traits.caregiving >= 65) {
    summaries.push("照料倾向较强，容易站到照顾者位置。")
  }

  if (traits.emotionalSensitivity >= 65) {
    summaries.push("情绪感知较强，更容易受到关系氛围与环境变化影响。")
  }

  if (traits.discipline >= 65) {
    summaries.push("纪律感和执行顺序较强，更习惯按规则或结构推进事情。")
  }

  if (traits.discipline <= 35) {
    summaries.push("纪律性相对较弱，更容易受情绪、状态和新鲜感影响节奏。")
  }

  if (traits.stability <= 40) {
    summaries.push("状态波动相对明显，对变化和刺激的反应更强。")
  }

  if (traits.restPreference >= 60) {
    summaries.push("追求舒适与和气，更倾向在可安放、可休整的环境中恢复自己。")
  }

  if (traits.curiosity >= 60) {
    summaries.push("探索欲偏强，容易被新的信息、变化和可能性吸引。")
  }

  if (traits.activity >= 65) {
    summaries.push("主动性较强，更愿意自己发起、推动和尝试。")
  }

  if (traits.activity <= 35) {
    summaries.push("外放主动性相对较弱，更偏观察、等待或顺势而动。")
  }
}

/**
 * ======================================================
 * 去重摘要
 * ======================================================
 */
function dedupeSummaries(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  items.forEach((item) => {
    const key = item.trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    result.push(key)
  })

  return result
}

/**
 * ======================================================
 * 主函数：BirthPattern -> PersonalityProfile
 * ======================================================
 */
export function mapBirthPatternToPersonalityProfile(
  pattern: BirthPattern
): PersonalityProfile {
  const core = createBaseCorePersonality()
  const traits = createBaseTraits()

  const tags = new Set<string>()
  const summaries: string[] = []

  applyStars(
    pattern.primaryStars,
    core,
    traits,
    PRIMARY_STAR_WEIGHT,
    tags,
    summaries
  )

  const hitPairs = detectPairs(pattern.primaryStars)
  applyPairs(
    hitPairs,
    core,
    traits,
    PRIMARY_STAR_WEIGHT,
    tags,
    summaries
  )

  applyStars(
    pattern.supportStars,
    core,
    traits,
    SUPPORT_STAR_WEIGHT,
    tags,
    summaries
  )

  const supportPairs = detectPairs(pattern.supportStars)
  applyPairs(
    supportPairs,
    core,
    traits,
    SUPPORT_STAR_WEIGHT,
    tags,
    summaries
  )

  if (pattern.isEmptyPrimary && pattern.borrowedStars.length > 0) {
    applyStars(
      pattern.borrowedStars,
      core,
      traits,
      BORROWED_STAR_WEIGHT,
      tags,
      summaries
    )

    const borrowedPairs = detectPairs(pattern.borrowedStars)
    applyPairs(
      borrowedPairs,
      core,
      traits,
      BORROWED_STAR_WEIGHT,
      tags,
      summaries
    )

    summaries.push("命宫原生主星不足，当前人格更多通过对宫借星来表现。")
  }

  if (pattern.isEmptyPrimary) {
    applyEmptyPrimaryAttenuation(core, traits)
  }

  appendTraitSummaries(traits, summaries)

  const finalSummaries = dedupeSummaries(summaries)
  const finalTags = Array.from(tags)

  return {
    pattern,
    corePersonality: core,
    traits,
    summaries: finalSummaries,
    tags: finalTags,
    debug: {
      primarySector: pattern.primarySector,
      primaryStars: pattern.primaryStars,
      supportSectors: pattern.supportSectors,
      supportStars: pattern.supportStars,
      borrowedStars: pattern.borrowedStars,
      isEmptyPrimary: pattern.isEmptyPrimary,
      hitPairs,
      supportPairs
    }
  }
}

/**
 * ======================================================
 * 兼容导出
 * ======================================================
 */
export const buildProfileFromPattern = mapBirthPatternToPersonalityProfile
export const mapBirthPattern = mapBirthPatternToPersonalityProfile

/**
 * ======================================================
 * 对外公开人格结果
 * ======================================================
 *
 * 这是给正式页面、展示层、外部结果层使用的结构。
 *
 * 注意：
 * 这里只保留“可公开展示”的字段，
 * 不直接暴露紫微术语。
 * ======================================================
 */
export type PublicPersonalityView = {
  /**
   * 先天气质标签
   */
  innateTemperamentLabel: string

  /**
   * 对外公开摘要
   */
  publicSummaries: string[]
}

/**
 * ======================================================
 * 禁止直接对外展示的关键词
 * ======================================================
 */
const PRIVATE_TERMS_REGEX =
  /命宫|身宫|主星|辅星|三方四正|借星|紫微|天机|天梁|天同|太阴|太阳|巨门|贪狼|破军|武曲|廉贞|天府|天相|七杀/

/**
 * ======================================================
 * 从人格摘要中提取“先天气质”
 * ======================================================
 */
export function getInnateTemperamentLabelFromProfile(
  profile: { summaries?: string[] }
): string {
  const text = (profile.summaries ?? []).join(" ")

  if (
    text.includes("保护欲") ||
    text.includes("责任感") ||
    text.includes("照顾")
  ) {
    return "守护型"
  }

  if (
    text.includes("探索欲") ||
    text.includes("变化") ||
    text.includes("联想")
  ) {
    return "探索型"
  }

  if (
    text.includes("细腻") ||
    text.includes("敏感") ||
    text.includes("情绪感知")
  ) {
    return "感知型"
  }

  if (
    text.includes("掌控") ||
    text.includes("主导") ||
    text.includes("执行")
  ) {
    return "主导型"
  }

  if (
    text.includes("舒适") ||
    text.includes("和气") ||
    text.includes("柔软")
  ) {
    return "温和型"
  }

  return "平衡型"
}

/**
 * ======================================================
 * 构建公开摘要
 * ======================================================
 */
export function buildPublicSummaries(
  profile: { summaries?: string[] },
  maxItems: number = 4
): string[] {
  const raw = profile.summaries ?? []

  const filtered = raw.filter((item) => {
    if (!item) return false
    if (PRIVATE_TERMS_REGEX.test(item)) return false
    return true
  })

  const deduped = Array.from(
    new Set(filtered.map((item) => item.trim()))
  ).filter(Boolean)

  return deduped.slice(0, maxItems)
}

/**
 * ======================================================
 * 构建公开人格展示结果
 * ======================================================
 */
export function buildPublicPersonalityView(
  profile: { summaries?: string[] }
): PublicPersonalityView {
  return {
    innateTemperamentLabel: getInnateTemperamentLabelFromProfile(profile),
    publicSummaries: buildPublicSummaries(profile)
  }
}

export default mapBirthPatternToPersonalityProfile