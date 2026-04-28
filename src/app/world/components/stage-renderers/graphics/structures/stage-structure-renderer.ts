/**
 * 当前文件负责：聚合导出家园结构渲染能力。
 */

export {
  GARDEN_STAGE_POSITION,
  HOME_CONSTRUCTION_STAGE_POSITION,
  INCUBATOR_STAGE_POSITION,
  TEMP_SHELTER_STAGE_POSITION,
  type StagePoint,
  type StageStructureLayout,
} from "./structure-types"
export { resolveStageStructureLayout } from "./structure-layout-resolver"
export { drawTempShelter } from "./temp-shelter-renderer"
export { drawHomeConstruction } from "./home-construction-renderer"
export { drawGarden } from "./garden-renderer"