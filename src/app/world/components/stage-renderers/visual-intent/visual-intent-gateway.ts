/**
 * 当前文件负责：统一导出像素舞台视觉意图入口。
 */

import {
  buildButlerVisualIntent,
} from "./butler-visual-intent"
import {
  buildPetVisualIntent,
} from "./pet-visual-intent"
import {
  buildWorldVisualIntent,
} from "./world-visual-intent"

import type {
  BuildStageVisualIntentSnapshotInput,
  StageVisualIntentSnapshot,
} from "./actor-visual-intent-types"

export {
  buildButlerVisualIntent,
} from "./butler-visual-intent"
export {
  buildPetVisualIntent,
} from "./pet-visual-intent"
export {
  buildWorldVisualIntent,
} from "./world-visual-intent"

export type {
  ActorVisualIntent,
  ActorVisualIntentActor,
  ActorVisualIntentEmotionTone,
  ActorVisualIntentFocusTarget,
  ActorVisualIntentMotionStyle,
  ActorVisualIntentPose,
  BuildStageVisualIntentSnapshotInput,
  BuildWorldVisualIntentInput,
  StageVisualIntentSnapshot,
  WorldVisualIntent,
  WorldVisualIntentActiveFocusArea,
  WorldVisualIntentAtmosphere,
  WorldVisualIntentHomeGrowthFocus,
  WorldVisualIntentTimeTone,
} from "./actor-visual-intent-types"

export function buildStageVisualIntentSnapshot(
  input: BuildStageVisualIntentSnapshotInput
): StageVisualIntentSnapshot {
  return {
    pet: buildPetVisualIntent(input.pet),
    butler: buildButlerVisualIntent(input.butler),
    world: buildWorldVisualIntent({
      time: input.time,
      home: input.home,
      incubator: input.incubator,
      worldRuntime: input.worldRuntime,
    }),
  }
}
