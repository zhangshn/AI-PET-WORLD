/**
 * 当前文件负责：处理管家照看孵化器、宠物出生与家园建造等管理交互。
 */

import {
  buildLifePersonalityProfile,
  buildPetTimelineSnapshot,
} from "@/ai/gateway"

import { resolvePetBirthGender } from "@/systems/pet/pet-gateway"

import type { TimeState } from "../../timeSystem"
import type { ButlerState } from "@/types/butler"

import type {
  PetSystem,
  ButlerSystem,
  EventSystem,
  HomeSystem,
  IncubatorSystem,
} from "@/systems/systems-gateway"

import { runHomeConstruction } from "../world-engine-gateway"
import { logPetBirthProfile } from "../world-runtime-logger"

export type RunManagementInteractionsInput = {
  tick: number
  time: TimeState
  butler: ButlerState
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  incubatorSystem: IncubatorSystem
  homeSystem: HomeSystem
  eventSystem: EventSystem
}

export function runManagementInteractions(
  input: RunManagementInteractionsInput
) {
  handleIncubatorCare(input)
  handleHomeBuilding(input)
}

function handleIncubatorCare(input: RunManagementInteractionsInput) {
  const butlerName = input.butler.name

  if (input.butler.task !== "watching_incubator") return
  if (input.petSystem.hasPet()) return

  const before = input.incubatorSystem.getIncubator()

  input.incubatorSystem.care(12, 6)

  const after = input.incubatorSystem.getIncubator()

  const progressAdded = after.progress - before.progress
  const stabilityAdded = after.stability - before.stability

  if (progressAdded > 0 || stabilityAdded > 0) {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message:
        `${butlerName}正在照看孵化器，` +
        `孵化进度 +${progressAdded}，稳定度 +${stabilityAdded}。`,
      payload: {
        interactionKind: "incubator_care",
        butlerName,
        progressAdded,
        stabilityAdded,
      },
    })
  }

  if (!input.incubatorSystem.canHatch()) return

  const petName = input.incubatorSystem.hatch()

  if (!petName) return

  hatchPetWithLifeProfile({
    ...input,
    petName,
  })
}

function hatchPetWithLifeProfile(
  input: RunManagementInteractionsInput & {
    petName: string
  }
) {
  const now = new Date()

  const birthInput = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  }

  const genderResult = resolvePetBirthGender({
    petName: input.petName,
    birthInput,
    tick: input.tick,
    worldTime: {
      day: input.time.day,
      hour: input.time.hour,
      period: input.time.period,
    },
  })

  const lifeProfile = buildLifePersonalityProfile({
    subjectType: "pet",
    birthInput,
    genderPerspective: genderResult.genderPerspective,
    hasBirthHour: true,
  })

  const timelineSnapshot = buildPetTimelineSnapshot({
    day: input.time.day,
    hour: input.time.hour,
    period: input.time.period,
  })

  input.petSystem.hatchPetWithLifeProfileBundle({
    name: input.petName,
    genderPerspective: genderResult.genderPerspective,
    lifeProfile,
    timelineSnapshot,
  })

  input.eventSystem.addPetHatchedEvent({
    tick: input.tick,
    day: input.time.day,
    hour: input.time.hour,
    petName: input.petName,
  })

  const createdPet = input.petSystem.getPet()

  logPetBirthProfile({
    petName: input.petName,
    birthInput,
    gender: genderResult,
    lifeProfile,
    createdPet,
    time: input.time,
  })
}

function handleHomeBuilding(input: RunManagementInteractionsInput) {
  if (input.butler.task !== "building_home") return

  const butlerName = input.butler.name
  const result = runHomeConstruction({
    homeSystem: input.homeSystem,
    pet: input.petSystem.getPet(),
    butler: input.butler,
  })

  if (result.didBuild) {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message:
        `${butlerName}推进了家园建造，` +
        `投入 ${result.buildAmount}，进度 +${result.progressAdded}，` +
        `当前阶段：${result.currentHome.constructionStage}。`,
      payload: {
        interactionKind: "home_construction",
        butlerName,
        buildAmount: result.buildAmount,
        progressAdded: result.progressAdded,
        constructionStage: result.currentHome.constructionStage,
        completed: result.completed,
      },
    })
  }

  if (result.completed) {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message: "家园第一阶段建造完成了。",
      payload: {
        interactionKind: "home_completed",
        level: result.currentHome.level,
        constructionStage: result.currentHome.constructionStage,
      },
    })
  }
}