/**
 * 当前文件负责：导出领养中心状态兼容入口。
 */

export {
  buildAdoptionStateFromIncubator,
} from "./adoption-incubator-adapter"

export type {
  AdoptionSource,
  AdoptionState,
  AdoptionStatus,
} from "./adoption-center-schema"
