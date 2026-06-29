export type ZiweiStarCategory =
  | "empty"
  | "main"
  | "assistant"
  | "malefic"
  | "transformation"
  | "misc"
  | "lifecycle"
  | "yearly"
  | "monthly"
  | "dailyHourly"

export type ZiweiStarId = string

export type LegacyZiweiStarId =
  | "star_00"
  | "star_01"
  | "star_02"
  | "star_03"
  | "star_04"
  | "star_05"
  | "star_06"
  | "star_07"
  | "star_08"
  | "star_09"
  | "star_10"
  | "star_11"
  | "star_12"
  | "star_13"
  | "star_14"

export interface ZiweiStarDefinition {
  starId: ZiweiStarId
  label: string
  category: ZiweiStarCategory
  enabled: boolean
  displayOrder: number
  legacyStarId?: LegacyZiweiStarId
  aliases?: string[]
}

export interface ZiweiStarDisplayGroup {
  category: ZiweiStarCategory
  label: string
  displayOrder: number
}
