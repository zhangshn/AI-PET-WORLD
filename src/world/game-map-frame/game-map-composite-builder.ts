import type {
  GameMapFrame,
  GameMapLayerRegion,
  GameMapObjectLayerItem,
} from "./game-map-frame-schema"
import { polygonBounds } from "./game-map-geometry"
import type {
  GameMapCompositeChunkKind,
  GameMapCompositeManifest,
  GameMapCompositeTileChunk,
  GameMapPainterInputKind,
  GameMapVisualUnitKind,
  GameMapVisualUnitSlot,
} from "./game-map-composite-schema"
import { validateGameMapCompositeManifest } from "./game-map-composite-schema"

export type GameMapCompositeBuildResult = {
  passed: boolean
  manifest: GameMapCompositeManifest | null
  blockedReasons: string[]
  tags: string[]
}

export function buildGameMapCompositeManifest(
  frame: GameMapFrame
): GameMapCompositeBuildResult {
  const terrainChunks = frame.terrainLayer.regions.map((region, index) =>
    regionToTileChunk(frame, region, "terrain", region.kind === "path_ground" ? "path_region" : "terrain_region", index)
  )
  const objectChunks = frame.objectLayer.objects.map((object, index) =>
    objectToTileChunk(frame, object, index)
  )
  const walkableChunks = frame.walkableLayer.regions.map((region, index) =>
    regionToTileChunk(frame, region, "walkable", "walkable_region", index)
  )
  const collisionChunks = frame.collisionLayer.regions.map((region, index) =>
    regionToTileChunk(frame, region, "collision", "collision_region", index)
  )
  const interactionChunks = frame.interactionLayer.items.map((item, index) => ({
    chunkId: `chunk-interaction-${item.id}`,
    layer: "interaction" as const,
    kind: "interaction_region" as const,
    sourceId: item.sourceObjectId,
    sourceFactIds: frame.sourceFactIds,
    bounds: item.bounds,
    zIndex: 500 + index,
    canRepeat: false,
    requiresAiPainterMaterial: false,
  }))

  const visualUnitSlots = [
    ...frame.terrainLayer.regions.flatMap((region, index) =>
      regionToVisualUnitSlots(frame, region, index)
    ),
    ...frame.objectLayer.objects.map((object, index) =>
      objectToVisualUnitSlot(frame, object, index)
    ),
  ]

  const manifest: GameMapCompositeManifest = {
    schemaVersion: "game-map-composite-manifest-v1",
    manifestId: `game-map-composite-${frame.frameId}`,
    gameMapFrameId: frame.frameId,
    structureId: frame.structureId,
    worldId: frame.worldId,
    ownerId: frame.ownerId,
    tick: frame.tick,
    sourceFactIds: frame.sourceFactIds,
    tileChunks: [
      ...terrainChunks,
      ...objectChunks,
      ...walkableChunks,
      ...collisionChunks,
      ...interactionChunks,
    ],
    visualUnitSlots,
    visualMaterialBindings: [],
    compositeOutput: null,
    compositionStatus: {
      mode: "chunked_runtime_map",
      canEnterWorld: false,
      blockedReasons: [
        "visual_unit_materials_not_fully_bound",
        "runtime_compositor_not_approved",
        "visual_judge_composite_gate_not_complete",
      ],
    },
    tags: [
      "p7_7_composite_map_manifest",
      "world_structure_to_map_chunks",
      "visual_unit_slots_declared",
      "requires_ai_painter_visual_units",
      "not_program_final_render",
      "not_world_page_runtime",
    ],
  }

  const validation = validateGameMapCompositeManifest(manifest)
  if (!validation.passed) {
    return {
      passed: false,
      manifest: null,
      blockedReasons: validation.issues,
      tags: ["game_map_composite_manifest_blocked"],
    }
  }

  return {
    passed: true,
    manifest,
    blockedReasons: [],
    tags: ["game_map_composite_manifest_built", "p7_7_composite_map_manifest"],
  }
}

function regionToTileChunk(
  frame: GameMapFrame,
  region: GameMapLayerRegion,
  layer: GameMapCompositeTileChunk["layer"],
  kind: GameMapCompositeChunkKind,
  index: number
): GameMapCompositeTileChunk {
  return {
    chunkId: `chunk-${layer}-${region.id}`,
    layer,
    kind,
    sourceId: region.sourceId,
    sourceFactIds: frame.sourceFactIds,
    bounds: polygonBounds(region.polygon),
    zIndex: layerZIndex(layer, region.kind, index),
    canRepeat: region.kind !== "path_ground",
    requiresAiPainterMaterial: layer === "terrain",
  }
}

function objectToTileChunk(
  frame: GameMapFrame,
  object: GameMapObjectLayerItem,
  index: number
): GameMapCompositeTileChunk {
  return {
    chunkId: `chunk-object-${object.id}`,
    layer: "object",
    kind: "object_unit",
    sourceId: object.sourceObjectId,
    sourceFactIds: frame.sourceFactIds,
    bounds: object.footprint,
    zIndex: 300 + index,
    canRepeat: object.kind === "grass_detail" || object.kind === "flower_patch",
    requiresAiPainterMaterial: true,
  }
}

