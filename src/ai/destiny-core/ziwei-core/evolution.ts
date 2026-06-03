/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Evolution
 *
 * 鍔熻兘锛?
 * 1. 灏嗗熀纭€浜烘牸缁撴灉涓庢棭鏈熸垚闀块樁娈电殑鎴愰暱淇℃伅杩涜铻嶅悎
 * 2. 杈撳嚭鏈€缁堜汉鏍兼。妗?
 *
 * 璁捐鐩爣锛? * - 璁╀汉鏍间笉鏄敱瀹犵墿杩涘満鐬棿鍑┖鐢熸垚
 * - 鑰屾槸鐢辩ǔ瀹氳緭鍏ャ€佹棭鏈熸垚闀胯繃绋嬩笌鐢ㄦ埛鎺堟潈淇℃伅鍏卞悓褰㈡垚
 *
 * 璇存槑锛?
 * - 杩欎竴灞備笉璐熻矗鍑虹敓杈撳叆璁＄畻
 * - 涓嶈礋璐ｅ熀纭€缁撴瀯鐢熸垚
 * - 鍙礋璐ｂ€滃浣曟妸鎴愰暱褰卞搷铻嶅悎杩涙渶缁堜汉鏍尖€?
 * ======================================================
 */

import type {
  CorePersonality,
  PersonalityProfile,
  PersonalityTraits
} from "./ziwei-core-schema"

/**
 * 鏃╂湡鎴愰暱闃舵鎴愰暱鍗拌
 *
 * 瀛楁璇存槑锛?
 * - calmGrowth锛?
 *   鏃╂湡鎴愰暱闃舵鏁翠綋鏄惁鏇村钩绋炽€佸畨闈?
 *
 * - activeGrowth锛?
 *   鏃╂湡鎴愰暱闃舵鏄惁鏇村亸娲昏穬鍙戝睍
 *
 * - stableGrowth锛?
 *   鏃╂湡鎴愰暱闃舵鏁翠綋鏄惁鏇寸ǔ瀹?
 *
 * - sensitiveGrowth锛?
 *   鏃╂湡鎴愰暱闃舵鏄惁鏇村鏄撲骇鐢熸尝鍔?
 */
export type AdoptionImprint = {
  calmGrowth: number
  activeGrowth: number
  stableGrowth: number
  sensitiveGrowth: number
}

/**
 * ======================================================
 * 闄愬埗鍗曚釜鏁板€艰寖鍥?
 * ======================================================
 */
function clampValue(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value)
}

/**
 * ======================================================
 * 闄愬埗 traits 鑼冨洿
 * ======================================================
 */
function clampTraits(traits: PersonalityTraits): PersonalityTraits {
  return {
    activity: clampValue(traits.activity),
    restPreference: clampValue(traits.restPreference),
    appetite: clampValue(traits.appetite),
    discipline: clampValue(traits.discipline),
    curiosity: clampValue(traits.curiosity),
    emotionalSensitivity: clampValue(traits.emotionalSensitivity),
    stability: clampValue(traits.stability),
    caregiving: clampValue(traits.caregiving),
    buildingPreference: clampValue(traits.buildingPreference)
  }
}

/**
 * ======================================================
 * 鍚堝苟涓ょ粍鎽樿
 *
 * 璇存槑锛?
 * - 鍘婚噸
 * - 淇濈暀椤哄簭
 * ======================================================
 */
function mergeSummaries(base: string[], extra: string[]): string[] {
  const set = new Set<string>()
  const merged: string[] = []

  for (const item of [...base, ...extra]) {
    if (!set.has(item)) {
      set.add(item)
      merged.push(item)
    }
  }

  return merged
}

function mergeTags(base: string[], extra: string[]): string[] {
  const set = new Set<string>()
  const merged: string[] = []

  for (const item of [...base, ...extra]) {
    if (!set.has(item)) {
      set.add(item)
      merged.push(item)
    }
  }

  return merged
}

function clampCoreValue(value: number): number {
  if (value < -1) return -1
  if (value > 1) return 1
  return Math.round(value * 1000) / 1000
}

function mergeCorePersonality(
  seedCore: CorePersonality,
  birthCore: CorePersonality,
  imprint: AdoptionImprint
): CorePersonality {
  return {
    activity: clampCoreValue(
      birthCore.activity * 0.65 +
      seedCore.activity * 0.25 +
      ((imprint.activeGrowth - 50) / 100) * 0.1
    ),
    curiosity: clampCoreValue(
      birthCore.curiosity * 0.7 +
      seedCore.curiosity * 0.3
    ),
    dependency: clampCoreValue(
      birthCore.dependency * 0.7 +
      seedCore.dependency * 0.3
    ),
    confidence: clampCoreValue(
      birthCore.confidence * 0.7 +
      seedCore.confidence * 0.3
    ),
    sensitivity: clampCoreValue(
      birthCore.sensitivity * 0.65 +
      seedCore.sensitivity * 0.25 +
      ((imprint.sensitiveGrowth - 50) / 100) * 0.1
    )
  }
}

/**
 * ======================================================
 * 鏍规嵁鎴愰暱鍗拌鏋勯€犺ˉ鍏呮憳瑕?
 * ======================================================
 */
