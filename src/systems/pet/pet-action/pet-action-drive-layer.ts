/**
 * 当前文件负责：把 drive 分数映射为候选行为权重。
 */

import type { DriveSnapshot } from "../drive/pet-drive-gateway"
import type { PetActionWeights } from "./pet-action-weight-types"

export function applyActionDriveLayer(
  driveSnapshot: DriveSnapshot,
  weights: PetActionWeights
) {
  const d = driveSnapshot.values

  weights.exploring += d.explore
  weights.walking += d.explore * 0.6

  weights.approaching += d.approach
  weights.walking += d.approach * 0.5

  weights.observing += d.observe
  weights.idle += d.observe * 0.3

  weights.alert_idle += d.avoid * 0.6
  weights.observing += d.avoid * 0.25

  weights.resting += d.rest
  weights.sleeping += d.rest * 0.7

  weights.eating += d.eat
}