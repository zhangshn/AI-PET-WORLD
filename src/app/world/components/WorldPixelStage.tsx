"use client"

/**
 * 当前文件负责：渲染小镇级原始自然地块、临时孵化小屋、管家建设中的家园、宠物、管家、世界刺激、生态区域与鼠标拖拽摄像机。
 */

import { useCallback, useEffect, useRef } from "react"
import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  Ticker,
} from "pixi.js"

import type { TimeState } from "@/engine/timeSystem"
import type { PetState } from "@/types/pet"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { WorldStimulus } from "@/ai/gateway"
import type { ActiveBehaviorProcess } from "@/ai/behavior-core/behavior-types"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldZone } from "@/world/ecology/world-zone-types"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import type { WorldMapTileType } from "@/world/map/world-map"

import styles from "@/styles/world-styles/world-pixel-stage.module.css"

type Props = {
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  incubator: IncubatorState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
  worldRuntime: WorldRuntimeState | null
  tick: number
}

type EntityMotionState = {
  x: number
  y: number
  targetX: number
  targetY: number
  speed: number
}

type CameraState = {
  x: number
  y: number
  dragging: boolean
  lastPointerX: number
  lastPointerY: number
}

type StimulusVisualState = {
  container: Container
  label: Text
  baseX: number
  baseY: number
  type: string
}

const STAGE_WIDTH = 1280
const STAGE_HEIGHT = 720

const TEMP_SHELTER_POSITION = { x: 205, y: 235 }
const INCUBATOR_POSITION = { x: 240, y: 282 }
const HOME_CONSTRUCTION_POSITION = { x: 1040, y: 520 }
const GARDEN_POSITION = { x: 690, y: 540 }

const PET_CENTER_ZONE = { x: 620, y: 420 }
const PET_EXPLORE_ZONE_A = { x: 980, y: 350 }
const PET_EXPLORE_ZONE_B = { x: 1120, y: 620 }
const PET_OBSERVE_ZONE = { x: 760, y: 455 }
const PET_ALERT_ZONE = { x: 680, y: 420 }
const PET_IDLE_ZONE = { x: 640, y: 430 }
const PET_SLEEP_ZONE = { x: 1090, y: 600 }
const PET_REST_ZONE = { x: 1040, y: 590 }
const PET_EAT_ZONE = { x: 720, y: 570 }
const PET_APPROACH_ZONE = { x: 560, y: 440 }

