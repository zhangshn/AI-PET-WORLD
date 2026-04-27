/**
 * 当前文件负责：定义 AI 认知层核心类型、世界刺激解释结果，以及 AI 主观理解结构。
 */

import type { WorldStimulus } from "../world-stimulus-system/stimulus-types"

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