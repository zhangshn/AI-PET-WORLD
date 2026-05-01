/**
 * 当前文件负责：定义紫微动态运势层的数据结构。
 */

import type {
  BranchPalace,
  SectorName,
  StarId
} from "../schema"

export type ZiweiGender = "male" | "female"

export type ZiweiCycleDirection = "forward" | "backward"

export type ZiweiFlowType =
  | "natal"
  | "daYun"
  | "liuNian"
  | "liuYue"
  | "liuRi"
  | "liuShi"

export type ZiweiDynamicInputErrorCode =
  | "missing_gender"
  | "invalid_gender"

export type ZiweiDynamicPositionBias =
  | "near_incubator"
  | "near_nest"
  | "near_door"
  | "near_desk"
  | "patrol_room"

export type ZiweiObservationDistance = "close" | "medium" | "distant"

export type ZiweiToneBias =
  | "gentle"
  | "rational"
  | "concise"
  | "protective"
  | "curious"

export interface ZiweiFlowResult {
  type: ZiweiFlowType

  /**
   * 当前动态流的命宫落点。
   *
   * 例：
   * - natal：本命命宫
   * - daYun：大运命宫
   * - liuNian：流年命宫
   * - liuYue：流月命宫
   * - liuRi：流日命宫
   * - liuShi：流时命宫
   */
  palace: BranchPalace

  /**
   * 当前 palace 在动态重排后的宫名。
   * 正常情况下会是 life。
   */
  sectorName: SectorName

  /**
   * 当前动态命宫重排后的：地支 -> 十二宫。
   *
   * 注意：
   * 星曜仍然固定在原生地支盘上。
   * 变的是“宫名”，不是星曜位置。
   */
  dynamicBranchToSectorMap: Record<BranchPalace, SectorName>

  /**
   * 当前动态命宫重排后的：十二宫 -> 地支。
   */
  dynamicSectorToBranchMap: Record<SectorName, BranchPalace>

  stars: StarId[]
  pairIds: string[]
  influence: number
}

export interface ZiweiDynamicChart {
  natal: ZiweiFlowResult
  daYun: ZiweiFlowResult
  liuNian: ZiweiFlowResult
  liuYue: ZiweiFlowResult
  liuRi: ZiweiFlowResult
  liuShi: ZiweiFlowResult
  debug: {
    direction: ZiweiCycleDirection
    startAge: number
  }
}

export interface ZiweiDynamicInfluence {
  careBias: number
  observeBias: number
  protectBias: number
  exploreBias: number
  recordBias: number
  routineBias: number
  repairBias: number
  boundaryBias: number

  positionBias: ZiweiDynamicPositionBias
  observationDistance: ZiweiObservationDistance
  toneBias: ZiweiToneBias

  currentPhaseLabel: string
  currentFocusLabel: string

  debug: {
    activeFlows: ZiweiFlowResult[]
    topBiases: string[]
  }
}

export interface ZiweiDynamicInputError {
  ok: false
  code: ZiweiDynamicInputErrorCode
  message: string
}

export type ZiweiDynamicResult<T> =
  | {
      ok: true
      data: T
    }
  | ZiweiDynamicInputError