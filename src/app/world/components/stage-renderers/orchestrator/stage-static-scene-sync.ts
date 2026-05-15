/**
 * 当前文件负责：同步 Graphics 舞台的静态场景重绘。
 */

import {
  drawStaticWorld,
  getStaticWorldRenderKey,
} from "../gateway/stage-renderer-gateway"
import type { SyncGraphicsStageInput } from "./graphics-stage-orchestrator"

export function redrawStaticSceneIfNeeded(input: SyncGraphicsStageInput) {
  redrawExteriorWorldIfNeeded(input)
}

function redrawExteriorWorldIfNeeded(input: SyncGraphicsStageInput) {
  const map = input.runtime?.map ?? null

  if (!map) {
    input.renderState.lastStaticWorldKey = null
    input.renderState.debugMessage = "exterior waiting: runtime.map is null"
    return
  }

  const renderKey = getStaticWorldRenderKey({
    runtime: input.runtime,
    home: input.home,
  })

  if (input.renderState.lastStaticWorldKey === renderKey) {
    input.renderState.debugMessage = `exterior skipped: same renderKey ${renderKey}`
    return
  }

  input.renderState.lastStaticWorldKey = renderKey
  input.renderState.debugMessage = `exterior redraw: ${renderKey}`

  drawStaticWorld({
    layers: {
      backgroundLayer: input.layers.backgroundLayer,
      terrainLayer: input.layers.landLayer,
      structureLayer: input.layers.structureLayer,
      natureLayer: input.layers.natureLayer,
      foregroundLayer: input.layers.foregroundLayer,
    },
    runtime: input.runtime,
    home: input.home,
    fallbackWidth: input.width,
    fallbackHeight: input.height,
  })
}
