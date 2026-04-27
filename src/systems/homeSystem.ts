/**
 * 当前文件负责：管理家园建造进度、施工阶段与家园成长方向。
 */

import type { FinalPersonalityProfile } from "../ai/gateway"
import type {
  HomeConstructionStage,
  HomeEvolutionFocus,
  HomeState,
} from "../types/home"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function resolveConstructionStage(progress: number): HomeConstructionStage {
  if (progress <= 0) return "temporary_shelter"
  if (progress < 20) return "foundation"
  if (progress < 45) return "frame"
  if (progress < 65) return "roof"
  if (progress < 85) return "interior"
  if (progress < 100) return "garden"
  return "completed"
}

function resolveEvolutionFocus(
  profile?: FinalPersonalityProfile | null
): HomeEvolutionFocus {
  if (!profile) return "balanced"

  const building = profile.bias.buildingBias

  const entries: Array<[HomeEvolutionFocus, number]> = [
    ["expansion", building.expansionPreference],
    ["stability", building.stabilityPreference],
    ["comfort", building.comfortPreference],
    ["order", building.orderPreference],
    ["adaptive", building.adaptabilityPreference],
  ]

  const [focus, score] = entries.sort((a, b) => b[1] - a[1])[0]

  return score >= 60 ? focus : "balanced"
}

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
    if (this.home.status === "completed") {
      return
    }

    const building = profile?.bias.buildingBias

    const constructionBonus = building
      ? (building.stabilityPreference + building.orderPreference) / 200
      : 0.25

    const finalAmount = amount * (1 + constructionBonus * 0.35)

    this.home.progress = clamp(this.home.progress + finalAmount)
    this.home.evolutionFocus = resolveEvolutionFocus(profile)
    this.home.constructionStage = resolveConstructionStage(this.home.progress)

    if (building) {
      this.home.comfort = clamp(
        this.home.comfort + building.comfortPreference * 0.015
      )
      this.home.stability = clamp(
        this.home.stability + building.stabilityPreference * 0.015
      )
      this.home.expansion = clamp(
        this.home.expansion + building.expansionPreference * 0.015
      )
      this.home.gardenProgress = clamp(
        this.home.gardenProgress + building.adaptabilityPreference * 0.012
      )
    } else {
      this.home.comfort = clamp(this.home.comfort + 0.3)
      this.home.stability = clamp(this.home.stability + 0.3)
      this.home.gardenProgress = clamp(this.home.gardenProgress + 0.2)
    }

    if (this.home.progress > 0 && this.home.progress < 100) {
      this.home.status = "building"
    }

    if (this.home.progress >= 100) {
      this.home.progress = 100
      this.home.status = "completed"
      this.home.constructionStage = "completed"
      this.home.level = Math.max(this.home.level, 2)
    }
  }

  getHome(): HomeState {
    return { ...this.home }
  }
}

export default HomeSystem