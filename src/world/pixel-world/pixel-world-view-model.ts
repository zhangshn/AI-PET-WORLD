import type { HomeMapState, HomeZone } from "@/world/map-state/home-map-state-schema"
import { composeScene } from "@/world/procedural-painter/scene-composer/scene-composer-gateway"
import type {
  SceneObject,
  SceneObjectLayer,
  SceneTile,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema"
import { adaptHomeMapStateToSceneComposerFact } from "@/world/procedural-painter/world-painter-adapter/world-painter-fact-adapter"
import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import {
  buildSpaceGridFromHomeMapState,
  type SpaceGrid,
} from "@/world/space"
import {
  buildTraceFieldFromWorld,
  type TraceFact,
  type TraceVisualKind,
} from "@/world/trace"

export type PixelWorldTileKind =
  | "grass"
  | "pressed_grass"
  | "worn_grass"
  | "exposed_soil"
  | "ecology_transition"
  | "recovery_growth"
  | "soil"
  | "built"
  | "boundary"

export type PixelWorldObjectKind =
  | "tree"
  | "bush"
  | "stone"
  | "flower"
  | "mushroom"
  | "insect_signal"
  | "structure"
  | "facility"

export type PixelWorldLayer = "back" | "middle" | "front"

export type PixelWorldSpriteKind = "butler" | "pet"

export type PixelWorldSpritePose =
  | "observe"
  | "maintain"
  | "wait"
  | "walk"
  | "idle"

export type PixelWorldTraceOverlayLayer = "ground" | "surface" | "attention"

export type PixelWorldTile = {
  id: string
  x: number
  y: number
  width: number
  height: number
  kind: PixelWorldTileKind
  variant: number
  traceIntensity: number
  traceSource: string
  passable: boolean
}

export type PixelWorldObject = {
  id: string
  kind: PixelWorldObjectKind
  x: number
  y: number
  layer: PixelWorldLayer
  scale: number
  opacity: number
  health: number
  growthStage: string
  label: string
}

export type PixelWorldSprite = {
  id: string
  kind: PixelWorldSpriteKind
  x: number
  y: number
  layer: PixelWorldLayer
  pose: PixelWorldSpritePose
  label: string
  visible: boolean
}

export type PixelWorldTraceOverlay = {
  id: string
  visualKind: Exclude<TraceVisualKind, "none">
  x: number
  y: number
  radius: number
  intensity: number
  opacity: number
  layer: PixelWorldTraceOverlayLayer
}

export type PixelWorldAtmosphere = {
  mood: "calm" | "warm" | "recovering" | "busy"
  weather: "clear" | "soft" | "damp"
  opacity: number
}

export type PixelWorldViewModel = {
  worldId: string
  ownerId: string
  tick: number
  savedAt: string
  map: {
    columns: number
    rows: number
    tileSize: number
    width: number
    height: number
  }
  tiles: PixelWorldTile[]
  objects: PixelWorldObject[]
  sprites: PixelWorldSprite[]
  traceOverlays: PixelWorldTraceOverlay[]
  atmosphere: PixelWorldAtmosphere
  butlerExplanation: {
    title: string
    body: string
  }
  pPhone: {
    unreadCount: number
    latestMessageTitle: string
    latestMessageBody: string
  }
  tags: string[]
}

export function buildPixelWorldViewModelFromRuntime(input: {
  saveRecord: WorldRuntimeSaveRecord
  isPersisted: boolean
}): PixelWorldViewModel {
  const { saveRecord } = input
  const homeMapState = saveRecord.homeMapState
  const firstSpaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState,
    traceField: saveRecord.traceField,
  })
  const traceField =
    saveRecord.traceField ??
    buildTraceFieldFromWorld({
      homeMapState,
      spaceGrid: firstSpaceGrid,
    })
  const spaceGrid =
    saveRecord.traceField === traceField
      ? firstSpaceGrid
      : buildSpaceGridFromHomeMapState({
          homeMapState,
          traceField,
        })
  const sceneAdapterResult = adaptHomeMapStateToSceneComposerFact({
    homeMapState,
  })
  const scenePlan = composeScene(sceneAdapterResult.sceneFact)
  const butlerSprite = buildButlerSprite({
    homeMapState,
    spaceGrid,
    saveRecord,
  })
  const petSprites = buildPetSprites(homeMapState)
  const latestEvent = saveRecord.recentEvents[saveRecord.recentEvents.length - 1]
  const tags = [
    "pixel_world_view_model",
    "no_world_fact_generation",
    "runtime_read_only_projection",
    input.isPersisted ? "runtime_save_persisted" : "runtime_save_fallback",
    saveRecord.traceField ? "persisted_trace_field_used" : "derived_trace_field_used_read_only",
    ...butlerSprite.tags,
  ]

  return {
    worldId: saveRecord.worldId,
    ownerId: saveRecord.ownerId,
    tick: saveRecord.tick,
    savedAt: saveRecord.savedAt,
    map: {
      columns: Math.max(1, Math.round(scenePlan.width / scenePlan.tileSize)),
      rows: Math.max(1, Math.round(scenePlan.height / scenePlan.tileSize)),
      tileSize: scenePlan.tileSize,
      width: scenePlan.width,
      height: scenePlan.height,
    },
    tiles: scenePlan.tiles.map((tile) =>
      mapSceneTileToPixelWorldTile({
        tile,
        tileSize: scenePlan.tileSize,
        spaceGrid,
      })
    ),
    objects: scenePlan.objects.flatMap(mapSceneObjectToPixelWorldObject),
    sprites: [butlerSprite.sprite, ...petSprites],
    traceOverlays: traceField.traces.flatMap(mapTraceToPixelWorldTraceOverlay),
    atmosphere: buildAtmosphere(homeMapState),
    butlerExplanation: buildButlerExplanation(saveRecord),
    pPhone: {
      unreadCount: latestEvent ? 1 : 0,
      latestMessageTitle: latestEvent?.title ?? "世界记录",
      latestMessageBody:
        latestEvent?.body ?? "世界正在等待下一次明确的运行推进。",
    },
    tags,
  }
}

