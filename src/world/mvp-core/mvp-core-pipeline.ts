/**
 * 当前文件职责：串联 AI-PET-WORLD MVP 必交付完整闭环。
 */

import { auditButlerMvpProfile } from "@/world/butler/butler-mvp-audit"
import { buildButlerMvpReport } from "@/world/butler/butler-mvp-report"
import { buildButlerMvpProfile } from "@/world/butler/butler-personality-adapter"
import { buildTownAdoptionPrecheckBuilderResult } from "@/world/adoption/town-adoption-candidate-builder"

import { auditAiPetWorldMvpPipeline } from "./mvp-core-audit"
import {
  buildAiPetWorldMvpReport,
  summarizeAiPetWorldMvpPipeline,
} from "./mvp-core-report"
import { runMvpCoreDebugRunner } from "./mvp-core-debug-runner"
import type {
  AiPetWorldMvpAudit,
  AiPetWorldMvpPipelineInput,
  AiPetWorldMvpPipelineResult,
  AiPetWorldMvpReport,
} from "./mvp-core-schema"
import { buildMvpButlerExplanations } from "./mvp-butler-explanation"
import { buildMvpFormalVisualRefresh } from "./mvp-formal-visual-refresh"
import { buildMvpInitialWorld } from "./mvp-initial-world-builder"
import { runMvpPersistenceDryRun } from "./mvp-persistence-dry-run"
import { buildMvpPPhoneData } from "./mvp-pphone-data"
import { buildMvpVisualRefresh } from "./mvp-visual-refresh"
import { buildMvpWorldLogEntries } from "./mvp-world-log"
import { runMvpWorldRuntimeTick } from "./mvp-world-runtime-tick"