function regionToVisualUnitSlots(
  frame: GameMapFrame,
  region: GameMapLayerRegion,
  index: number
): GameMapVisualUnitSlot[] {
  const bounds = polygonBounds(region.polygon)
  return [{
    slotId: `slot-terrain-${region.id}`,
    unitKind: terrainVisualUnitKind(region.kind),
    sourceId: region.sourceId,
    sourceFactIds: frame.sourceFactIds,
    bounds,
    maskGeometry: {
      kind: "polygon",
      points: region.polygon,
    },
    zIndex: layerZIndex("terrain", region.kind, index),
    painterContract: painterContract(
      region.kind === "path_ground" ? "condition_mask_path" : "condition_mask_region",
      frame.sourceFactIds
    ),
  }]
}

function objectToVisualUnitSlot(
  frame: GameMapFrame,
  object: GameMapObjectLayerItem,
  index: number
): GameMapVisualUnitSlot {
  return {
    slotId: `slot-object-${object.id}`,
    unitKind: objectVisualUnitKind(object.kind),
    sourceId: object.sourceObjectId,
    sourceFactIds: frame.sourceFactIds,
    bounds: object.footprint,
    maskGeometry: objectMaskGeometry(object),
    zIndex: 300 + index,
    painterContract: painterContract("condition_mask_object", frame.sourceFactIds),
  }
}

function objectMaskGeometry(
  object: GameMapObjectLayerItem
): GameMapVisualUnitSlot["maskGeometry"] {
  const { x, y, width, height } = object.footprint
  const cx = x + width / 2
  const cy = y + height / 2

  if (object.kind === "tree") {
    return {
      kind: "polygon",
      points: [
        { x: cx, y: y + height * 0.08 },
        { x: x + width * 0.78, y: y + height * 0.16 },
        { x: x + width * 0.88, y: y + height * 0.42 },
        { x: x + width * 0.76, y: y + height * 0.7 },
        { x: x + width * 0.58, y: y + height * 0.94 },
        { x: x + width * 0.42, y: y + height * 0.94 },
        { x: x + width * 0.24, y: y + height * 0.7 },
        { x: x + width * 0.12, y: y + height * 0.42 },
        { x: x + width * 0.22, y: y + height * 0.16 },
      ],
    }
  }

  if (object.kind === "rock") {
    return {
      kind: "polygon",
      points: [
        { x: x + width * 0.22, y: y + height * 0.2 },
        { x: x + width * 0.68, y: y + height * 0.08 },
        { x: x + width * 0.9, y: y + height * 0.38 },
        { x: x + width * 0.78, y: y + height * 0.78 },
        { x: x + width * 0.38, y: y + height * 0.92 },
        { x: x + width * 0.12, y: y + height * 0.66 },
        { x: x + width * 0.08, y: y + height * 0.34 },
      ],
    }
  }

  if (object.kind === "shrub" || object.kind === "grass_detail") {
    return {
      kind: "polygon",
      points: [
        { x: cx, y: y + height * 0.14 },
        { x: x + width * 0.84, y: y + height * 0.32 },
        { x: x + width * 0.88, y: y + height * 0.66 },
        { x: x + width * 0.64, y: y + height * 0.88 },
        { x: x + width * 0.32, y: y + height * 0.9 },
        { x: x + width * 0.12, y: y + height * 0.68 },
        { x: x + width * 0.16, y: y + height * 0.34 },
      ],
    }
  }

  if (object.kind === "flower_patch") {
    return {
      kind: "polygon",
      points: [
        { x: cx, y: y + height * 0.16 },
        { x: x + width * 0.84, y: cy },
        { x: cx, y: y + height * 0.84 },
        { x: x + width * 0.16, y: cy },
      ],
    }
  }

  return {
    kind: "rect",
    rect: object.footprint,
  }
}

function painterContract(
  inputKind: GameMapPainterInputKind,
  sourceFactIds: string[]
): GameMapVisualUnitSlot["painterContract"] {
  return {
    inputKind,
    mustPreserveFacts: sourceFactIds,
    forbiddenPayloads: [
      "new_world_fact",
      "program_final_render",
      "training_image",
      "candidate_only",
      "single_model_output_only",
    ],
  }
}

function terrainVisualUnitKind(kind: string): GameMapVisualUnitKind {
  if (kind === "water") return "water_texture"
  if (kind === "shoreline") return "shoreline_texture"
  if (kind === "path_ground") return "path_texture"
  if (kind === "natural_boundary") return "boundary_texture"
  return "grass_texture"
}

function objectVisualUnitKind(kind: string): GameMapVisualUnitKind {
  if (kind === "tree") return "tree_visual_unit"
  if (kind === "rock") return "rock_visual_unit"
  if (kind === "shrub") return "shrub_visual_unit"
  if (kind === "flower_patch") return "flower_visual_unit"
  return "grass_detail_visual_unit"
}

function layerZIndex(
  layer: GameMapCompositeTileChunk["layer"],
  kind: string,
  index: number
): number {
  if (layer === "collision") return 700 + index
  if (layer === "interaction") return 800 + index
  if (layer === "object") return 300 + index
  if (layer === "walkable") return 200 + index
  if (kind === "water") return 20 + index
  if (kind === "shoreline") return 30 + index
  if (kind === "mud_patch") return 42 + index
  if (kind === "path_ground") return 50 + index
  if (kind === "tall_grass") return 60 + index
  if (kind === "natural_boundary") return 70 + index
  return 10 + index
}
