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
  buildHome,
  buildHomeSpaceSummary,
  createInitialHomeFacilities,
  createInitialHomeSpaces,
  syncHomeFacilities,
  syncHomeSpaces,
} from "./home/home-gateway"

export class HomeSystem {
  private home: HomeState

  constructor() {
    const initialSpaces = createInitialHomeSpaces()
    const initialFacilities = createInitialHomeFacilities()

    this.home = {
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
      spaceSummary: buildHomeSpaceSummary({
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
      }),
    }
  }

  restore(home: HomeState): void {
    const restoredHome = {
      ...home,
      homeSpaces: syncHomeSpaces(home),
      homeFacilities: syncHomeFacilities(home),
    }

    this.home = {
      ...restoredHome,
      spaceSummary: buildHomeSpaceSummary(restoredHome),
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
    this.home = applyButlerHomeSpaceAction({
      home: this.home,
      execution,
    })
  }

  applyButlerFacilityAction(
    execution: ButlerBehaviorExecution | null | undefined
  ): void {
    this.home = applyButlerHomeFacilityAction({
      home: this.home,
      execution,
    })
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
    }
  }
}

export default HomeSystem
