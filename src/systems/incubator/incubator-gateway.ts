/**
 * 当前文件负责：统一导出孵化器系统模块的公开入口。
 */

export { careIncubator } from "./incubator-care-runner"
export type { CareIncubatorInput } from "./incubator-care-runner"

export {
  canHatchIncubator,
  hatchIncubator,
} from "./incubator-hatch-runner"
export type { HatchIncubatorResult } from "./incubator-hatch-runner"

export { refreshIncubatorStatus } from "./incubator-status-runner"
export { updateIncubatorNaturally } from "./incubator-update-runner"
export { clampIncubatorValues } from "./incubator-value-runner"
export { clamp } from "./incubator-utils"