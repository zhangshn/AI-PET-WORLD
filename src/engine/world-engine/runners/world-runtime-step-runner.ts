/**
 * 当前文件负责：封装世界 runtime 初始化与推进时的参数组装。
 */

import type { TimeState } from "../../timeSystem"
import type { PetState } from "@/types/pet"
import type { HomeState } from "@/types/home"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import { runWorldRuntime } from "./world-runtime-runner"

export type CreateWorldRuntimeInput = {
  tick: number
  time: TimeState
  home: HomeState
  petCount?: number
  shouldLog?: boolean
}

export type StepWorldRuntimeInput = {
  previous: WorldRuntimeState
  tick: number
  time: TimeState
  home: HomeState
  pet: PetState | null
  shouldLog?: boolean
}

export function createWorldRuntime(
  input: CreateWorldRuntimeInput
): WorldRuntimeState {
  return runWorldRuntime({
    previous: null,
    tick: input.tick,
    time: input.time,
    homeLevel: input.home.level,
    petCount: input.petCount ?? 0,
    shouldLog: input.shouldLog ?? false,
  })
}

export function stepWorldRuntime(
  input: StepWorldRuntimeInput
): WorldRuntimeState {
  return runWorldRuntime({
    previous: input.previous,
    tick: input.tick,
    time: input.time,
    homeLevel: input.home.level,
    petCount: input.pet ? 1 : 0,
    shouldLog: input.shouldLog,
  })
}