/**
 * 当前文件负责：管理世界舞台摄像机拖拽、边界限制与位置应用。
 */

import type { Container } from "pixi.js"

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

export type StageCameraState = {
  x: number
  y: number
  dragging: boolean
  lastPointerX: number
  lastPointerY: number
}

export type CreateStageCameraStateInput = {
  x?: number
  y?: number
}

export type ClampStageCameraInput = {
  camera: StageCameraState
  runtime: WorldRuntimeState | null
  stageWidth: number
  stageHeight: number
}

export type ApplyStageCameraInput = {
  camera: StageCameraState
  worldLayer: Container | null
  runtime: WorldRuntimeState | null
  stageWidth: number
  stageHeight: number
}

export type BeginStageCameraDragInput = {
  camera: StageCameraState
  pointerX: number
  pointerY: number
}

export type MoveStageCameraDragInput = {
  camera: StageCameraState
  pointerX: number
  pointerY: number
}

export function createStageCameraState(
  input: CreateStageCameraStateInput = {}
): StageCameraState {
  return {
    x: input.x ?? 0,
    y: input.y ?? 0,
    dragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
  }
}

export function applyStageCamera(input: ApplyStageCameraInput) {
  if (!input.worldLayer) return

  clampStageCamera({
    camera: input.camera,
    runtime: input.runtime,
    stageWidth: input.stageWidth,
    stageHeight: input.stageHeight,
  })

  input.worldLayer.x = input.camera.x
  input.worldLayer.y = input.camera.y
}

export function beginStageCameraDrag(input: BeginStageCameraDragInput) {
  input.camera.dragging = true
  input.camera.lastPointerX = input.pointerX
  input.camera.lastPointerY = input.pointerY
}

export function moveStageCameraDrag(input: MoveStageCameraDragInput) {
  if (!input.camera.dragging) return

  const dx = input.pointerX - input.camera.lastPointerX
  const dy = input.pointerY - input.camera.lastPointerY

  input.camera.x += dx
  input.camera.y += dy
  input.camera.lastPointerX = input.pointerX
  input.camera.lastPointerY = input.pointerY
}

export function endStageCameraDrag(camera: StageCameraState) {
  camera.dragging = false
}

export function resetStageCamera(camera: StageCameraState) {
  camera.x = 0
  camera.y = 0
  camera.dragging = false
  camera.lastPointerX = 0
  camera.lastPointerY = 0
}

function clampStageCamera(input: ClampStageCameraInput) {
  const map = input.runtime?.map

  const mapWidth = map ? map.size.width * map.tileSize : input.stageWidth
  const mapHeight = map ? map.size.height * map.tileSize : input.stageHeight

  const minX = Math.min(0, input.stageWidth - mapWidth)
  const minY = Math.min(0, input.stageHeight - mapHeight)

  input.camera.x = clampNumber(input.camera.x, minX, 0)
  input.camera.y = clampNumber(input.camera.y, minY, 0)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}