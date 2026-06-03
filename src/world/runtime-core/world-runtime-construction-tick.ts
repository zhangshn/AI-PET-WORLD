/**
 * 褰撳墠鏂囦欢鑱岃矗锛氳繍琛?World runtime construction tick銆?
 */

import type { ButlerRuntimeProfile } from "@/world/butler/butler-runtime-profile-schema"
import type {
  ConstructionPersistenceMode,
  ConstructionRuntimeVerticalSliceResult,
  ConstructionVisualRefreshMode,
} from "@/world/construction/construction-schema"
import { runConstructionRuntimeVerticalSlice } from "@/world/construction/construction-runtime-vertical-slice"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import {
  auditWorldRuntimeConstructionTick,
  type WorldRuntimeConstructionAudit,
} from "./world-runtime-construction-audit"
import {
  buildWorldRuntimeConstructionReport,
  type WorldRuntimeConstructionReport,
} from "./world-runtime-construction-report"

export type WorldRuntimeConstructionTickInput = {
  homeMapState: HomeMapState
  butlerProfile: ButlerRuntimeProfile
  constructionStyle: ButlerConstructionStyleVector
  worldDay: number
  now: number
  tickReason: "manual_debug" | "scheduled_tick" | "world_recovery" | "maintenance_check"
  persistenceMode: ConstructionPersistenceMode
  visualMode: ConstructionVisualRefreshMode
  tags: string[]
}

export type WorldRuntimeConstructionTickResult = {
  nextHomeMapState: HomeMapState
  constructionResult: ConstructionRuntimeVerticalSliceResult
  logs: string[]
  audit: WorldRuntimeConstructionAudit
  report: WorldRuntimeConstructionReport
  messages: string[]
  tags: string[]
}

export function runWorldRuntimeConstructionTick(
  input: WorldRuntimeConstructionTickInput
): WorldRuntimeConstructionTickResult {
  const constructionResult = runConstructionRuntimeVerticalSlice({
    homeMapState: input.homeMapState,
    constructionStyle: input.constructionStyle,
    worldDay: input.worldDay,
    now: input.now,
    runReason: input.tickReason,
    persistenceMode: input.persistenceMode,
    visualRefreshMode: input.visualMode,
    memoryPersistenceMode: "memory_preview",
    tags: [
      ...input.tags,
      "world_runtime_construction_tick",
      `butler:${input.butlerProfile.butlerId}`,
    ],
  })
  const audit = auditWorldRuntimeConstructionTick({
    inputHomeMapState: input.homeMapState,
    nextHomeMapState: constructionResult.nextHomeMapState,
    constructionWarnings: constructionResult.fullPipelineAudit.warnings,
    tickReason: input.tickReason,
  })
  const report = buildWorldRuntimeConstructionReport({
    constructionResult,
    tickReason: input.tickReason,
  }, audit)

  return {
    nextHomeMapState: constructionResult.nextHomeMapState,
    constructionResult,
    logs: report.messages,
    audit,
    report,
    messages: [
      "World runtime construction tick completed through construction vertical slice.",
      ...report.messages,
    ],
    tags: [
      "world_runtime_construction_tick_result",
      "construction_vertical_slice_driven",
      "no_unplanned_life_entry",
    ],
  }
}
