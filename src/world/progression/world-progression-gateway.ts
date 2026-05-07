/**
 * 当前文件负责：统一导出世界进度系统公开入口。
 */

export { WorldProgressionSystem } from "./world-progression-system"

export type {
  WorldProgressionSystemUpdateInput,
} from "./world-progression-system"

export {
  createInitialWorldProgressionState,
  getWorldFacilityDefinition,
  WORLD_FACILITY_DEFINITIONS,
} from "./world-facility-registry"

export {
  runWorldProgression,
} from "./world-progression-runner"

export type {
  RunWorldProgressionInput,
  RunWorldProgressionResult,
} from "./world-progression-runner"

export type {
  WorldFacilityDefinition,
  WorldFacilityId,
  WorldFacilityNoticeType,
  WorldFacilityProgressState,
  WorldFacilityStatus,
  WorldProgressionNotice,
  WorldProgressionState,
} from "./world-progression-types"