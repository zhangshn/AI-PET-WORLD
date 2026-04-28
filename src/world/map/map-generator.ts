/**
 * 当前文件负责：生成带随机种子的 Starter Land 家园自然地图。
 */

import {
  createWorldMapTile,
  type WorldMapState,
  type WorldMapTileType,
} from "./world-map"

type HomeMapPoint = {
  x: number
  y: number
}

type HomeMapRect = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type HomeMapGenerationConfig = {
  seed: number
  width: number
  height: number
  tileSize: number
  incubatorCenter: HomeMapPoint
  shelterCenter: HomeMapPoint
  homeBuildCenter: HomeMapPoint
  gardenCenter: HomeMapPoint
  townGateCenter: HomeMapPoint
}

type HomeMapGenerationContext = {
  config: HomeMapGenerationConfig
  waterTiles: Set<string>
  wetlandTiles: Set<string>
  pathTiles: Set<string>
  townPathTiles: Set<string>
  shelterTiles: Set<string>
  gardenTiles: Set<string>
  forestTiles: Set<string>
  flowerTiles: Set<string>
}

const DEFAULT_HOME_MAP_SEED = 20260428

const DEFAULT_HOME_MAP_CONFIG: HomeMapGenerationConfig = {
  seed: DEFAULT_HOME_MAP_SEED,
  width: 80,
  height: 48,
  tileSize: 24,
  incubatorCenter: { x: 16, y: 20 },
  shelterCenter: { x: 29, y: 22 },
  homeBuildCenter: { x: 48, y: 26 },
  gardenCenter: { x: 63, y: 36 },
  townGateCenter: { x: 79, y: 24 },
}

export function generateStarterWorldMap(input?: {
  seed?: number
}): WorldMapState {
  const config: HomeMapGenerationConfig = {
    ...DEFAULT_HOME_MAP_CONFIG,
    seed: input?.seed ?? DEFAULT_HOME_MAP_SEED,
  }

  const context = buildHomeMapGenerationContext(config)
  const tiles = []

  for (let y = 0; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      const type = resolveHomeMapTileType(context, x, y)

      tiles.push(
        createWorldMapTile({
          x,
          y,
          type,
          fertility: resolveTileFertility(context, x, y, type),
          moisture: resolveTileMoisture(context, x, y, type),
        })
      )
    }
  }

  return {
    id: `starter-land-seed-${config.seed}`,
    name: "Starter Land",
    size: {
      width: config.width,
      height: config.height,
    },
    tileSize: config.tileSize,
    tiles,
  }
}

function buildHomeMapGenerationContext(
  config: HomeMapGenerationConfig
): HomeMapGenerationContext {
  const waterTiles = createWaterTiles(config)
  const wetlandTiles = createWetlandTiles(config, waterTiles)
  const pathTiles = createPathTiles(config, waterTiles)
  const townPathTiles = createTownPathTiles(config, waterTiles)
  const shelterTiles = createAreaTiles(
    createRectAroundPoint(config.shelterCenter, 10, 6),
    config
  )
  const gardenTiles = createAreaTiles(
    createRectAroundPoint(config.gardenCenter, 8, 5),
    config
  )
  const forestTiles = createForestTiles(config, waterTiles, pathTiles)
  const flowerTiles = createFlowerFieldTiles(config, waterTiles, pathTiles)

  return {
    config,
    waterTiles,
    wetlandTiles,
    pathTiles,
    townPathTiles,
    shelterTiles,
    gardenTiles,
    forestTiles,
    flowerTiles,
  }
}

function createWaterTiles(config: HomeMapGenerationConfig): Set<string> {
  const tiles = new Set<string>()

  const lakeCenter = {
    x: 8 + randomInt(config.seed, "lake-x", 0, 10),
    y: 5 + randomInt(config.seed, "lake-y", 0, 8),
  }

  addOrganicBlobTiles({
    target: tiles,
    config,
    center: lakeCenter,
    radiusX: 7 + randomInt(config.seed, "lake-radius-x", 0, 5),
    radiusY: 4 + randomInt(config.seed, "lake-radius-y", 0, 3),
    noiseKey: "main-lake",
    threshold: 0.18,
  })

  const pondCenter = {
    x: 8 + randomInt(config.seed, "pond-x", 0, 12),
    y: 33 + randomInt(config.seed, "pond-y", 0, 8),
  }

  addOrganicBlobTiles({
    target: tiles,
    config,
    center: pondCenter,
    radiusX: 4 + randomInt(config.seed, "pond-radius-x", 0, 4),
    radiusY: 3 + randomInt(config.seed, "pond-radius-y", 0, 3),
    noiseKey: "lower-pond",
    threshold: 0.24,
  })

  return tiles
}

