/**
 * 当前文件负责：根据世界地图生成 Alpha 阶段初始化所需的基础自然实体。
 */

import type {
  WorldMapState,
  WorldMapTile,
  WorldMapTileType,
  WorldPosition,
} from "../map/world-map"
import { createWorldEntity, type WorldEntity } from "./entity-types"

export type StarterWorldEntitySpawnInput = {
  map: WorldMapState
  tick?: number
}

export type StarterWorldEntitySpawnResult = {
  entities: WorldEntity[]
  treeCount: number
  flowerCount: number
  waterCount: number
  butterflyCount: number
}

type NaturalEntitySpawnPoint = {
  id: string
  position: WorldPosition
}

type SpawnRule = {
  allowedTiles: WorldMapTileType[]
  searchRadius: number
  minDistance: number
}

type SpawnCandidateInput = {
  map: WorldMapState
  count: number
  rule: SpawnRule
  seedKey: string
  idPrefix: string
  usedPositions: Set<string>
  preferTiles?: WorldMapTileType[]
}

const TREE_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["forest_edge", "wild_grass", "short_grass", "flower_patch"],
  searchRadius: 10,
  minDistance: 4,
}

const FLOWER_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["flower_patch", "short_grass", "wild_grass"],
  searchRadius: 8,
  minDistance: 3,
}

const WATER_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["water"],
  searchRadius: 10,
  minDistance: 4,
}

const BUTTERFLY_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["flower_patch", "short_grass", "wild_grass"],
  searchRadius: 8,
  minDistance: 5,
}

