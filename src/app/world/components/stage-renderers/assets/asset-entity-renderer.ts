/**
 * 当前文件负责：预留未来基于真实像素实体素材的运行时实体渲染入口。
 */

import type { Container } from "pixi.js"

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

export type SyncAssetRuntimeEntitiesInput = {
  layer: Container | null
  runtime: WorldRuntimeState | null
}

export function syncAssetRuntimeEntities(input: SyncAssetRuntimeEntitiesInput) {
  void input
}