/**
 * ======================================================
 * AI-PET-WORLD
 * Cognition Type
 * ======================================================
 *
 * 当前文件负责：
 * 1. 定义宠物当前认知结果类型
 * 2. 作为世界层 / 宠物层的正式认知状态结构
 * ======================================================
 */

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

export type PetCognitionRecord = {
  stimulusId: string
  stimulusType: string
  interpretation: StimulusInterpretation
  reactionTendency: StimulusReactionTendency
  curiosityLevel: number
  stressLevel: number
  safetyFeeling: number
  emotionalShift: number
  summary: string
  tick: number
  day: number
  hour: number
}