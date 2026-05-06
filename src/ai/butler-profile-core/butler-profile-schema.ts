/**
 * 当前文件负责：定义管家人格核心类型。
 */

export type ButlerMappingMode =
  | "self_projection"
  | "parallel_self"

export type ButlerBirthTimeMode =
  | "date_only"
  | "full_datetime"

export type ButlerProfileBirthInput = {
  year: number
  month: number
  day: number

  /**
   * 用户可能不知道出生时辰。
   * 不知道时辰时，hour / minute 不传，系统走 date_only 模式。
   */
  hour?: number
  minute?: number
}

export type ButlerProfileInput = {
  birth: ButlerProfileBirthInput
  mappingMode: ButlerMappingMode
  displayName?: string
}

export type ButlerProfileIdentity = {
  displayName: string
  mappingMode: ButlerMappingMode
  birthTimeMode: ButlerBirthTimeMode
  identitySummary: string
}

export type ButlerCareStyle =
  | "gentle_observer"
  | "active_supporter"
  | "protective_guardian"
  | "quiet_maintainer"
  | "structured_manager"

export type ButlerBuildStyle =
  | "steady_builder"
  | "adaptive_builder"
  | "protective_builder"
  | "aesthetic_builder"
  | "minimal_builder"

export type ButlerBoundaryStyle =
  | "soft_boundary"
  | "balanced_boundary"
  | "clear_boundary"
  | "watchful_boundary"

export type ButlerOpportunityStyle =
  | "offer_gently"
  | "offer_actively"
  | "offer_when_needed"
  | "offer_after_observation"

export type ButlerProfileBias = {
  /**
   * 0 - 100。
   * 越高越优先照护、观察、稳定关系。
   */
  carePriority: number

  /**
   * 0 - 100。
   * 越高越倾向主动建设家园。
   */
  constructionDrive: number

  /**
   * 0 - 100。
   * 越高越会先观察，再提供机会。
   */
  observationPatience: number

  /**
   * 0 - 100。
   * 越高越重视边界、安全和稳定。
   */
  boundarySensitivity: number

  /**
   * 0 - 100。
   * 越高越愿意提供食物 / 休息 / 靠近机会。
   */
  opportunityInitiative: number
}

export type ButlerProfile = {
  identity: ButlerProfileIdentity
  birth: ButlerProfileBirthInput
  careStyle: ButlerCareStyle
  buildStyle: ButlerBuildStyle
  boundaryStyle: ButlerBoundaryStyle
  opportunityStyle: ButlerOpportunityStyle
  bias: ButlerProfileBias
  publicSummary: string
  internalNotes: string[]
}