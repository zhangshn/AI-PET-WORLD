/**
 * 当前文件职责：运行 MVP world runtime tick。
 */

import type { ButlerMvpProfile } from "@/world/butler/butler-mvp-schema"
import type {
  ConstructionPersistenceMode,
  ConstructionRuntimeVerticalSliceResult,
  ConstructionVisualRefreshMode,
} from "@/world/construction/construction-schema"
import { runConstructionRuntimeVerticalSlice } from "@/world/construction/construction-runtime-vertical-slice"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import {
  auditMvpWorldRuntimeTick,
  type MvpWorldRuntimeAudit,
} from "./mvp-world-runtime-audit"
import {
  buildMvpWorldRuntimeReport,
  type MvpWorldRuntimeReport,
} from "./mvp-world-runtime-report"

export type MvpWorldRuntimeTickInput = {
  homeMapState: HomeMapState
  butlerProfile: ButlerMvpProfile
  constructionStyle: ButlerConstructionStyleVector
  worldDay: number
  now: number
  tickReason: "manual_debug" | "scheduled_tick" | "world_recovery" | "maintenance_check"
  persistenceMode: ConstructionPersistenceMode
  visualMode: ConstructionVisualRefreshMode
  tags: string[]
}

export type MvpWorldRuntimeTickResult = {
  nextHomeMapState: HomeMapState
  constructionResult: ConstructionRuntimeVerticalSliceResult
  logs: string[]
  audit: MvpWorldRuntimeAudit
  report: MvpWorldRuntimeReport
  messages: string[]
  tags: string[]
}

export function runMvpWorldRuntimeTick(
  input: MvpWorldRuntimeTickInput
): MvpWorldRuntimeTickResult {
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
      "mvp_world_runtime_tick",
      `butler:${input.butlerProfile.butlerId}`,
    ],
  })
  const audit = auditMvpWorldRuntimeTick({
    inputHomeMapState: input.homeMapState,
    nextHomeMapState: constructionResult.nextHomeMapState,
    constructionWarnings: constructionResult.fullPipelineAudit.warnings,
    tickReason: input.tickReason,
  })
  const report = buildMvpWorldRuntimeReport({
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
      "MVP world runtime tick completed through construction vertical slice.",
      ...report.messages,
    ],
    tags: [
      "mvp_world_runtime_tick_result",
      "construction_vertical_slice_driven",
      "no_default_companion_entry",
    ],
  }
}
