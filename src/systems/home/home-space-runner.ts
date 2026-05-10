/**
 * 当前文件负责：根据家园建设状态同步家园空间实体。
 */

import type {
  HomeConstructionStage,
  HomeSpaceState,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { createInitialHomeSpaces } from "./home-space-builder"

function cloneSpaces(spaces: HomeSpaceState[]): HomeSpaceState[] {
  return spaces.map((space) => ({
    ...space,
    tags: [...space.tags],
  }))
}

function getBaseSpaces(home: HomeState): HomeSpaceState[] {
  if (home.homeSpaces && home.homeSpaces.length > 0) {
    return cloneSpaces(home.homeSpaces)
  }

  return createInitialHomeSpaces()
}

function mapShelterProgress(home: HomeState): number {
  return clamp(home.progress)
}

function mapGardenProgress(home: HomeState): number {
  return clamp(home.gardenProgress)
}

function resolveShelterStatus(home: HomeState): HomeSpaceState["status"] {
  if (home.progress >= 100 || home.constructionStage === "completed") {
    return "active"
  }

  if (home.progress > 0) {
    return "building"
  }

  return "building"
}

function resolveGardenStatus(home: HomeState): HomeSpaceState["status"] {
  if (home.gardenProgress >= 80 || home.constructionStage === "garden") {
    return "active"
  }

  if (home.gardenProgress > 10 || home.progress >= 65) {
    return "building"
  }

  if (home.progress >= 45) {
    return "available"
  }

  return "locked"
}

function resolveStorageStatus(
  stage: HomeConstructionStage
): HomeSpaceState["status"] {
  if (
    stage === "interior" ||
    stage === "garden" ||
    stage === "completed"
  ) {
    return "available"
  }

  return "locked"
}

function resolveActivityStatus(home: HomeState): HomeSpaceState["status"] {
  if (home.status === "completed") {
    return "available"
  }

  if (home.progress >= 85) {
    return "available"
  }

  return "locked"
}

function updateSpaceById(
  spaces: HomeSpaceState[],
  id: HomeSpaceState["id"],
  updater: (space: HomeSpaceState) => HomeSpaceState
): HomeSpaceState[] {
  return spaces.map((space) => {
    if (space.id !== id) return space

    return updater(space)
  })
}

export function syncHomeSpaces(home: HomeState): HomeSpaceState[] {
  let spaces = getBaseSpaces(home)

  spaces = updateSpaceById(spaces, "temporary_shelter", (space) => ({
    ...space,
    status: resolveShelterStatus(home),
    progress: mapShelterProgress(home),
    comfort: clamp((space.comfort + home.comfort) / 2),
    stability: clamp((space.stability + home.stability) / 2),
    tags: Array.from(new Set([
      ...space.tags,
      `stage_${home.constructionStage}`,
      `focus_${home.evolutionFocus}`,
    ])),
  }))

  spaces = updateSpaceById(spaces, "garden_area", (space) => ({
    ...space,
    status: resolveGardenStatus(home),
    progress: mapGardenProgress(home),
    comfort: clamp((space.comfort + home.comfort) / 2),
    stability: clamp((space.stability + home.stability) / 2),
    activity: clamp(space.activity + home.gardenProgress * 0.05),
    tags: Array.from(new Set([
      ...space.tags,
      `stage_${home.constructionStage}`,
      `focus_${home.evolutionFocus}`,
    ])),
  }))

  spaces = updateSpaceById(spaces, "storage_area", (space) => ({
    ...space,
    status: resolveStorageStatus(home.constructionStage),
    progress: home.progress >= 70 ? clamp(home.progress - 45) : space.progress,
    stability: clamp((space.stability + home.stability) / 2),
    tags: Array.from(new Set([
      ...space.tags,
      `focus_${home.evolutionFocus}`,
    ])),
  }))

  spaces = updateSpaceById(spaces, "activity_area", (space) => ({
    ...space,
    status: resolveActivityStatus(home),
    progress: home.progress >= 80 ? clamp(home.progress - 60) : space.progress,
    comfort: clamp((space.comfort + home.comfort) / 2),
    activity: clamp(space.activity + home.expansion * 0.05),
    tags: Array.from(new Set([
      ...space.tags,
      `focus_${home.evolutionFocus}`,
    ])),
  }))

  return spaces.sort((a, b) => a.order - b.order)
}
