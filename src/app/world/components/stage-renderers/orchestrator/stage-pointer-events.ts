/**
 * 当前文件负责：绑定世界舞台指针事件。
 */

import type { Application } from "pixi.js"

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import { isPointInsideShelterStructure } from "../graphics/structures/stage-structure-hit-test"
import {
  applyStageCamera,
  beginStageCameraDrag,
  endStageCameraDrag,
  moveStageCameraDrag,
  type StageCameraState,
} from "./stage-camera-controller"
import type { WorldStageLayerRefs } from "./stage-layer-types"
import type { WorldStageSceneMode } from "./stage-scene-mode"
import { WORLD_STAGE_SIZE } from "../config/stage-size-config"

export type BindWorldStagePointerEventsInput = {
  app: Application
  camera: StageCameraState
  layers: WorldStageLayerRefs
  getRuntime: () => WorldRuntimeState | null
  getSceneMode: () => WorldStageSceneMode
  onEnterShelter?: () => void
}

type PointerDownState = {
  screenX: number
  screenY: number
  worldX: number
  worldY: number
}

const CLICK_MOVE_TOLERANCE = 6

export function bindWorldStagePointerEvents(
  input: BindWorldStagePointerEventsInput
) {
  let pointerDownState: PointerDownState | null = null

  input.app.stage.eventMode = "static"
  input.app.stage.hitArea = input.app.screen

  input.app.stage.on("pointerdown", (event) => {
    pointerDownState = {
      screenX: event.global.x,
      screenY: event.global.y,
      worldX: screenToWorldX(event.global.x, input.layers.worldLayer?.x ?? 0),
      worldY: screenToWorldY(event.global.y, input.layers.worldLayer?.y ?? 0),
    }

    if (input.getSceneMode() !== "exterior") return

    beginStageCameraDrag({
      camera: input.camera,
      pointerX: event.global.x,
      pointerY: event.global.y,
    })
  })

  input.app.stage.on("pointermove", (event) => {
    if (input.getSceneMode() !== "exterior") return

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

  input.app.stage.on("pointerup", (event) => {
    const pointerUpX = event.global.x
    const pointerUpY = event.global.y
    const downState = pointerDownState

    pointerDownState = null

    if (input.getSceneMode() !== "exterior") {
      endStageCameraDrag(input.camera)
      return
    }

    endStageCameraDrag(input.camera)

    if (!downState) return

    const movedDistance = Math.sqrt(
      (pointerUpX - downState.screenX) * (pointerUpX - downState.screenX) +
        (pointerUpY - downState.screenY) * (pointerUpY - downState.screenY)
    )

    if (movedDistance > CLICK_MOVE_TOLERANCE) return

    const hitShelter = isPointInsideShelterStructure({
      map: input.getRuntime()?.map ?? null,
      point: {
        x: downState.worldX,
        y: downState.worldY,
      },
    })

    if (hitShelter) {
      input.onEnterShelter?.()
    }
  })

  input.app.stage.on("pointerupoutside", () => {
    pointerDownState = null
    endStageCameraDrag(input.camera)
  })
}

function screenToWorldX(screenX: number, worldLayerX: number): number {
  return screenX - worldLayerX
}

function screenToWorldY(screenY: number, worldLayerY: number): number {
  return screenY - worldLayerY
}