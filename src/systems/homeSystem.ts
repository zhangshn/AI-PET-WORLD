/**
 * 当前文件负责：维护家园状态，并调度家园建造进度更新。
 */

import type { GenderAwareBehaviorBias } from "../ai/gateway"
import type { HomeState } from "../types/home"
import {
  buildHome,
  buildHomeSpaceSummary,
  createInitialHomeSpaces,
  syncHomeSpaces,
} from "./home/home-gateway"

export class HomeSystem {
  private home: HomeState

  constructor() {
    const initialSpaces = createInitialHomeSpaces()

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
      }),
    }
  }

  restore(home: HomeState): void {
    const restoredHome = {
      ...home,
      homeSpaces: syncHomeSpaces(home),
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

  getHome(): HomeState {
    return {
      ...this.home,
      homeSpaces: this.home.homeSpaces?.map((space) => ({
        ...space,
        tags: [...space.tags],
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