function mapSceneTileToPixelWorldTile(input: {
  tile: SceneTile
  tileSize: number
  spaceGrid: SpaceGrid
}): PixelWorldTile {
  const relatedCell = findNearestSpaceCell(input.spaceGrid, input.tile)
  const visualKind = input.tile.visualKind ?? "grass"
  const kind =
    relatedCell?.regionKind === "boundary"
      ? "boundary"
      : relatedCell?.terrainKind === "built"
        ? "built"
        : relatedCell?.terrainKind === "soil"
          ? "soil"
          : mapSceneTileVisualKind(visualKind)

  return {
    id: input.tile.id,
    x: input.tile.x,
    y: input.tile.y,
    width: input.tileSize,
    height: input.tileSize,
    kind,
    variant: input.tile.variant,
    traceIntensity: input.tile.traceVisualIntensity ?? relatedCell?.traceStrength ?? 0,
    traceSource: input.tile.traceVisualSource ?? relatedCell?.traceLevel ?? "none",
    passable: relatedCell?.passable ?? true,
  }
}

function mapSceneTileVisualKind(value: string): PixelWorldTileKind {
  if (value === "pressed_grass") return "pressed_grass"
  if (value === "worn_grass") return "worn_grass"
  if (value === "exposed_soil") return "exposed_soil"
  if (value === "ecology_transition") return "ecology_transition"
  if (value === "recovery_growth") return "recovery_growth"

  return "grass"
}

function mapSceneObjectToPixelWorldObject(
  object: SceneObject
): PixelWorldObject[] {
  if (object.kind === "actor") return []

  return [
    {
      id: object.id,
      kind: mapSceneObjectKind(object),
      x: object.x,
      y: object.y,
      layer: mapSceneObjectLayer(object.layer),
      scale: object.scale,
      opacity: 0.72 + ((object.health ?? 80) / 100) * 0.24,
      health: object.health ?? object.ecologyHealth ?? 80,
      growthStage: object.growthStage ?? "mature",
      label: buildObjectLabel(object),
    },
  ]
}