const BUTLER_INCUBATOR_ZONE = { x: 340, y: 340 }
const BUTLER_HOME_ZONE = { x: 900, y: 540 }
const BUTLER_IDLE_ZONE = { x: 520, y: 420 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getOverlayAlpha(period?: string): number {
  if (period === "Morning") return 0.025
  if (period === "Daytime") return 0
  if (period === "Evening") return 0.06
  if (period === "Night") return 0.16
  return 0.02
}

function getTileColor(type: WorldMapTileType): number {
  switch (type) {
    case "wild_grass":
      return 0x5f9f45
    case "short_grass":
      return 0x79b957
    case "soil":
      return 0xa86f3f
    case "flower_patch":
      return 0x76b852
    case "stone":
      return 0x8a8f7a
    case "water":
      return 0x4fa3d1
    case "forest_edge":
      return 0x3f7f39
    case "mud":
      return 0x7a5738
    case "path":
      return 0xc28a4a
    case "shelter_foundation":
      return 0xb78b58
    case "garden_soil":
      return 0x9a6336
    default:
      return 0x79b957
  }
}

function getTileColorWithVariation(type: WorldMapTileType, x: number, y: number): number {
  const baseColor = getTileColor(type)
  const variation = ((x * 17 + y * 31) % 5) - 2

  if (variation === 0) return baseColor

  const r = (baseColor >> 16) & 255
  const g = (baseColor >> 8) & 255
  const b = baseColor & 255

  const amount = variation * 5

  const nextR = clamp(r + amount, 0, 255)
  const nextG = clamp(g + amount, 0, 255)
  const nextB = clamp(b + amount, 0, 255)

  return (nextR << 16) + (nextG << 8) + nextB
}

function drawTileDetail(
  graphic: Graphics,
  type: WorldMapTileType,
  x: number,
  y: number,
  tileSize: number
) {
  if (type === "short_grass") {
    graphic.rect(x + 4, y + 18, 3, 4).fill(0x5f9f45)
    graphic.rect(x + 15, y + 12, 2, 5).fill(0x6dad4f)
    return
  }

  if (type === "wild_grass") {
    graphic.rect(x + 4, y + 13, 4, 9).fill(0x3f7f39)
    graphic.rect(x + 11, y + 9, 3, 11).fill(0x4f9142)
    graphic.rect(x + 18, y + 14, 3, 8).fill(0x3f7f39)
    return
  }

  if (type === "path") {
    graphic.rect(x, y, tileSize, 3).fill({ color: 0xf0b96a, alpha: 0.35 })
    graphic.rect(x + 4, y + 8, 5, 3).fill({ color: 0x8a5a2b, alpha: 0.22 })
    graphic.rect(x + 15, y + 16, 4, 3).fill({ color: 0x8a5a2b, alpha: 0.18 })
    return
  }

  if (type === "soil" || type === "garden_soil") {
    graphic.rect(x + 2, y + 6, tileSize - 4, 2).fill({ color: 0x70421f, alpha: 0.35 })
    graphic.rect(x + 2, y + 14, tileSize - 4, 2).fill({ color: 0x70421f, alpha: 0.28 })
    graphic.rect(x + 2, y + 21, tileSize - 4, 2).fill({ color: 0x70421f, alpha: 0.22 })
    return
  }

  if (type === "flower_patch") {
    graphic.rect(x + 7, y + 7, 3, 3).fill(0xf7a8c8)
    graphic.rect(x + 14, y + 10, 3, 3).fill(0xffd166)
    graphic.rect(x + 17, y + 16, 3, 3).fill(0xf28482)
    graphic.rect(x + 6, y + 16, 3, 4).fill(0x3f7f39)
    return
  }

  if (type === "forest_edge") {
    graphic.rect(x + 4, y + 10, 16, 12).fill(0x2f6b2f)
    graphic.rect(x + 8, y + 15, 6, 9).fill(0x7a4b2a)
    graphic.rect(x + 1, y + 5, 22, 10).fill(0x4f9142)
    graphic.rect(x + 5, y + 2, 14, 7).fill(0x5fa34b)
    return
  }

  if (type === "water") {
    graphic.rect(x + 2, y + 7, tileSize - 4, 3).fill(0x8ed3ef)
    graphic.rect(x + 6, y + 15, tileSize - 10, 2).fill(0xb7e7f7)
    graphic.rect(x + 1, y + tileSize - 3, tileSize - 2, 3).fill({
      color: 0x2f7fad,
      alpha: 0.45,
    })
    return
  }

  if (type === "stone") {
    graphic.rect(x + 6, y + 9, 12, 9).fill(0xa6a990)
    graphic.rect(x + 8, y + 7, 9, 4).fill(0xd0d2b8)
    graphic.rect(x + 10, y + 17, 8, 2).fill(0x686b5a)
    return
  }

  if (type === "mud") {
    graphic.rect(x + 5, y + 9, 12, 3).fill(0x5a3b22)
    graphic.rect(x + 11, y + 17, 8, 2).fill(0x5a3b22)
    graphic.rect(x + 2, y + 21, 16, 2).fill({ color: 0x3f2a18, alpha: 0.35 })
  }
}

function drawTempShelter(layer: Container) {
  const shadow = new Graphics()
  shadow.rect(
    TEMP_SHELTER_POSITION.x - 12,
    TEMP_SHELTER_POSITION.y + 88,
    160,
    34
  ).fill({ color: 0x000000, alpha: 0.22 })
  layer.addChild(shadow)

  const shelter = new Graphics()
  shelter.rect(
    TEMP_SHELTER_POSITION.x,
    TEMP_SHELTER_POSITION.y,
    135,
    112
  ).fill(0x4a3426)
  shelter.rect(
    TEMP_SHELTER_POSITION.x + 10,
    TEMP_SHELTER_POSITION.y + 12,
    115,
    92
  ).fill(0x7a5a3a)
  shelter.rect(
    TEMP_SHELTER_POSITION.x - 8,
    TEMP_SHELTER_POSITION.y - 14,
    151,
    18
  ).fill(0x5b2e16)
  shelter.rect(
    TEMP_SHELTER_POSITION.x + 20,
    TEMP_SHELTER_POSITION.y + 22,
    92,
    66
  ).fill({ color: 0x1f2937, alpha: 0.32 })
  shelter.rect(
    TEMP_SHELTER_POSITION.x + 26,
    TEMP_SHELTER_POSITION.y + 26,
    80,
    54
  ).stroke({ color: 0x2f2419, width: 3 })
  layer.addChild(shelter)
}

function drawHomeConstruction(layer: Container) {
  const shadow = new Graphics()
  shadow.rect(
    HOME_CONSTRUCTION_POSITION.x - 14,
    HOME_CONSTRUCTION_POSITION.y + 76,
    184,
    36
  ).fill({ color: 0x000000, alpha: 0.2 })
  layer.addChild(shadow)

  const home = new Graphics()
  home.rect(
    HOME_CONSTRUCTION_POSITION.x,
    HOME_CONSTRUCTION_POSITION.y,
    155,
    100
  ).fill({ color: 0x8b7355, alpha: 0.75 })
  home.rect(
    HOME_CONSTRUCTION_POSITION.x + 16,
    HOME_CONSTRUCTION_POSITION.y + 14,
    124,
    14
  ).fill(0x7c2d12)
  home.rect(
    HOME_CONSTRUCTION_POSITION.x + 34,
    HOME_CONSTRUCTION_POSITION.y + 52,
    26,
    48
  ).fill(0x6b3f1d)
  home.rect(
    HOME_CONSTRUCTION_POSITION.x + 90,
    HOME_CONSTRUCTION_POSITION.y + 44,
    24,
    22
  ).fill(0x93c5fd)
  home.rect(
    HOME_CONSTRUCTION_POSITION.x + 116,
    HOME_CONSTRUCTION_POSITION.y + 72,
    18,
    8
  ).fill(0xfacc15)
  layer.addChild(home)
}

function drawGarden(layer: Container) {
  const garden = new Graphics()
  garden.rect(
    GARDEN_POSITION.x,
    GARDEN_POSITION.y,
    120,
    56
  ).fill({ color: 0x6f4e25, alpha: 0.72 })
  garden.rect(GARDEN_POSITION.x + 15, GARDEN_POSITION.y + 13, 7, 7).fill(0x22c55e)
  garden.rect(GARDEN_POSITION.x + 48, GARDEN_POSITION.y + 28, 7, 7).fill(0xf472b6)
  garden.rect(GARDEN_POSITION.x + 88, GARDEN_POSITION.y + 15, 7, 7).fill(0xfacc15)
  garden.rect(GARDEN_POSITION.x + 10, GARDEN_POSITION.y + 42, 95, 3).fill({
    color: 0x3f2b16,
    alpha: 0.42,
  })
  layer.addChild(garden)
}

function drawAmbientNature(layer: Container, mapWidth: number, mapHeight: number) {
  const ambient = new Graphics()

  ambient.circle(430, 210, 150).fill({ color: 0x86efac, alpha: 0.035 })
  ambient.circle(800, 380, 210).fill({ color: 0x60a5fa, alpha: 0.025 })
  ambient.circle(mapWidth - 240, 160, 180).fill({ color: 0xfacc15, alpha: 0.025 })

  for (let index = 0; index < 34; index += 1) {
    const x = (index * 97) % Math.max(mapWidth, 1)
    const y = (index * 53) % Math.max(mapHeight, 1)
    const size = 3 + (index % 3)

    ambient.rect(x, y, size, size).fill({
      color: index % 2 === 0 ? 0x86efac : 0xfacc15,
      alpha: 0.2,
    })
  }

  layer.addChild(ambient)
}

function drawForegroundAtmosphere(layer: Container, mapWidth: number, mapHeight: number) {
  const atmosphere = new Graphics()

  atmosphere.rect(0, 0, mapWidth, 40).fill({ color: 0x000000, alpha: 0.08 })
  atmosphere.rect(0, mapHeight - 52, mapWidth, 52).fill({
    color: 0x000000,
    alpha: 0.12,
  })

  atmosphere.circle(360, 250, 110).fill({ color: 0x000000, alpha: 0.06 })
  atmosphere.circle(980, 520, 120).fill({ color: 0x000000, alpha: 0.07 })

  layer.addChild(atmosphere)
}

function getStimulusColor(type: string): number {
  if (type === "butterfly") return 0xffd166
  if (type === "breeze") return 0x93c5fd
  if (type === "temperature_drop") return 0x38bdf8
  if (type === "falling_leaf") return 0x84cc16
  if (type === "light_shift") return 0xf8fafc
  return 0xffffff
}

function getZoneVisual(zone: WorldZone): { color: number; alpha: number } {
  if (zone.type === "sleep_zone") return { color: 0x818cf8, alpha: 0.025 }
  if (zone.type === "food_zone") return { color: 0xf97316, alpha: 0.025 }
  if (zone.type === "warm_zone") return { color: 0xf59e0b, alpha: 0.03 }
  if (zone.type === "quiet_zone") return { color: 0x60a5fa, alpha: 0.025 }
  if (zone.type === "observation_zone") return { color: 0x22c55e, alpha: 0.025 }
  if (zone.type === "incubator_zone") return { color: 0x38bdf8, alpha: 0.025 }
  if (zone.type === "home_build_zone") return { color: 0xa78bfa, alpha: 0.025 }
  if (zone.type === "exploration_zone") return { color: 0xfacc15, alpha: 0.02 }

  return { color: 0x94a3b8, alpha: 0.02 }
}

function moveToward(state: EntityMotionState, deltaScale = 1) {
  const dx = state.targetX - state.x
  const dy = state.targetY - state.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < 0.5) {
    state.x = state.targetX
    state.y = state.targetY
    return
  }

  const step = state.speed * deltaScale

  if (distance <= step) {
    state.x = state.targetX
    state.y = state.targetY
    return
  }

  state.x += (dx / distance) * step
  state.y += (dy / distance) * step
}

