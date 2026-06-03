/**
 * 当前文件职责：定义 runtime 管家人格映射输入、输出、审计与报告协议。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

export type ButlerRuntimeProfileBirthInput = {
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

export type ButlerRuntimeProfile = {
  playerId: string
  ownerId: string
  worldId: string
  butlerId: string
  displayName: string
  constructionStyle: ButlerConstructionStyleVector
  lifeRhythmBias: "morning" | "day" | "evening" | "night" | "balanced"
  worldCareBias: "observe_first" | "prepare_carefully"
  explanationTone: "calm" | "warm" | "structured" | "protective"
  visualTendency: "ordered" | "warmNatural" | "protective" | "quiet"
  tags: string[]
}

export type ButlerRuntimeProfileBuildResult = {
  input: ButlerRuntimeProfileBirthInput
  profile: ButlerRuntimeProfile
  messages: string[]
  tags: string[]
}
