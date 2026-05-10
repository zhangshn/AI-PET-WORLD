/**
 * 当前文件负责：维护家园状态，并调度家园建造进度更新。
 */

import type { GenderAwareBehaviorBias } from "../ai/gateway"
import type { HomeState } from "../types/home"
import {
  buildHome,
  createInitialHomeSpaces,
  syncHomeSpaces,
} from "./home/home-gateway"

export class HomeSystem {
  private home: HomeState

  constructor() {
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
      homeSpaces: createInitialHomeSpaces(),
    }
  }

  restore(home: HomeState): void {
    this.home = {
      ...home,
      homeSpaces: syncHomeSpaces(home),
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
    }
  }
}

export default HomeSystem