function createWetlandTiles(
  config: HomeMapGenerationConfig,
  waterTiles: Set<string>
): Set<string> {
  const tiles = new Set<string>()

  for (const key of waterTiles) {
    const point = parseTileKey(key)

    for (let y = point.y - 2; y <= point.y + 2; y += 1) {
      for (let x = point.x - 2; x <= point.x + 2; x += 1) {
        if (!isInsideMap(config, x, y)) continue
        if (waterTiles.has(getTileKey(x, y))) continue

        const noise = randomFloat(config.seed, `wetland-${x}-${y}`)

        if (noise > 0.34) {
          tiles.add(getTileKey(x, y))
        }
      }
    }
  }

  return tiles
}

function createPathTiles(
  config: HomeMapGenerationConfig,
  waterTiles: Set<string>
): Set<string> {
  const tiles = new Set<string>()
  const hub = { x: 36, y: 27 }

  addPathBetweenPoints(tiles, config.incubatorCenter, config.shelterCenter)
  addPathBetweenPoints(tiles, config.shelterCenter, hub)
  addPathBetweenPoints(tiles, hub, config.homeBuildCenter)
  addPathBetweenPoints(tiles, hub, config.gardenCenter)

  // 通往小镇的出口路：从家园中心枢纽一路连接到地图右侧边界。
  addPathBetweenPoints(tiles, hub, config.townGateCenter)

  // 小镇入口处稍微加宽，让玩家明显看出这里是出口。
  for (let y = config.townGateCenter.y - 2; y <= config.townGateCenter.y + 2; y += 1) {
    for (let x = config.width - 4; x < config.width; x += 1) {
      if (!isInsideMap(config, x, y)) continue
      tiles.add(getTileKey(x, y))
    }
  }

  // 如果路径穿过水域，当前 MVP 先让路径避开水，不画桥。
  // 桥梁以后可以作为独立结构接入。
  for (const key of Array.from(tiles)) {
    if (waterTiles.has(key)) {
      tiles.delete(key)
    }
  }

  return tiles
}

function createTownPathTiles(
  config: HomeMapGenerationConfig,
  waterTiles: Set<string>
  ): Set<string> {
  const tiles = new Set<string>()

  for (let y = config.townGateCenter.y - 2; y <= config.townGateCenter.y + 2; y += 1) {
    for (let x = config.width - 6; x < config.width; x += 1) {
      if (!isInsideMap(config, x, y)) continue

      const key = getTileKey(x, y)

      if (waterTiles.has(key)) continue

      tiles.add(key)
    }
  }

  return tiles
}

function createForestTiles(
  config: HomeMapGenerationConfig,
  waterTiles: Set<string>,
  pathTiles: Set<string>
): Set<string> {
  const tiles = new Set<string>()

  for (let y = 0; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      const key = getTileKey(x, y)

      if (waterTiles.has(key) || pathTiles.has(key)) continue
      if (isCoreSafeArea(config, x, y)) continue

      const nearBorder =
        y <= 4 ||
        x <= 5 ||
        x >= config.width - 9 ||
        y >= config.height - 5
      const forestNoise = randomFloat(config.seed, `forest-${x}-${y}`)
      const isTownGateCorridor =
        x >= config.width - 12 &&
        Math.abs(y - config.townGateCenter.y) <= 4

      if (isTownGateCorridor) continue

      if (nearBorder && forestNoise > 0.22) {
        tiles.add(key)
      }

      if (
        x >= config.width - 18 &&
        y >= 5 &&
        y <= config.height - 10 &&
        forestNoise > 0.52
      ) {
        tiles.add(key)
      }
    }
  }

  return tiles
}

