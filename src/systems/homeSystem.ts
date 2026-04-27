/**
 * 当前文件负责：维护家园状态，并调度家园建造进度更新。
 */

import type { FinalPersonalityProfile } from "../ai/gateway"
import type { HomeState } from "../types/home"
import { buildHome } from "./home/home-gateway"

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
    }
  }

  build(amount: number, profile?: FinalPersonalityProfile | null) {
    this.home = buildHome({
      home: this.home,
      amount,
      profile,
    })
  }

  getHome(): HomeState {
    return { ...this.home }
  }
}

export default HomeSystem