function mapSceneObjectKind(object: SceneObject): PixelWorldObjectKind {
  if (object.kind === "tree") return "tree"
  if (object.kind === "bush") return "bush"
  if (object.kind === "stone") return "stone"
  if (object.kind === "flower") return "flower"
  if (object.kind === "mushroom") return "mushroom"
  if (object.kind === "insect_signal") return "insect_signal"
  if (object.ecologyRole === "placeholder") return "facility"

  return "structure"
}

function mapSceneObjectLayer(layer: SceneObjectLayer): PixelWorldLayer {
  if (layer === "back") return "back"
  if (layer === "front") return "front"

  return "middle"
}

function mapTraceToPixelWorldTraceOverlay(
  trace: TraceFact
): PixelWorldTraceOverlay[] {
  if (trace.visualHints.visualKind === "none") return []

  return [
    {
      id: `pixel_trace_${trace.id}`,
      visualKind: trace.visualHints.visualKind,
      x: trace.area.x,
      y: trace.area.y,
      radius: Math.max(6, Math.min(trace.area.radius, 96)),
      intensity: Math.max(0, Math.min(100, trace.visualHints.intensity)),
      opacity: Math.max(0.08, Math.min(0.42, trace.visualHints.opacityHint)),
      layer:
        trace.visualHints.visualKind === "attention_glow"
          ? "attention"
          : trace.visualHints.layerHint === "ground"
            ? "ground"
            : "surface",
    },
  ]
}

function buildButlerSprite(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  saveRecord: WorldRuntimeSaveRecord
}): {
  sprite: PixelWorldSprite
  tags: string[]
} {
  const actorPlacement = input.homeMapState.placements.find(
    (placement) =>
      placement.layer === "actor" &&
      (placement.tags.includes("butler") ||
        placement.id.toLowerCase().includes("butler") ||
        placement.label.toLowerCase().includes("butler"))
  )

  if (actorPlacement) {
    const actorPoint = placementToPixelPoint({
      x: actorPlacement.x,
      y: actorPlacement.y,
      homeMapState: input.homeMapState,
    })

    return {
      sprite: {
        id: "butler_sprite",
        kind: "butler",
        x: actorPoint.x,
        y: actorPoint.y,
        layer: "front",
        pose: mapButlerPose(input.saveRecord),
        label: "管家",
        visible: true,
      },
      tags: ["butler_sprite_position_from_actor_placement"],
    }
  }

  const fallbackZone = findButlerFallbackZone(input.homeMapState)
  const fallbackPoint = fallbackZone
    ? centerOfZone(fallbackZone, input.homeMapState)
    : input.spaceGrid.cells.find((cell) => cell.passable) ?? {
        x: input.homeMapState.mapSize.columns * input.homeMapState.mapSize.tileSize * 0.5,
        y: input.homeMapState.mapSize.rows * input.homeMapState.mapSize.tileSize * 0.5,
      }

  return {
    sprite: {
      id: "butler_sprite",
      kind: "butler",
      x: fallbackPoint.x,
      y: fallbackPoint.y,
      layer: "front",
      pose: mapButlerPose(input.saveRecord),
      label: "管家",
      visible: true,
    },
    tags: ["butler_sprite_position_fallback_from_zone_center"],
  }
}

function buildPetSprites(homeMapState: HomeMapState): PixelWorldSprite[] {
  return homeMapState.placements
    .filter(
      (placement) =>
        placement.layer === "actor" &&
        (placement.tags.includes("pet") ||
          placement.id.toLowerCase().includes("pet") ||
          placement.label.toLowerCase().includes("pet"))
    )
    .map((placement) => ({
      id: `pet_sprite_${placement.id}`,
      kind: "pet" as const,
      ...placementToPixelPoint({
        x: placement.x,
        y: placement.y,
        homeMapState,
      }),
      layer: "front" as const,
      pose: "idle" as const,
      label: placement.label,
      visible: true,
    }))
}

