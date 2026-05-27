import type { SceneObject, SceneTile } from "@/world/procedural-painter/scene-composer/scene-composer-schema"
import {
  buildDefaultSceneComposerFact,
  composeScene,
} from "@/world/procedural-painter/scene-composer/scene-composer-gateway"
import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import { buildTraceFieldFromWorld } from "@/world/trace"

import { buildPPhoneView } from "./p-phone-view-mapper"
import { mapTraceFieldToWorldViewTraces } from "./trace-pixel-mapper"
import { buildWorldViewAtmosphere } from "./world-atmosphere-mapper"
import type {
  WorldViewActor,
  WorldViewActorPose,
  WorldViewModel,
  WorldViewObject,
  WorldViewObjectKind,
  WorldViewTile,
  WorldViewTileKind,
} from "./world-view-model-schema"

export function buildWorldViewModelForPixelWorld(input: {
  saveRecord: WorldRuntimeSaveRecord
  isPersisted: boolean
}): WorldViewModel {
  const { saveRecord } = input
  const homeMapState = saveRecord.homeMapState
  const baseSpaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState,
    traceField: saveRecord.traceField,
  })
  const traceField =
    saveRecord.traceField ??
    buildTraceFieldFromWorld({
      homeMapState,
      spaceGrid: baseSpaceGrid,
    })
  const scenePlan = composeScene(
    buildDefaultSceneComposerFact({
      id: `formal_pixel_world_${saveRecord.worldId}`,
      biome: "forest",
      moisture: resolveSceneMoisture(saveRecord),
      decorationDensity: resolveSceneDecorationDensity(saveRecord),
      traceShape: resolveSceneTraceShape(saveRecord),
      traceDensity: resolveSceneTraceDensity(saveRecord),
      worldSeed: `${homeMapState.seed}:${saveRecord.worldId}:formal-scene-composer-rules`,
      hasTraceFact: true,
      includeActorPlaceholder: true,
    })
  )
  const sceneActor = scenePlan.objects.find((object) => object.kind === "actor")

  return {
    worldId: saveRecord.worldId,
    ownerId: saveRecord.ownerId,
    tick: saveRecord.tick,
    savedAt: saveRecord.savedAt,
    canvas: {
      width: scenePlan.width,
      height: scenePlan.height,
      tileSize: scenePlan.tileSize,
      columns: Math.round(scenePlan.width / scenePlan.tileSize),
      rows: Math.round(scenePlan.height / scenePlan.tileSize),
    },
    tiles: scenePlan.tiles.map(mapSceneTileToWorldViewTile),
    objects: [
      ...scenePlan.objects
        .filter((object) => object.kind !== "actor")
        .map(mapSceneObjectToWorldViewObject),
      ...scenePlan.grassTufts.map((tuft): WorldViewObject => ({
        id: `scene_composer_grass_tuft_${tuft.id}`,
        kind: "bush",
        x: tuft.x,
        y: tuft.y,
        layer: tuft.layer,
        scale: Math.max(0.36, Math.min(0.72, tuft.height / 10)),
        opacity: tuft.light ? 0.72 : 0.58,
        health: tuft.light ? 82 : 66,
        growthStage: "young",
        label: "草簇",
        source: "derived_visual_only",
        tags: [
          "scene_composer_rules",
          "grass_tuft_visual",
          "derived_visual_only",
          "not_world_fact",
          "no_runtime_write",
        ],
      })),
    ],
    traces: mapTraceFieldToWorldViewTraces({
      traces: traceField.traces,
    }),
    actors: [buildButlerActorFromScene(saveRecord, sceneActor)],
    atmosphere: buildWorldViewAtmosphere({
      homeMapState,
      traceField,
      saveRecord,
    }),
    butlerExplanation: buildButlerExplanation(saveRecord),
    pPhone: buildPPhoneView({
      saveRecord,
    }),
    tags: [
      "world_view_model",
      "pixel_world_primary",
      "scene_composer_rules_primary",
      "composer_scene_plan_to_world_view_model",
      "no_svg_renderer_in_world",
      "no_world_fact_generation",
      "runtime_read_only_projection",
      input.isPersisted ? "runtime_save_persisted" : "runtime_save_fallback",
      saveRecord.traceField ? "persisted_trace_field_used" : "derived_trace_field_used_read_only",
      "no_default_pet_actor",
      "pet_actor_requires_existing_fact",
    ],
  }
}

function mapSceneTileToWorldViewTile(tile: SceneTile): WorldViewTile {
  return {
    id: `scene_composer_tile_${tile.id}`,
    x: tile.x,
    y: tile.y,
    width: 24,
    height: 24,
    kind: mapSceneTileKind(tile),
    variant: tile.variant,
    traceIntensity: tile.traceVisualIntensity ?? 0,
    traceSource: tile.traceVisualSource ?? "scene_composer",
    passable: true,
  }
}

