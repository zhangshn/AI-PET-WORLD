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
      message: `${butlerName}正在照看孵化器，孵化进度 +${progressAdded}，稳定度 +${stabilityAdded}。`,
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

  console.log("世界引擎：宠物已通过 LifeProfile 核心完成出生数据构建并绑定。", {
    petName: input.petName,
    birthInput,
    gender: genderResult,
    mode: lifeProfile.mode,
    genderPerspective: lifeProfile.genderPerspective,
    publicPersonality: lifeProfile.publicPersonalityView,
    bazi: lifeProfile.baziProfile,
    interpretation: lifeProfile.personalityInterpretationProfile.summary,
    behaviorBias: lifeProfile.genderAwareBehaviorBias,
    summaries: lifeProfile.ziweiProfile?.summaries ?? [],
    traits: lifeProfile.ziweiProfile?.traits ?? null,
    consciousness: lifeProfile.consciousnessProfile,
    timelinePhase: createdPet?.timelineSnapshot?.fortune.phaseTag,
    timelineBranch: createdPet?.timelineSnapshot?.trajectory.branchTag,
    timelineEmotion: createdPet?.timelineSnapshot?.state.emotional.label,
    timelineDrive: createdPet?.timelineSnapshot?.state.drive.primary,
    lifeState: createdPet?.lifeState,
  })
}

function handleHomeBuilding(input: RunManagementInteractionsInput) {
  const butlerName = input.butler.name

  if (input.butler.task !== "building_home") return

  const homeBefore = input.homeSystem.getHome()

  if (homeBefore.status === "completed") return

  input.homeSystem.build(
    15,
    input.petSystem.getPet()?.lifeProfile.genderAwareBehaviorBias ??
      input.butler.lifeProfile?.genderAwareBehaviorBias ??
      null
  )

  const homeAfter = input.homeSystem.getHome()
  const progressAdded = Math.round(homeAfter.progress - homeBefore.progress)

  if (progressAdded > 0) {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message: `${butlerName}推进了家园建造，进度 +${progressAdded}，当前阶段：${homeAfter.constructionStage}。`,
    })
  }

  if (homeAfter.status === "completed") {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message: "家园第一阶段建造完成了。",
    })
  }
}