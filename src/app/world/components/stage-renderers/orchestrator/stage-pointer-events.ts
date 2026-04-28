/**
 * 当前文件负责：绑定世界舞台指针事件。
 */

import type { Application } from "pixi.js"

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import {
  applyStageCamera,
  beginStageCameraDrag,
  endStageCameraDrag,
  moveStageCameraDrag,
  type StageCameraState,
} from "./stage-camera-controller"
import type { WorldStageLayerRefs } from "./stage-layer-types"
import { WORLD_STAGE_SIZE } from "../config/stage-size-config"

export type BindWorldStagePointerEventsInput = {
  app: Application
  camera: StageCameraState
  layers: WorldStageLayerRefs
  getRuntime: () => WorldRuntimeState | null
}

export function bindWorldStagePointerEvents(
  input: BindWorldStagePointerEventsInput
) {
  input.app.stage.eventMode = "static"
  input.app.stage.hitArea = input.app.screen

  input.app.stage.on("pointerdown", (event) => {
    beginStageCameraDrag({
      camera: input.camera,
      pointerX: event.global.x,
      pointerY: event.global.y,
    })
  })

  input.app.stage.on("pointermove", (event) => {
    moveStageCameraDrag({
      camera: input.camera,
      pointerX: event.global.x,
      pointerY: event.global.y,
    })

    applyStageCamera({
      camera: input.camera,
      worldLayer: input.layers.worldLayer,
      runtime: input.getRuntime(),
      stageWidth: WORLD_STAGE_SIZE.width,
      stageHeight: WORLD_STAGE_SIZE.height,
    })
  })

  input.app.stage.on("pointerup", () => {
    endStageCameraDrag(input.camera)
  })

  input.app.stage.on("pointerupoutside", () => {
    endStageCameraDrag(input.camera)
  })
}