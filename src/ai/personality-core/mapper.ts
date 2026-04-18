/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Mapper
 * ======================================================
 *
 * 【文件职责】
 * 1. 将 BirthPattern（盘面结构）映射为 PersonalityProfile（人格档案）
 * 2. 正式输出：
 *    - corePersonality（紫微核心 5 维人格）
 *    - traits（行为层 9 维）
 *    - summaries（摘要）
 *    - debug（调试结构）
 *
 * ------------------------------------------------------
 * 【当前正式算法流程】
 * 1. 判断命宫是否为空宫
 * 2. 非空宫：
 *    - 1 星 → 单星人格
 *    - 2 星 → 组合人格
 * 3. 空宫：
 *    - 借对宫（0.65）
 * 4. 三方四正修正：
 *    - supportStars 单星修正
 *    - supportStars 组合修正
 * 5. 空宫虚化滤镜
 * 6. 输出 corePersonality
 * 7. 映射为 traits
 * 8. 生成 summaries / debug
 *
 * ------------------------------------------------------
 * 【重要说明】
 * 这版严格对齐你当前项目结构：
 * - StarProfile 用 baseCorePersonality / baseTraits
 * - PairProfile 用 pairCorePersonality / pairTraits / summaryText
 * - 不再错误读取不存在的 traits / label 字段
 *
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
  getPairLabelByStars,
  getPairProfile,
  getPairRelation,
  getStarLabel,
  getStarProfile,
  buildTraitSummaries,
  mergeUniqueSummaries,
  isEnabledPair
} from "./knowledge"

/**
 * ======================================================
 * 兼容当前 knowledge 结构的轻量类型
 * ======================================================
 */
type StarProfileLike = {
  summaryTags?: string[]
  baseTraits?: Partial<PersonalityTraits>
  baseCorePersonality?: Partial<CorePersonality>
}

type PairProfileLike = {
  summaryText?: string
  personalityTags?: string[]
  pairTraits?: Partial<PersonalityTraits>
  pairCorePersonality?: Partial<CorePersonality>
}

/**
 * ======================================================
 * 常量
 * ======================================================
 */

/**
 * 空宫借对宫衰减
 */
const EMPTY_BORROW_MULTIPLIER = 0.65

/**
 * 空宫虚化滤镜
 */
const EMPTY_STATE_FILTER: CorePersonality = {
  activity: 0.9,
  curiosity: 1.08,
  dependency: 1.15,
  confidence: 0.85,
  sensitivity: 1.12
}

/**
 * 默认核心人格
 */
const DEFAULT_CORE_PERSONALITY: CorePersonality = {
  activity: 0.5,
  curiosity: 0.5,
  dependency: 0.5,
  confidence: 0.5,
  sensitivity: 0.5
}

/**
 * ======================================================
 * 工具函数
 * ======================================================
 */

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.5
  if (value < 0) return 0
  if (value > 1) return 1
  return Number(value.toFixed(4))
}

function clamp100(value: number): number {
  if (Number.isNaN(value)) return 50
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value)
}

function normalizeCore(core: CorePersonality): CorePersonality {
  return {
    activity: clamp01(core.activity),
    curiosity: clamp01(core.curiosity),
    dependency: clamp01(core.dependency),
    confidence: clamp01(core.confidence),
    sensitivity: clamp01(core.sensitivity)
  }
}

function blendCore(
  base: CorePersonality,
  overlay: CorePersonality,
  weight: number
): CorePersonality {
  return normalizeCore({
    activity: base.activity * (1 - weight) + overlay.activity * weight,
    curiosity: base.curiosity * (1 - weight) + overlay.curiosity * weight,
    dependency: base.dependency * (1 - weight) + overlay.dependency * weight,
    confidence: base.confidence * (1 - weight) + overlay.confidence * weight,
    sensitivity: base.sensitivity * (1 - weight) + overlay.sensitivity * weight
  })
}