export function runAiPetWorldMvpPipeline(
  input: AiPetWorldMvpPipelineInput
): AiPetWorldMvpPipelineResult {
  const butlerBuildResult = buildButlerMvpProfile({
    playerId: input.playerId,
    ownerId: input.ownerId,
    worldId: input.worldId,
    birthYear: input.birthYear,
    birthMonth: input.birthMonth,
    birthDay: input.birthDay,
    birthHour: input.birthHour,
    timezone: input.timezone,
    seed: input.seed,
    tags: input.tags,
  })
  const butlerAudit = auditButlerMvpProfile(butlerBuildResult)
  const butlerReport = buildButlerMvpReport(butlerBuildResult, butlerAudit)
  const initialWorld = buildMvpInitialWorld({
    worldId: input.worldId,
    ownerId: input.ownerId,
    seed: input.seed,
    butlerProfile: butlerBuildResult.profile,
    worldDay: input.worldDay,
    now: input.now,
    biomeType: input.biomeType,
    tags: input.tags,
  })
  const runtimeTick = runMvpWorldRuntimeTick({
    homeMapState: initialWorld.homeMapState,
    butlerProfile: butlerBuildResult.profile,
    constructionStyle: butlerBuildResult.profile.constructionStyle,
    worldDay: input.worldDay,
    now: input.now,
    tickReason: input.runMode === "mvp" ? "scheduled_tick" : "manual_debug",
    persistenceMode:
      input.persistenceMode === "disabled" ? "disabled" : "proposal_only",
    visualMode: input.visualMode === "disabled" ? "disabled" : "signal_only",
    tags: input.tags,
  })
  const acceptedDiffIds =
    runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds
  const changedPlacementIds =
    runtimeTick.constructionResult.visualRefreshBridgeResult.changedPlacementIds
  const persistence = runMvpPersistenceDryRun({
    mode: input.persistenceMode,
    baseHomeMapState: initialWorld.homeMapState,
    nextHomeMapState: runtimeTick.nextHomeMapState,
    acceptedDiffIds,
    warnings: runtimeTick.audit.warnings,
    tags: input.tags,
  })
  const visualRefresh = buildMvpVisualRefresh({
    nextHomeMapState: runtimeTick.nextHomeMapState,
    acceptedDiffIds,
    changedPlacementIds,
    warnings: runtimeTick.audit.warnings,
    tags: input.tags,
  })
  const formalVisualRefresh = buildMvpFormalVisualRefresh({
    nextHomeMapState: runtimeTick.nextHomeMapState,
    shouldRefreshSnapshot:
      input.visualMode === "formal_precheck" &&
      visualRefresh.shouldRefreshSnapshot,
    now: input.now,
    warnings: visualRefresh.warnings,
    tags: input.tags,
  })
  const debugRunnerResult = runMvpCoreDebugRunner({
    homeMapState: initialWorld.homeMapState,
    constructionStyle: butlerBuildResult.profile.constructionStyle,
    worldDay: input.worldDay,
    now: input.now,
    tags: input.tags,
  })
  const townAdoptionResult = buildTownAdoptionPrecheckBuilderResult({
    homeMapState: runtimeTick.nextHomeMapState,
    constructionBridgeResult: debugRunnerResult.constructionBridgeResult,
    now: input.now,
    tags: input.tags,
  })
  const worldLogs = buildMvpWorldLogEntries({
    runtimeTick,
    visualRefresh,
    adoptionOpportunityObservations: townAdoptionResult.adoptionOpportunityObservations,
  })
  const butlerExplanations = buildMvpButlerExplanations({
    butlerProfile: butlerBuildResult.profile,
    runtimeTick,
  })
  const preliminaryMessages = [
    ...butlerBuildResult.messages,
    ...initialWorld.messages,
    ...runtimeTick.messages,
    ...persistence.messages,
    ...visualRefresh.messages,
    ...formalVisualRefresh.messages,
    ...townAdoptionResult.messages,
  ]
  const pPhoneData = buildMvpPPhoneData({
    worldId: input.worldId,
    logs: worldLogs,
    butlerExplanations,
    adoptionOpportunityObservations: townAdoptionResult.adoptionOpportunityObservations,
    butlerAdoptionIntents: townAdoptionResult.butlerAdoptionIntents,
    warningCount:
      butlerAudit.warnings.length +
      initialWorld.audit.warnings.length +
      runtimeTick.audit.warnings.length +
      persistence.warnings.length +
      visualRefresh.warnings.length +
      formalVisualRefresh.warnings.length +
      townAdoptionResult.audit.warnings.length,
  })
  const draftAudit: AiPetWorldMvpAudit = {
    stableMvpFingerprint: "draft",
    worldId: input.worldId,
    ownerId: input.ownerId,
    warnings: [],
    tags: ["ai_pet_world_mvp_audit_draft"],
  }
  const draftReport: AiPetWorldMvpReport = {
    reportId: "draft",
    worldId: input.worldId,
    ownerId: input.ownerId,
    sections: [],
    messages: [],
    tags: ["ai_pet_world_mvp_report_draft"],
  }
  const draftResult: AiPetWorldMvpPipelineResult = {
    butlerProfile: butlerBuildResult.profile,
    butlerBuildResult,
    butlerAudit,
    butlerReport,
    initialWorld,
    runtimeTick,
    persistence,
    visualRefresh,
    formalVisualRefresh,
    worldLogs,
    butlerExplanations,
    pPhoneData,
    adoptionOpportunityObservations: townAdoptionResult.adoptionOpportunityObservations,
    butlerAdoptionIntents: townAdoptionResult.butlerAdoptionIntents,
    audit: draftAudit,
    report: draftReport,
    nextHomeMapState: runtimeTick.nextHomeMapState,
    messages: preliminaryMessages,
    tags: [
      "ai_pet_world_mvp_pipeline_result",
      "full_mvp_required_completion",
      "no_default_adoption_entry",
      "town_adoption_precheck_01",
      ...input.tags,
    ],
  }
  const audit = auditAiPetWorldMvpPipeline(draftResult)
  const resultWithAudit: AiPetWorldMvpPipelineResult = {
    ...draftResult,
    audit,
  }
  const report = buildAiPetWorldMvpReport(resultWithAudit, audit)

  return {
    ...resultWithAudit,
    report,
    messages: [
      ...resultWithAudit.messages,
      ...summarizeAiPetWorldMvpPipeline({
        ...resultWithAudit,
        report,
      }),
    ],
  }
}

export function runAiPetWorldMvpDebugPipeline(
  input: AiPetWorldMvpPipelineInput
): AiPetWorldMvpPipelineResult {
  return runAiPetWorldMvpPipeline({
    ...input,
    runMode: "debug",
  })
}