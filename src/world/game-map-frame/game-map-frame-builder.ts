import type { GameMapFrame } from "./game-map-frame-schema"
import type { HomeMapStructure } from "./home-map-structure-schema"
import { collectHomeMapStructureSourceFactIds } from "./home-map-structure-schema"
import { generateGameMapLayers } from "./game-map-layer-generator"

export function buildGameMapFrameFromHomeMapStructure(
  structure: HomeMapStructure
): GameMapFrame {
  const layers = generateGameMapLayers(structure)

  return {
    schemaVersion: "game-map-frame-v1",
    frameId: `game-map-frame-${structure.structureId}-${structure.tick}`,
    structureId: structure.structureId,
    worldId: structure.worldId,
    ownerId: structure.ownerId,
    tick: structure.tick,
    sourceFactIds: collectHomeMapStructureSourceFactIds(structure),
    terrainLayer: layers.terrainLayer,
    objectLayer: layers.objectLayer,
    walkableLayer: layers.walkableLayer,
    collisionLayer: layers.collisionLayer,
    interactionLayer: layers.interactionLayer,
    runtimeLayer: layers.runtimeLayer,
    visualLayer: {
      status: "not_generated",
      source: "none",
      approvedFrameId: null,
      candidateId: null,
      imageSha256: null,
      imageWidth: null,
      imageHeight: null,
      imageFormat: null,
    },
    tags: [
      "game_map_frame",
      "natural_home_mvp",
      "world_facts_first",
      "generated_from_home_map_structure",
      "segmented_path_layers",
      "ai_painter_visual_layer_not_generated",
    ],
  }
}