function multiplyCore(
  core: CorePersonality,
  multiplier: number
): CorePersonality {
  return normalizeCore({
    activity: core.activity * multiplier,
    curiosity: core.curiosity * multiplier,
    dependency: core.dependency * multiplier,
    confidence: core.confidence * multiplier,
    sensitivity: core.sensitivity * multiplier
  })
}

function applyEmptyStateFilter(core: CorePersonality): CorePersonality {
  return normalizeCore({
    activity: core.activity * EMPTY_STATE_FILTER.activity,
    curiosity: core.curiosity * EMPTY_STATE_FILTER.curiosity,
    dependency: core.dependency * EMPTY_STATE_FILTER.dependency,
    confidence: core.confidence * EMPTY_STATE_FILTER.confidence,
    sensitivity: core.sensitivity * EMPTY_STATE_FILTER.sensitivity
  })
}

/**
 * ======================================================
 * 旧 traits -> CorePersonality 兼容推导
 *
 * 说明：
 * - 如果某颗星 / 某个组合暂时还没正式写 5 维人格，
 *   就从旧 traits 临时推导
 * ======================================================
 */
function deriveCoreFromLegacyTraits(
  traits?: Partial<PersonalityTraits>
): CorePersonality {
  const source = traits ?? {}

  const activity = (source.activity ?? 50) / 100
  const curiosity = (source.curiosity ?? 50) / 100

  const dependency = (
    ((source.caregiving ?? 50) * 0.45) +
    ((source.emotionalSensitivity ?? 50) * 0.30) +
    ((100 - (source.discipline ?? 50)) * 0.25)
  ) / 100

  const confidence = (
    ((source.discipline ?? 50) * 0.35) +
    ((source.buildingPreference ?? 50) * 0.20) +
    ((source.activity ?? 50) * 0.20) +
    ((source.stability ?? 50) * 0.25)
  ) / 100

  const sensitivity = (
    ((source.emotionalSensitivity ?? 50) * 0.65) +
    ((source.caregiving ?? 50) * 0.20) +
    ((100 - (source.stability ?? 50)) * 0.15)
  ) / 100

  return normalizeCore({
    activity,
    curiosity,
    dependency,
    confidence,
    sensitivity
  })
}

/**
 * ======================================================
 * 读取单星核心人格
 * ======================================================
 */
function getStarCorePersonality(starId: StarId): CorePersonality {
  const profile = getStarProfile(starId) as StarProfileLike | null

  if (!profile) {
    return DEFAULT_CORE_PERSONALITY
  }

  if (profile.baseCorePersonality) {
    return normalizeCore({
      activity: profile.baseCorePersonality.activity ?? 0.5,
      curiosity: profile.baseCorePersonality.curiosity ?? 0.5,
      dependency: profile.baseCorePersonality.dependency ?? 0.5,
      confidence: profile.baseCorePersonality.confidence ?? 0.5,
      sensitivity: profile.baseCorePersonality.sensitivity ?? 0.5
    })
  }

  return deriveCoreFromLegacyTraits(profile.baseTraits)
}

/**
 * ======================================================
 * 读取组合核心人格
 * ======================================================
 */
function getPairCorePersonality(pairId: string): CorePersonality {
  const profile = getPairProfile(pairId) as PairProfileLike | null

  if (!profile) {
    return DEFAULT_CORE_PERSONALITY
  }

  if (profile.pairCorePersonality) {
    return normalizeCore({
      activity: profile.pairCorePersonality.activity ?? 0.5,
      curiosity: profile.pairCorePersonality.curiosity ?? 0.5,
      dependency: profile.pairCorePersonality.dependency ?? 0.5,
      confidence: profile.pairCorePersonality.confidence ?? 0.5,
      sensitivity: profile.pairCorePersonality.sensitivity ?? 0.5
    })
  }

  return deriveCoreFromLegacyTraits(profile.pairTraits)
}

/**
 * ======================================================
 * traits 映射
 * ======================================================
 */
