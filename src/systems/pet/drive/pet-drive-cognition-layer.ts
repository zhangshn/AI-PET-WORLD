/**
 * 当前文件负责：把宠物最新认知结果轻量映射到 drive 分数。
 */

import type {
  PetCognitionRecord,
} from "../../../types/cognition"

import type {
  DriveLayerContext,
  DriveType,
} from "./pet-drive-types"

import {
  addScore,
} from "./pet-drive-score-utils"

import {
  COGNITION_INTERPRETATION_DRIVE_TUNING,
  COGNITION_REACTION_DRIVE_TUNING,
} from "./pet-drive-tuning"

function clampLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value))
}

function readCognitionLevel(
  cognition: PetCognitionRecord,
  field: "curiosityLevel" | "stressLevel" | "safetyFeeling" | undefined
): number {
  if (!field) {
    return 0
  }

  return clampLevel(cognition[field])
}

function applyTuningItem(params: {
  context: DriveLayerContext
  cognition: PetCognitionRecord
  drive: DriveType
  base: number
  levelField?: "curiosityLevel" | "stressLevel" | "safetyFeeling"
  levelFactor?: number
  reason: string
}) {
  const level = readCognitionLevel(
    params.cognition,
    params.levelField
  )

  const score = params.base + level * (params.levelFactor ?? 0)

  addScore(
    params.context.scores,
    params.context.reasons,
    params.drive,
    score,
    `${params.reason}（${params.cognition.summary}）`
  )
}

function applyReactionTuning(
  context: DriveLayerContext,
  cognition: PetCognitionRecord
) {
  const tuning =
    COGNITION_REACTION_DRIVE_TUNING[cognition.reactionTendency]

  for (const [drive, item] of Object.entries(tuning)) {
    if (!item) continue

    applyTuningItem({
      context,
      cognition,
      drive: drive as DriveType,
      base: item.base,
      levelField: item.levelField,
      levelFactor: item.levelFactor,
      reason: item.reason,
    })
  }
}

function applyInterpretationTuning(
  context: DriveLayerContext,
  cognition: PetCognitionRecord
) {
  const tuning =
    COGNITION_INTERPRETATION_DRIVE_TUNING[cognition.interpretation]

  for (const [drive, item] of Object.entries(tuning)) {
    if (!item) continue

    applyTuningItem({
      context,
      cognition,
      drive: drive as DriveType,
      base: item.base,
      reason: item.reason,
    })
  }
}

export function applyCognitionDriveLayer(
  context: DriveLayerContext
) {
  const cognition = context.input.pet.latestCognition

  if (!cognition) {
    return
  }

  applyReactionTuning(context, cognition)
  applyInterpretationTuning(context, cognition)
}