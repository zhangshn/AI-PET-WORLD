import type { PixelAnchor, PixelLayerKind } from "@/world/pixel-primitives"
import type { WorldViewModel, WorldViewObjectKind } from "@/world/world-view-model"

export type VisualGenerationPixelBlock = {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  layer: PixelLayerKind
  stateTags: string[]
}

export type VisualObjectRecipe = {
  recipeId: string
  recipeVersion: string
  sourceObjectId: string
  kind: WorldViewObjectKind
  anchor: PixelAnchor
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  blocks: VisualGenerationPixelBlock[]
  deterministicKey: string
  stateTags: string[]
}

export type VisualGenerationAudit = {
  ok: boolean
  warnings: string[]
  tags: string[]
}

export type VisualGenerationObjectMigration = {
  blockEnabledKinds: WorldViewObjectKind[]
  markerFallbackKinds: WorldViewObjectKind[]
  blockEnabledObjectCount: number
  markerFallbackObjectCount: number
  tags: string[]
}

export type VisualGenerationPlan = {
  worldId: string
  tick: number
  deterministicKey: string
  objectRecipes: VisualObjectRecipe[]
  objectMigration: VisualGenerationObjectMigration
  actorSpriteFrames: []
  traceVisuals: []
  atmosphereVisuals: []
  audit: VisualGenerationAudit
  tags: string[]
}

export type VisualGenerationInput = {
  worldViewModel: WorldViewModel
}