export function spawnStarterWorldEntities(
  input: StarterWorldEntitySpawnInput
): StarterWorldEntitySpawnResult {
  const tick = input.tick ?? 0
  const usedPositions = new Set<string>()
  const spawnCounts = resolveSpawnCounts(input.map)

  const treePoints = createSpawnCandidates({
    map: input.map,
    count: spawnCounts.trees,
    rule: TREE_SPAWN_RULE,
    seedKey: "starter-trees",
    idPrefix: "tree",
    usedPositions,
    preferTiles: ["forest_edge", "wild_grass"],
  })

  const flowerPoints = createSpawnCandidates({
    map: input.map,
    count: spawnCounts.flowers,
    rule: FLOWER_SPAWN_RULE,
    seedKey: "starter-flowers",
    idPrefix: "flower",
    usedPositions,
    preferTiles: ["flower_patch"],
  })

  const waterPoints = createSpawnCandidates({
    map: input.map,
    count: spawnCounts.waters,
    rule: WATER_SPAWN_RULE,
    seedKey: "starter-water",
    idPrefix: "water",
    usedPositions,
    preferTiles: ["water"],
  })

  const butterflyPoints = createSpawnCandidates({
    map: input.map,
    count: spawnCounts.butterflies,
    rule: BUTTERFLY_SPAWN_RULE,
    seedKey: "starter-butterflies",
    idPrefix: "butterfly",
    usedPositions,
    preferTiles: ["flower_patch"],
  })

  const trees = treePoints.map((point, index) =>
    createWorldEntity({
      id: point.id,
      kind: "vegetation",
      type: "tree",
      name: `树木 ${index + 1}`,
      description: "一棵安静生长在世界边缘的树。",
      position: point.position,
      radius: 1.4,
      interactionRange: 5,
      createdAtTick: tick,
      visual: {
        label: "树",
        icon: "🌳",
        layer: "object",
        colorToken: "tree",
      },
      stimulus: {
        enabled: true,
        channels: ["visual", "scent"],
        intensity: 35,
        radius: 5,
        tags: ["safe_spot", "curiosity_source", "scent_source"],
        cooldownTicks: 4,
      },
      movement: {
        mode: "static",
        speedPerTick: 0,
      },
      flags: {
        selectable: true,
        observable: true,
        canBeStimulusSource: true,
        canMove: false,
        canExpire: false,
      },
      metadata: {
        alphaNaturalEntity: true,
        habitat: "forest_edge",
      },
    })
  )

  const flowers = flowerPoints.map((point, index) =>
    createWorldEntity({
      id: point.id,
      kind: "vegetation",
      type: "flower",
      name: `野花 ${index + 1}`,
      description: "一小簇随着时间轻微摇动的野花。",
      position: point.position,
      radius: 0.8,
      interactionRange: 4,
      createdAtTick: tick,
      visual: {
        label: "花",
        icon: "🌸",
        layer: "ground",
        colorToken: "flower",
      },
      stimulus: {
        enabled: true,
        channels: ["visual", "scent"],
        intensity: 28,
        radius: 4,
        tags: ["curiosity_source", "scent_source"],
        cooldownTicks: 3,
      },
      movement: {
        mode: "static",
        speedPerTick: 0,
      },
      flags: {
        selectable: true,
        observable: true,
        canBeStimulusSource: true,
        canMove: false,
        canExpire: false,
      },
      metadata: {
        alphaNaturalEntity: true,
        habitat: "meadow",
      },
    })
  )

  const waters = waterPoints.map((point, index) =>
    createWorldEntity({
      id: point.id,
      kind: "resource",
      type: "water",
      name: `浅水 ${index + 1}`,
      description: "一片反射天空颜色的浅水。",
      position: point.position,
      radius: 1.2,
      interactionRange: 5,
      createdAtTick: tick,
      visual: {
        label: "水",
        icon: "💧",
        layer: "ground",
        colorToken: "water",
      },
      stimulus: {
        enabled: true,
        channels: ["visual", "sound", "temperature"],
        intensity: 40,
        radius: 5,
        tags: ["water_source", "curiosity_source", "sound_source"],
        cooldownTicks: 4,
      },
      movement: {
        mode: "static",
        speedPerTick: 0,
      },
      flags: {
        selectable: true,
        observable: true,
        canBeStimulusSource: true,
        canMove: false,
        canExpire: false,
      },
      metadata: {
        alphaNaturalEntity: true,
        resourceType: "water",
      },
    })
  )

  const butterflies = butterflyPoints.map((point, index) =>
    createWorldEntity({
      id: point.id,
      kind: "creature",
      type: "butterfly",
      name: `蝴蝶 ${index + 1}`,
      description: "一只在花丛附近缓慢飞行的蝴蝶。",
      position: point.position,
      radius: 0.5,
      interactionRange: 6,
      createdAtTick: tick,
      visual: {
        label: "蝶",
        icon: "🦋",
        layer: "creature",
        colorToken: "butterfly",
      },
      stimulus: {
        enabled: true,
        channels: ["visual", "movement"],
        intensity: 45,
        radius: 6,
        tags: ["visual_motion", "curiosity_source"],
        cooldownTicks: 2,
      },
      movement: {
        mode: "wander",
        speedPerTick: 0.6,
        homePosition: point.position,
        wanderRadius: 5,
      },
      flags: {
        selectable: true,
        observable: true,
        canBeStimulusSource: true,
        canMove: true,
        canExpire: false,
      },
      metadata: {
        alphaNaturalEntity: true,
        habitat: "meadow",
      },
    })
  )

  const entities = [...trees, ...flowers, ...waters, ...butterflies]

  return {
    entities,
    treeCount: trees.length,
    flowerCount: flowers.length,
    waterCount: waters.length,
    butterflyCount: butterflies.length,
  }
}

function resolveSpawnCounts(map: WorldMapState): {
  trees: number
  flowers: number
  waters: number
  butterflies: number
} {
  const area = map.size.width * map.size.height
  const scale = area / (80 * 48)

  return {
    trees: clampNumber(Math.round(14 * scale), 9, 22),
    flowers: clampNumber(Math.round(18 * scale), 10, 30),
    waters: clampNumber(Math.round(5 * scale), 3, 8),
    butterflies: clampNumber(Math.round(6 * scale), 3, 10),
  }
}

