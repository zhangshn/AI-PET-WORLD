/**
 * 当前文件职责：定义 MVP 管家人格映射输入、输出、审计与报告协议。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

export type ButlerMvpBirthInput = {
  playerId: string
  ownerId: string
  worldId: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  timezone: string
  seed: string
  tags: string[]
}

export type ButlerMvpProfile = {
  playerId: string
  ownerId: string
  worldId: string
  butlerId: string
  displayName: string
  constructionStyle: ButlerConstructionStyleVector
  lifeRhythmBias: "morning" | "day" | "evening" | "night" | "balanced"
  adoptionIntentBias: "wait" | "consider"
  explanationTone: "calm" | "warm" | "structured" | "protective"
  visualTendency: "ordered" | "warmNatural" | "protective" | "quiet"
  tags: string[]
}

export type ButlerMvpBuildResult = {
  input: ButlerMvpBirthInput
  profile: ButlerMvpProfile
  messages: string[]
  tags: string[]
}
