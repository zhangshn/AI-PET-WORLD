/**
 * 当前文件负责：聚合 world 页面未来 HUD 所需的轻量状态数据。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { PetState } from "@/types/pet"
import type { ButlerState } from "@/types/butler"
import type { HomeState } from "@/types/home"

import {
  getLifePhaseDisplayLabel,
  getPetBehaviorBiasSummary,
  getPetCurrentTendency,
  getPetGenderPerspectiveLabel,
  getPetInnateTemperament,
  getPetVisibleTraits,
} from "./petDisplayMappers"

import {
  getButlerMoodLabel,
  getButlerTaskLabel,
} from "./butlerDisplayMappers"

import {
  clampHomeMeterValue,
  getHomeFocusLabel,
  getHomeProgressLabel,
  getHomeStageLabel,
  getHomeStatusLabel,
} from "./homeDisplayMappers"

import {
  formatWorldHour,
  getWorldPeriodLabel,
  getWorldPulseLabel,
  getWorldPulseTone,
  getWorldTemperatureLabel,
  getWorldWeatherLabel,
} from "./worldInfoMappers"

export type HudTone =
  | "neutral"
  | "good"
  | "warning"
  | "danger"
  | "quiet"
  | "active"

export type HudMeter = {
  label: string
  value: number
  valueLabel: string
  tone: HudTone
}

export type PetHudData = {
  available: boolean
  name: string
  actionLabel: string
  moodLabel: string
  lifePhaseLabel: string
  genderPerspectiveLabel: string
  temperamentLabel: string
  currentTendencyLabel: string
  traitTags: string[]
  behaviorBiasSummary: string
  meters: {
    energy: HudMeter
    hunger: HudMeter
  }
}

export type ButlerHudData = {
  available: boolean
  name: string
  taskLabel: string
  moodLabel: string
  opportunityCount: number
  note: string
}

export type HomeHudData = {
  available: boolean
  levelLabel: string
  statusLabel: string
  stageLabel: string
  focusLabel: string
  meters: {
    progress: HudMeter
    garden: HudMeter
    comfort: HudMeter
    stability: HudMeter
    expansion: HudMeter
  }
}

export type WorldHudData = {
  dayLabel: string
  timeLabel: string
  periodLabel: string
  weatherLabel: string
  temperatureLabel: string
  pulseLabel: string
  pulseTone: "amber" | "muted"
  stimuliCount: number
}

export type WorldHudBundle = {
  pet: PetHudData
  butler: ButlerHudData
  home: HomeHudData
  world: WorldHudData
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function getPetActionLabel(action?: string): string {
  if (!action) return "观察环境"

  if (action === "idle") return "停留"
  if (action === "walking") return "移动"
  if (action === "exploring") return "探索"
  if (action === "eating") return "进食"
  if (action === "resting") return "休息"
  if (action === "sleeping") return "睡眠"
  if (action === "approaching") return "靠近"
  if (action === "observing") return "观察"
  if (action === "alert_idle") return "警觉停留"

  return action
}

function getPetMoodLabel(mood?: string): string {
  if (!mood) return "未知"

  if (mood === "happy") return "愉快"
  if (mood === "normal") return "平稳"
  if (mood === "calm") return "平静"
  if (mood === "curious") return "好奇"
  if (mood === "alert") return "警觉"
  if (mood === "sad") return "低落"

  return mood
}

function getEnergyTone(energy: number): HudTone {
  if (energy >= 70) return "good"
  if (energy >= 35) return "neutral"
  if (energy >= 18) return "warning"

  return "danger"
}

function getHungerTone(hunger: number): HudTone {
  if (hunger >= 80) return "danger"
  if (hunger >= 55) return "warning"
  if (hunger >= 25) return "neutral"

  return "good"
}

function getHomeMeterTone(value: number): HudTone {
  if (value >= 80) return "good"
  if (value >= 45) return "neutral"
  if (value >= 20) return "warning"

  return "quiet"
}

export function buildPetHudData(pet: PetState | null): PetHudData {
  if (!pet) {
    return {
      available: false,
      name: "等待诞生",
      actionLabel: "孵化中",
      moodLabel: "未知",
      lifePhaseLabel: "未出生",
      genderPerspectiveLabel: "未知视角",
      temperamentLabel: "尚未生成",
      currentTendencyLabel: "等待生命反应",
      traitTags: [],
      behaviorBiasSummary: "孵化完成后，生命倾向才会逐步进入世界表现。",
      meters: {
        energy: {
          label: "能量",
          value: 0,
          valueLabel: "--",
          tone: "quiet",
        },
        hunger: {
          label: "饥饿",
          value: 0,
          valueLabel: "--",
          tone: "quiet",
        },
      },
    }
  }

  const energyValue = clampPercent(pet.energy)
  const hungerValue = clampPercent(pet.hunger)

  return {
    available: true,
    name: pet.name,
    actionLabel: getPetActionLabel(pet.action),
    moodLabel: getPetMoodLabel(pet.mood),
    lifePhaseLabel: getLifePhaseDisplayLabel(pet.lifeState.phase),
    genderPerspectiveLabel: getPetGenderPerspectiveLabel(pet.genderPerspective),
    temperamentLabel: getPetInnateTemperament(pet),
    currentTendencyLabel: getPetCurrentTendency(pet),
    traitTags: getPetVisibleTraits(pet).slice(0, 3),
    behaviorBiasSummary: getPetBehaviorBiasSummary(pet),
    meters: {
      energy: {
        label: "能量",
        value: energyValue,
        valueLabel: `${energyValue}%`,
        tone: getEnergyTone(energyValue),
      },
      hunger: {
        label: "饥饿",
        value: hungerValue,
        valueLabel: `${hungerValue}%`,
        tone: getHungerTone(hungerValue),
      },
    },
  }
}

export function buildButlerHudData(
  butler: ButlerState | null
): ButlerHudData {
  if (!butler) {
    return {
      available: false,
      name: "管家",
      taskLabel: "未就位",
      moodLabel: "未知",
      opportunityCount: 0,
      note: "世界还没有读取到管家状态。",
    }
  }

  return {
    available: true,
    name: butler.name,
    taskLabel: getButlerTaskLabel(butler.task),
    moodLabel: getButlerMoodLabel(butler.mood),
    opportunityCount: butler.pendingOpportunities.length,
    note: "管家只提供机会，不直接控制宠物。",
  }
}

export function buildHomeHudData(home: HomeState | null): HomeHudData {
  if (!home) {
    return {
      available: false,
      levelLabel: "Lv.-",
      statusLabel: "未知",
      stageLabel: "未知阶段",
      focusLabel: "未知",
      meters: {
        progress: {
          label: "建设",
          value: 0,
          valueLabel: "--",
          tone: "quiet",
        },
        garden: {
          label: "庭院",
          value: 0,
          valueLabel: "--",
          tone: "quiet",
        },
        comfort: {
          label: "舒适",
          value: 0,
          valueLabel: "--",
          tone: "quiet",
        },
        stability: {
          label: "稳定",
          value: 0,
          valueLabel: "--",
          tone: "quiet",
        },
        expansion: {
          label: "扩展",
          value: 0,
          valueLabel: "--",
          tone: "quiet",
        },
      },
    }
  }

  const progressValue = clampPercent(home.progress)
  const gardenValue = clampPercent(home.gardenProgress)
  const comfortValue = clampPercent(home.comfort)
  const stabilityValue = clampHomeMeterValue(home.stability)
  const expansionValue = clampHomeMeterValue(home.expansion)

  return {
    available: true,
    levelLabel: `Lv.${home.level}`,
    statusLabel: getHomeStatusLabel(home.status),
    stageLabel: getHomeStageLabel(home.constructionStage),
    focusLabel: getHomeFocusLabel(home.evolutionFocus),
    meters: {
      progress: {
        label: "建设",
        value: progressValue,
        valueLabel: getHomeProgressLabel(progressValue),
        tone: getHomeMeterTone(progressValue),
      },
      garden: {
        label: "庭院",
        value: gardenValue,
        valueLabel: getHomeProgressLabel(gardenValue),
        tone: getHomeMeterTone(gardenValue),
      },
      comfort: {
        label: "舒适",
        value: comfortValue,
        valueLabel: `${comfortValue}`,
        tone: getHomeMeterTone(comfortValue),
      },
      stability: {
        label: "稳定",
        value: stabilityValue,
        valueLabel: `${Math.round(stabilityValue)}`,
        tone: getHomeMeterTone(stabilityValue),
      },
      expansion: {
        label: "扩展",
        value: expansionValue,
        valueLabel: `${Math.round(expansionValue)}`,
        tone: getHomeMeterTone(expansionValue),
      },
    },
  }
}

export function buildWorldHudData(input: {
  time: TimeState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
}): WorldHudData {
  const stimuliCount = input.stimuli.length
  const weatherLabel = getWorldWeatherLabel(
    input.ecology?.environment.activeWeather
  )

  return {
    dayLabel: `Day ${input.time?.day ?? "-"}`,
    timeLabel: formatWorldHour(input.time?.hour),
    periodLabel: getWorldPeriodLabel(input.time?.period),
    weatherLabel,
    temperatureLabel: getWorldTemperatureLabel(input.ecology),
    pulseLabel: getWorldPulseLabel(stimuliCount),
    pulseTone: getWorldPulseTone(stimuliCount),
    stimuliCount,
  }
}

export function buildWorldHudBundle(input: {
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  home: HomeState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
}): WorldHudBundle {
  return {
    pet: buildPetHudData(input.pet),
    butler: buildButlerHudData(input.butler),
    home: buildHomeHudData(input.home),
    world: buildWorldHudData({
      time: input.time,
      stimuli: input.stimuli,
      ecology: input.ecology,
    }),
  }
}