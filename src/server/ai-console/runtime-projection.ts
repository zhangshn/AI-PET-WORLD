import { readLatestGameMapRuntimeFrameRecord } from "@/world/game-map-frame/game-map-runtime-frame-store"
import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  createNotConnectedProjection,
  createProjection,
  createUnknownOrStaleProjection,
  type AiConsoleProjectionResult,
} from "./projection-contract"

const runtimeFrameSource = "formal_game_map_runtime_frame_store_v1"
const worldRuntimeSource = "formal_world_runtime_store_adapter_v1"

export function getAiConsoleRuntimeProjectionAvailability(workspaceSlug: string): "partial" | "not_connected" {
  return workspaceSlug === "frames" || workspaceSlug === "world" ? "partial" : "not_connected"
}

export async function queryAiConsoleRuntimeProjection(
  workspaceSlug: string,
): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "frames") return queryRuntimeFrameProjection()
  if (workspaceSlug === "world") return queryWorldRuntimeProjection()
  return createNotConnectedProjection()
}

async function queryRuntimeFrameProjection(): Promise<AiConsoleProjectionResult> {
  const result = await readLatestGameMapRuntimeFrameRecord()
  const evidenceReferences = [".runtime/game-map-runtime-frame/latest-runtime-frame.json"]

  if (result.status === "empty") {
    return createNotConnectedProjection("formal_runtime_frame_record_missing")
  }
  if (result.status !== "found" || !result.record) {
    return createUnknownOrStaleProjection({
      sourceIdentity: runtimeFrameSource,
      writerIdentity: "game_map_runtime_frame_store",
      reasonCode: result.warnings[0] ?? "formal_runtime_frame_record_invalid",
      evidenceReferences,
    })
  }

  const { record } = result
  const { runtimeFrame } = record
  return createProjection({
    dataStatus: "partial",
    sourceIdentity: runtimeFrameSource,
    writerIdentity: "game_map_runtime_frame_store",
    observedAtUtc: record.createdAt,
    evidenceReferences,
    trustStatus: "verified_registry",
    reasonCode: "capability_release_and_publish_registries_not_joined",
    unavailableFields: ["capabilityReleaseIdentity", "publishIdentity"],
    records: [{
      runtimeFrameIdentity: runtimeFrame.runtimeFrameId,
      worldId: record.worldId,
      tick: record.tick,
      capabilityReleaseIdentity: null,
      publishIdentity: null,
      runtimeFrameStatus: record.canShowInWorld ? "world_ready" : "world_blocked",
      recordIdentity: record.recordId,
      sourceFactCount: record.sourceFactIds.length,
      visualSource: runtimeFrame.visual.source,
      imageSha256: runtimeFrame.visual.imageSha256,
      terrainLayerCount: runtimeFrame.layers.terrain.length,
      objectLayerCount: runtimeFrame.layers.objects.length,
      interactionLayerCount: runtimeFrame.layers.interactions.length,
    }],
  })
}

async function queryWorldRuntimeProjection(): Promise<AiConsoleProjectionResult> {
  const result = await readWorldRuntimeSaveRecord()
  const evidenceReferences = ["data/world-runtime/latest-world.json"]

  if (result.status === "empty") {
    return createNotConnectedProjection("formal_world_runtime_record_missing")
  }
  if (result.status !== "found" || !result.record) {
    return createUnknownOrStaleProjection({
      sourceIdentity: worldRuntimeSource,
      writerIdentity: "world_runtime_store_adapter",
      reasonCode: result.warnings[0] ?? "formal_world_runtime_record_invalid",
      evidenceReferences,
    })
  }

  const { record } = result
  return createProjection({
    dataStatus: "partial",
    sourceIdentity: worldRuntimeSource,
    writerIdentity: "world_runtime_store_adapter",
    observedAtUtc: record.savedAt,
    evidenceReferences,
    trustStatus: "verified_registry",
    reasonCode: "runtime_frame_consumption_and_freeze_registries_not_joined",
    unavailableFields: ["activeRuntimeFrameIdentity", "consumptionStatus", "publishFreezeStatus"],
    records: [{
      worldId: record.worldId,
      currentTick: record.tick,
      activeRuntimeFrameIdentity: null,
      consumptionStatus: null,
      publishFreezeStatus: null,
      worldRuntimeStatus: "runtime_save_available",
      savedAtUtc: record.savedAt,
      runtimeSchemaVersion: record.version,
      recentEventCount: record.recentEvents.length,
      lastRuntimeActionTick: record.lastRuntimeAction?.tick ?? null,
    }],
  })
}
