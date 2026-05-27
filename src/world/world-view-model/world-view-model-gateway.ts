import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import { buildTraceFieldFromWorld } from "@/world/trace"

import { buildWorldViewActors } from "./life-sprite-mapper"
import { buildPPhoneView } from "./p-phone-view-mapper"
import { buildWorldViewTilesFromSpaceGrid } from "./pixel-tile-mapper"
import { mapTraceFieldToWorldViewTraces } from "./trace-pixel-mapper"
import { buildWorldViewAtmosphere } from "./world-atmosphere-mapper"
import { buildWorldViewObjectsFromHomeMapState } from "./world-object-mapper"
import type { WorldViewModel } from "./world-view-model-schema"

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
  const actorResult = buildWorldViewActors({
    homeMapState,
    spaceGrid,
    saveRecord,
  })

  return {
    worldId: saveRecord.worldId,
    ownerId: saveRecord.ownerId,
    tick: saveRecord.tick,
    savedAt: saveRecord.savedAt,
    canvas: {
      width: homeMapState.mapSize.columns * homeMapState.mapSize.tileSize,
      height: homeMapState.mapSize.rows * homeMapState.mapSize.tileSize,
      tileSize: homeMapState.mapSize.tileSize,
      columns: homeMapState.mapSize.columns,
      rows: homeMapState.mapSize.rows,
    },
    tiles: buildWorldViewTilesFromSpaceGrid({
      spaceGrid,
      homeMapState,
      traceField,
    }),
    objects: buildWorldViewObjectsFromHomeMapState({
      homeMapState,
      spaceGrid,
      traceField,
    }),
    traces: mapTraceFieldToWorldViewTraces({
      traces: traceField.traces,
    }),
    actors: actorResult.actors,
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
      "composer_rules_to_viewmodel",
      "no_world_fact_generation",
      "runtime_read_only_projection",
      input.isPersisted ? "runtime_save_persisted" : "runtime_save_fallback",
      saveRecord.traceField ? "persisted_trace_field_used" : "derived_trace_field_used_read_only",
      ...actorResult.tags,
    ],
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
