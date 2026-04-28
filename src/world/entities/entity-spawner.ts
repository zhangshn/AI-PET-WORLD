/**
 * 当前文件负责：生成 Alpha 阶段世界初始化所需的基础自然实体。
 */

import type {
  WorldMapState,
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
}

const TREE_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["forest_edge", "wild_grass", "short_grass", "flower_patch"],
  searchRadius: 8,
}

const FLOWER_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["flower_patch", "short_grass", "wild_grass"],
  searchRadius: 7,
}

const WATER_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["water"],
  searchRadius: 10,
}

const BUTTERFLY_SPAWN_RULE: SpawnRule = {
  allowedTiles: ["flower_patch", "short_grass", "wild_grass"],
  searchRadius: 8,
}

export function spawnStarterWorldEntities(
  input: StarterWorldEntitySpawnInput
): StarterWorldEntitySpawnResult {
  const tick = input.tick ?? 0

  const treePoints = resolveSpawnPointsForRule(
    [
      { id: "tree-north-west", position: { x: 6, y: 5 } },
      { id: "tree-north-east", position: { x: 35, y: 6 } },
      { id: "tree-west", position: { x: 4, y: 18 } },
      { id: "tree-south", position: { x: 28, y: 26 } },
      { id: "tree-east", position: { x: 42, y: 17 } },
    ],
    input.map,
    TREE_SPAWN_RULE
  )

  const flowerPoints = resolveSpawnPointsForRule(
    [
      { id: "flower-meadow-1", position: { x: 13, y: 10 } },
      { id: "flower-meadow-2", position: { x: 16, y: 12 } },
      { id: "flower-meadow-3", position: { x: 20, y: 9 } },
      { id: "flower-home-1", position: { x: 23, y: 18 } },
      { id: "flower-home-2", position: { x: 26, y: 19 } },
      { id: "flower-south-1", position: { x: 31, y: 24 } },
    ],
    input.map,
    FLOWER_SPAWN_RULE
  )

  const waterPoints = resolveSpawnPointsForRule(
    [
      { id: "water-pond-1", position: { x: 9, y: 23 } },
      { id: "water-pond-2", position: { x: 10, y: 24 } },
      { id: "water-pond-3", position: { x: 11, y: 23 } },
    ],
    input.map,
    WATER_SPAWN_RULE
  )

  const butterflyPoints = resolveSpawnPointsForRule(
    [
      { id: "butterfly-meadow-1", position: { x: 15, y: 11 } },
      { id: "butterfly-meadow-2", position: { x: 22, y: 14 } },
    ],
    input.map,
    BUTTERFLY_SPAWN_RULE
  )

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

function resolveSpawnPointsForRule(
  points: NaturalEntitySpawnPoint[],
  map: WorldMapState,
  rule: SpawnRule
): NaturalEntitySpawnPoint[] {
  const usedPositions = new Set<string>()

  return points.map((point) => {
    const safePosition = findNearestAllowedPosition({
      preferred: point.position,
      map,
      rule,
      usedPositions,
    })

    usedPositions.add(createPositionKey(safePosition))

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

  return findFirstAllowedMapPosition({
    map: input.map,
    rule: input.rule,
    usedPositions: input.usedPositions,
  }) ?? preferred
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

  return true
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

function clampPositionToMap(
  position: WorldPosition,
  map: WorldMapState
): WorldPosition {
  return {
    x: clampNumber(Math.round(position.x), 0, Math.max(0, map.size.width - 1)),
    y: clampNumber(Math.round(position.y), 0, Math.max(0, map.size.height - 1)),
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}