function createFlowerFieldTiles(
  config: HomeMapGenerationConfig,
  waterTiles: Set<string>,
  pathTiles: Set<string>
): Set<string> {
  const tiles = new Set<string>()
  const center = {
    x: 51 + randomInt(config.seed, "flower-x", -5, 5),
    y: 13 + randomInt(config.seed, "flower-y", -4, 5),
  }

  for (let y = center.y - 6; y <= center.y + 6; y += 1) {
    for (let x = center.x - 10; x <= center.x + 10; x += 1) {
      if (!isInsideMap(config, x, y)) continue

      const key = getTileKey(x, y)

      if (waterTiles.has(key) || pathTiles.has(key)) continue
      if (isCoreSafeArea(config, x, y)) continue

      const distance = getDistance({ x, y }, center)
      const noise = randomFloat(config.seed, `flower-${x}-${y}`)

      if (distance < 11 && noise > 0.28) {
        tiles.add(key)
      }
    }
  }

  return tiles
}

function resolveHomeMapTileType(
  context: HomeMapGenerationContext,
  x: number,
  y: number
): WorldMapTileType {
  const key = getTileKey(x, y)

  if (context.waterTiles.has(key)) return "water"
  if (context.townPathTiles.has(key)) return "town_path"
  if (context.pathTiles.has(key)) return "path"
  if (context.shelterTiles.has(key)) return "shelter_foundation"
  if (context.gardenTiles.has(key)) return "garden_soil"
  if (context.wetlandTiles.has(key)) return "mud"

  if (context.flowerTiles.has(key)) {
    return shouldDecorateFlower(context.config.seed, x, y)
      ? "flower_patch"
      : "short_grass"
  }

  if (context.forestTiles.has(key)) {
    return shouldPlaceStone(context, x, y) ? "stone" : "forest_edge"
  }

  if (shouldPlaceStone(context, x, y)) return "stone"

  if (shouldDecorateFlower(context.config.seed, x, y)) {
    return "flower_patch"
  }

  if (shouldDecorateGrass(context.config.seed, x, y)) {
    return "wild_grass"
  }

  return "short_grass"
}

function resolveTileFertility(
  context: HomeMapGenerationContext,
  x: number,
  y: number,
  type: WorldMapTileType
): number {
  if (type === "garden_soil") return 82
  if (type === "flower_patch") return 76
  if (type === "wild_grass") return 68
  if (type === "forest_edge") return 58
  if (type === "mud") return 54
  if (
    type === "water" ||
    type === "stone" ||
    type === "path" ||
    type === "town_path"
  ) {
    return 10
  }

  return 48 + randomInt(context.config.seed, `fertility-${x}-${y}`, -8, 12)
}

function resolveTileMoisture(
  context: HomeMapGenerationContext,
  x: number,
  y: number,
  type: WorldMapTileType
): number {
  if (type === "water") return 100
  if (type === "mud") return 86
  if (type === "garden_soil") return 62
  if (type === "flower_patch") return 56
  if (type === "forest_edge") return 50
  if (type === "stone" || type === "path" || type === "town_path") return 20

  const distanceToWater = getDistanceToNearestTile({ x, y }, context.waterTiles)

  if (distanceToWater <= 2) return 68
  if (distanceToWater <= 5) return 54

  return 38 + randomInt(context.config.seed, `moisture-${x}-${y}`, -8, 8)
}

function addOrganicBlobTiles(input: {
  target: Set<string>
  config: HomeMapGenerationConfig
  center: HomeMapPoint
  radiusX: number
  radiusY: number
  noiseKey: string
  threshold: number
}) {
  const minX = Math.floor(input.center.x - input.radiusX - 2)
  const maxX = Math.ceil(input.center.x + input.radiusX + 2)
  const minY = Math.floor(input.center.y - input.radiusY - 2)
  const maxY = Math.ceil(input.center.y + input.radiusY + 2)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!isInsideMap(input.config, x, y)) continue

      const normalized =
        ((x - input.center.x) * (x - input.center.x)) /
          (input.radiusX * input.radiusX) +
        ((y - input.center.y) * (y - input.center.y)) /
          (input.radiusY * input.radiusY)
      const noise = randomFloat(input.config.seed, `${input.noiseKey}-${x}-${y}`)

      if (normalized <= 1 + input.threshold * noise) {
        input.target.add(getTileKey(x, y))
      }
    }
  }
}