function buildEvolutionSummaries(
  imprint: AdoptionImprint
): string[] {
  const summaries: string[] = []

  if (imprint.calmGrowth >= 60) {
    summaries.push("鏃╂湡鎴愰暱闃舵琛ㄧ幇鍑哄畨闈欑ǔ瀹氱殑鍊惧悜")
  }

  if (imprint.activeGrowth >= 60) {
    summaries.push("鏃╂湡鎴愰暱闃舵绉疮浜嗚緝寮虹殑琛屽姩鍊惧悜")
  }

  if (imprint.stableGrowth >= 60) {
    summaries.push("早期成长过程整体较稳定。")
  }

  if (imprint.sensitiveGrowth >= 60) {
    summaries.push("鏃╂湡鎴愰暱闃舵瀵圭幆澧冨彉鍖栬緝鏁忔劅")
  }

  return summaries
}

/**
 * ======================================================
 * 铻嶅悎浜烘牸
 *
 * 杈撳叆锛?
 * - seedProfile锛?
 *   鐢熷懡绉嶅瓙闃舵鐨勪汉鏍肩瀛?
 *
 * - birthProfile锛?
 *   鏍规嵁鍑虹敓鏃跺埢鐢熸垚鐨勫熀纭€浜烘牸
 *
 * - imprint锛?
 *   鏃╂湡鎴愰暱杩囩▼褰㈡垚鐨勬垚闀垮嵃璁?
 *
 * 杈撳嚭锛?
 * - 鏈€缁堜汉鏍兼。妗?
 *
 * 瑙勫垯璇存槑锛?
 * - 浠ュ嚭鐢熸椂鍒荤殑浜烘牸涓轰富
 * - 淇濈暀閮ㄥ垎鐢熷懡绉嶅瓙鍊惧悜
 * - 鍐嶅彔鍔犳棭鏈熸垚闀块樁娈垫垚闀垮嵃璁?
 * ======================================================
 */
export function evolveProfile(
  seedProfile: PersonalityProfile,
  birthProfile: PersonalityProfile,
  imprint: AdoptionImprint
): PersonalityProfile {
  const seedTraits = seedProfile.traits
  const birthTraits = birthProfile.traits

  /**
   * 铻嶅悎鏉冮噸璇存槑锛?
   * - 鍑虹敓鏃跺埢浜烘牸锛氫富瀵煎眰
   * - 鐢熷懡绉嶅瓙浜烘牸锛氫繚鐣欏眰
   * - 鏃╂湡鎴愰暱鍗拌锛氬井璋冨眰
   */
  const mergedTraits: PersonalityTraits = {
    activity:
      birthTraits.activity * 0.6 +
      seedTraits.activity * 0.25 +
      imprint.activeGrowth * 0.15,

    restPreference:
      birthTraits.restPreference * 0.6 +
      seedTraits.restPreference * 0.25 +
      imprint.calmGrowth * 0.15,

    appetite:
      birthTraits.appetite * 0.7 +
      seedTraits.appetite * 0.3,

    discipline:
      birthTraits.discipline * 0.65 +
      seedTraits.discipline * 0.2 +
      imprint.stableGrowth * 0.15,

    curiosity:
      birthTraits.curiosity * 0.75 +
      seedTraits.curiosity * 0.25,

    emotionalSensitivity:
      birthTraits.emotionalSensitivity * 0.6 +
      seedTraits.emotionalSensitivity * 0.2 +
      imprint.sensitiveGrowth * 0.2,

    stability:
      birthTraits.stability * 0.6 +
      seedTraits.stability * 0.2 +
      imprint.stableGrowth * 0.2,

    caregiving:
      birthTraits.caregiving * 0.7 +
      seedTraits.caregiving * 0.3,

    buildingPreference:
      birthTraits.buildingPreference * 0.7 +
      seedTraits.buildingPreference * 0.3
  }

  const normalizedTraits = clampTraits(mergedTraits)

  const evolutionSummaries = buildEvolutionSummaries(imprint)
  const mergedCorePersonality = mergeCorePersonality(
    seedProfile.corePersonality,
    birthProfile.corePersonality,
    imprint
  )
  const mergedTags = mergeTags(seedProfile.tags, birthProfile.tags)

  return {
    /**
     * 褰撳墠 runtime 鏂规锛?
     * pattern 鍏堜繚鐣欌€滃嚭鐢熸椂鍒荤粨鏋勨€濅綔涓烘渶缁堢粨鏋?
     */
    pattern: birthProfile.pattern,

    /**
     * 鎽樿 = 鍑虹敓鏃跺埢鎽樿 + 鐢熷懡绉嶅瓙鎽樿 + 鏃╂湡鎴愰暱鎽樿
     */
    summaries: mergeSummaries(
      birthProfile.summaries,
      [...seedProfile.summaries, ...evolutionSummaries]
    ),

    /**
     * traits 浣跨敤铻嶅悎鍚庣殑鏈€缁堢粨鏋?
     */
    traits: normalizedTraits,
    corePersonality: mergedCorePersonality,
    tags: mergedTags
  }
}
