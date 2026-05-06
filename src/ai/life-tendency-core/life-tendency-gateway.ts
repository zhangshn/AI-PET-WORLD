/**
 * 当前文件负责：提供当前生命趋向核心统一入口。
 */

export {
  buildCurrentLifeTendencyProfile
} from "./life-tendency-composer"

export {
  buildCurrentLifeRuntimeBundle
} from "./life-runtime-bundle-gateway"

export {
  buildCurrentLifeRuntimeBundleFromWorld
} from "./life-runtime-world-gateway"

export {
  buildLifeRuntimeTimeFromWorld
} from "./life-runtime-time-adapter"

export {
  buildCurrentLifeTendencyFromRuntime
} from "./life-tendency-runtime-gateway"

export {
  buildLifeTendencyFiveDimensionScores
} from "./life-tendency-five-dimension"

export {
  clampLifeTendencyScore,
  getLifeTendencyLevel,
  getTopLifeTendencies,
  mixLifeTendencyScore
} from "./life-tendency-normalizer"

export type {
  CurrentLifeRuntimeBundle
} from "./life-runtime-bundle-schema"

export type {
  BuildCurrentLifeRuntimeBundleFromWorldInput
} from "./life-runtime-world-gateway"

export type {
  BuildLifeRuntimeTimeFromWorldInput,
  LifeRuntimeWorldStartDate,
  LifeRuntimeWorldTimeInput
} from "./life-runtime-time-adapter"

export type {
  BuildCurrentLifeTendencyProfileInput,
  CurrentLifeTendencyProfile,
  LifeTendencyFiveDimensionScores,
  LifeTendencyKey,
  LifeTendencyLabels,
  LifeTendencyLevel,
  LifeTendencyScoreInputs,
  LifeTendencyScoreItem,
  LifeTendencyScores,
  LifeTendencySourceProfile
} from "./life-tendency-schema"

export type {
  BuildCurrentLifeTendencyFromRuntimeInput,
  LifeTendencyRuntimeGender,
  LifeTendencyRuntimeTime
} from "./life-tendency-runtime-gateway"