function addPathBetweenPoints(
  target: Set<string>,
  from: HomeMapPoint,
  to: HomeMapPoint
) {
  const current = {
    x: from.x,
    y: from.y,
  }

  while (current.x !== to.x) {
    addPathTileWithWidth(target, current.x, current.y)
    current.x += current.x < to.x ? 1 : -1
  }

  while (current.y !== to.y) {
    addPathTileWithWidth(target, current.x, current.y)
    current.y += current.y < to.y ? 1 : -1
  }

  addPathTileWithWidth(target, to.x, to.y)
}

function addPathTileWithWidth(target: Set<string>, x: number, y: number) {
  target.add(getTileKey(x, y))
  target.add(getTileKey(x, y + 1))
}

function createAreaTiles(
  rect: HomeMapRect,
  config: HomeMapGenerationConfig
): Set<string> {
  const tiles = new Set<string>()

  for (let y = rect.minY; y <= rect.maxY; y += 1) {
    for (let x = rect.minX; x <= rect.maxX; x += 1) {
      if (!isInsideMap(config, x, y)) continue

      tiles.add(getTileKey(x, y))
    }
  }

  return tiles
}

function createRectAroundPoint(
  center: HomeMapPoint,
  halfWidth: number,
  halfHeight: number
): HomeMapRect {
  return {
    minX: center.x - halfWidth,
    maxX: center.x + halfWidth,
    minY: center.y - halfHeight,
    maxY: center.y + halfHeight,
  }
}

function isCoreSafeArea(
  config: HomeMapGenerationConfig,
  x: number,
  y: number
): boolean {
  return (
    getDistance({ x, y }, config.incubatorCenter) <= 6 ||
    getDistance({ x, y }, config.shelterCenter) <= 8 ||
    getDistance({ x, y }, config.homeBuildCenter) <= 8 ||
    getDistance({ x, y }, config.gardenCenter) <= 7 ||
    getDistance({ x, y }, config.townGateCenter) <= 5
  )
}

function shouldDecorateFlower(seed: number, x: number, y: number): boolean {
  return randomFloat(seed, `decorate-flower-${x}-${y}`) > 0.92
}

function shouldDecorateGrass(seed: number, x: number, y: number): boolean {
  return randomFloat(seed, `decorate-grass-${x}-${y}`) > 0.88
}

function shouldPlaceStone(
  context: HomeMapGenerationContext,
  x: number,
  y: number
): boolean {
  const key = getTileKey(x, y)

  if (context.waterTiles.has(key)) return false
  if (context.townPathTiles.has(key)) return false
  if (context.shelterTiles.has(key)) return false
  if (context.gardenTiles.has(key)) return false
  if (context.wetlandTiles.has(key)) return false

  return randomFloat(context.config.seed, `stone-${x}-${y}`) > 0.965
}

function isInsideMap(
  config: HomeMapGenerationConfig,
  x: number,
  y: number
): boolean {
  return x >= 0 && y >= 0 && x < config.width && y < config.height
}

function getTileKey(x: number, y: number): string {
  return `${x}:${y}`
}

function parseTileKey(key: string): HomeMapPoint {
  const [x, y] = key.split(":").map(Number)

  return {
    x,
    y,
  }
}

function getDistance(a: HomeMapPoint, b: HomeMapPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y

  return Math.sqrt(dx * dx + dy * dy)
}

function getDistanceToNearestTile(
  point: HomeMapPoint,
  tiles: Set<string>
): number {
  let nearest = Number.POSITIVE_INFINITY

  for (const key of tiles) {
    const target = parseTileKey(key)
    const distance = getDistance(point, target)

    if (distance < nearest) {
      nearest = distance
    }
  }

  return nearest
}

function randomFloat(seed: number, key: string): number {
  let hash = seed

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }

  const value = Math.sin(hash) * 10000

  return value - Math.floor(value)
}

function randomInt(
  seed: number,
  key: string,
  min: number,
  max: number
): number {
  return Math.floor(randomFloat(seed, key) * (max - min + 1)) + min
}