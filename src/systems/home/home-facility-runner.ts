/**
 * 当前文件负责：根据家园空间状态同步家园设施状态。
 */

import type {
  HomeFacilityState,
  HomeSpaceState,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { createInitialHomeFacilities } from "./home-facility-builder"
import { syncHomeSpaces } from "./home-space-runner"

function cloneFacilities(
  facilities: HomeFacilityState[]
): HomeFacilityState[] {
  return facilities.map((facility) => ({
    ...facility,
    tags: [...facility.tags],
  }))
}

function getBaseFacilities(home: HomeState): HomeFacilityState[] {
  if (home.homeFacilities && home.homeFacilities.length > 0) {
    return cloneFacilities(home.homeFacilities)
  }

  return createInitialHomeFacilities()
}

function findSpace(
  spaces: HomeSpaceState[],
  spaceId: HomeFacilityState["spaceId"]
): HomeSpaceState | null {
  return spaces.find((space) => space.id === spaceId) ?? null
}

function resolveFacilityStatus(input: {
  facility: HomeFacilityState
  space: HomeSpaceState | null
  home: HomeState
}): HomeFacilityState["status"] {
  if (input.facility.status === "active") {
    if (input.facility.durability <= 22) return "needs_maintenance"
    return "active"
  }

  if (!input.space || input.space.status === "locked") {
    return "locked"
  }

  if (input.facility.progress >= 100) {
    return "active"
  }

  if (
    input.space.status === "active" ||
    input.space.status === "available" ||
    input.space.status === "building"
  ) {
    if (input.facility.progress > 0) return "building"

    if (
      input.facility.id === "shelter_bed" &&
      input.home.progress >= 20
    ) {
      return "planned"
    }

    if (
      input.facility.id === "food_corner" &&
      input.home.progress >= 35
    ) {
      return "planned"
    }

    if (
      input.facility.id === "water_corner" &&
      input.home.progress >= 40
    ) {
      return "planned"
    }

    if (
      input.facility.id === "storage_box" &&
      input.home.progress >= 70
    ) {
      return "planned"
    }

    if (
      input.facility.id === "garden_patch" &&
      input.home.gardenProgress >= 20
    ) {
      return "planned"
    }

    if (
      input.facility.id === "observation_spot" &&
      input.home.progress >= 85
    ) {
      return "planned"
    }
  }

  return input.facility.status
}

export function syncHomeFacilities(home: HomeState): HomeFacilityState[] {
  const spaces = syncHomeSpaces(home)
  const facilities = getBaseFacilities(home)

  return facilities.map((facility) => {
    const space = findSpace(spaces, facility.spaceId)
    const status = resolveFacilityStatus({
      facility,
      space,
      home,
    })

    const spaceComfort = space?.comfort ?? 0
    const spaceStability = space?.stability ?? 0
    const spaceActivity = space?.activity ?? 0

    return {
      ...facility,
      status,
      durability:
        status === "active"
          ? clamp(facility.durability - 0.02)
          : facility.durability,
      usefulness: clamp(
        facility.usefulness +
          spaceComfort * 0.004 +
          spaceStability * 0.004 +
          spaceActivity * 0.002
      ),
      tags: Array.from(new Set([
        ...facility.tags,
        `facility_status_${status}`,
        `space_${facility.spaceId}`,
      ])),
    }
  })
}
