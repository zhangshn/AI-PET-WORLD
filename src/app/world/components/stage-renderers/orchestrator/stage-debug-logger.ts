/**
 * 当前文件负责：输出世界舞台渲染调试日志。
 */

import type { SyncGraphicsStageInput } from "./graphics-stage-orchestrator"

let debugLogCount = 0

export function logStageDebug(input: SyncGraphicsStageInput) {
  if (debugLogCount >= 20) return

  debugLogCount += 1

  const map = input.runtime?.map ?? null

  console.info("[WORLD STAGE DEBUG]", {
    sceneMode: input.sceneMode,
    tick: input.tick,
    runtime: Boolean(input.runtime),
    map: Boolean(map),
    mapSize: map ? `${map.size.width}x${map.size.height}` : "none",
    tileSize: map?.tileSize ?? "none",
    tiles: map?.tiles.length ?? 0,
    lastStaticWorldKey: input.renderState.lastStaticWorldKey,
    worldLayer: Boolean(input.layers.worldLayer),
    backgroundLayer: Boolean(input.layers.backgroundLayer),
    landLayer: Boolean(input.layers.landLayer),
    structureLayer: Boolean(input.layers.structureLayer),
    natureLayer: Boolean(input.layers.natureLayer),
    foregroundLayer: Boolean(input.layers.foregroundLayer),
    entityLayer: Boolean(input.layers.entityLayer),
  })
}