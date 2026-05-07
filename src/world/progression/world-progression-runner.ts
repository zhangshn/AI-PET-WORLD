/**
 * 当前文件负责：推进世界设施建设与世界进度事件。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { HomeState } from "@/types/home"
import type { PetState } from "@/types/pet"

import {
  WORLD_FACILITY_DEFINITIONS,
  getWorldFacilityDefinition,
} from "./world-facility-registry"

import type {
  WorldFacilityId,
  WorldFacilityProgressState,
  WorldProgressionNotice,
  WorldProgressionState,
} from "./world-progression-types"

export type RunWorldProgressionInput = {
  state: WorldProgressionState
  tick: number
  time: TimeState
  home: HomeState
  pet: PetState | null
}

export type RunWorldProgressionResult = {
  state: WorldProgressionState
  notices: WorldProgressionNotice[]
}

const DAILY_PROGRESS_AMOUNT: Record<WorldFacilityId, number> = {
  home_base: 100,
  community_board: 50,
  pet_park: 34,
  pet_clinic: 28,
  small_town: 20,
}

function cloneFacilityState(
  facility: WorldFacilityProgressState
): WorldFacilityProgressState {
  return {
    ...facility,
  }
}

function cloneProgressionState(
  state: WorldProgressionState
): WorldProgressionState {
  return {
    ...state,
    facilities: {
      home_base: cloneFacilityState(state.facilities.home_base),
      community_board: cloneFacilityState(state.facilities.community_board),
      pet_park: cloneFacilityState(state.facilities.pet_park),
      pet_clinic: cloneFacilityState(state.facilities.pet_clinic),
      small_town: cloneFacilityState(state.facilities.small_town),
    },
  }
}

function isFacilityActive(
  state: WorldProgressionState,
  facilityId: WorldFacilityId
): boolean {
  return state.facilities[facilityId].status === "active"
}

function shouldAdvanceDaily(input: RunWorldProgressionInput): boolean {
  return input.time.hour === 8
}

function canUnlockFacility(input: {
  facilityId: WorldFacilityId
  state: WorldProgressionState
  home: HomeState
  pet: PetState | null
  time: TimeState
}): boolean {
  if (input.facilityId === "home_base") {
    return true
  }

  if (input.facilityId === "community_board") {
    return isFacilityActive(input.state, "home_base")
  }

  if (input.facilityId === "pet_park") {
    return (
      isFacilityActive(input.state, "community_board") &&
      input.pet !== null
    )
  }

  if (input.facilityId === "pet_clinic") {
    return (
      isFacilityActive(input.state, "community_board") &&
      input.pet !== null &&
      input.time.day >= 3
    )
  }

  if (input.facilityId === "small_town") {
    return (
      isFacilityActive(input.state, "community_board") &&
      isFacilityActive(input.state, "pet_park") &&
      input.time.day >= 5
    )
  }

  return false
}

function buildNotice(input: {
  tick: number
  day: number
  hour: number
  facilityId: WorldFacilityId
  type: WorldProgressionNotice["type"]
  message: string
}): WorldProgressionNotice {
  return {
    id: `world-progression-${input.facilityId}-${input.type}-day-${input.day}`,
    facilityId: input.facilityId,
    type: input.type,
    message: input.message,
    tick: input.tick,
    day: input.day,
    hour: input.hour,
  }
}

function activateFacility(input: {
  state: WorldProgressionState
  facilityId: WorldFacilityId
  tick: number
  time: TimeState
  notices: WorldProgressionNotice[]
}): void {
  const facility = input.state.facilities[input.facilityId]
  const definition = getWorldFacilityDefinition(input.facilityId)

  if (facility.status === "active") return

  facility.status = "active"
  facility.progress = 100
  facility.activatedAtDay = input.time.day
  facility.lastProgressDay = input.time.day

  input.notices.push(
    buildNotice({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      facilityId: input.facilityId,
      type: "facility_completed",
      message: definition.completedMessage,
    })
  )
}

function startFacility(input: {
  state: WorldProgressionState
  facilityId: WorldFacilityId
  tick: number
  time: TimeState
  notices: WorldProgressionNotice[]
}): void {
  const facility = input.state.facilities[input.facilityId]
  const definition = getWorldFacilityDefinition(input.facilityId)

  if (facility.status !== "locked") return

  facility.status = "building"
  facility.progress = 0
  facility.startedAtDay = input.time.day
  facility.lastProgressDay = null

  input.notices.push(
    buildNotice({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      facilityId: input.facilityId,
      type: "facility_planned",
      message: definition.plannedMessage,
    })
  )
}

function advanceFacilityProgress(input: {
  state: WorldProgressionState
  facilityId: WorldFacilityId
  tick: number
  time: TimeState
  notices: WorldProgressionNotice[]
}): void {
  const facility = input.state.facilities[input.facilityId]

  if (facility.status !== "building") return
  if (facility.lastProgressDay === input.time.day) return

  facility.lastProgressDay = input.time.day
  facility.progress = Math.min(
    100,
    facility.progress + DAILY_PROGRESS_AMOUNT[input.facilityId]
  )

  if (facility.progress >= 100) {
    activateFacility(input)
  }
}

function syncHomeBase(input: {
  state: WorldProgressionState
  home: HomeState
  tick: number
  time: TimeState
  notices: WorldProgressionNotice[]
}): void {
  const homeBase = input.state.facilities.home_base

  if (homeBase.status === "active") return

  homeBase.status = "building"
  homeBase.progress = Math.max(homeBase.progress, Math.round(input.home.progress))

  if (input.home.status === "completed" || input.home.progress >= 100) {
    activateFacility({
      state: input.state,
      facilityId: "home_base",
      tick: input.tick,
      time: input.time,
      notices: input.notices,
    })
  }
}

export function runWorldProgression(
  input: RunWorldProgressionInput
): RunWorldProgressionResult {
  const nextState = cloneProgressionState(input.state)
  const notices: WorldProgressionNotice[] = []

  syncHomeBase({
    state: nextState,
    home: input.home,
    tick: input.tick,
    time: input.time,
    notices,
  })

  if (shouldAdvanceDaily(input)) {
    WORLD_FACILITY_DEFINITIONS.forEach((definition) => {
      if (definition.id === "home_base") return

      const facility = nextState.facilities[definition.id]

      if (facility.status === "active") return

      if (
        canUnlockFacility({
          facilityId: definition.id,
          state: nextState,
          home: input.home,
          pet: input.pet,
          time: input.time,
        })
      ) {
        startFacility({
          state: nextState,
          facilityId: definition.id,
          tick: input.tick,
          time: input.time,
          notices,
        })

        advanceFacilityProgress({
          state: nextState,
          facilityId: definition.id,
          tick: input.tick,
          time: input.time,
          notices,
        })
      }
    })
  }

  nextState.lastUpdatedTick = input.tick

  return {
    state: nextState,
    notices,
  }
}