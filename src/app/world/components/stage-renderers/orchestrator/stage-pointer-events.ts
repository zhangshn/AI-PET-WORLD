/**
 * 当前文件负责：绑定世界舞台指针事件。
 */

import type { Application } from "pixi.js"

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import {
  isPointInsideStageRect,
  SHELTER_INTERIOR_DOOR_HIT_BOX,
} from "../graphics/interior/interior-hit-areas"
import {
  createStageClickFeedback,
  type StageClickFeedbackKind,
} from "../graphics/feedback/stage-click-feedback-renderer"
import { isPointInsideShelterStructure } from "../graphics/structures/stage-structure-hit-test"
import { resolveStageStructureLayout } from "../graphics/structures/structure-layout-resolver"
import { WORLD_STAGE_SIZE } from "../config/stage-size-config"
import {
  applyStageCamera,
  beginStageCameraDrag,
  endStageCameraDrag,
  moveStageCameraDrag,
  type StageCameraState,
} from "./stage-camera-controller"
import type { GraphicsStageRenderState } from "./graphics-stage-orchestrator"
import type { WorldStageLayerRefs } from "./stage-layer-types"
import type { WorldStageSceneMode } from "./stage-scene-mode"

export type BindWorldStagePointerEventsInput = {
  app: Application
  camera: StageCameraState
  layers: WorldStageLayerRefs
  renderState: GraphicsStageRenderState
  getRuntime: () => WorldRuntimeState | null
  getHome: () => HomeState | null
  getIncubator: () => IncubatorState | null
  getPet: () => PetState | null
  getSceneMode: () => WorldStageSceneMode
  onEnterShelter?: () => void
  onExitShelter?: () => void
}

type PointerDownState = {
  screenX: number
  screenY: number
  worldX: number
  worldY: number
}

const CLICK_MOVE_TOLERANCE = 6
const FEEDBACK_MAX_COUNT = 8