function getPetBaseSpeed(
  action?: string,
  process?: ActiveBehaviorProcess | null,
  lifePhase?: string
): number {
  let baseSpeed = 0.7

  if (action === "exploring") baseSpeed = 1.8
  if (action === "walking") baseSpeed = 1.5
  if (action === "approaching") baseSpeed = 1.25
  if (action === "observing") baseSpeed = 0.55
  if (action === "eating" || action === "sleeping" || action === "resting") {
    baseSpeed = 0.35
  }

  if (process?.stage === "peak") baseSpeed *= 1.28
  if (process?.stage === "cooldown") baseSpeed *= 0.72

  if (lifePhase === "newborn") baseSpeed *= 0.28
  if (lifePhase === "adaptation") baseSpeed *= 0.45
  if (lifePhase === "dependent") baseSpeed *= 0.65

  return baseSpeed
}

function getButlerBaseSpeed(task?: string): number {
  if (task === "watching_incubator") return 1.15
  if (task === "building_home") return 1.2
  return 0.85
}

function getZonePosition(
  ecology: WorldEcologyState | null,
  zoneType: WorldZone["type"]
): { x: number; y: number } | null {
  const zone = ecology?.zones.find(
    (item) => item.type === zoneType && item.isActive
  )

  if (!zone) return null

  return {
    x: zone.x,
    y: zone.y,
  }
}

