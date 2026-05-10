/**
 * 当前文件负责：维护家园状态，并调度家园建造进度更新。
 */

import type { GenderAwareBehaviorBias } from "../ai/gateway"
import type {
  ButlerBehaviorExecution,
} from "./butler/butler-gateway"
import type { HomeState } from "../types/home"
import {
  applyButlerHomeFacilityAction,
  applyButlerHomeSpaceAction,
  applyHomeFacilityEffects,
  buildHome,
  buildHomeGoals,
  buildHomeSpaceSummary,
  createInitialHomeFacilities,
  createInitialHomeSpaces,
  resolveHomeLifecycle,
  syncHomeFacilities,
  syncHomeSpaces,
} from "./home/home-gateway"

export class HomeSystem {
  private home: HomeState

  constructor() {
    const initialSpaces = createInitialHomeSpaces()
    const initialFacilities = createInitialHomeFacilities()
    const initialHome: HomeState = {
      level: 1,
      progress: 0,
      status: "building",
      constructionStage: "temporary_shelter",
      evolutionFocus: "balanced",
      gardenProgress: 0,
      comfort: 35,
      stability: 45,
      expansion: 20,
      homeSpaces: initialSpaces,
      homeFacilities: initialFacilities,
    }

    const initialHomeWithLifecycle: HomeState = {
      ...initialHome,
      spaceSummary: buildHomeSpaceSummary(initialHome),
      lifecycle: resolveHomeLifecycle(initialHome),
    }

    this.home = {
      ...initialHomeWithLifecycle,
      homeGoals: buildHomeGoals(initialHomeWithLifecycle),
    }
  }

  restore(home: HomeState): void {
    const restoredHome = {
      ...home,
      homeSpaces: syncHomeSpaces(home),
      homeFacilities: syncHomeFacilities(home),
    }

    const restoredWithEffects = applyHomeFacilityEffects(restoredHome)

    const restoredWithLifecycle: HomeState = {
      ...restoredWithEffects,
      spaceSummary: buildHomeSpaceSummary(restoredWithEffects),
      lifecycle: resolveHomeLifecycle(restoredWithEffects),
    }

    this.home = {
      ...restoredWithLifecycle,
      homeGoals: buildHomeGoals(restoredWithLifecycle),
    }
  }

  build(amount: number, behaviorBias?: GenderAwareBehaviorBias | null) {
    this.home = buildHome({
      home: this.home,
      amount,
      behaviorBias,
    })
  }

  applyButlerSpaceAction(
    execution: ButlerBehaviorExecution | null | undefined
  ): void {
    const nextHome = applyButlerHomeSpaceAction({
      home: this.home,
      execution,
    })

    const nextHomeWithLifecycle: HomeState = {
      ...nextHome,
      lifecycle: resolveHomeLifecycle(nextHome),
    }

    this.home = {
      ...nextHomeWithLifecycle,
      homeGoals: buildHomeGoals(nextHomeWithLifecycle),
    }
  }

  applyButlerFacilityAction(
    execution: ButlerBehaviorExecution | null | undefined
  ): void {
    const nextHome = applyHomeFacilityEffects(
      applyButlerHomeFacilityAction({
        home: this.home,
        execution,
      })
    )

    const nextHomeWithLifecycle: HomeState = {
      ...nextHome,
      lifecycle: resolveHomeLifecycle(nextHome),
    }

    this.home = {
      ...nextHomeWithLifecycle,
      homeGoals: buildHomeGoals(nextHomeWithLifecycle),
    }
  }

  getHome(): HomeState {
    return {
      ...this.home,
      homeSpaces: this.home.homeSpaces?.map((space) => ({
        ...space,
        tags: [...space.tags],
      })),
      homeFacilities: this.home.homeFacilities?.map((facility) => ({
        ...facility,
        tags: [...facility.tags],
      })),
      spaceSummary: this.home.spaceSummary
        ? {
            ...this.home.spaceSummary,
            buildingSpaceIds: [...this.home.spaceSummary.buildingSpaceIds],
            activeSpaceIds: [...this.home.spaceSummary.activeSpaceIds],
            availableSpaceIds: [...this.home.spaceSummary.availableSpaceIds],
            maintenanceSpaceIds: [...this.home.spaceSummary.maintenanceSpaceIds],
            activitySpaceIds: [...this.home.spaceSummary.activitySpaceIds],
            tags: [...this.home.spaceSummary.tags],
          }
        : undefined,
      lifecycle: this.home.lifecycle
        ? {
            ...this.home.lifecycle,
            tags: [...this.home.lifecycle.tags],
          }
        : undefined,
      homeGoals: this.home.homeGoals?.map((goal) => ({
        ...goal,
        recommendedBehaviorKinds: [...goal.recommendedBehaviorKinds],
        tags: [...goal.tags],
      })),
    }
  }
}

export default HomeSystem
