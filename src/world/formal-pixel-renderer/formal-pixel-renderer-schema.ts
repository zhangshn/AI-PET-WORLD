// 该文件定义正式像素渲染模型结构。

import type {
  WorldViewActorKind,
  WorldViewActorPose,
  WorldViewCanvas,
  WorldViewLayer,
  WorldViewObjectKind,
  WorldViewObjectSource,
  WorldViewTileKind,
  WorldViewTraceLayer,
} from "@/world/world-view-model/world-view-model-schema"
import type { TraceVisualKind } from "@/world/trace"

export type FormalPixelRenderSource = "world_view_model"

export type FormalPixelLayerKind =
  | "tile"
  | "trace"
  | "object"
  | "actor"
  | "atmosphere"

export type FormalPixelCanvas = WorldViewCanvas

export type FormalPixelTileRenderItem = {
  id: string
  layerKind: "tile"
  x: number
  y: number
  width: number
  height: number
  kind: WorldViewTileKind
  variant: number
  passable: boolean
  traceIntensity: number
  drawOrder: number
  tags: string[]
}

export type FormalPixelTraceRenderItem = {
  id: string
  layerKind: "trace"
  x: number
  y: number
  radius: number
  visualKind: Exclude<TraceVisualKind, "none">
  intensity: number
  opacity: number
  traceLayer: WorldViewTraceLayer
  drawOrder: number
  tags: string[]
}

export type FormalPixelObjectRenderItem = {
  id: string
  layerKind: "object"
  kind: WorldViewObjectKind
  source: WorldViewObjectSource
  x: number
  y: number
  worldLayer: WorldViewLayer
  scale: number
  opacity: number
  health: number
  growthStage: string
  label: string
  drawOrder: number
  tags: string[]
}

export type FormalPixelActorRenderItem = {
  id: string
  layerKind: "actor"
  kind: WorldViewActorKind
  x: number
  y: number
  worldLayer: WorldViewLayer
  pose: WorldViewActorPose
  label: string
  visible: boolean
  drawOrder: number
  tags: string[]
}

export type FormalPixelAtmosphereRenderItem = {
  id: string
  layerKind: "atmosphere"
  mood: "calm" | "warm" | "recovering" | "busy"
  weather: "clear" | "soft" | "damp"
  opacity: number
  drawOrder: number
  tags: string[]
}

export type FormalPixelTileLayer = {
  kind: "tile"
  items: FormalPixelTileRenderItem[]
  tags: string[]
}

export type FormalPixelTraceLayer = {
  kind: "trace"
  items: FormalPixelTraceRenderItem[]
  tags: string[]
}

export type FormalPixelObjectLayer = {
  kind: "object"
  items: FormalPixelObjectRenderItem[]
  tags: string[]
}

export type FormalPixelActorLayer = {
  kind: "actor"
  items: FormalPixelActorRenderItem[]
  tags: string[]
}

export type FormalPixelAtmosphereLayer = {
  kind: "atmosphere"
  items: FormalPixelAtmosphereRenderItem[]
  tags: string[]
}

export type FormalPixelRendererAudit = {
  source: FormalPixelRenderSource
  readOnly: boolean
  runtimeWrite: false
  worldFactWrite: false
  tickAdvance: false
  debugVisualLabUsed: false
  proceduralRendererUsed: false
  defaultPetGenerated: false
  visibleButlerActors: number
  visiblePetActors: number
  derivedVisualOnlyItems: number
  worldFactItems: number
  tags: string[]
}

export type FormalPixelRenderLayers = {
  tiles: FormalPixelTileLayer
  traces: FormalPixelTraceLayer
  objects: FormalPixelObjectLayer
  actors: FormalPixelActorLayer
  atmosphere: FormalPixelAtmosphereLayer
}

export type FormalPixelRenderModel = {
  worldId: string
  ownerId: string
  tick: number
  savedAt: string
  canvas: FormalPixelCanvas
  layers: FormalPixelRenderLayers
  audit: FormalPixelRendererAudit
  tags: string[]
}
