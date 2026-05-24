/**
 * Runs one live-world tick from an existing HomeMapState.
 */

import { buildButlerMvpProfile } from "@/world/butler/butler-personality-adapter"
import { runMvpWorldRuntimeTick } from "@/world/mvp-core/mvp-world-runtime-tick"

import { auditWorldRuntimeTick } from "./world-runtime-audit"
import type {
  WorldRuntimeEventLog,
  WorldRuntimeSaveRecord,
  WorldRuntimeTickInput,
  WorldRuntimeTickResult,
} from "./world-runtime-schema"

const DEFAULT_BIRTH_INPUT = {
  birthYear: 1991,
  birthMonth: 6,
  birthDay: 18,
  birthHour: 8,
  timezone: "Asia/Shanghai",
}

export function runOneRuntimeTick(
  input: WorldRuntimeTickInput
): Omit<WorldRuntimeTickResult, "persisted"> {
  const nextTick = input.saveRecord.tick + 1
  const nowIso = new Date(input.now).toISOString()
  const butlerBuildResult = buildButlerMvpProfile({
    playerId: input.saveRecord.ownerId,
    ownerId: input.saveRecord.ownerId,
    worldId: input.saveRecord.worldId,
    seed: input.saveRecord.homeMapState.seed,
    ...DEFAULT_BIRTH_INPUT,
    tags: ["world_runtime_tick_butler_profile"],
  })
  const runtimeTick = runMvpWorldRuntimeTick({
    homeMapState: input.saveRecord.homeMapState,
    butlerProfile: butlerBuildResult.profile,
    constructionStyle: butlerBuildResult.profile.constructionStyle,
    worldDay: nextTick,
    now: input.now,
    tickReason: "scheduled_tick",
    persistenceMode: "proposal_only",
    visualMode: "signal_only",
    tags: [
      "live_world_runtime_tick",
      "server_side_runtime",
      "safe_apply_required",
      ...input.tags,
    ],
  })
  const event = buildRuntimeEvent({
    tick: nextTick,
    createdAt: nowIso,
    acceptedDiffCount:
      runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds.length,
    warningCount: runtimeTick.audit.warnings.length,
  })
  const recentEvents = [...input.saveRecord.recentEvents, event].slice(-20)
  const nextSaveRecord: WorldRuntimeSaveRecord = {
    version: "v2.6-runtime-00",
    worldId: input.saveRecord.worldId,
    ownerId: input.saveRecord.ownerId,
    tick: nextTick,
    savedAt: nowIso,
    homeMapState: runtimeTick.nextHomeMapState,
    recentEvents,
    tags: [
      "world_runtime_save_record",
      "safe_apply_output",
      "home_map_state_persisted_after_tick",
    ],
  }
  const audit = auditWorldRuntimeTick({
    nextHomeMapState: nextSaveRecord.homeMapState,
    events: [event],
  })

  return {
    previousSaveRecord: input.saveRecord,
    nextSaveRecord,
    runtimeTick,
    events: [event],
    audit,
    messages: [
      "Live world runtime tick completed.",
      ...runtimeTick.messages,
      ...audit.warnings,
    ],
    tags: [
      "world_runtime_tick_result",
      "map_diff_safe_apply_driven",
      "no_pet_fact_created",
    ],
  }
}

function buildRuntimeEvent(input: {
  tick: number
  createdAt: string
  acceptedDiffCount: number
  warningCount: number
}): WorldRuntimeEventLog {
  const changedText =
    input.acceptedDiffCount > 0
      ? `This tick wrote ${input.acceptedDiffCount} world change(s) through SafeApply.`
      : "The butler observed resources, space, and construction state without forcing a world change."

  return {
    id: `runtime-event-${input.tick}`,
    tick: input.tick,
    title: "World runtime continued",
    body: `${changedText} Audit warnings: ${input.warningCount}.`,
    source: input.acceptedDiffCount > 0 ? "safe_apply" : "butler",
    createdAt: input.createdAt,
    tags: [
      "world_runtime_event",
      "butler_autonomous_action",
      "safe_apply_checked",
      "no_pet_fact_created",
    ],
  }
}