function mapCoreToBehaviorTraits(core: CorePersonality): PersonalityTraits {
  return {
    activity: clamp100(core.activity * 100),
    restPreference: clamp100((1 - core.activity) * 100),
    appetite: clamp100((core.activity * 0.45 + core.sensitivity * 0.55) * 100),
    discipline: clamp100(
      (core.confidence * 0.75 + (1 - core.dependency) * 0.25) * 100
    ),
    curiosity: clamp100(core.curiosity * 100),
    emotionalSensitivity: clamp100(core.sensitivity * 100),
    stability: clamp100(
      ((1 - core.sensitivity) * 0.6 + core.confidence * 0.4) * 100
    ),
    caregiving: clamp100(
      (core.dependency * 0.55 + core.sensitivity * 0.45) * 100
    ),
    buildingPreference: clamp100(
      (
        core.confidence * 0.5 +
        (1 - core.curiosity) * 0.2 +
        (1 - core.dependency) * 0.3
      ) * 100
    )
  }
}

/**
 * ======================================================
 * 构建命中组合结构
 * ======================================================
 */
function buildMatchedPair(
  pairId: string,
  starA: StarId,
  starB: StarId
): MatchedPairResult {
  return {
    pairId,
    starIds: [starA, starB],
    pairLabel: getPairLabelByStars(starA, starB)
  }
}

/**
 * ======================================================
 * 命宫人格
 * ======================================================
 */
function resolvePrimaryCore(
  primaryStars: StarId[]
): {
  core: CorePersonality
  hitPairs: MatchedPairResult[]
} {
  const validPrimaryStars = primaryStars.filter((starId) => starId !== "star_00")

  if (validPrimaryStars.length === 0) {
    return {
      core: DEFAULT_CORE_PERSONALITY,
      hitPairs: []
    }
  }

  if (validPrimaryStars.length === 1) {
    return {
      core: getStarCorePersonality(validPrimaryStars[0]),
      hitPairs: []
    }
  }

  const starA = validPrimaryStars[0]
  const starB = validPrimaryStars[1]

  const relation = getPairRelation(starA, starB)

  if (relation && isEnabledPair(relation.pairId)) {
    return {
      core: getPairCorePersonality(relation.pairId),
      hitPairs: [buildMatchedPair(relation.pairId, starA, starB)]
    }
  }

  return {
    core: blendCore(
      getStarCorePersonality(starA),
      getStarCorePersonality(starB),
      0.5
    ),
    hitPairs: []
  }
}

/**
 * ======================================================
 * 空宫借对宫
 * ======================================================
 */
function resolveBorrowedCore(
  borrowedStars: StarId[]
): {
  core: CorePersonality
  hitPairs: MatchedPairResult[]
} {
  const validBorrowedStars = borrowedStars.filter((starId) => starId !== "star_00")

  if (validBorrowedStars.length === 0) {
    return {
      core: DEFAULT_CORE_PERSONALITY,
      hitPairs: []
    }
  }

  if (validBorrowedStars.length === 1) {
    return {
      core: multiplyCore(
        getStarCorePersonality(validBorrowedStars[0]),
        EMPTY_BORROW_MULTIPLIER
      ),
      hitPairs: []
    }
  }

  const starA = validBorrowedStars[0]
  const starB = validBorrowedStars[1]

  const relation = getPairRelation(starA, starB)

  if (relation && isEnabledPair(relation.pairId)) {
    return {
      core: multiplyCore(
        getPairCorePersonality(relation.pairId),
        EMPTY_BORROW_MULTIPLIER
      ),
      hitPairs: [buildMatchedPair(relation.pairId, starA, starB)]
    }
  }

  return {
    core: multiplyCore(
      blendCore(
        getStarCorePersonality(starA),
        getStarCorePersonality(starB),
        0.5
      ),
      EMPTY_BORROW_MULTIPLIER
    ),
    hitPairs: []
  }
}

/**
 * ======================================================
 * 三方四正修正（support）
 * ======================================================
 */