function createSpawnCandidates(
  input: SpawnCandidateInput
): NaturalEntitySpawnPoint[] {
  const candidates = getCandidateTiles(input.map, input.rule, input.preferTiles)
  const result: NaturalEntitySpawnPoint[] = []

  for (
    let index = 0;
    index < candidates.length && result.length < input.count;
    index += 1
  ) {
    const tile = candidates[index]
    const position = {
      x: tile.x,
      y: tile.y,
    }

    if (
      !isAllowedSpawnPosition({
        position,
        map: input.map,
        rule: input.rule,
        usedPositions: input.usedPositions,
      })
    ) {
      continue
    }

    input.usedPositions.add(createPositionKey(position))

    result.push({
      id: `${input.idPrefix}-${result.length + 1}`,
      position,
    })
  }

  if (result.length >= input.count) {
    return result
  }

  const fallbackPoints = resolveSpawnPointsForRule(
    createFallbackPreferredPoints(input),
    input.map,
    input.rule,
    input.usedPositions
  )

  for (const point of fallbackPoints) {
    if (result.length >= input.count) break

    if (
      !isAllowedSpawnPosition({
        position: point.position,
        map: input.map,
        rule: input.rule,
        usedPositions: input.usedPositions,
      })
    ) {
      continue
    }

    input.usedPositions.add(createPositionKey(point.position))
    result.push({
      id: `${input.idPrefix}-${result.length + 1}`,
      position: point.position,
    })
  }

  return result
}

function getCandidateTiles(
  map: WorldMapState,
  rule: SpawnRule,
  preferTiles?: WorldMapTileType[]
): WorldMapTile[] {
  const preferred = map.tiles.filter((tile) => {
    if (!preferTiles?.includes(tile.type)) return false

    return rule.allowedTiles.includes(tile.type)
  })
  const allowed = map.tiles.filter((tile) => rule.allowedTiles.includes(tile.type))
  const sortedPreferred = sortTilesByStableSeed(map.id, preferred, "preferred")
  const sortedAllowed = sortTilesByStableSeed(map.id, allowed, "allowed")

  return dedupeTiles([...sortedPreferred, ...sortedAllowed])
}

function createFallbackPreferredPoints(
  input: SpawnCandidateInput
): NaturalEntitySpawnPoint[] {
  const points: NaturalEntitySpawnPoint[] = []

  for (let index = 0; index < input.count * 2; index += 1) {
    const seed = createStableNumber(input.map.id, `${input.seedKey}-${index}`)
    const x = seed % input.map.size.width
    const y = Math.floor(seed / input.map.size.width) % input.map.size.height

    points.push({
      id: `${input.idPrefix}-fallback-${index + 1}`,
      position: { x, y },
    })
  }

  return points
}

function sortTilesByStableSeed(
  mapId: string,
  tiles: WorldMapTile[],
  seedKey: string
): WorldMapTile[] {
  return [...tiles].sort((a, b) => {
    const aSeed = createStableNumber(mapId, `${seedKey}-${a.x}-${a.y}`)
    const bSeed = createStableNumber(mapId, `${seedKey}-${b.x}-${b.y}`)

    return aSeed - bSeed
  })
}

function dedupeTiles(tiles: WorldMapTile[]): WorldMapTile[] {
  const used = new Set<string>()
  const result: WorldMapTile[] = []

  for (const tile of tiles) {
    const key = createPositionKey({ x: tile.x, y: tile.y })

    if (used.has(key)) continue

    used.add(key)
    result.push(tile)
  }

  return result
}

function resolveSpawnPointsForRule(
  points: NaturalEntitySpawnPoint[],
  map: WorldMapState,
  rule: SpawnRule,
  usedPositions = new Set<string>()
): NaturalEntitySpawnPoint[] {
  return points.map((point) => {
    const safePosition = findNearestAllowedPosition({
      preferred: point.position,
      map,
      rule,
      usedPositions,
    })

    return {
      ...point,
      position: safePosition,
    }
  })
}

