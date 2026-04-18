/**
 * ======================================================
 * AI-PET-WORLD
 * Pet System
 * ======================================================
 */

import { PetState } from "../types/pet"
import { TimeState } from "../engine/timeSystem"
import type { PersonalityProfile } from "../ai/personality-core/schema"

export class PetSystem {
  private pet: PetState | null

  constructor() {
    this.pet = null
  }

  hatchPetWithProfile(
    name: string,
    personalityProfile: PersonalityProfile
  ) {
    if (this.pet) {
      return
    }

    this.pet = {
      name,
      energy: 100,
      hunger: 10,
      mood: "happy",
      action: "sleeping",
      personalityProfile
    }

    console.log(`宠物系统：${name}已经出生，正式进入世界。`)
    console.log("宠物系统：已绑定最终人格档案。", {
      name,
      summaries: personalityProfile.summaries,
      traits: personalityProfile.traits
    })
  }

  update(time: TimeState) {
    if (!this.pet) {
      console.log("宠物系统：当前还没有已出生宠物，跳过宠物行为更新。")
      return
    }

    this.applyCurrentActionEffects()
    this.updateNeeds()
    this.updateMood()
    this.updateAction(time)

    console.log(
      `宠物状态：精力=${this.pet.energy} 饥饿=${this.pet.hunger} 心情=${this.pet.mood}`
    )

    console.log(`宠物行为：${this.pet.action}`)

    console.log("宠物人格影响：", {
      activity: this.pet.personalityProfile.traits.activity,
      restPreference: this.pet.personalityProfile.traits.restPreference,
      appetite: this.pet.personalityProfile.traits.appetite,
      discipline: this.pet.personalityProfile.traits.discipline,
      emotionalSensitivity:
        this.pet.personalityProfile.traits.emotionalSensitivity,
      stability: this.pet.personalityProfile.traits.stability
    })
  }

  private applyCurrentActionEffects() {
    if (!this.pet) return

    if (this.pet.action === "sleeping") {
      this.pet.energy += 15
    }

    if (this.pet.action === "eating") {
      this.pet.hunger -= 15
    }

    this.clampStats()
  }

  private updateNeeds() {
    if (!this.pet) return

    if (this.pet.action === "walking") {
      this.pet.energy -= 8
      this.pet.hunger += 6
    } else if (this.pet.action === "sleeping") {
      this.pet.energy -= 1
      this.pet.hunger += 4
    } else if (this.pet.action === "eating") {
      this.pet.energy -= 2
      this.pet.hunger += 2
    }

    this.clampStats()
  }

  private updateMood() {
    if (!this.pet) return

    const traits = this.pet.personalityProfile.traits

    const sensitivityOffset = Math.round(
      (traits.emotionalSensitivity - 50) / 5
    )

    const stabilityOffset = Math.round(
      (traits.stability - 50) / 5
    )

    const sadHungerThreshold = this.clampThreshold(
      80 - sensitivityOffset + stabilityOffset,
      60,
      95
    )

    const sadEnergyThreshold = this.clampThreshold(
      20 + sensitivityOffset - stabilityOffset,
      10,
      40
    )

    const normalHungerThreshold = this.clampThreshold(
      50 - sensitivityOffset + Math.round(stabilityOffset / 2),
      35,
      70
    )

    const normalEnergyThreshold = this.clampThreshold(
      50 + sensitivityOffset - Math.round(stabilityOffset / 2),
      35,
      70
    )

    if (
      this.pet.hunger >= sadHungerThreshold ||
      this.pet.energy <= sadEnergyThreshold
    ) {
      this.pet.mood = "sad"
      return
    }

    if (
      this.pet.hunger >= normalHungerThreshold ||
      this.pet.energy <= normalEnergyThreshold
    ) {
      this.pet.mood = "normal"
      return
    }

    this.pet.mood = "happy"
  }

  private updateAction(time: TimeState) {
    if (!this.pet) return

    const traits = this.pet.personalityProfile.traits

    const eatingThreshold = this.clampThreshold(
      65 -
        Math.round((traits.appetite - 50) / 4) +
        Math.round((traits.discipline - 50) / 8),
      45,
      80
    )

    const sleepingEnergyThreshold = this.clampThreshold(
      35 +
        Math.round((traits.restPreference - 50) / 3) +
        Math.round((traits.emotionalSensitivity - 50) / 8) -
        Math.round((traits.stability - 50) / 8),
      20,
      65
    )

    const nightSleepBias =
      Math.round((traits.discipline - 50) / 8) -
      Math.round((traits.activity - 50) / 10)

    if (this.pet.hunger >= eatingThreshold) {
      this.pet.action = "eating"
      return
    }

    if (this.pet.energy <= sleepingEnergyThreshold) {
      this.pet.action = "sleeping"
      return
    }

    if (time.period === "Night") {
      if (
        traits.restPreference + traits.discipline + nightSleepBias >=
        traits.activity + 55
      ) {
        this.pet.action = "sleeping"
        return
      }
    }

    const activityScore =
      traits.activity +
      Math.round((this.pet.energy - 50) / 3) -
      Math.round((this.pet.hunger - 50) / 4)

    const restScore =
      traits.restPreference +
      Math.round((50 - this.pet.energy) / 2) +
      Math.round((this.pet.hunger - 50) / 6)

    const stabilityBuffer = Math.round((traits.stability - 50) / 5)

    if (restScore > activityScore + stabilityBuffer) {
      this.pet.action = "sleeping"
      return
    }

    if (activityScore > restScore + stabilityBuffer) {
      this.pet.action = "walking"
      return
    }

    this.pet.action = "walking"
  }

  applyFeeding(amount: number) {
    if (!this.pet) return

    this.pet.hunger -= amount
    this.clampStats()
  }

  restoreEnergy(amount: number) {
    if (!this.pet) return

    this.pet.energy += amount
    this.clampStats()
  }

  private clampStats() {
    if (!this.pet) return

    if (this.pet.energy < 0) {
      this.pet.energy = 0
    }

    if (this.pet.energy > 100) {
      this.pet.energy = 100
    }

    if (this.pet.hunger < 0) {
      this.pet.hunger = 0
    }

    if (this.pet.hunger > 100) {
      this.pet.hunger = 100
    }
  }

  private clampThreshold(
    value: number,
    min: number,
    max: number
  ): number {
    if (value < min) return min
    if (value > max) return max
    return value
  }

  getPet(): PetState | null {
    if (!this.pet) {
      return null
    }

    const pattern = this.pet.personalityProfile.pattern

    return {
      ...this.pet,
      personalityProfile: {
        ...this.pet.personalityProfile,
        pattern: {
          ...pattern,
          sectors: { ...pattern.sectors },
          supportSectors: [...(pattern.supportSectors ?? [])],
          supportStars: [...(pattern.supportStars ?? [])],

          /**
           * 兼容旧逻辑：如果 supportSymbols 没有，就回退到 supportStars
           */
          supportSymbols: [
            ...((pattern.supportSymbols ?? pattern.supportStars) ?? [])
          ],

          primaryStars: [...(pattern.primaryStars ?? [])],
          borrowedStars: [...(pattern.borrowedStars ?? [])]
        },
        summaries: [...(this.pet.personalityProfile.summaries ?? [])],
        traits: { ...this.pet.personalityProfile.traits }
      }
    }
  }

  hasPet(): boolean {
    return this.pet !== null
  }
}