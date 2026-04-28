/**
 * 当前文件负责：定义世界舞台结构渲染所需的通用类型与默认位置。
 */

export type StagePoint = {
  x: number
  y: number
}

export type StageStructureLayout = {
  tempShelter: StagePoint
  incubator: StagePoint
  homeConstruction: StagePoint
  garden: StagePoint
}

export type TileBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const TEMP_SHELTER_STAGE_POSITION: StagePoint = { x: 205, y: 235 }
export const INCUBATOR_STAGE_POSITION: StagePoint = { x: 240, y: 282 }
export const HOME_CONSTRUCTION_STAGE_POSITION: StagePoint = { x: 1040, y: 520 }
export const GARDEN_STAGE_POSITION: StagePoint = { x: 690, y: 540 }

export const TEMP_SHELTER_WIDTH = 135
export const TEMP_SHELTER_HEIGHT = 110
export const HOME_CONSTRUCTION_WIDTH = 155
export const HOME_CONSTRUCTION_HEIGHT = 110
export const GARDEN_WIDTH = 120
export const GARDEN_HEIGHT = 56