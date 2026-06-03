/**
 * 当前文件负责：定义 AI 认知层核心类型、世界刺激解释结果，以及 AI 主观理解结构。
 */

export type WorldStimulusType =
  | "entity_motion"
  | "tree_presence"
  | "flower_scent"
  | "water_sound"
  | "butterfly"
  | "shadow_motion"
  | "quiet_zone"
  | "breeze"
  | "temperature_drop"
  | "warm_zone"
  | "falling_leaf"
  | "distant_sound"
  | "light_shift"
  | "sound"
  | "smell"
  | "movement"
  | "object"
  | "weather"
  | "social"
  | "world"

export type WorldStimulusCategory =
  | "environment"
  | "social"
  | "resource"
  | "safety"
  | "curiosity"
  | "comfort"

export type WorldStimulusIntensity = "low" | "medium" | "high"

export type WorldStimulus = {
  id: string
  type: WorldStimulusType
  category: WorldStimulusCategory
  label: string
  description: string
  intensity: WorldStimulusIntensity
  worldPosition: {
    x: number
    y: number
  }
  spatialRadius: number
  createdAtTick: number
  expiresAtTick?: number
  tags: string[]
}

export type StimulusInterpretation =
  | "safe"
  | "dangerous"
  | "interesting"
  | "comforting"
  | "annoying"
  | "mysterious"
  | "exciting"
  | "peaceful"
  | "ignore"

export type StimulusReactionTendency =
  | "approach"
  | "avoid"
  | "observe"
  | "ignore"
  | "chase"
  | "rest_nearby"

export type CognitionResult = {
  stimulusId: string
  stimulusType: WorldStimulus["type"]
  interpretation: StimulusInterpretation
  reactionTendency: StimulusReactionTendency
  curiosityLevel: number
  stressLevel: number
  safetyFeeling: number
  emotionalShift: number
  summary: string

  /**
   * 宠物与刺激之间的空间距离。
   * 当前用于认知修正，后续可用于注意力、记忆、路径偏好。
   */
  distanceToStimulus?: number
}

export type BuildCognitionInput = {
  stimulus: WorldStimulus

  personalityTraits: Record<string, number>

  consciousness: {
    caution: number
    curiosity: number
    sociability: number
    emotionalSensitivity: number
    environmentalAwareness: number
  }

  currentState: {
    energy: number
    hunger: number
    emotionalStability: number
  }

  /**
   * 宠物当前在像素世界中的位置。
   * 当前可选，未接入前认知仍可正常运行。
   */
  petWorldPosition?: {
    x: number
    y: number
  }
}
