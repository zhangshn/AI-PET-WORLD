/**
 * 当前文件负责：定义世界进度与世界设施系统类型。
 */

export type WorldFacilityId =
  | "home_base"
  | "community_board"
  | "pet_park"
  | "pet_clinic"
  | "small_town"

export type WorldFacilityStatus =
  | "locked"
  | "planning"
  | "building"
  | "active"

export type WorldFacilityNoticeType =
  | "facility_planned"
  | "facility_completed"

export type WorldFacilityDefinition = {
  id: WorldFacilityId
  title: string
  description: string
  plannedMessage: string
  completedMessage: string
  order: number
}

export type WorldFacilityProgressState = {
  id: WorldFacilityId
  status: WorldFacilityStatus
  progress: number
  startedAtDay: number | null
  activatedAtDay: number | null
  lastProgressDay: number | null
}

export type WorldProgressionState = {
  facilities: Record<WorldFacilityId, WorldFacilityProgressState>
  lastUpdatedTick: number
}

export type WorldProgressionNotice = {
  id: string
  facilityId: WorldFacilityId
  type: WorldFacilityNoticeType
  message: string
  tick: number
  day: number
  hour: number
}