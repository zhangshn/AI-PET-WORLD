/**
 * 当前文件负责：构建宠物事件叙事系统所需的样式输入。
 */

import type { PetEventStyleInput } from "@/ai/event-style/schema"
import type { NarrativeType } from "@/types/event"
import type { HomeState } from "@/types/home"
import type { PetAction, PetMood } from "@/types/pet"
import type { PetStateLike } from "./event-schema"
import { buildHomeContextFromHomeState } from "./event-pet-context-runner"

export type BuildActionEventStyleInputEnhancements = {
  intensity?: number
  narrativeType?: NarrativeType
  continuityId?: string
  continuityStep?: number
}

export function buildActionEventStyleInput(
  pet: PetStateLike,
  nextAction: PetAction,
  home?: HomeState,
  enhancements?: BuildActionEventStyleInputEnhancements
): PetEventStyleInput {
  return {
    scene: "pet_action_changed",
    petName: pet.name,
    action: nextAction,
    personalityProfile: pet.personalityProfile,
    homeContext: buildHomeContextFromHomeState(home),
    intensity: enhancements?.intensity,
    narrativeType: enhancements?.narrativeType,
    continuityId: enhancements?.continuityId,
    continuityStep: enhancements?.continuityStep,
  } as PetEventStyleInput
}

export function buildMoodEventStyleInput(
  pet: PetStateLike,
  nextMood: PetMood,
  home?: HomeState
): PetEventStyleInput {
  return {
    scene: "pet_mood_changed",
    petName: pet.name,
    mood: nextMood,
    personalityProfile: pet.personalityProfile,
    homeContext: buildHomeContextFromHomeState(home),
  }
}