/**
 * 当前文件负责：定义世界地图、世界坐标、原始自然地表、建设地块与基础地图状态。
 */

export type WorldPosition = {
  x: number
  y: number
}

export type WorldMapTileType =
  | "wild_grass"
  | "short_grass"
  | "soil"
  | "flower_patch"
  | "stone"
  | "water"
  | "forest_edge"
  | "mud"
  | "path"
  | "town_path"
  | "shelter_foundation"
  | "garden_soil"

export type WorldMapTile = {
  id: string
  x: number
  y: number
  type: WorldMapTileType
  walkable: boolean
  buildable: boolean
  fertility: number
  moisture: number
}

export type WorldMapSize = {
  width: number
  height: number
}

export type WorldMapState = {
  id: string
  name: string
  size: WorldMapSize
  tileSize: number
  tiles: WorldMapTile[]
}

export function createWorldMapTile(input: {
  x: number
  y: number
  type?: WorldMapTileType
  walkable?: boolean
  buildable?: boolean
  fertility?: number
  moisture?: number
}): WorldMapTile {
  const type = input.type ?? "short_grass"

  return {
    id: `tile-${input.x}-${input.y}`,
    x: input.x,
    y: input.y,
    type,
    walkable:
      input.walkable ??
      (type !== "water" && type !== "stone"),
    buildable:
      input.buildable ??
      (type === "short_grass" ||
        type === "wild_grass" ||
        type === "soil" ||
        type === "shelter_foundation" ||
        type === "garden_soil"),
    fertility: input.fertility ?? 50,
    moisture: input.moisture ?? 40,
  }
}

export function createEmptyWorldMap(input?: {
  id?: string
  name?: string
  width?: number
  height?: number
  tileSize?: number
}): WorldMapState {
  return {
    id: input?.id ?? "starter-land",
    name: input?.name ?? "Starter Land",
    size: {
      width: input?.width ?? 80,
      height: input?.height ?? 48,
    },
    tileSize: input?.tileSize ?? 24,
    tiles: [],
  }
}