function getPetTargetPosition(
  pet: PetState | null,
  ecology: WorldEcologyState | null,
  tick: number
): { x: number; y: number } {
  if (!pet) return PET_CENTER_ZONE

  const lifePhase = pet.lifeState?.phase

  if (lifePhase === "newborn") {
    return {
      x: INCUBATOR_POSITION.x + 42,
      y: INCUBATOR_POSITION.y + 42,
    }
  }

  if (lifePhase === "adaptation") {
    return tick % 2 === 0
      ? { x: INCUBATOR_POSITION.x + 70, y: INCUBATOR_POSITION.y + 58 }
      : { x: TEMP_SHELTER_POSITION.x + 96, y: TEMP_SHELTER_POSITION.y + 86 }
  }

  if (lifePhase === "dependent" && pet.action === "exploring") {
    return PET_OBSERVE_ZONE
  }

  if (pet.action === "sleeping") {
    return getZonePosition(ecology, "sleep_zone") ?? PET_SLEEP_ZONE
  }

  if (pet.action === "eating") {
    return getZonePosition(ecology, "food_zone") ?? PET_EAT_ZONE
  }

  if (pet.action === "resting") {
    return (
      getZonePosition(ecology, "quiet_zone") ??
      getZonePosition(ecology, "warm_zone") ??
      PET_REST_ZONE
    )
  }

  if (pet.action === "observing") {
    return getZonePosition(ecology, "observation_zone") ?? PET_OBSERVE_ZONE
  }

  if (pet.action === "exploring") {
    return tick % 2 === 0 ? PET_EXPLORE_ZONE_A : PET_EXPLORE_ZONE_B
  }

  if (pet.action === "approaching") return PET_APPROACH_ZONE
  if (pet.action === "alert_idle") return PET_ALERT_ZONE
  if (pet.action === "idle") return PET_IDLE_ZONE

  return PET_CENTER_ZONE
}

function getButlerTargetPosition(
  butler: ButlerState | null,
  ecology: WorldEcologyState | null
): { x: number; y: number } {
  if (butler?.task === "watching_incubator") {
    return getZonePosition(ecology, "incubator_zone") ?? BUTLER_INCUBATOR_ZONE
  }

  if (butler?.task === "building_home") {
    return getZonePosition(ecology, "home_build_zone") ?? BUTLER_HOME_ZONE
  }

  return BUTLER_IDLE_ZONE
}

