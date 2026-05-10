/**
 * 当前文件负责：统一导出家园系统模块的公开入口。
 */

export { buildHome } from "./home-build-runner"
export type { BuildHomeInput } from "./home-build-runner"

export { resolveEvolutionFocus } from "./home-evolution-runner"
export { resolveConstructionStage } from "./home-stage-runner"
export { clamp } from "./home-utils"
export { createInitialHomeSpaces } from "./home-space-builder"
export { syncHomeSpaces } from "./home-space-runner"
export { buildHomeSpaceSummary } from "./home-space-summary-runner"
export { applyButlerHomeSpaceAction } from "./home-space-action-runner"
export type { ApplyButlerHomeSpaceActionInput } from "./home-space-action-runner"
export { createInitialHomeFacilities } from "./home-facility-builder"
export { syncHomeFacilities } from "./home-facility-runner"
export { applyButlerHomeFacilityAction } from "./home-facility-action-runner"
export type {
  ApplyButlerHomeFacilityActionInput,
} from "./home-facility-action-runner"
