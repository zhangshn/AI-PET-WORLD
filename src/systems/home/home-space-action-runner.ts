/**
 * 褰撳墠鏂囦欢璐熻矗锛氭牴鎹瀹惰涓烘墽琛屽揩鐓э紝瀹夊叏鏇存柊鍏蜂綋瀹跺洯绌洪棿鐘舵€併€? *
 * 娉ㄦ剰锛? * 杩欓噷鍙奖鍝?homeSpaces銆? * 涓嶆帶鍒跺疇鐗┿€? * 涓嶅啓瀹犵墿 learning銆? */

import type {
  ButlerBehaviorExecution,
} from "@/systems/butler/butler-gateway"

import type {
  HomeSpaceId,
  HomeSpaceState,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { syncHomeSpaces } from "./home-space-runner"
import { buildHomeSpaceSummary } from "./home-space-summary-runner"

export type ApplyButlerHomeSpaceActionInput = {
  home: HomeState
  execution: ButlerBehaviorExecution | null | undefined
}

function cloneSpaces(spaces: HomeSpaceState[]): HomeSpaceState[] {
  return spaces.map((space) => ({
    ...space,
    tags: [...space.tags],
  }))
}

function updateSpaceById(
  spaces: HomeSpaceState[],
  id: HomeSpaceId,
  updater: (space: HomeSpaceState) => HomeSpaceState
): HomeSpaceState[] {
  return spaces.map((space) => {
    if (space.id !== id) return space

    return updater(space)
  })
}

function getActionPower(execution: ButlerBehaviorExecution): number {
  return Math.max(0.2, Math.min(1.4, execution.intensity / 60))
}

function findWeakestAvailableSpace(
  spaces: HomeSpaceState[]
): HomeSpaceState | null {
  const candidates = spaces.filter((space) => space.status !== "locked")

  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => {
    const aScore = a.comfort + a.stability
    const bScore = b.comfort + b.stability

    return aScore - bScore
  })[0] ?? null
}

function syncDerivedHome(home: HomeState): HomeState {
  const homeWithSpaces: HomeState = {
    ...home,
    homeSpaces: syncHomeSpaces(home),
  }

  return {
    ...homeWithSpaces,
    spaceSummary: buildHomeSpaceSummary(homeWithSpaces),
  }
}

function addTag(space: HomeSpaceState, tag: string): string[] {
  return Array.from(new Set([...space.tags, tag]))
}

export function applyButlerHomeSpaceAction(
  input: ApplyButlerHomeSpaceActionInput
): HomeState {
  const execution = input.execution

  if (!execution) {
    return syncDerivedHome(input.home)
  }

  let spaces = cloneSpaces(syncHomeSpaces(input.home))
  const power = getActionPower(execution)

  if (execution.kind === "home_building" && execution.canAffectHome) {
    spaces = updateSpaceById(spaces, "temporary_shelter", (space) => ({
      ...space,
      status: space.status === "locked" ? "building" : space.status,
      progress: clamp(space.progress + 2.4 * power),
      comfort: clamp(space.comfort + 0.5 * power),
      stability: clamp(space.stability + 0.8 * power),
      tags: addTag(space, "butler_home_building"),
    }))
  }

  if (execution.kind === "home_maintenance" && execution.canAffectHome) {
    const weakest = findWeakestAvailableSpace(spaces)

    if (weakest) {
      spaces = updateSpaceById(spaces, weakest.id, (space) => ({
        ...space,
        comfort: clamp(space.comfort + 1.2 * power),
        stability: clamp(space.stability + 1.4 * power),
        tags: addTag(space, "butler_home_maintenance"),
      }))
    }
  }

  if (execution.kind === "space_tidying" && execution.canAffectHome) {
    spaces = updateSpaceById(spaces, "storage_area", (space) => ({
      ...space,
      stability: clamp(space.stability + 1.1 * power),
      comfort: clamp(space.comfort + 0.4 * power),
      tags: addTag(space, "butler_space_tidying"),
    }))

    spaces = updateSpaceById(spaces, "activity_area", (space) => ({
      ...space,
      stability: clamp(space.stability + 0.8 * power),
      activity: clamp(space.activity + 0.5 * power),
      tags: addTag(space, "butler_space_tidying"),
    }))
  }

  if (execution.kind === "home_maintenance") {
    spaces = updateSpaceById(spaces, "initial_care_area", (space) => ({
      ...space,
      stability: clamp(space.stability + 0.6 * power),
      comfort: clamp(space.comfort + 0.25 * power),
      tags: addTag(space, "butler_home_maintenance"),
    }))
  }

  const nextHome: HomeState = {
    ...input.home,
    homeSpaces: spaces.sort((a, b) => a.order - b.order),
  }

  return {
    ...nextHome,
    spaceSummary: buildHomeSpaceSummary(nextHome),
  }
}