function applySupportModifier(
  baseCore: CorePersonality,
  supportStars: StarId[]
): {
  core: CorePersonality
  supportPairs: MatchedPairResult[]
} {
  let current = { ...baseCore }
  const supportPairs: MatchedPairResult[] = []

  const validSupportStars = Array.from(
    new Set(supportStars.filter((starId) => starId !== "star_00"))
  )

  /**
   * 单星修正
   */
  for (const starId of validSupportStars) {
    const supportCore = getStarCorePersonality(starId)
    current = blendCore(current, supportCore, 0.08)
  }

  /**
   * 组合修正
   * 当前简化策略：
   * - 任意 supportStars 两两尝试配对
   * - 命中 pairRelation + enabled 才生效
   */
  for (let i = 0; i < validSupportStars.length; i++) {
    for (let j = i + 1; j < validSupportStars.length; j++) {
      const starA = validSupportStars[i]
      const starB = validSupportStars[j]

      const relation = getPairRelation(starA, starB)

      if (!relation) continue
      if (!isEnabledPair(relation.pairId)) continue

      current = blendCore(current, getPairCorePersonality(relation.pairId), 0.12)

      supportPairs.push(buildMatchedPair(relation.pairId, starA, starB))
    }
  }

  return {
    core: normalizeCore(current),
    supportPairs
  }
}

/**
 * ======================================================
 * 摘要生成
 * ======================================================
 */
function buildSummaries(params: {
  pattern: BirthPattern
  corePersonality: CorePersonality
  traits: PersonalityTraits
  hitPairs: MatchedPairResult[]
  supportPairs: MatchedPairResult[]
}): string[] {
  const { pattern, corePersonality, traits, hitPairs, supportPairs } = params
  const raw: string[] = []

  if (pattern.isEmptyPrimary) {
    raw.push("命宫为空宫，主性格更容易受外部结构影响")
  } else {
    for (const starId of pattern.primaryStars.filter((id) => id !== "star_00")) {
      raw.push(`${getStarLabel(starId)}底色明显`)
    }
  }

  if (pattern.isEmptyPrimary && pattern.borrowedStars.length > 0) {
    raw.push(
      `命宫借对宫影响：${pattern.borrowedStars
        .filter((id) => id !== "star_00")
        .map((id) => getStarLabel(id))
        .join("、")}`
    )
  }

  for (const pair of hitPairs) {
    const profile = getPairProfile(pair.pairId) as PairProfileLike | null
    if (profile?.summaryText) {
      raw.push(profile.summaryText)
    } else {
      raw.push(`${pair.pairLabel}组合影响明显`)
    }
  }

  for (const pair of supportPairs) {
    const profile = getPairProfile(pair.pairId) as PairProfileLike | null
    if (profile?.summaryText) {
      raw.push(`联动结构：${profile.summaryText}`)
    } else {
      raw.push(`联动组合：${pair.pairLabel}`)
    }
  }

  for (const starId of pattern.supportStars.slice(0, 2)) {
    raw.push(`受${getStarLabel(starId)}联动修正`)
  }

  if (corePersonality.activity >= 0.72) raw.push("行动倾向很强")
  if (corePersonality.activity <= 0.32) raw.push("更偏静态与保守")
  if (corePersonality.curiosity >= 0.72) raw.push("探索欲与好奇心明显")
  if (corePersonality.dependency >= 0.7) raw.push("依赖倾向较高，重关系与回应")
  if (corePersonality.confidence >= 0.72) raw.push("自我强度高，主导欲明显")
  if (corePersonality.sensitivity >= 0.72) raw.push("情绪敏感度较高，感受力强")

  if (pattern.emptySectorCount >= 4) {
    raw.push("空宫数量较多，整体变动性更强")
  }

  raw.push(...buildTraitSummaries(traits))

  for (const starId of pattern.primaryStars.filter((id) => id !== "star_00")) {
    const profile = getStarProfile(starId) as StarProfileLike | null
    if (profile?.summaryTags?.length) {
      raw.push(...profile.summaryTags.slice(0, 2))
    }
  }

  return mergeUniqueSummaries(raw)
}

