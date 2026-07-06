import type {
  GameMapFrame,
  GameMapInteractionItem,
  GameMapLayerRegion,
  GameMapObjectLayerItem,
} from "./game-map-frame-schema"
import type {
  HomeMapObject,
  HomeMapPath,
  HomeMapStructure,
} from "./home-map-structure-schema"
import {
  buildPolylineCorridorPolygon,
  rectToPolygon,
} from "./game-map-geometry"

export type GeneratedGameMapLayers = Pick<
  GameMapFrame,
  | "terrainLayer"
  | "objectLayer"
  | "walkableLayer"
  | "collisionLayer"
  | "interactionLayer"
  | "runtimeLayer"
>

export function generateGameMapLayers(
  structure: HomeMapStructure
): GeneratedGameMapLayers {
  const pathRegions = structure.paths.flatMap(pathToSegmentRegions)
  const blockedObjects = structure.objects.filter((object) => object.blocksMovement)

  return {
    terrainLayer: {
      regions: [
        ...structure.terrainRegions.map((region) => ({
          id: `terrain-${region.id}`,
          sourceId: region.id,
          kind: region.kind,
          polygon: region.polygon,
        })),
        ...pathRegions,
      ],
    },
    objectLayer: {
      objects: structure.objects.map(objectToLayerItem),
    },
    walkableLayer: {
      regions: [
        ...pathRegions.map((region) => ({
          ...region,
          id: `walkable-${region.id}`,
          kind: "walkable_area" as const,
        })),
        {
          id: "walkable-home-center-buffer",
          sourceId: structure.structureId,
          kind: "walkable_area",
          polygon: rectToPolygon({
            x: structure.homeCenter.x - 64,
            y: structure.homeCenter.y - 48,
            width: 128,
            height: 96,
          }),
        },
      ],
    },
    collisionLayer: {
      regions: blockedObjects.map(objectToBlockedRegion),
      blockedObjectIds: blockedObjects.map((object) => object.id),
    },
    interactionLayer: {
      items: structure.objects
        .filter((object) => object.interactionKind === "inspect")
        .map(objectToInteractionItem),
    },
    runtimeLayer: {
      phase: "natural_home_static_mvp",
      stateRefs: [
        `world:${structure.worldId}`,
        `tick:${structure.tick}`,
        `structure:${structure.structureId}`,
      ],
    },
  }
}

function pathToSegmentRegions(path: HomeMapPath): GameMapLayerRegion[] {
  return [
    {
      id: `path-corridor-${path.id}`,
      sourceId: path.id,
      kind: "path_ground",
      polygon: buildPolylineCorridorPolygon(path.points, path.width),
    },
  ]
}

function objectToLayerItem(object: HomeMapObject): GameMapObjectLayerItem {
  return {
    id: `object-${object.id}`,
    sourceObjectId: object.id,
    kind: object.kind,
    position: object.position,
    footprint: object.footprint,
    blocksMovement: object.blocksMovement,
  }
}

function objectToBlockedRegion(object: HomeMapObject): GameMapLayerRegion {
  return {
    id: `blocked-${object.id}`,
    sourceId: object.id,
    kind: "blocked_area",
    polygon: rectToPolygon(object.footprint),
  }
}

function objectToInteractionItem(object: HomeMapObject): GameMapInteractionItem {
  return {
    id: `inspect-${object.id}`,
    sourceObjectId: object.id,
    kind: "inspect",
    bounds: object.footprint,
  }
}
