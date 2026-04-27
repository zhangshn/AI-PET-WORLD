/**
 * 当前文件负责：把紫微人格结构与八字动力底盘映射为统一人格向量。
 */

import type { BaziProfile } from "../bazi-core/bazi-types"
import type { PersonalityProfile } from "../ziwei-core/schema"
import type {
  FinalPersonalityBias,
  FinalPersonalityVector,
  PersonalitySourceMode,
} from "./vector-types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function avg(values: number[]): number {
  if (values.length === 0) return 50
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function weighted(
  baseValue: number,
  modifierValue: number,
  baseWeight = 0.65,
  modifierWeight = 0.35
): number {
  return clamp(baseValue * baseWeight + modifierValue * modifierWeight)
}

export function resolvePersonalitySourceMode(input: {
  ziweiProfile?: PersonalityProfile | null
  baziProfile?: BaziProfile | null
}): PersonalitySourceMode {
  if (input.ziweiProfile && input.baziProfile) return "ziwei_bazi_combined"
  if (input.ziweiProfile) return "ziwei_only"
  return "bazi_only"
}

export function mapZiweiToBaseVector(
  ziweiProfile: PersonalityProfile
): FinalPersonalityVector {
  const traits = ziweiProfile.traits

  return {
    curiosity: clamp(traits.curiosity ?? 50),
    activity: clamp(traits.activity ?? 50),
    stability: clamp(traits.stability ?? 50),
    sensitivity: clamp(traits.emotionalSensitivity ?? traits.sensitivity ?? 50),
    discipline: clamp(traits.discipline ?? 50),
    attachment: clamp(traits.social ?? traits.attachment ?? traits.stability ?? 50),
    control: clamp(avg([
      traits.discipline ?? 50,
      traits.stability ?? 50,
    ])),
    explorationDrive: clamp(avg([
      traits.curiosity ?? 50,
      traits.activity ?? 50,
    ])),
    reactionSpeed: clamp(traits.activity ?? 50),
    persistence: clamp(avg([
      traits.discipline ?? 50,
      traits.stability ?? 50,
    ])),
    adaptability: clamp(avg([
      traits.curiosity ?? 50,
      100 - (traits.discipline ?? 50),
    ])),
    sensoryDepth: clamp(traits.emotionalSensitivity ?? traits.sensitivity ?? 50),
    restPreference: clamp(traits.restPreference ?? 50),
  }
}

export function mapBaziToBaseVector(
  baziProfile: BaziProfile
): FinalPersonalityVector {
  const dynamics = baziProfile.dynamics

  return {
    curiosity: clamp(dynamics.explorationDrive),
    activity: clamp(dynamics.actionIntensity),
    stability: clamp(dynamics.stability),
    sensitivity: clamp(dynamics.sensoryDepth),
    discipline: clamp(dynamics.consistency),
    attachment: clamp(avg([
      dynamics.stability,
      dynamics.sensoryDepth,
    ])),
    control: clamp(dynamics.consistency),
    explorationDrive: clamp(dynamics.explorationDrive),
    reactionSpeed: clamp(dynamics.reactionSpeed),
    persistence: clamp(dynamics.persistence),
    adaptability: clamp(dynamics.adaptability),
    sensoryDepth: clamp(dynamics.sensoryDepth),
    restPreference: clamp(100 - dynamics.actionIntensity * 0.45 + dynamics.stability * 0.25),
  }
}

export function mergeZiweiAndBaziVectors(input: {
  ziweiVector: FinalPersonalityVector
  baziVector: FinalPersonalityVector
}): FinalPersonalityVector {
  const z = input.ziweiVector
  const b = input.baziVector

  return {
    curiosity: weighted(z.curiosity, b.curiosity),
    activity: weighted(z.activity, b.activity),
    stability: weighted(z.stability, b.stability),
    sensitivity: weighted(z.sensitivity, b.sensitivity),
    discipline: weighted(z.discipline, b.discipline),
    attachment: weighted(z.attachment, b.attachment),
    control: weighted(z.control, b.control),
    explorationDrive: weighted(z.explorationDrive, b.explorationDrive, 0.45, 0.55),
    reactionSpeed: weighted(z.reactionSpeed, b.reactionSpeed, 0.35, 0.65),
    persistence: weighted(z.persistence, b.persistence, 0.45, 0.55),
    adaptability: weighted(z.adaptability, b.adaptability, 0.45, 0.55),
    sensoryDepth: weighted(z.sensoryDepth, b.sensoryDepth, 0.45, 0.55),
    restPreference: weighted(z.restPreference, b.restPreference),
  }
}

