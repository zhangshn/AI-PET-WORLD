/**
 * 当前文件负责：
 * 1. 世界模拟统一入口
 * 2. 聚合 world runtime
 * 3. 推进 ecology / civilization / entity runtime
 * 4. 提供 WorldEngine 可调用的统一世界更新接口
 * 5. 后续会继续接入：
 *    - resource regeneration
 *    - creature spawn
 *    - weather evolution
 *    - npc civilization
 *    - butler construction
 */

import type { TimeState } from "../../engine/timeSystem"

import {
  createInitialWorldRuntimeState,
  stepWorldRuntime,
  type WorldRuntimeState,
} from "../runtime/world-runtime"

export type WorldSimulationInput = {
  previous?: WorldRuntimeState | null

  tick: number

  time: TimeState

  /**
   * 当前家园等级
   */
  homeLevel: number

  /**
   * 当前世界宠物数量
   */
  petCount: number

  /**
   * 世界设施状态
   */
  hasHospital: boolean
  hasShop: boolean
  hasPark: boolean
}

export type WorldSimulationResult = {
  runtime: WorldRuntimeState
}

export function runWorldSimulation(
  input: WorldSimulationInput
): WorldSimulationResult {
  /**
   * 第一次初始化世界
   */
  if (!input.previous) {
    return {
      runtime: createInitialWorldRuntimeState({
        time: input.time,
      }),
    }
  }

  /**
   * 推进世界 runtime
   */
  const runtime = stepWorldRuntime({
    previous: input.previous,

    tick: input.tick,

    time: input.time,

    homeLevel: input.homeLevel,

    petCount: input.petCount,

    hasHospital: input.hasHospital,

    hasShop: input.hasShop,

    hasPark: input.hasPark,
  })

  return {
    runtime,
  }
}