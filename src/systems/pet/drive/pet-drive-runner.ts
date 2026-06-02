/**
 * 当前文件负责：编排宠物 drive 系统的各层计算，并输出当前主导 drive。
 */

import type {
  DriveSnapshot,
  DriveSystemInput,
} from "./pet-drive-types"

import {
  createEmptyReasons,
  createEmptyScores,
} from "./pet-drive-score-utils"

import {
  applyConsciousnessLayer,
  applyTraitBaseLayer,
} from "./pet-drive-base-layers"

import {
  applyDriveMemoryLayer,
} from "./pet-drive-memory-layer"

import {
  applyLifeTendencyLayer,
} from "./pet-drive-life-tendency-layer"

import {
  applyCognitionDriveLayer,
} from "./pet-drive-cognition-layer"

import {
  applyCrossDriveSuppression,
  applyEmotionAndRelationLayer,
  applyExternalStimuliLayer,
  applyDriveHintLayer,
  applyPhysicalLayer,
  applyRhythmLayer,
} from "./pet-drive-state-layers"

import {
  buildDriveSummary,
  chooseDominantDrive,
  normalizeDriveScores,
} from "./pet-drive-finalize-runner"

export class DriveSystem {
  compute(input: DriveSystemInput): DriveSnapshot {
    const scores = createEmptyScores()
    const reasons = createEmptyReasons()

    const context = {
      input,
      scores,
      reasons,
    }

    applyTraitBaseLayer(context)
    applyConsciousnessLayer(context)
    applyDriveMemoryLayer(context)

    /**
     * 生命趋向层只做底层偏移。
     * 它不能直接决定 action，也不能覆盖饥饿、疲劳等生理优先级。
     */
    applyLifeTendencyLayer(context)

    /**
     * 认知层只影响 drive。
     * 世界刺激不能直接推行为，只能先转成主体内部驱动变化。
     */
    applyCognitionDriveLayer(context)

    applyPhysicalLayer(context)
    applyEmotionAndRelationLayer(context)
    applyRhythmLayer(context)
    applyDriveHintLayer(context)
    applyExternalStimuliLayer(context)
    applyCrossDriveSuppression(context)

    normalizeDriveScores(scores)

    const { dominant, dominantScore } = chooseDominantDrive(scores)

    const snapshot: DriveSnapshot = {
      values: scores,
      dominant,
      dominantScore,
      reasons,
      summary: "",
    }

    snapshot.summary = buildDriveSummary(snapshot)

    return snapshot
  }
}

export const driveSystem = new DriveSystem()

export default driveSystem

export type {
  DriveScores,
  DriveSnapshot,
  DriveSystemInput,
  DriveType,
} from "./pet-drive-types"
