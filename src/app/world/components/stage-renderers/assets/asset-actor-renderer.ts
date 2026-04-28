/**
 * 当前文件负责：预留未来基于真实像素角色素材的核心角色渲染入口。
 */

import type { Container } from "pixi.js"

import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

export type SyncAssetCoreActorsInput = {
  layer: Container | null
  pet: PetState | null
  butler: ButlerState | null
  incubator: IncubatorState | null
}

export function syncAssetCoreActors(input: SyncAssetCoreActorsInput) {
  void input
}