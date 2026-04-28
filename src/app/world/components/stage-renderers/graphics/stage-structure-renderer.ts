/**
 * 当前文件负责：兼容旧路径并转发家园结构渲染能力。
 */

export {
  GARDEN_STAGE_POSITION,
  HOME_CONSTRUCTION_STAGE_POSITION,
  INCUBATOR_STAGE_POSITION,
  TEMP_SHELTER_STAGE_POSITION,
  drawGarden,
  drawHomeConstruction,
  drawTempShelter,
  resolveStageStructureLayout,
  type StagePoint,
  type StageStructureLayout,
} from "./structures/stage-structure-renderer"