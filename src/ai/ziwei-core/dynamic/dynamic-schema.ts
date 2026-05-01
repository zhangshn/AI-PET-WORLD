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
   */
  palace: BranchPalace

  /**
   * 当前 palace 在动态重排后的宫名。
   */
  sectorName: SectorName

  /**
   * 当前动态命宫重排后的：地支 -> 十二宫。
   */
  dynamicBranchToSectorMap: Record<BranchPalace, SectorName>

  /**
   * 当前动态命宫重排后的：十二宫 -> 地支。
   */
  dynamicSectorToBranchMap: Record<SectorName, BranchPalace>

  stars: StarId[]
  pairIds: string[]

  /**
   * 该动态层对当前影响的权重。
   *
   * 注意：
   * 未起运时 daYun 的 influence 必须是 0。
   */
  influence: number

  /**
   * 当前流是否已经在时间上生效。
   *
   * 例如：
   * - natal 永远生效
   * - daYun 必须 currentAge >= startAge 才生效
   */
  isActive: boolean

  /**
   * 如果当前流被请求但还未生效，用于 UI 解释。
   */
  inactiveReason?: string
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
    currentAge: number
    isDaYunStarted: boolean
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