function mapSceneTileKind(tile: SceneTile): WorldViewTileKind {
  if (tile.visualKind === "pressed_grass") return "pressed_grass"
  if (tile.visualKind === "worn_grass") return "worn_grass"
  if (tile.visualKind === "exposed_soil") return "exposed_soil"
  if (tile.visualKind === "ecology_transition") return "ecology_transition"
  if (tile.visualKind === "recovery_growth") return "recovery_growth"
  if (tile.kind === "path") return "worn_grass"
  if (tile.kind === "edge") return "ecology_transition"

  return "grass"
}

function mapSceneObjectToWorldViewObject(object: SceneObject): WorldViewObject {
  return {
    id: `scene_composer_object_${object.id}`,
    kind: mapSceneObjectKind(object.kind),
    x: object.x,
    y: object.y,
    layer: object.layer,
    scale: object.scale,
    opacity: resolveObjectOpacity(object),
    health: object.health ?? 72,
    growthStage: object.growthStage ?? "mature",
    label: labelForSceneObject(object.kind),
    source: "derived_visual_only",
    tags: [
      "scene_composer_rules",
      "derived_visual_only",
      "not_world_fact",
      "no_runtime_write",
      object.ecologyRole ? `ecology_role_${object.ecologyRole}` : "ecology_role_unknown",
      object.growthStage ? `growth_${object.growthStage}` : "growth_mature",
    ],
  }
}

function mapSceneObjectKind(kind: SceneObject["kind"]): WorldViewObjectKind {
  if (kind === "tree") return "tree"
  if (kind === "bush") return "bush"
  if (kind === "stone") return "stone"
  if (kind === "flower") return "flower"
  if (kind === "mushroom") return "mushroom"
  if (kind === "insect_signal") return "insect_signal"

  return "facility"
}

function buildButlerActorFromScene(
  saveRecord: WorldRuntimeSaveRecord,
  sceneActor: SceneObject | undefined
): WorldViewActor {
  return {
    id: "butler_actor",
    kind: "butler",
    x: sceneActor?.x ?? 336,
    y: sceneActor?.y ?? 252,
    layer: "front",
    pose: mapButlerPose(saveRecord),
    label: "管家",
    visible: true,
  }
}

function resolveSceneMoisture(saveRecord: WorldRuntimeSaveRecord): number {
  const resources = saveRecord.homeMapState.resources
  return clamp(Math.round(54 + resources.naturalGrowth * 0.24 + resources.groundHealth * 0.12), 48, 86)
}

function resolveSceneDecorationDensity(saveRecord: WorldRuntimeSaveRecord): number {
  const resources = saveRecord.homeMapState.resources
  return clamp(Math.round(42 + resources.naturalGrowth * 0.28 + resources.careReadiness * 0.18), 42, 82)
}

function resolveSceneTraceShape(saveRecord: WorldRuntimeSaveRecord): number {
  const pressure = saveRecord.homeMapState.resources.spacePressure
  const traceCount = saveRecord.traceField?.traces.length ?? 0
  return clamp(Math.round(46 + pressure * 0.16 + traceCount * 2), 42, 72)
}

function resolveSceneTraceDensity(saveRecord: WorldRuntimeSaveRecord): number {
  const pressure = saveRecord.homeMapState.resources.spacePressure
  const traceCount = saveRecord.traceField?.traces.length ?? 0
  return clamp(Math.round(48 + pressure * 0.12 + traceCount * 3), 44, 78)
}

function resolveObjectOpacity(object: SceneObject): number {
  const health = object.health ?? 72
  const stress = object.stressLevel ?? 0
  return Number(clamp(0.58 + health * 0.004 - stress * 0.002, 0.42, 0.96).toFixed(2))
}

function labelForSceneObject(kind: SceneObject["kind"]): string {
  if (kind === "tree") return "树"
  if (kind === "bush") return "灌木"
  if (kind === "stone") return "石头"
  if (kind === "flower") return "花"
  if (kind === "mushroom") return "蘑菇"
  if (kind === "insect_signal") return "生态信号"

  return "对象"
}

function mapButlerPose(saveRecord: WorldRuntimeSaveRecord): WorldViewActorPose {
  const motivation = saveRecord.lastButlerRuntimeDecision?.selectedMotivation

  if (motivation === "maintain_home") return "maintain"
  if (motivation === "observe_world") return "observe"
  if (motivation === "continue_construction") return "walk"
  if (motivation === "wait_for_resources") return "wait"

  return "idle"
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