export function bindWorldStagePointerEvents(
  input: BindWorldStagePointerEventsInput
) {
  let pointerDownState: PointerDownState | null = null

  input.app.stage.eventMode = "static"
  input.app.stage.hitArea = input.app.screen

  input.app.stage.on("pointerdown", (event) => {
    const sceneMode = input.getSceneMode()

    pointerDownState = {
      screenX: event.global.x,
      screenY: event.global.y,
      worldX: screenToWorldX(
        event.global.x,
        input.layers.worldLayer?.x ?? 0,
        input.layers.worldLayer?.scale.x ?? 1
      ),
      worldY: screenToWorldY(
        event.global.y,
        input.layers.worldLayer?.y ?? 0,
        input.layers.worldLayer?.scale.y ?? 1
      ),
    }

    if (sceneMode !== "exterior") return

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
    const sceneMode = input.getSceneMode()

    pointerDownState = null
    endStageCameraDrag(input.camera)

    if (!downState) return

    const movedDistance = Math.sqrt(
      (pointerUpX - downState.screenX) * (pointerUpX - downState.screenX) +
        (pointerUpY - downState.screenY) * (pointerUpY - downState.screenY)
    )

    if (movedDistance > CLICK_MOVE_TOLERANCE) return

    if (sceneMode === "shelterInterior") {
      if (
        isPointInsideStageRect(
          {
            x: downState.worldX,
            y: downState.worldY,
          },
          SHELTER_INTERIOR_DOOR_HIT_BOX
        )
      ) {
        pushClickFeedback({
          input,
          kind: "shelter_exit",
          screenX: SHELTER_INTERIOR_DOOR_HIT_BOX.x +
            SHELTER_INTERIOR_DOOR_HIT_BOX.width / 2,
          screenY: SHELTER_INTERIOR_DOOR_HIT_BOX.y + 18,
        })
        input.onExitShelter?.()
      }

      return
    }

    const exteriorFeedback = resolveExteriorClickFeedback({
      input,
      worldX: downState.worldX,
      worldY: downState.worldY,
    })

    if (exteriorFeedback) {
      pushClickFeedback({
        input,
        kind: exteriorFeedback.kind,
        screenX: exteriorFeedback.screenX,
        screenY: exteriorFeedback.screenY,
      })
    }

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

function resolveExteriorClickFeedback(input: {
  input: BindWorldStagePointerEventsInput
  worldX: number
  worldY: number
}): {
  kind: StageClickFeedbackKind
  screenX: number
  screenY: number
} | null {
  const runtime = input.input.getRuntime()
  const layout = resolveStageStructureLayout(runtime?.map ?? null)
  const home = input.input.getHome()
  const incubator = input.input.getIncubator()
  const pet = input.input.getPet()
  const worldPoint = {
    x: input.worldX,
    y: input.worldY,
  }

  const incubatorFocus = {
    x: layout.tempShelter.x + 68,
    y: layout.tempShelter.y + 32,
  }

  if (
    !pet &&
    incubator?.status !== "hatched" &&
    isPointInsideStageRect(worldPoint, {
      x: incubatorFocus.x - 28,
      y: incubatorFocus.y - 34,
      width: 56,
      height: 58,
    })
  ) {
    return {
      kind: "incubator_focus",
      ...worldToScreenPoint({
        input: input.input,
        worldX: incubatorFocus.x,
        worldY: incubatorFocus.y,
      }),
    }
  }

  const gardenFocus = {
    x: layout.garden.x + 62,
    y: layout.garden.y - 10,
  }

  if (
    (home?.constructionStage === "garden" ||
      home?.constructionStage === "completed") &&
    isPointInsideStageRect(worldPoint, {
      x: gardenFocus.x - 34,
      y: gardenFocus.y - 24,
      width: 68,
      height: 52,
    })
  ) {
    return {
      kind: "garden_observe",
      ...worldToScreenPoint({
        input: input.input,
        worldX: gardenFocus.x,
        worldY: gardenFocus.y,
      }),
    }
  }

  const hitShelter = isPointInsideShelterStructure({
    map: runtime?.map ?? null,
    point: worldPoint,
  })

  if (hitShelter) {
    return {
      kind: "shelter_entry",
      ...worldToScreenPoint({
        input: input.input,
        worldX: layout.tempShelter.x + 67,
        worldY: layout.tempShelter.y + 108,
      }),
    }
  }

  return null
}

function pushClickFeedback(input: {
  input: BindWorldStagePointerEventsInput
  kind: StageClickFeedbackKind
  screenX: number
  screenY: number
}) {
  input.input.renderState.clickFeedbacks.push(
    createStageClickFeedback({
      kind: input.kind,
      x: input.screenX,
      y: input.screenY,
      nowMs: getNowMs(),
    })
  )

  if (input.input.renderState.clickFeedbacks.length > FEEDBACK_MAX_COUNT) {
    input.input.renderState.clickFeedbacks.splice(
      0,
      input.input.renderState.clickFeedbacks.length - FEEDBACK_MAX_COUNT
    )
  }
}

function worldToScreenPoint(input: {
  input: BindWorldStagePointerEventsInput
  worldX: number
  worldY: number
}): {
  screenX: number
  screenY: number
} {
  const worldLayer = input.input.layers.worldLayer
  const scaleX = worldLayer?.scale.x ?? 1
  const scaleY = worldLayer?.scale.y ?? 1

  return {
    screenX: input.worldX * scaleX + (worldLayer?.x ?? 0),
    screenY: input.worldY * scaleY + (worldLayer?.y ?? 0),
  }
}

function getNowMs(): number {
  return globalThis.performance?.now() ?? Date.now()
}

function screenToWorldX(
  screenX: number,
  worldLayerX: number,
  worldLayerScaleX: number
): number {
  return (screenX - worldLayerX) / worldLayerScaleX
}

function screenToWorldY(
  screenY: number,
  worldLayerY: number,
  worldLayerScaleY: number
): number {
  return (screenY - worldLayerY) / worldLayerScaleY
}
