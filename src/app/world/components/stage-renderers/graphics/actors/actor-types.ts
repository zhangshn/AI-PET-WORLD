/**
 * 当前文件负责：定义舞台核心角色渲染相关类型。
 */

import type { Container, Graphics, Text } from "pixi.js"

import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

export type ActorMotionState = {
  x: number
  y: number
  targetX: number
  targetY: number
  speed: number
}

export type ActorVisualState = {
  container: Container
  graphic: Graphics
  label: Text
}

export type CoreActorVisualRegistry = {
  incubator: Graphics | null
  pet: ActorVisualState | null
  butler: ActorVisualState | null
}

export type CreateCoreActorsInput = {
  layer: Container
  registry: CoreActorVisualRegistry
}

export type SyncCoreActorsInput = {
  registry: CoreActorVisualRegistry
  pet: PetState | null
  butler: ButlerState | null
  incubator: IncubatorState | null
  ecology: WorldEcologyState | null
  tick: number
  phase: number
  petMotion: ActorMotionState
  butlerMotion: ActorMotionState
}