export function buildFinalPersonalityBias(
  vector: FinalPersonalityVector
): FinalPersonalityBias {
  return {
    petBehaviorBias: {
      newbornActivity: clamp(vector.activity * 0.45 + vector.reactionSpeed * 0.25),
      observationNeed: clamp(vector.sensoryDepth * 0.7 + vector.sensitivity * 0.25),
      attachmentNeed: clamp(vector.attachment * 0.75 + vector.stability * 0.15),
      explorationRange: clamp(vector.explorationDrive * 0.75 + vector.curiosity * 0.2),
      restNeed: clamp(vector.restPreference * 0.65 + vector.stability * 0.2),
    },
    butlerBehaviorBias: {
      carePriority: clamp(vector.attachment * 0.45 + vector.sensitivity * 0.3 + vector.stability * 0.15),
      constructionDrive: clamp(vector.persistence * 0.35 + vector.discipline * 0.3 + vector.activity * 0.2),
      routinePreference: clamp(vector.discipline * 0.55 + vector.stability * 0.3),
      riskTolerance: clamp(vector.activity * 0.35 + vector.explorationDrive * 0.3 + (100 - vector.stability) * 0.2),
      responseSpeed: clamp(vector.reactionSpeed * 0.75 + vector.activity * 0.2),
    },
    buildingBias: {
      expansionPreference: clamp(vector.explorationDrive * 0.55 + vector.activity * 0.25),
      stabilityPreference: clamp(vector.stability * 0.55 + vector.persistence * 0.25),
      comfortPreference: clamp(vector.restPreference * 0.45 + vector.attachment * 0.25 + vector.sensitivity * 0.15),
      orderPreference: clamp(vector.discipline * 0.55 + vector.control * 0.25),
      adaptabilityPreference: clamp(vector.adaptability * 0.65 + vector.curiosity * 0.2),
    },
  }
}

export function buildFinalPersonalityLabels(
  vector: FinalPersonalityVector
): string[] {
  const labels: string[] = []

  if (vector.curiosity >= 68) labels.push("高好奇")
  if (vector.activity >= 68) labels.push("高行动")
  if (vector.stability >= 68) labels.push("稳定倾向")
  if (vector.sensitivity >= 68) labels.push("高感知")
  if (vector.discipline >= 68) labels.push("秩序倾向")
  if (vector.attachment >= 68) labels.push("关系依附")
  if (vector.explorationDrive >= 68) labels.push("探索驱动")
  if (vector.reactionSpeed >= 68) labels.push("反应快速")
  if (vector.persistence >= 68) labels.push("持续推进")
  if (vector.adaptability >= 68) labels.push("适应变化")

  if (labels.length === 0) {
    labels.push("均衡人格")
  }

  return labels
}

export function buildFinalPersonalitySummary(input: {
  mode: PersonalitySourceMode
  labels: string[]
  vector: FinalPersonalityVector
}): string {
  const modeText: Record<PersonalitySourceMode, string> = {
    bazi_only: "当前基于八字动力底盘生成统一人格向量。",
    ziwei_only: "当前基于紫微人格结构生成统一人格向量。",
    ziwei_bazi_combined: "当前基于紫微人格结构与八字动力底盘共同生成统一人格向量。",
  }

  const strongest = Object.entries(input.vector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key)
    .join("、")

  return `${modeText[input.mode]} 主要人格标签：${input.labels.join("、")}。当前最强向量维度：${strongest}。`
}