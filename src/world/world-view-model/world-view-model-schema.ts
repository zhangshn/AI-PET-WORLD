import type { TraceVisualKind } from "@/world/trace"

export type WorldViewTileKind =
  | "grass"
  | "pressed_grass"
  | "worn_grass"
  | "exposed_soil"
  | "ecology_transition"
  | "recovery_growth"
  | "soil"
  | "built"
  | "boundary"

export type WorldViewObjectKind =
  | "tree"
  | "bush"
  | "stone"
  | "flower"
  | "mushroom"
  | "insect_signal"
  | "structure"
  | "facility"

export type WorldViewLayer = "back" | "middle" | "front"

export type WorldViewActorKind = "butler"

export type WorldViewActorPose =
  | "observe"
  | "maintain"
  | "wait"
  | "walk"
  | "idle"

export type WorldViewTraceLayer = "ground" | "surface" | "attention"

export type WorldViewCanvas = {
  width: number
  height: number
  tileSize: number
  columns: number
  rows: number
}

export type WorldViewTile = {
  id: string
  x: number
  y: number
  width: number
  height: number
  kind: WorldViewTileKind
  variant: number
  traceIntensity: number
  traceSource: string
  passable: boolean
}

export type WorldViewObjectSource = "world_fact" | "derived_visual_only"

export type WorldViewObject = {
  id: string
  kind: WorldViewObjectKind
  x: number
  y: number
  layer: WorldViewLayer
  scale: number
  opacity: number
  health: number
  growthStage: string
  label: string
  source: WorldViewObjectSource
  tags: string[]
}

export type WorldViewTrace = {
  id: string
  visualKind: Exclude<TraceVisualKind, "none">
  x: number
  y: number
  radius: number
  intensity: number
  opacity: number
  layer: WorldViewTraceLayer
  sourceId?: string
  tags?: string[]
}

export type WorldViewActor = {
  id: string
  kind: WorldViewActorKind
  x: number
  y: number
  layer: WorldViewLayer
  pose: WorldViewActorPose
  label: string
  visible: boolean
}

export type WorldViewAtmosphere = {
  mood: "calm" | "warm" | "recovering" | "busy"
  weather: "clear" | "soft" | "damp"
  opacity: number
}

export type WorldViewModel = {
  worldId: string
  ownerId: string
  tick: number
  savedAt: string
  canvas: WorldViewCanvas
  tiles: WorldViewTile[]
  objects: WorldViewObject[]
  traces: WorldViewTrace[]
  actors: WorldViewActor[]
  atmosphere: WorldViewAtmosphere
  butlerExplanation: {
    title: string
    body: string
  }
  pPhone: {
    unreadCount: number
    latestMessageTitle: string
    latestMessageBody: string
  }
  tags: string[]
}
