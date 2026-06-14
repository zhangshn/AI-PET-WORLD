export type Point = [number, number]

export type TerrainRegion = {
  id: string
  terrain: "grass" | "water"
  polygon: Point[]
}

export type RoadShape = {
  id: string
  width: number
  points: Point[]
}

export type SceneObject = {
  id: string
  kind: "tree" | "rock" | "shelter"
  x: number
  y: number
  width: number
  height: number
  stage?: number
}

export type SceneBlueprint = {
  schemaVersion: "world-blueprint-v0"
  sceneId: string
  width: 256
  height: 192
  seed: number
  styleId: string
  terrainRegions: TerrainRegion[]
  roads: RoadShape[]
  objects: SceneObject[]
}

export type V1StructureType =
  | "grass" | "water_body" | "shoreline" | "road_center" | "road_edge"
  | "tree_trunk" | "tree_crown" | "rock" | "shelter_foundation"
  | "shelter_wall" | "shelter_roof" | "construction_material" | "walkable" | "depth"

export type V1Geometry =
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "polygon"; points: Point[] }
  | { kind: "polyline"; points: Point[]; lineWidth: number }

export type V1Structure = {
  id: string
  type: V1StructureType
  geometry: V1Geometry
  layer: number
  sourceV0Id?: string
  requiresManualReview: boolean
  manualReviewReasons: string[]
  depthValue?: number
  confidence?: number
  evidence?: Record<string, unknown>
}

export type SceneBlueprintV1 = {
  schemaVersion: "world-blueprint-v1"
  sceneId: string
  width: 256
  height: 192
  seed: number
  styleId: string
  sourceBlueprintVersion?: string
  sourceBlueprintHash?: string
  requiresManualReview: boolean
  manualReviewReasons: string[]
  structures: V1Structure[]
}

export type SceneDatasetItem = {
  sampleId: string
  subtype: string
  imageUrl: string
  annotationSource?: "module_d_auto" | "legacy_v1_draft"
  blueprint: SceneBlueprint
  blueprintV1?: SceneBlueprintV1
  blueprintV1Hash?: string | null
  targetImageHash?: string | null
  migrationV1?: Record<string, unknown>
  reviewV1?: Record<string, unknown>
  source?: Record<string, unknown>
  versions?: Record<string, unknown>
  judge?: {
    status?: string
    errors?: string[]
    evidence?: Record<string, unknown>
  }
}

export type AnnotationTool = "grass" | "water" | "road" | "tree" | "rock" | "shelter"
