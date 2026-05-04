/**
 * 当前文件负责：封装世界 runtime 初始化、推进与生态日志输出。
 */

import type { TimeState } from "../../timeSystem"
import { runWorldSimulation } from "@/world/simulation/world-simulation"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import { logWorldEcology } from "../world-runtime-logger"

export type RunWorldRuntimeInput = {
  previous: WorldRuntimeState | null
  tick: number
  time: TimeState
  homeLevel: number
  petCount: number
  hasHospital?: boolean
  hasShop?: boolean
  hasPark?: boolean
  shouldLog?: boolean
}

export function runWorldRuntime(
  input: RunWorldRuntimeInput
): WorldRuntimeState {
  const runtime = runWorldSimulation({
    previous: input.previous,
    tick: input.tick,
    time: input.time,
    homeLevel: input.homeLevel,
    petCount: input.petCount,
    hasHospital: input.hasHospital ?? false,
    hasShop: input.hasShop ?? false,
    hasPark: input.hasPark ?? false,
  }).runtime

  if (input.shouldLog ?? true) {
    logWorldEcology(runtime)
  }

  return runtime
}