export type HomeMapStructureVersion = "home-map-structure-v1"

export type HomeMapPoint = {
  x: number
  y: number
}

export type HomeMapSize = {
  width: number
  height: number
  tileSize: number
}

export type HomeMapRect = HomeMapPoint & {
  width: number
  height: number
}

export type HomeMapTerrainKind =
  | "grass"
  | "water"
  | "shoreline"
  | "path_ground"
  | "natural_boundary"

export type HomeMapObjectKind =
  | "tree"
  | "rock"
  | "shrub"
  | "flower_patch"
  | "grass_detail"

export type HomeMapPathKind = "entry_path" | "branch_path"

export type HomeMapConnectionTarget = "entry_point" | "home_center" | string

export type HomeMapTerrainRegion = {
  id: string
  kind: HomeMapTerrainKind
  polygon: HomeMapPoint[]
  sourceFactIds: string[]
}

export type HomeMapPath = {
  id: string
  kind: HomeMapPathKind
  points: HomeMapPoint[]
  width: number
  connects: HomeMapConnectionTarget[]
  sourceFactIds: string[]
}

export type HomeMapObject = {
  id: string
  kind: HomeMapObjectKind
  position: HomeMapPoint
  footprint: HomeMapRect
  blocksMovement: boolean
  interactionKind: "none" | "inspect"
  sourceFactIds: string[]
}

export type HomeMapGenerationPolicy = {
  scope: "natural_home_mvp"
  allowAiPainterVisualFill: true
  forbiddenFacts: readonly [
    "character",
    "animal",
    "town",
    "city",
    "interior",
    "building_construction"
  ]
}

export type HomeMapStructure = {
  schemaVersion: HomeMapStructureVersion
  structureId: string
  worldId: string
  ownerId: string
  tick: number
  seed: string
  size: HomeMapSize
  entryPoint: HomeMapPoint
  homeCenter: HomeMapPoint
  terrainRegions: HomeMapTerrainRegion[]
  paths: HomeMapPath[]
  objects: HomeMapObject[]
  sourceFactIds: string[]
  generationPolicy: HomeMapGenerationPolicy
  tags: string[]
}

export function isHomeMapStructure(value: unknown): value is HomeMapStructure {
  if (!isRecord(value)) return false

  return (
    value.schemaVersion === "home-map-structure-v1" &&
    isNonEmptyString(value.structureId) &&
    isNonEmptyString(value.worldId) &&
    isNonEmptyString(value.ownerId) &&
    Number.isInteger(value.tick) &&
    isNonEmptyString(value.seed) &&
    isHomeMapSize(value.size) &&
    isHomeMapPoint(value.entryPoint) &&
    isHomeMapPoint(value.homeCenter) &&
    isArrayOf(value.terrainRegions, isHomeMapTerrainRegion) &&
    isArrayOf(value.paths, isHomeMapPath) &&
    isArrayOf(value.objects, isHomeMapObject) &&
    isArrayOf(value.sourceFactIds, isNonEmptyString) &&
    isHomeMapGenerationPolicy(value.generationPolicy) &&
    isArrayOf(value.tags, isNonEmptyString)
  )
}

export function collectHomeMapStructureSourceFactIds(
  structure: HomeMapStructure
): string[] {
  return Array.from(
    new Set([
      ...structure.sourceFactIds,
      ...structure.terrainRegions.flatMap((region) => region.sourceFactIds),
      ...structure.paths.flatMap((path) => path.sourceFactIds),
      ...structure.objects.flatMap((object) => object.sourceFactIds),
    ])
  ).sort()
}

export function pointInMapBounds(
  point: HomeMapPoint,
  size: HomeMapSize
): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= size.width && point.y <= size.height
}

function isHomeMapSize(value: unknown): value is HomeMapSize {
  return (
    isRecord(value) &&
    isPositiveNumber(value.width) &&
    isPositiveNumber(value.height) &&
    isPositiveNumber(value.tileSize)
  )
}

function isHomeMapPoint(value: unknown): value is HomeMapPoint {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isHomeMapRect(value: unknown): value is HomeMapRect {
  if (!isRecord(value) || !isHomeMapPoint(value)) return false
  const record = value as Record<string, unknown>

  return (
    isPositiveNumber(record.width) &&
    isPositiveNumber(record.height)
  )
}

function isHomeMapTerrainRegion(value: unknown): value is HomeMapTerrainRegion {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isHomeMapTerrainKind(value.kind) &&
    isArrayOf(value.polygon, isHomeMapPoint) &&
    value.polygon.length >= 3 &&
    isArrayOf(value.sourceFactIds, isNonEmptyString)
  )
}

function isHomeMapPath(value: unknown): value is HomeMapPath {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    (value.kind === "entry_path" || value.kind === "branch_path") &&
    isArrayOf(value.points, isHomeMapPoint) &&
    value.points.length >= 2 &&
    isPositiveNumber(value.width) &&
    isArrayOf(value.connects, isNonEmptyString) &&
    isArrayOf(value.sourceFactIds, isNonEmptyString)
  )
}

function isHomeMapObject(value: unknown): value is HomeMapObject {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isHomeMapObjectKind(value.kind) &&
    isHomeMapPoint(value.position) &&
    isHomeMapRect(value.footprint) &&
    typeof value.blocksMovement === "boolean" &&
    (value.interactionKind === "none" || value.interactionKind === "inspect") &&
    isArrayOf(value.sourceFactIds, isNonEmptyString)
  )
}

function isHomeMapGenerationPolicy(
  value: unknown
): value is HomeMapGenerationPolicy {
  return (
    isRecord(value) &&
    value.scope === "natural_home_mvp" &&
    value.allowAiPainterVisualFill === true &&
    isArrayOf(value.forbiddenFacts, isNonEmptyString) &&
    value.forbiddenFacts.includes("character") &&
    value.forbiddenFacts.includes("building_construction")
  )
}

function isHomeMapTerrainKind(value: unknown): value is HomeMapTerrainKind {
  return (
    value === "grass" ||
    value === "water" ||
    value === "shoreline" ||
    value === "path_ground" ||
    value === "natural_boundary"
  )
}

function isHomeMapObjectKind(value: unknown): value is HomeMapObjectKind {
  return (
    value === "tree" ||
    value === "rock" ||
    value === "shrub" ||
    value === "flower_patch" ||
    value === "grass_detail"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(predicate)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}
