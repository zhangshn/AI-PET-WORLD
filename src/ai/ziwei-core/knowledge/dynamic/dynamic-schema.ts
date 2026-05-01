/**
 * 当前文件负责：定义紫微动态运势层的数据结构。
 */

import type { BranchPalace, StarId } from "../schema"

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
  palace: BranchPalace
  sectorName: string
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