function placementToPixelPoint(input: {
  x: number
  y: number
  homeMapState: HomeMapState
}): { x: number; y: number } {
  const scale =
    input.x <= input.homeMapState.mapSize.columns &&
    input.y <= input.homeMapState.mapSize.rows
      ? input.homeMapState.mapSize.tileSize
      : 1

  return {
    x: input.x * scale,
    y: input.y * scale,
  }
}

function findButlerFallbackZone(homeMapState: HomeMapState): HomeZone | undefined {
  return (
    homeMapState.zones.find((zone) => zone.type === "visual_center") ??
    homeMapState.zones.find((zone) => zone.type === "entry_area") ??
    homeMapState.zones.find((zone) => zone.type === "quiet_living")
  )
}

function centerOfZone(
  zone: HomeZone,
  homeMapState: HomeMapState
): { x: number; y: number } {
  const scale =
    zone.bounds.x <= homeMapState.mapSize.columns &&
    zone.bounds.y <= homeMapState.mapSize.rows
      ? homeMapState.mapSize.tileSize
      : 1

  return {
    x: (zone.bounds.x + zone.bounds.width / 2) * scale,
    y: (zone.bounds.y + zone.bounds.height / 2) * scale,
  }
}

function mapButlerPose(saveRecord: WorldRuntimeSaveRecord): PixelWorldSpritePose {
  const motivation = saveRecord.lastButlerRuntimeDecision?.selectedMotivation

  if (motivation === "maintain_home") return "maintain"
  if (motivation === "observe_world") return "observe"
  if (motivation === "continue_construction") return "walk"
  if (motivation === "wait_for_resources") return "wait"

  return "idle"
}

function buildAtmosphere(homeMapState: HomeMapState): PixelWorldAtmosphere {
  if (homeMapState.resources.spacePressure > 74) {
    return {
      mood: "busy",
      weather: "soft",
      opacity: 0.22,
    }
  }

  if (homeMapState.resources.groundHealth < 42) {
    return {
      mood: "recovering",
      weather: "damp",
      opacity: 0.2,
    }
  }

  if (homeMapState.resources.careReadiness > 68) {
    return {
      mood: "warm",
      weather: "clear",
      opacity: 0.16,
    }
  }

  return {
    mood: "calm",
    weather: "clear",
    opacity: 0.14,
  }
}

function buildButlerExplanation(saveRecord: WorldRuntimeSaveRecord): {
  title: string
  body: string
} {
  const motivation = saveRecord.lastButlerRuntimeDecision?.selectedMotivation

  if (motivation === "maintain_home") {
    return {
      title: "管家正在照看家园",
      body: "它会优先观察地面、资源和痕迹变化，再决定下一步维护。",
    }
  }

  if (motivation === "observe_world") {
    return {
      title: "管家正在观察世界",
      body: "它把世界里的变化当成信号，而不是直接替用户改写事实。",
    }
  }

  if (motivation === "continue_construction") {
    return {
      title: "管家正在评估建设",
      body: "建设只会在资源与规则允许时继续推进。",
    }
  }

  return {
    title: "管家正在等待",
    body: "当前更适合先积累资源与观察变化。",
  }
}

function findNearestSpaceCell(
  spaceGrid: SpaceGrid,
  tile: SceneTile
) {
  const centerX = tile.x + spaceGrid.tileSize / 2
  const centerY = tile.y + spaceGrid.tileSize / 2

  return spaceGrid.cells.reduce(
    (nearest, cell) => {
      const distance = Math.hypot(cell.x - centerX, cell.y - centerY)

      if (!nearest || distance < nearest.distance) {
        return {
          cell,
          distance,
        }
      }

      return nearest
    },
    null as { cell: SpaceGrid["cells"][number]; distance: number } | null
  )?.cell
}

function buildObjectLabel(object: SceneObject): string {
  if (object.kind === "tree") return "树"
  if (object.kind === "bush") return "灌木"
  if (object.kind === "stone") return "石头"
  if (object.kind === "flower") return "花"
  if (object.kind === "mushroom") return "蘑菇"
  if (object.kind === "insect_signal") return "微小生态信号"

  return "世界对象"
}
