import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import { composeScene } from "@/world/procedural-painter/scene-composer/scene-composer-gateway"
import type {
  SceneObject,
  SceneObjectLayer,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema"
import { adaptHomeMapStateToSceneComposerFact } from "@/world/procedural-painter/world-painter-adapter/world-painter-fact-adapter"
import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import { buildTraceFieldFromWorld } from "@/world/trace"

import { buildWorldViewActors } from "./life-sprite-mapper"
import { mapSceneTilesToWorldViewTiles } from "./pixel-tile-mapper"
import { mapTraceFieldToWorldViewTraces } from "./trace-pixel-mapper"
import type {
  WorldViewAtmosphere,
  WorldViewLayer,
  WorldViewModel,
  WorldViewObject,
  WorldViewObjectKind,
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
  const spaceGrid =
    traceField === saveRecord.traceField
      ? baseSpaceGrid
      : buildSpaceGridFromHomeMapState({
          homeMapState,
          traceField,
        })
  const sceneAdapterResult = adaptHomeMapStateToSceneComposerFact({
    homeMapState,
  })
  const scenePlan = composeScene(sceneAdapterResult.sceneFact)
  const actorResult = buildWorldViewActors({
    homeMapState,
    spaceGrid,
    saveRecord,
  })
  const latestEvent = saveRecord.recentEvents[saveRecord.recentEvents.length - 1]

  return {
    worldId: saveRecord.worldId,
    ownerId: saveRecord.ownerId,
    tick: saveRecord.tick,
    savedAt: saveRecord.savedAt,
    canvas: {
      width: scenePlan.width,
      height: scenePlan.height,
      tileSize: scenePlan.tileSize,
      columns: Math.max(1, Math.round(scenePlan.width / scenePlan.tileSize)),
      rows: Math.max(1, Math.round(scenePlan.height / scenePlan.tileSize)),
    },
    tiles: mapSceneTilesToWorldViewTiles({
      tiles: scenePlan.tiles,
      tileSize: scenePlan.tileSize,
      spaceGrid,
    }),
    objects: scenePlan.objects.flatMap(mapSceneObjectToWorldViewObject),
    traces: mapTraceFieldToWorldViewTraces({
      traces: traceField.traces,
    }),
    actors: actorResult.actors,
    atmosphere: buildAtmosphere(homeMapState),
    butlerExplanation: buildButlerExplanation(saveRecord),
    pPhone: {
      unreadCount: latestEvent ? 1 : 0,
      latestMessageTitle: latestEvent?.title ?? "世界记录",
      latestMessageBody:
        latestEvent?.body ?? "世界正在等待下一次明确的运行推进。",
    },
    tags: [
      "world_view_model",
      "pixel_world_primary",
      "no_world_fact_generation",
      "runtime_read_only_projection",
      input.isPersisted ? "runtime_save_persisted" : "runtime_save_fallback",
      saveRecord.traceField ? "persisted_trace_field_used" : "derived_trace_field_used_read_only",
      ...actorResult.tags,
    ],
  }
}

function mapSceneObjectToWorldViewObject(object: SceneObject): WorldViewObject[] {
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

function mapSceneObjectKind(object: SceneObject): WorldViewObjectKind {
  if (object.kind === "tree") return "tree"
  if (object.kind === "bush") return "bush"
  if (object.kind === "stone") return "stone"
  if (object.kind === "flower") return "flower"
  if (object.kind === "mushroom") return "mushroom"
  if (object.kind === "insect_signal") return "insect_signal"
  if (object.ecologyRole === "placeholder") return "facility"

  return "structure"
}

function mapSceneObjectLayer(layer: SceneObjectLayer): WorldViewLayer {
  if (layer === "back") return "back"
  if (layer === "front") return "front"

  return "middle"
}

function buildAtmosphere(homeMapState: HomeMapState): WorldViewAtmosphere {
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

function buildObjectLabel(object: SceneObject): string {
  if (object.kind === "tree") return "树"
  if (object.kind === "bush") return "灌木"
  if (object.kind === "stone") return "石头"
  if (object.kind === "flower") return "花"
  if (object.kind === "mushroom") return "蘑菇"
  if (object.kind === "insect_signal") return "微小生态信号"

  return "世界对象"
}
