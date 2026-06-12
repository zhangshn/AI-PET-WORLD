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

export type SceneDatasetItem = {
  sampleId: string
  subtype: string
  imageUrl: string
  blueprint: SceneBlueprint
}

export type AnnotationTool = "grass" | "water" | "road" | "tree" | "rock" | "shelter"
