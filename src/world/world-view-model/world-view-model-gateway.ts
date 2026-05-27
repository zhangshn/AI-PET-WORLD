import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import { buildTraceFieldFromWorld } from "@/world/trace"

import { buildPPhoneView } from "./p-phone-view-mapper"
import { mapTraceFieldToWorldViewTraces } from "./trace-pixel-mapper"
import { buildWorldViewActors } from "./world-actor-mapper"
import { buildWorldViewAtmosphere } from "./world-atmosphere-mapper"
import { buildWorldViewObjectsFromHomeMapState } from "./world-object-mapper"
import { buildWorldViewTilesFromSpaceGrid } from "./world-tile-mapper"
import type { WorldViewModel } from "./world-view-model-schema"

export function buildWorldViewModelForPixelWorld(input: {
  saveRecord: WorldRuntimeSaveRecord
  isPersisted: boolean
}): WorldViewModel {
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

  return {
    worldId: saveRecord.worldId,
    ownerId: saveRecord.ownerId,
    tick: saveRecord.tick,
    savedAt: saveRecord.savedAt,
    canvas: {
      width: spaceGrid.width,
      height: spaceGrid.height,
      tileSize: spaceGrid.tileSize,
      columns: spaceGrid.columns,
      rows: spaceGrid.rows,
    },
    tiles: buildWorldViewTilesFromSpaceGrid({
      spaceGrid,
    }),
    objects: buildWorldViewObjectsFromHomeMapState({
      homeMapState,
      spaceGrid,
      traceField,
    }),
    traces: mapTraceFieldToWorldViewTraces({
      traces: traceField.traces,
    }),
    actors: buildWorldViewActors({
      homeMapState,
      spaceGrid,
      saveRecord,
    }),
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
      "world_pixel_rule_mapper_00",
      "space_grid_to_world_view_tiles",
      "trace_field_to_world_view_traces",
      "home_map_state_to_world_view_objects",
      "butler_state_to_world_view_actors",
      "no_svg_renderer_in_world",
      "no_scene_composer_gateway_in_world_view_model",
      "no_world_fact_generation",
      "runtime_read_only_projection",
      input.isPersisted ? "runtime_save_persisted" : "runtime_save_fallback",
      saveRecord.traceField ? "persisted_trace_field_used" : "derived_trace_field_used_read_only",
      "no_default_pet_actor",
      "pet_actor_requires_existing_fact",
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