function findNearestAllowedPosition(input: {
  preferred: WorldPosition
  map: WorldMapState
  rule: SpawnRule
  usedPositions: Set<string>
}): WorldPosition {
  const preferred = clampPositionToMap(input.preferred, input.map)

  if (
    isAllowedSpawnPosition({
      position: preferred,
      map: input.map,
      rule: input.rule,
      usedPositions: input.usedPositions,
    })
  ) {
    return preferred
  }

  for (let radius = 1; radius <= input.rule.searchRadius; radius += 1) {
    const candidates = getRingPositions(preferred, radius, input.map)

    for (const candidate of candidates) {
      if (
        isAllowedSpawnPosition({
          position: candidate,
          map: input.map,
          rule: input.rule,
          usedPositions: input.usedPositions,
        })
      ) {
        return candidate
      }
    }
  }

  return (
    findFirstAllowedMapPosition({
      map: input.map,
      rule: input.rule,
      usedPositions: input.usedPositions,
    }) ?? preferred
  )
}

function isAllowedSpawnPosition(input: {
  position: WorldPosition
  map: WorldMapState
  rule: SpawnRule
  usedPositions: Set<string>
}): boolean {
  const tileType = getTileTypeAt(input.map, input.position)

  if (!tileType) return false

  if (!input.rule.allowedTiles.includes(tileType)) {
    return false
  }

  if (input.usedPositions.has(createPositionKey(input.position))) {
    return false
  }

  if (isTooCloseToUsedPosition(input.position, input.usedPositions, input.rule)) {
    return false
  }

  return true
}

function isTooCloseToUsedPosition(
  position: WorldPosition,
  usedPositions: Set<string>,
  rule: SpawnRule
): boolean {
  for (const key of usedPositions) {
    const usedPosition = parsePositionKey(key)

    if (getDistance(position, usedPosition) < rule.minDistance) {
      return true
    }
  }

  return false
}

function getRingPositions(
  center: WorldPosition,
  radius: number,
  map: WorldMapState
): WorldPosition[] {
  const positions: WorldPosition[] = []

  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const isOnRing =
        x === center.x - radius ||
        x === center.x + radius ||
        y === center.y - radius ||
        y === center.y + radius

      if (!isOnRing) continue

      positions.push(
        clampPositionToMap(
          {
            x,
            y,
          },
          map
        )
      )
    }
  }

  return dedupePositions(positions)
}

function findFirstAllowedMapPosition(input: {
  map: WorldMapState
  rule: SpawnRule
  usedPositions: Set<string>
}): WorldPosition | null {
  for (const tile of input.map.tiles) {
    const position = {
      x: tile.x,
      y: tile.y,
    }

    if (
      isAllowedSpawnPosition({
        position,
        map: input.map,
        rule: input.rule,
        usedPositions: input.usedPositions,
      })
    ) {
      return position
    }
  }

  return null
}

function getTileTypeAt(
  map: WorldMapState,
  position: WorldPosition
): WorldMapTileType | null {
  const tileX = Math.round(position.x)
  const tileY = Math.round(position.y)

  return (
    map.tiles.find((tile) => tile.x === tileX && tile.y === tileY)?.type ?? null
  )
}

function dedupePositions(positions: WorldPosition[]): WorldPosition[] {
  const result: WorldPosition[] = []
  const used = new Set<string>()

  for (const position of positions) {
    const key = createPositionKey(position)

    if (used.has(key)) {
      continue
    }

    used.add(key)
    result.push(position)
  }

  return result
}

function createPositionKey(position: WorldPosition): string {
  return `${Math.round(position.x)}:${Math.round(position.y)}`
}

function parsePositionKey(key: string): WorldPosition {
  const [x, y] = key.split(":").map(Number)

  return {
    x,
    y,
  }
}

function clampPositionToMap(
  position: WorldPosition,
  map: WorldMapState
): WorldPosition {
  return {
    x: clampNumber(Math.round(position.x), 0, Math.max(0, map.size.width - 1)),
    y: clampNumber(Math.round(position.y), 0, Math.max(0, map.size.height - 1)),
  }
}

function createStableNumber(seed: string, key: string): number {
  let hash = 2166136261

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function getDistance(a: WorldPosition, b: WorldPosition): number {
  const dx = a.x - b.x
  const dy = a.y - b.y

  return Math.sqrt(dx * dx + dy * dy)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}