import type { GameMapFrame } from "./game-map-frame-schema"
import { isGameMapFrame } from "./game-map-frame-schema"
import {
  buildSegmentPolygon,
  polygonBounds,
  rectWithinBounds,
  rectsOverlap,
} from "./game-map-geometry"
import type { HomeMapStructure } from "./home-map-structure-schema"
import {
  collectHomeMapStructureSourceFactIds,
  isHomeMapStructure,
  pointInMapBounds,
} from "./home-map-structure-schema"

export type GameMapFrameValidationIssue = {
  code: string
  message: string
}

export type GameMapFrameValidationResult = {
  passed: boolean
  issues: GameMapFrameValidationIssue[]
}

export function validateHomeMapStructure(
  value: unknown
): GameMapFrameValidationResult {
  if (!isHomeMapStructure(value)) {
    return failed("home_map_structure_schema_invalid", "HomeMapStructure schema is invalid.")
  }

  const issues: GameMapFrameValidationIssue[] = []

  if (!pointInMapBounds(value.entryPoint, value.size)) {
    issues.push(issue("entry_point_out_of_bounds", "Entry point must be inside the map."))
  }

  if (!pointInMapBounds(value.homeCenter, value.size)) {
    issues.push(issue("home_center_out_of_bounds", "Home center must be inside the map."))
  }

  const mapBounds = {
    x: 0,
    y: 0,
    width: value.size.width,
    height: value.size.height,
  }

  for (const path of value.paths) {
    for (const point of path.points) {
      if (!pointInMapBounds(point, value.size)) {
        issues.push(issue("path_point_out_of_bounds", `Path ${path.id} has a point outside map.`))
      }
    }
  }

  for (const object of value.objects) {
    if (!rectWithinBounds(object.footprint, mapBounds)) {
      issues.push(issue("object_footprint_out_of_bounds", `Object ${object.id} is outside map.`))
    }
  }

  if (!value.terrainRegions.some((region) => region.kind === "grass")) {
    issues.push(issue("grass_region_missing", "Natural home MVP must include grass terrain."))
  }

  const entryPath = value.paths.find(
    (path) =>
      path.kind === "entry_path" &&
      path.connects.includes("entry_point") &&
      path.connects.includes("home_center")
  )
  if (!entryPath) {
    issues.push(
      issue(
        "entry_to_home_path_missing",
        "Natural home MVP must include an entry path connected to the home center."
      )
    )
  }

  const sourceFactIds = collectHomeMapStructureSourceFactIds(value)
  if (!sameStringSet(value.sourceFactIds, sourceFactIds)) {
    issues.push(
      issue(
        "source_fact_ids_not_canonical",
        "HomeMapStructure sourceFactIds must include all terrain, path, and object facts."
      )
    )
  }

  if (value.objects.some((object) => object.kind === "tree" && !object.blocksMovement)) {
    issues.push(issue("tree_collision_missing", "Trees must block movement in MVP."))
  }

  const blockingObjects = value.objects.filter((object) => object.blocksMovement)
  const pathBounds = value.paths.flatMap((path) =>
    path.points.slice(0, -1).map((point, index) =>
      polygonBounds(
        buildSegmentPolygon(point, path.points[index + 1], path.width)
      )
    )
  )

  for (const object of blockingObjects) {
    if (pathBounds.some((bounds) => rectsOverlap(object.footprint, bounds))) {
      issues.push(
        issue(
          "blocking_object_overlaps_path",
          `Blocking object ${object.id} overlaps a required path corridor.`
        )
      )
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  }
}

export function validateGameMapFrame(
  value: unknown,
  structure: HomeMapStructure
): GameMapFrameValidationResult {
  if (!isGameMapFrame(value)) {
    return failed("game_map_frame_schema_invalid", "GameMapFrame schema is invalid.")
  }

  const issues: GameMapFrameValidationIssue[] = []

  if (value.structureId !== structure.structureId) {
    issues.push(issue("structure_id_mismatch", "GameMapFrame must bind to HomeMapStructure."))
  }
  if (value.worldId !== structure.worldId) {
    issues.push(issue("world_id_mismatch", "GameMapFrame worldId must match structure."))
  }
  if (value.tick !== structure.tick) {
    issues.push(issue("tick_mismatch", "GameMapFrame tick must match structure."))
  }
  if (!sameStringSet(value.sourceFactIds, collectHomeMapStructureSourceFactIds(structure))) {
    issues.push(
      issue(
        "source_fact_ids_mismatch",
        "GameMapFrame sourceFactIds must match the structure fact set."
      )
    )
  }

  const terrainSourceIds = new Set(value.terrainLayer.regions.map((region) => region.sourceId))
  for (const region of structure.terrainRegions) {
    if (!terrainSourceIds.has(region.id)) {
      issues.push(issue("terrain_region_missing", `Missing terrain region ${region.id}.`))
    }
  }
  for (const path of structure.paths) {
    if (!terrainSourceIds.has(path.id)) {
      issues.push(issue("path_terrain_missing", `Missing path terrain for ${path.id}.`))
    }
  }

  const objectSourceIds = new Set(
    value.objectLayer.objects.map((object) => object.sourceObjectId)
  )
  for (const object of structure.objects) {
    if (!objectSourceIds.has(object.id)) {
      issues.push(issue("object_missing", `Missing object ${object.id}.`))
    }
  }

  const blockedObjectIds = new Set(value.collisionLayer.blockedObjectIds)
  for (const object of structure.objects.filter((item) => item.blocksMovement)) {
    if (!blockedObjectIds.has(object.id)) {
      issues.push(issue("blocked_object_missing", `Missing collision for ${object.id}.`))
    }
  }

  const walkableSourceIds = new Set(value.walkableLayer.regions.map((region) => region.sourceId))
  for (const path of structure.paths) {
    if (!walkableSourceIds.has(path.id)) {
      issues.push(issue("path_walkable_missing", `Missing walkable path for ${path.id}.`))
    }
  }

  const interactionSourceIds = new Set(
    value.interactionLayer.items.map((item) => item.sourceObjectId)
  )
  for (const object of structure.objects.filter((item) => item.interactionKind === "inspect")) {
    if (!interactionSourceIds.has(object.id)) {
      issues.push(issue("interaction_item_missing", `Missing interaction item for ${object.id}.`))
    }
  }

  if (!value.runtimeLayer.stateRefs.includes(`structure:${structure.structureId}`)) {
    issues.push(
      issue(
        "runtime_layer_structure_ref_missing",
        "Runtime layer must reference the source structure."
      )
    )
  }

  if (value.visualLayer.status === "approved") {
    if (!value.visualLayer.approvedFrameId || value.visualLayer.imageSha256.length !== 64) {
      issues.push(
        issue(
          "approved_visual_layer_binding_invalid",
          "Approved visual layer must bind approvedFrameId and sha256."
        )
      )
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  }
}

function failed(code: string, message: string): GameMapFrameValidationResult {
  return {
    passed: false,
    issues: [issue(code, message)],
  }
}

function issue(code: string, message: string): GameMapFrameValidationIssue {
  return { code, message }
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