function getPetColor(pet: PetState | null): number {
  if (!pet) return 0xf8fafc
  if (pet.action === "sleeping") return 0x94a3b8
  if (pet.action === "eating") return 0xfacc15
  if (pet.action === "resting") return 0xa7f3d0
  if (pet.mood === "happy") return 0xf59e0b
  if (pet.mood === "alert") return 0xef4444
  if (pet.mood === "curious") return 0x22c55e
  return 0xf8fafc
}

function drawPetGraphic(graphic: Graphics, pet: PetState | null) {
  graphic.clear()

  const color = getPetColor(pet)

  if (pet?.action === "sleeping") {
    graphic.rect(0, 8, 26, 13).fill(color)
    graphic.rect(4, 2, 14, 8).fill(color)
    graphic.rect(28, -4, 5, 5).fill(0xe2e8f0)
    graphic.rect(35, -11, 6, 6).fill(0xf8fafc)
    return
  }

  graphic.rect(0, 0, 22, 18).fill(color)
  graphic.rect(4, -6, 14, 8).fill(color)
  graphic.rect(2, 18, 5, 5).fill(0x111827)
  graphic.rect(15, 18, 5, 5).fill(0x111827)
}

function getPetBob(action?: string, phase = 0): number {
  if (action === "sleeping") return Math.sin(phase * 1.6) * 0.45
  if (action === "exploring") return Math.sin(phase * 6.5) * 2.2
  if (action === "walking") return Math.sin(phase * 6) * 1.8
  return Math.sin(phase * 3) * 0.8
}

