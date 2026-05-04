/**
 * 当前文件负责：整理未来手机主页模块所需的数据。
 */

import type { WorldEvent } from "@/types/event"

import type {
  ButlerHudData,
  HomeHudData,
  HudMeter,
  PetHudData,
  WorldHudBundle,
} from "./worldHudMappers"

import {
  buildPhoneObservationModuleData,
  type PhoneObservationModuleData,
} from "./phoneObservationMappers"

export type PhoneModuleStatus =
  | "normal"
  | "active"
  | "warning"
  | "quiet"
  | "locked"

export type PhoneModuleMetric = {
  label: string
  valueLabel: string
  value?: number
  meter?: HudMeter
}

export type PhoneModuleCard = {
  id: "pet" | "butler" | "home" | "observation"
  title: string
  subtitle: string
  status: PhoneModuleStatus
  statusLabel: string
  primaryText: string
  secondaryText: string
  metrics: PhoneModuleMetric[]
  tags: string[]
  routeKey: string
}

export type PhonePetModuleData = PhoneModuleCard & {
  id: "pet"
  petName: string
  actionLabel: string
  moodLabel: string
  lifePhaseLabel: string
  temperamentLabel: string
  currentTendencyLabel: string
}

export type PhoneButlerModuleData = PhoneModuleCard & {
  id: "butler"
  butlerName: string
  taskLabel: string
  moodLabel: string
  opportunityCount: number
}

export type PhoneHomeModuleData = PhoneModuleCard & {
  id: "home"
  levelLabel: string
  stageLabel: string
  focusLabel: string
}

export type PhoneObservationEntryModuleData = PhoneModuleCard & {
  id: "observation"
  observation: PhoneObservationModuleData
}

export type PhoneHomeScreenModuleData = {
  screenTitle: string
  screenSubtitle: string
  modules: [
    PhonePetModuleData,
    PhoneButlerModuleData,
    PhoneHomeModuleData,
    PhoneObservationEntryModuleData,
  ]
}

function resolvePetStatus(pet: PetHudData): PhoneModuleStatus {
  if (!pet.available) return "locked"

  if (
    pet.meters.energy.tone === "danger" ||
    pet.meters.hunger.tone === "danger"
  ) {
    return "warning"
  }

  if (pet.actionLabel === "探索" || pet.actionLabel === "靠近") {
    return "active"
  }

  if (pet.actionLabel === "睡眠" || pet.actionLabel === "休息") {
    return "quiet"
  }

  return "normal"
}

function resolvePetStatusLabel(status: PhoneModuleStatus): string {
  if (status === "locked") return "等待中"
  if (status === "warning") return "需要关注"
  if (status === "active") return "活动中"
  if (status === "quiet") return "恢复中"

  return "稳定"
}

function resolveButlerStatus(butler: ButlerHudData): PhoneModuleStatus {
  if (!butler.available) return "locked"

  if (butler.opportunityCount > 0) {
    return "active"
  }

  if (
    butler.taskLabel.includes("食物") ||
    butler.taskLabel.includes("恢复") ||
    butler.taskLabel.includes("靠近")
  ) {
    return "active"
  }

  if (butler.taskLabel.includes("待命")) {
    return "quiet"
  }

  return "normal"
}

function resolveButlerStatusLabel(status: PhoneModuleStatus): string {
  if (status === "locked") return "未就位"
  if (status === "active") return "有动作"
  if (status === "quiet") return "待命"

  return "运行中"
}

function resolveHomeStatus(home: HomeHudData): PhoneModuleStatus {
  if (!home.available) return "locked"

  if (home.statusLabel === "建设中") {
    return "active"
  }

  if (home.meters.progress.value >= 100) {
    return "normal"
  }

  if (home.meters.stability.tone === "warning") {
    return "warning"
  }

  return "quiet"
}

function resolveHomeStatusLabel(status: PhoneModuleStatus): string {
  if (status === "locked") return "未生成"
  if (status === "active") return "建设中"
  if (status === "warning") return "待稳定"
  if (status === "quiet") return "缓慢推进"

  return "稳定"
}

function resolveObservationStatus(
  observation: PhoneObservationModuleData
): PhoneModuleStatus {
  if (observation.totalCount <= 0) return "quiet"
  if (observation.unreadCount >= 5) return "active"

  return "normal"
}

function resolveObservationStatusLabel(status: PhoneModuleStatus): string {
  if (status === "active") return "有新记录"
  if (status === "quiet") return "暂无记录"

  return "已记录"
}

