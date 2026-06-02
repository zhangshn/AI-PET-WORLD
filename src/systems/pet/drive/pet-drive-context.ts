/**
 * 当前文件负责：从 drive 输入中读取人格、意识、状态与时间上下文。
 */

import type { PersonalityTraits } from "../../../ai/destiny-core/ziwei-core/ziwei-core-schema"
import type { ConsciousnessBias } from "../../../ai/consciousness-core/consciousness/consciousness-gateway"
import type { PetState } from "../../../types/pet"
import type { DriveSystemInput } from "./pet-drive-types"
import { clamp } from "./pet-drive-score-utils"

type TimelineSnapshot = NonNullable<PetState["timelineSnapshot"]>

export function getTraits(input: DriveSystemInput): PersonalityTraits {
  return input.pet.personalityProfile.traits
}

export function getConsciousnessBias(input: DriveSystemInput): ConsciousnessBias {
  return input.pet.consciousnessProfile.bias
}

export function getSnapshot(input: DriveSystemInput): TimelineSnapshot | null {
  return input.pet.timelineSnapshot ?? null
}

export function getEnergy(input: DriveSystemInput): number {
  const snapshot = getSnapshot(input)

  return clamp(snapshot?.state.physical.energy ?? input.pet.energy ?? 50)
}

export function getHunger(input: DriveSystemInput): number {
  const snapshot = getSnapshot(input)

  return clamp(snapshot?.state.physical.hunger ?? input.pet.hunger ?? 50)
}

export function getEmotionalLabel(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input)

  return snapshot?.state.emotional.label ?? input.pet.mood ?? "normal"
}

export function getEmotionalArousal(input: DriveSystemInput): number {
  const snapshot = getSnapshot(input)

  return clamp((snapshot?.state.emotional.arousal ?? 0.5) * 100)
}

export function getCognitiveLabel(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input)

  return snapshot?.state.cognitive.label ?? "idle"
}

export function getRelationalLabel(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input)

  return snapshot?.state.relational.label ?? "neutral"
}

export function getPhaseTag(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input)

  return snapshot?.fortune.phaseTag ?? "stable_phase"
}

export function getBranchTag(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input)

  return snapshot?.trajectory.branchTag ?? "balanced"
}

export function getDriveHint(input: DriveSystemInput): string | null {
  const snapshot = getSnapshot(input)

  return snapshot?.state.drive.primary ?? null
}
