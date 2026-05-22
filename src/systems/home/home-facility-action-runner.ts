/**
 * 褰撳墠鏂囦欢璐熻矗锛氭牴鎹瀹惰涓烘墽琛屽揩鐓э紝瀹夊叏鎺ㄨ繘瀹跺洯璁炬柦銆? */

import type {
  ButlerBehaviorExecution,
} from "@/systems/butler/butler-gateway"

import type {
  HomeFacilityState,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { syncHomeFacilities } from "./home-facility-runner"
import { syncHomeSpaces } from "./home-space-runner"
import { buildHomeSpaceSummary } from "./home-space-summary-runner"

export type ApplyButlerHomeFacilityActionInput = {
  home: HomeState
  execution: ButlerBehaviorExecution | null | undefined
}

function getActionPower(execution: ButlerBehaviorExecution): number {
  return Math.max(0.2, Math.min(1.4, execution.intensity / 60))
}

function updateFacilityById(
  facilities: HomeFacilityState[],
  id: HomeFacilityState["id"],
  updater: (facility: HomeFacilityState) => HomeFacilityState
): HomeFacilityState[] {
  return facilities.map((facility) => {
    if (facility.id !== id) return facility

    return updater(facility)
  })
}

function findWeakestActiveFacility(
  facilities: HomeFacilityState[]
): HomeFacilityState | null {
  const candidates = facilities.filter(
    (facility) =>
      facility.status === "active" ||
      facility.status === "needs_maintenance"
  )

  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => {
    const aScore = a.durability + a.usefulness
    const bScore = b.durability + b.usefulness

    return aScore - bScore
  })[0] ?? null
}

function buildDerivedHome(home: HomeState): HomeState {
  const homeWithSpaces: HomeState = {
    ...home,
    homeSpaces: syncHomeSpaces(home),
  }

  const homeWithFacilities: HomeState = {
    ...homeWithSpaces,
    homeFacilities: syncHomeFacilities(homeWithSpaces),
  }

  return {
    ...homeWithFacilities,
    spaceSummary: buildHomeSpaceSummary(homeWithFacilities),
  }
}

export function applyButlerHomeFacilityAction(
  input: ApplyButlerHomeFacilityActionInput
): HomeState {
  const execution = input.execution

  if (!execution) {
    return buildDerivedHome(input.home)
  }

  let facilities = syncHomeFacilities(input.home)
  const power = getActionPower(execution)

  if (execution.kind === "home_maintenance") {
    facilities = updateFacilityById(facilities, "basic_care_station", (facility) => ({
      ...facility,
      durability: clamp(facility.durability + 0.8 * power),
      usefulness: clamp(facility.usefulness + 0.4 * power),
      tags: Array.from(new Set([...facility.tags, "butler_home_maintenance"])),
    }))
  }

  if (execution.kind === "home_building" && execution.canAffectHome) {
    facilities = updateFacilityById(facilities, "shelter_bed", (facility) => ({
      ...facility,
      status: facility.status === "locked" ? "planned" : facility.status,
      progress: clamp(facility.progress + 2.2 * power),
      durability: clamp(facility.durability + 0.3 * power),
      usefulness: clamp(facility.usefulness + 0.3 * power),
      tags: Array.from(new Set([...facility.tags, "butler_home_building"])),
    }))

    facilities = updateFacilityById(facilities, "food_corner", (facility) => ({
      ...facility,
      status: facility.status === "locked" ? "planned" : facility.status,
      progress: clamp(facility.progress + 1.2 * power),
      usefulness: clamp(facility.usefulness + 0.2 * power),
      tags: Array.from(new Set([...facility.tags, "butler_home_building"])),
    }))
  }

  if (execution.kind === "home_maintenance" && execution.canAffectHome) {
    const weakest = findWeakestActiveFacility(facilities)

    if (weakest) {
      facilities = updateFacilityById(facilities, weakest.id, (facility) => ({
        ...facility,
        status: facility.status === "needs_maintenance" ? "active" : facility.status,
        durability: clamp(facility.durability + 1.6 * power),
        usefulness: clamp(facility.usefulness + 0.8 * power),
        tags: Array.from(new Set([...facility.tags, "butler_home_maintenance"])),
      }))
    }
  }

  if (execution.kind === "space_tidying" && execution.canAffectHome) {
    facilities = updateFacilityById(facilities, "storage_box", (facility) => ({
      ...facility,
      status: facility.status === "locked" ? "planned" : facility.status,
      progress: clamp(facility.progress + 1.4 * power),
      durability: clamp(facility.durability + 0.5 * power),
      usefulness: clamp(facility.usefulness + 0.6 * power),
      tags: Array.from(new Set([...facility.tags, "butler_space_tidying"])),
    }))

    facilities = updateFacilityById(facilities, "observation_spot", (facility) => ({
      ...facility,
      status: facility.status === "locked" ? "planned" : facility.status,
      progress: clamp(facility.progress + 0.8 * power),
      usefulness: clamp(facility.usefulness + 0.6 * power),
      tags: Array.from(new Set([...facility.tags, "butler_space_tidying"])),
    }))
  }

  const nextHome: HomeState = {
    ...input.home,
    homeFacilities: facilities,
  }

  return buildDerivedHome(nextHome)
}
