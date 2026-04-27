/**
 * 当前文件负责：封装宠物对世界刺激的认知处理，并生成可能的行为过程。
 */

import {
  buildPetBehaviorProcess,
  buildPetStimulusCognition,
} from "../../../ai/gateway"

import type { WorldStimulus } from "../../../ai/gateway"
import type { PetCognitionRecord } from "../../../types/cognition"
import type { PetState } from "../../../types/pet"

export type PetStimulusPerceptionTime = {
  day: number
  hour: number
  period?: string
}

export type RunPetStimulusPerceptionInput = {
  pet: PetState
  currentTick: number
  stimuli: WorldStimulus[]
  time: PetStimulusPerceptionTime
}

export type RunPetStimulusPerceptionResult = {
  pet: PetState
  records: PetCognitionRecord[]
}

export function runPetStimulusPerception(
  input: RunPetStimulusPerceptionInput
): RunPetStimulusPerceptionResult {
  if (!input.pet.timelineSnapshot || input.stimuli.length === 0) {
    return {
      pet: input.pet,
      records: [],
    }
  }

  let nextPet = input.pet
  const records: PetCognitionRecord[] = []

  for (const stimulus of input.stimuli) {
    const timelineSnapshot = nextPet.timelineSnapshot

    if (!timelineSnapshot) {
      break
    }

    const cognition = buildPetStimulusCognition({
      stimulus,
      personalityTraits: {
        ...(nextPet.personalityProfile.traits as Record<string, number>),
        ...nextPet.finalPersonalityProfile.vector,
      },
      consciousness: {
        caution: nextPet.consciousnessProfile.bias.riskTolerance <= 40 ? 80 : 40,
        curiosity: nextPet.finalPersonalityProfile.vector.curiosity,
        sociability: nextPet.personalityProfile.traits.social ?? 50,
        emotionalSensitivity: nextPet.finalPersonalityProfile.vector.sensitivity,
        environmentalAwareness:
          nextPet.finalPersonalityProfile.vector.sensoryDepth,
      },
      currentState: {
        energy: nextPet.energy,
        hunger: nextPet.hunger,
        emotionalStability: resolveEmotionalStability(
          timelineSnapshot.state.emotional.label
        ),
      },
    })

    const record: PetCognitionRecord = {
      ...cognition,
      tick: input.currentTick,
      day: input.time.day,
      hour: input.time.hour,
    }

    nextPet = {
      ...nextPet,
      latestCognition: record,
      recentCognition: pushLimited(nextPet.recentCognition, record, 12),
    }

    records.push(record)

    if (!nextPet.activeBehaviorProcess) {
      const process = buildPetBehaviorProcess({
        tick: input.currentTick,
        cognition: record,
        currentAction: nextPet.action,
        energy: nextPet.energy,
        hunger: nextPet.hunger,
      })

      if (process) {
        nextPet = {
          ...nextPet,
          activeBehaviorProcess: process,
        }
      }
    }
  }

  return {
    pet: nextPet,
    records,
  }
}

function resolveEmotionalStability(label: string): number {
  if (label === "relaxed" || label === "content") return 78
  if (label === "anxious" || label === "irritated") return 32

  return 55
}

function pushLimited<T>(list: T[], item: T, max: number): T[] {
  const next = [...list, item]

  if (next.length <= max) return next

  return next.slice(next.length - max)
}