function buildPetModule(pet: PetHudData): PhonePetModuleData {
  const status = resolvePetStatus(pet)

  return {
    id: "pet",
    title: "宠物",
    subtitle: pet.available ? pet.name : "等待新的生命反应",
    status,
    statusLabel: resolvePetStatusLabel(status),
    primaryText: pet.available
      ? `${pet.actionLabel} · ${pet.moodLabel}`
      : "宠物尚未诞生。",
    secondaryText: pet.currentTendencyLabel,
    metrics: [
      {
        label: pet.meters.energy.label,
        valueLabel: pet.meters.energy.valueLabel,
        value: pet.meters.energy.value,
        meter: pet.meters.energy,
      },
      {
        label: pet.meters.hunger.label,
        valueLabel: pet.meters.hunger.valueLabel,
        value: pet.meters.hunger.value,
        meter: pet.meters.hunger,
      },
    ],
    tags: [
      pet.lifePhaseLabel,
      pet.temperamentLabel,
      ...pet.traitTags,
    ].filter(Boolean),
    routeKey: "phone.pet",
    petName: pet.name,
    actionLabel: pet.actionLabel,
    moodLabel: pet.moodLabel,
    lifePhaseLabel: pet.lifePhaseLabel,
    temperamentLabel: pet.temperamentLabel,
    currentTendencyLabel: pet.currentTendencyLabel,
  }
}

function buildButlerModule(
  butler: ButlerHudData
): PhoneButlerModuleData {
  const status = resolveButlerStatus(butler)

  return {
    id: "butler",
    title: "管家",
    subtitle: butler.available ? butler.name : "管家未就位",
    status,
    statusLabel: resolveButlerStatusLabel(status),
    primaryText: butler.taskLabel,
    secondaryText: butler.note,
    metrics: [
      {
        label: "机会",
        valueLabel: `${butler.opportunityCount}`,
        value: butler.opportunityCount,
      },
    ],
    tags: [butler.moodLabel, butler.taskLabel],
    routeKey: "phone.butler",
    butlerName: butler.name,
    taskLabel: butler.taskLabel,
    moodLabel: butler.moodLabel,
    opportunityCount: butler.opportunityCount,
  }
}

function buildHomeModule(home: HomeHudData): PhoneHomeModuleData {
  const status = resolveHomeStatus(home)

  return {
    id: "home",
    title: "家园",
    subtitle: home.available ? home.levelLabel : "家园未生成",
    status,
    statusLabel: resolveHomeStatusLabel(status),
    primaryText: home.stageLabel,
    secondaryText: `${home.statusLabel} · ${home.focusLabel}`,
    metrics: [
      {
        label: home.meters.progress.label,
        valueLabel: home.meters.progress.valueLabel,
        value: home.meters.progress.value,
        meter: home.meters.progress,
      },
      {
        label: home.meters.stability.label,
        valueLabel: home.meters.stability.valueLabel,
        value: home.meters.stability.value,
        meter: home.meters.stability,
      },
    ],
    tags: [home.statusLabel, home.stageLabel, home.focusLabel],
    routeKey: "phone.home",
    levelLabel: home.levelLabel,
    stageLabel: home.stageLabel,
    focusLabel: home.focusLabel,
  }
}

function buildObservationModule(
  observation: PhoneObservationModuleData
): PhoneObservationEntryModuleData {
  const status = resolveObservationStatus(observation)

  return {
    id: "observation",
    title: "观察",
    subtitle: observation.moduleSubtitle,
    status,
    statusLabel: resolveObservationStatusLabel(status),
    primaryText: observation.latestTitle,
    secondaryText: observation.latestSummary,
    metrics: [
      {
        label: "记录",
        valueLabel: `${observation.totalCount}`,
        value: observation.totalCount,
      },
      {
        label: "未读",
        valueLabel: `${observation.unreadCount}`,
        value: observation.unreadCount,
      },
    ],
    tags: observation.groups.slice(0, 3).map((group) => group.groupLabel),
    routeKey: "phone.observation",
    observation,
  }
}

export function buildPhoneHomeScreenModuleData(input: {
  hud: WorldHudBundle
  events: WorldEvent[]
}): PhoneHomeScreenModuleData {
  const observation = buildPhoneObservationModuleData(input.events, 20)

  return {
    screenTitle: "世界终端",
    screenSubtitle: "查看宠物、管家、家园与观察记录",
    modules: [
      buildPetModule(input.hud.pet),
      buildButlerModule(input.hud.butler),
      buildHomeModule(input.hud.home),
      buildObservationModule(observation),
    ],
  }
}