/**
 * ======================================================
 * 对外主函数
 * ======================================================
 */
export function mapPatternToProfile(
  pattern: BirthPattern
): PersonalityProfile {
  const primaryStars = pattern.primaryStars ?? []
  const supportStars = pattern.supportStars ?? []
  const borrowedStars = pattern.borrowedStars ?? []

  let corePersonality = DEFAULT_CORE_PERSONALITY
  let hitPairs: MatchedPairResult[] = []

  /**
   * ----------------------------------------------------
   * 1. 主人格来源
   * ----------------------------------------------------
   */
  if (pattern.isEmptyPrimary) {
    const borrowedResult = resolveBorrowedCore(borrowedStars)
    corePersonality = borrowedResult.core
    hitPairs = borrowedResult.hitPairs
  } else {
    const primaryResult = resolvePrimaryCore(primaryStars)
    corePersonality = primaryResult.core
    hitPairs = primaryResult.hitPairs
  }

  /**
   * ----------------------------------------------------
   * 2. 三方四正修正
   * ----------------------------------------------------
   */
  const supportResult = applySupportModifier(corePersonality, supportStars)
  corePersonality = supportResult.core

  /**
   * ----------------------------------------------------
   * 3. 空宫虚化滤镜
   * ----------------------------------------------------
   */
  if (pattern.isEmptyPrimary) {
    corePersonality = applyEmptyStateFilter(corePersonality)
  }

  /**
   * ----------------------------------------------------
   * 4. 空宫数量整体修正
   *
   * 当前简化策略：
   * - 空宫越多，变动性越强
   * - 稳定性（通过 confidence / sensitivity 间接体现）偏弱
   * ----------------------------------------------------
   */
  if (pattern.emptySectorCount >= 4) {
    corePersonality = normalizeCore({
      activity: corePersonality.activity,
      curiosity: corePersonality.curiosity + 0.04,
      dependency: corePersonality.dependency + 0.03,
      confidence: corePersonality.confidence - 0.04,
      sensitivity: corePersonality.sensitivity + 0.05
    })
  }

  /**
   * ----------------------------------------------------
   * 5. 行为层 traits
   * ----------------------------------------------------
   */
  const traits = mapCoreToBehaviorTraits(corePersonality)

  /**
   * ----------------------------------------------------
   * 6. summaries
   * ----------------------------------------------------
   */
  const summaries = buildSummaries({
    pattern,
    corePersonality,
    traits,
    hitPairs,
    supportPairs: supportResult.supportPairs
  })

  /**
   * ----------------------------------------------------
   * 7. debug 输出
   * ----------------------------------------------------
   */
  console.log("🧠 Mapper 完整运行", {
    birthKey: pattern.birthKey,
    lunarInfo: pattern.lunarInfo,
    primarySector: pattern.primarySector,
    primaryStars,
    supportSectors: pattern.supportSectors,
    supportStars,
    oppositeSector: pattern.oppositeSector,
    borrowedStars,
    isEmptyPrimary: pattern.isEmptyPrimary,
    emptySectorCount: pattern.emptySectorCount,
    hitPairs,
    supportPairs: supportResult.supportPairs,
    corePersonality,
    traits,
    summaries
  })

  /**
   * ----------------------------------------------------
   * 8. 返回最终人格档案
   * ----------------------------------------------------
   */
  return {
    pattern,
    corePersonality,
    traits,
    summaries,
    tags: [],
    debug: {
      primarySector: pattern.primarySector,
      primaryStars,
      supportSectors: pattern.supportSectors,
      supportStars,
      borrowedStars,
      isEmptyPrimary: pattern.isEmptyPrimary,
      hitPairs,
      supportPairs: supportResult.supportPairs
    }
  }
}