export default function WorldPixelStage(props: Props) {
  const latestRef = useRef<Props>(props)

  const mountRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)

  const worldLayerRef = useRef<Container | null>(null)
  const backgroundLayerRef = useRef<Container | null>(null)
  const landLayerRef = useRef<Container | null>(null)
  const structureLayerRef = useRef<Container | null>(null)
  const natureLayerRef = useRef<Container | null>(null)
  const zoneLayerRef = useRef<Container | null>(null)
  const stimulusLayerRef = useRef<Container | null>(null)
  const entityLayerRef = useRef<Container | null>(null)
  const foregroundLayerRef = useRef<Container | null>(null)
  const overlayRef = useRef<Graphics | null>(null)

  const petContainerRef = useRef<Container | null>(null)
  const petGraphicRef = useRef<Graphics | null>(null)
  const petLabelRef = useRef<Text | null>(null)

  const butlerContainerRef = useRef<Container | null>(null)
  const butlerLabelRef = useRef<Text | null>(null)

  const incubatorGraphicRef = useRef<Graphics | null>(null)

  const stimulusVisualsRef = useRef<Map<string, StimulusVisualState>>(new Map())

  const cameraRef = useRef<CameraState>({
    x: 0,
    y: 0,
    dragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
  })

  const petMotionRef = useRef<EntityMotionState>({
    x: 620,
    y: 420,
    targetX: 620,
    targetY: 420,
    speed: 1.1,
  })

  const butlerMotionRef = useRef<EntityMotionState>({
    x: 340,
    y: 340,
    targetX: 340,
    targetY: 340,
    speed: 0.95,
  })

  const tickerRef = useRef<Ticker | null>(null)
  const phaseRef = useRef(0)
  const lastMapIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    latestRef.current = props
  }, [props])

  const clampCamera = useCallback(() => {
    const runtime = latestRef.current.worldRuntime
    const map = runtime?.map

    const mapWidth = map ? map.size.width * map.tileSize : STAGE_WIDTH
    const mapHeight = map ? map.size.height * map.tileSize : STAGE_HEIGHT

    const minX = Math.min(0, STAGE_WIDTH - mapWidth)
    const minY = Math.min(0, STAGE_HEIGHT - mapHeight)

    cameraRef.current.x = clamp(cameraRef.current.x, minX, 0)
    cameraRef.current.y = clamp(cameraRef.current.y, minY, 0)
  }, [])

  const applyCamera = useCallback(() => {
    const worldLayer = worldLayerRef.current
    if (!worldLayer) return

    clampCamera()

    worldLayer.x = cameraRef.current.x
    worldLayer.y = cameraRef.current.y
  }, [clampCamera])

  const drawStaticLand = useCallback(() => {
    const backgroundLayer = backgroundLayerRef.current
    const terrainLayer = landLayerRef.current
    const structureLayer = structureLayerRef.current
    const natureLayer = natureLayerRef.current
    const foregroundLayer = foregroundLayerRef.current

    if (
      !backgroundLayer ||
      !terrainLayer ||
      !structureLayer ||
      !natureLayer ||
      !foregroundLayer
    ) {
      return
    }

    const map = latestRef.current.worldRuntime?.map
    const mapId = map?.id ?? "empty"

    if (lastMapIdRef.current === mapId && terrainLayer.children.length > 0) {
      return
    }

    lastMapIdRef.current = mapId

    backgroundLayer.removeChildren()
    terrainLayer.removeChildren()
    structureLayer.removeChildren()
    natureLayer.removeChildren()
    foregroundLayer.removeChildren()

    const mapWidth = map ? map.size.width * map.tileSize : STAGE_WIDTH
    const mapHeight = map ? map.size.height * map.tileSize : STAGE_HEIGHT

    const background = new Graphics()
    background.rect(0, 0, mapWidth, mapHeight).fill(0x102818)
    background.circle(250, 160, 220).fill({ color: 0x1f4d2b, alpha: 0.34 })
    background.circle(mapWidth - 260, 260, 260).fill({
      color: 0x163d2a,
      alpha: 0.28,
    })
    backgroundLayer.addChild(background)

    if (map) {
      const terrainGraphic = new Graphics()
      const natureDetailGraphic = new Graphics()

      for (const tile of map.tiles) {
        const x = tile.x * map.tileSize
        const y = tile.y * map.tileSize

        terrainGraphic.rect(x, y, map.tileSize, map.tileSize).fill(
          getTileColorWithVariation(tile.type, tile.x, tile.y)
        )

        drawTileDetail(natureDetailGraphic, tile.type, x, y, map.tileSize)
      }

      terrainLayer.addChild(terrainGraphic)
      natureLayer.addChild(natureDetailGraphic)
    }

    drawAmbientNature(natureLayer, mapWidth, mapHeight)
    drawTempShelter(structureLayer)
    drawHomeConstruction(structureLayer)
    drawGarden(structureLayer)
    drawForegroundAtmosphere(foregroundLayer, mapWidth, mapHeight)
  }, [])

  const syncZones = useCallback(() => {
    const zoneLayer = zoneLayerRef.current
    if (!zoneLayer) return

    zoneLayer.removeChildren()

    const ecology = latestRef.current.ecology
    if (!ecology) return

    for (const zone of ecology.zones) {
      if (!zone.isActive) continue

      const visual = getZoneVisual(zone)
      const graphic = new Graphics()

      graphic.circle(0, 0, zone.radius).fill({
        color: visual.color,
        alpha: visual.alpha,
      })

      graphic.x = zone.x
      graphic.y = zone.y
      zoneLayer.addChild(graphic)
    }
  }, [])

  const createStaticEntities = useCallback(() => {
    const entityLayer = entityLayerRef.current
    if (!entityLayer) return

    if (!incubatorGraphicRef.current) {
      const container = new Container()
      const graphic = new Graphics()

      const label = new Text({
        text: "孵化器 / Incubator",
        style: new TextStyle({
          fill: 0xe2e8f0,
          fontSize: 10,
        }),
      })

      label.x = -10
      label.y = -18
      label.visible = false

      container.x = INCUBATOR_POSITION.x
      container.y = INCUBATOR_POSITION.y
      container.addChild(graphic)
      container.addChild(label)

      incubatorGraphicRef.current = graphic
      entityLayer.addChild(container)
    }

    if (!butlerContainerRef.current) {
      const container = new Container()
      const graphic = new Graphics()

      graphic.rect(0, 0, 18, 18).fill(0xf5d0a9)
      graphic.rect(-4, 18, 26, 30).fill(0x6366f1)
      graphic.rect(-2, 48, 8, 20).fill(0x1e293b)
      graphic.rect(12, 48, 8, 20).fill(0x1e293b)

      const label = new Text({
        text: "管家",
        style: new TextStyle({
          fill: 0xe2e8f0,
          fontSize: 11,
        }),
      })

      label.x = -36
      label.y = -22
      label.visible = false

      container.addChild(graphic)
      container.addChild(label)

      butlerContainerRef.current = container
      butlerLabelRef.current = label
      entityLayer.addChild(container)
    }

    if (!petContainerRef.current) {
      const container = new Container()
      const graphic = new Graphics()

      const label = new Text({
        text: "Pet",
        style: new TextStyle({
          fill: 0xf8fafc,
          fontSize: 11,
        }),
      })

      label.x = -12
      label.y = -22

      container.addChild(graphic)
      container.addChild(label)
      label.visible = false

      petContainerRef.current = container
      petGraphicRef.current = graphic
      petLabelRef.current = label

      entityLayer.addChild(container)
    }
  }, [])

  const syncIncubator = useCallback(() => {
    const graphic = incubatorGraphicRef.current
    if (!graphic) return

    const progress = latestRef.current.incubator?.progress ?? 0
    const fillWidth = Math.max(0, Math.min(42, Math.round(progress * 0.42)))

    graphic.clear()
    graphic.rect(0, 0, 54, 42).fill(0x475569)
    graphic.rect(8, 8, 38, 20).fill(0x7dd3fc)
    graphic.rect(7, 34, 42, 5).fill(0x0f172a)
    graphic.rect(7, 34, fillWidth, 5).fill(0x22c55e)
  }, [])

  const syncStimuli = useCallback(() => {
    const layer = stimulusLayerRef.current
    if (!layer) return

    const stimuli = latestRef.current.stimuli.slice(0, 8)
    const activeIds = new Set(stimuli.map((item) => item.id))

    for (const [id, visual] of stimulusVisualsRef.current.entries()) {
      if (!activeIds.has(id)) {
        layer.removeChild(visual.container)
        layer.removeChild(visual.label)
        visual.container.destroy({ children: true })
        visual.label.destroy()
        stimulusVisualsRef.current.delete(id)
      }
    }

    stimuli.forEach((stimulus, index) => {
      const existing = stimulusVisualsRef.current.get(stimulus.id)
      const point = stimulus.worldPosition ?? {
        x: 520 + index * 40,
        y: 420,
      }

      if (existing) {
        existing.baseX = point.x
        existing.baseY = point.y
        existing.type = stimulus.type
        existing.label.text = stimulus.type
        return
      }

      const color = getStimulusColor(stimulus.type)
      const container = new Container()
      const marker = new Graphics()

      marker.rect(-5, -5, 10, 10).fill(color)

      container.x = point.x
      container.y = point.y
      container.addChild(marker)

      const label = new Text({
        text: stimulus.type,
        style: new TextStyle({
          fill: 0xe2e8f0,
          fontSize: 10,
        }),
      })

      label.x = point.x - 18
      label.y = point.y - 18
      label.visible = false

      layer.addChild(container)
      layer.addChild(label)

      stimulusVisualsRef.current.set(stimulus.id, {
        container,
        label,
        baseX: point.x,
        baseY: point.y,
        type: stimulus.type,
      })
    })
  }, [])

  

  

  const syncLighting = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const period = latestRef.current.time?.period

    const color =
      period === "Morning"
        ? 0xffe8a3
        : period === "Evening"
          ? 0xff9f5a
          : period === "Night"
            ? 0x233b6e
            : 0xffffff

    overlay.clear()

    overlay.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill({
      color,
      alpha: getOverlayAlpha(period),
    })
  }, [])

  const syncTargets = useCallback(() => {
    const { pet, butler, ecology, tick } = latestRef.current

    const petTarget = getPetTargetPosition(pet, ecology, tick)
    petMotionRef.current.targetX = petTarget.x
    petMotionRef.current.targetY = petTarget.y
    petMotionRef.current.speed = getPetBaseSpeed(
      pet?.action,
      pet?.activeBehaviorProcess,
      pet?.lifeState?.phase
    )

    const butlerTarget = getButlerTargetPosition(butler, ecology)
    butlerMotionRef.current.targetX = butlerTarget.x
    butlerMotionRef.current.targetY = butlerTarget.y
    butlerMotionRef.current.speed = getButlerBaseSpeed(butler?.task)
  }, [])

  const syncScene = useCallback(() => {
  drawStaticLand()

  createStaticEntities()

  syncZones()

  syncIncubator()

  syncStimuli()

  syncLighting()

  syncTargets()

  applyCamera()
}, [
  applyCamera,
  createStaticEntities,
  drawStaticLand,
  syncIncubator,
  syncLighting,
  syncStimuli,
  syncTargets,
  syncZones,
])

  const updateMotion = useCallback((deltaTime: number) => {
    phaseRef.current += deltaTime * 0.05

    const { pet, butler } = latestRef.current

    if (petContainerRef.current) {
      petContainerRef.current.visible = !!pet

      if (pet) {
        moveToward(petMotionRef.current, deltaTime * 0.5)

        petContainerRef.current.x = petMotionRef.current.x
        petContainerRef.current.y =
          petMotionRef.current.y + getPetBob(pet.action, phaseRef.current)

        if (petLabelRef.current) {
          petLabelRef.current.text = `${pet.name} / ${pet.action}`
        }

        if (petGraphicRef.current) {
          drawPetGraphic(petGraphicRef.current, pet)
        }
      }
    }

    if (butlerContainerRef.current) {
      moveToward(butlerMotionRef.current, deltaTime * 0.5)

      butlerContainerRef.current.x = butlerMotionRef.current.x
      butlerContainerRef.current.y =
        butlerMotionRef.current.y + Math.sin(phaseRef.current * 4) * 1.1

      if (butlerLabelRef.current) {
        butlerLabelRef.current.text = `${butler?.task ?? "idle"} / 管家`
      }
    }

    let stimulusIndex = 0

    stimulusVisualsRef.current.forEach((visual) => {
      const phase = phaseRef.current + stimulusIndex * 0.6
      stimulusIndex += 1

      visual.container.x = visual.baseX + Math.sin(phase * 3) * 4
      visual.container.y = visual.baseY + Math.cos(phase * 4) * 3
      visual.label.x = visual.container.x - 18
      visual.label.y = visual.container.y - 18
    })
  }, [])

  useEffect(() => {
    let disposed = false

    async function setupPixi() {
      if (!mountRef.current || appRef.current) return

      const app = new Application()
      await app.init({
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        antialias: false,
        background: "#79b957",
        resolution: window.devicePixelRatio || 1,
      })

      if (disposed) {
        app.destroy(true)
        return
      }

      appRef.current = app
      mountRef.current.appendChild(app.canvas)

      const worldLayer = new Container()
      const backgroundLayer = new Container()
      const terrainLayer = new Container()
      const structureLayer = new Container()
      const natureLayer = new Container()
      const zoneLayer = new Container()
      const stimulusLayer = new Container()
      const entityLayer = new Container()
      const foregroundLayer = new Container()
      const overlay = new Graphics()

      worldLayerRef.current = worldLayer
      backgroundLayerRef.current = backgroundLayer
      landLayerRef.current = terrainLayer
      structureLayerRef.current = structureLayer
      natureLayerRef.current = natureLayer
      zoneLayerRef.current = zoneLayer
      stimulusLayerRef.current = stimulusLayer
      entityLayerRef.current = entityLayer
      foregroundLayerRef.current = foregroundLayer
      overlayRef.current = overlay

      worldLayer.addChild(backgroundLayer)
      worldLayer.addChild(terrainLayer)
      worldLayer.addChild(structureLayer)
      worldLayer.addChild(natureLayer)
      worldLayer.addChild(zoneLayer)
      worldLayer.addChild(stimulusLayer)
      worldLayer.addChild(entityLayer)
      worldLayer.addChild(foregroundLayer)

      app.stage.addChild(worldLayer)
      app.stage.addChild(overlay)

      app.stage.eventMode = "static"
      app.stage.hitArea = app.screen

      app.stage.on("pointerdown", (event) => {
        if (event.button !== 0) return

        cameraRef.current.dragging = true
        cameraRef.current.lastPointerX = event.global.x
        cameraRef.current.lastPointerY = event.global.y
      })

      app.stage.on("pointermove", (event) => {
        if (!cameraRef.current.dragging) return

        const dx = event.global.x - cameraRef.current.lastPointerX
        const dy = event.global.y - cameraRef.current.lastPointerY

        cameraRef.current.x += dx
        cameraRef.current.y += dy
        cameraRef.current.lastPointerX = event.global.x
        cameraRef.current.lastPointerY = event.global.y

        applyCamera()
      })

      app.stage.on("pointerup", () => {
        cameraRef.current.dragging = false
      })

      app.stage.on("pointerupoutside", () => {
        cameraRef.current.dragging = false
      })

      syncScene()

      const ticker = new Ticker()
      ticker.add((tickerInstance) => {
        updateMotion(tickerInstance.deltaTime)
      })
      ticker.start()
      tickerRef.current = ticker
    }

    setupPixi()

    const stimulusVisuals = stimulusVisualsRef.current

    return () => {
      disposed = true

      if (tickerRef.current) {
        tickerRef.current.stop()
        tickerRef.current.destroy()
        tickerRef.current = null
      }

      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }

      stimulusVisuals.clear()
    }
    // Pixi 只允许初始化一次，后续 React 状态通过 latestRef + syncScene 同步，避免闪屏。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    syncScene()
  }, [syncScene, props])

 return (
  <section className={styles.panel}>
    <div ref={mountRef} className={styles.stage} />

    <div className={styles.frameGlow} />
    <div className={styles.scanline} />

    <div className={styles.cornerLabel}>
      LIVE WORLD · AI 自主运行中
    </div>

    <div className={styles.stageHint}>
      鼠标左键拖拽查看世界
    </div>
  </section>
)
}