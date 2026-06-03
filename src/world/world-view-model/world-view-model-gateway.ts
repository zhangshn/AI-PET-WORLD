import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import { buildTraceFieldFromWorld } from "@/world/trace"

import { buildButlerExplanationView } from "./butler-explanation-mapper"
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
    butlerExplanation: buildButlerExplanationView({
      saveRecord,
    }),
    pPhone: buildPPhoneView({
      saveRecord,
    }),
    tags: [
      "world_view_model",
      "pixel_world_primary",
      "world_pixel_rule_mapper_00",
      "butler_trace_closure_explanation",
      "space_grid_to_world_view_tiles",
      "trace_field_to_world_view_traces",
      "home_map_state_to_world_view_objects",
      "butler_state_to_world_view_actors",
      "ui_auto_generation_input_boundary",
      "ui_reads_world_view_model_only",
      "ui_does_not_generate_world_facts",
      "no_svg_renderer_in_world",
      "no_scene_composer_gateway_in_world_view_model",
      "no_world_fact_generation",
      "runtime_read_only_projection",
      input.isPersisted ? "runtime_save_persisted" : "runtime_save_fallback",
      saveRecord.traceField ? "persisted_trace_field_used" : "derived_trace_field_used_read_only",
      "no_unplanned_life_actor",
      "life_actor_requires_existing_fact",
    ],
  }
}
