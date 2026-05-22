/**
 * 当前文件职责：把 MVP pipeline result 转换为 /world 只读 ViewModel。
 */

import type { FormalVisualModel } from "@/world/formal-visual-model/formal-visual-model-gateway"
import type { AiPetWorldMvpPipelineResult } from "@/world/mvp-core/mvp-core-schema"

export type MvpWorldViewModel = {
  worldSummary: {
    worldId: string
    ownerId: string
    placementCount: number
    mapDiffCount: number
  }
  butlerSummary: {
    butlerId: string
    displayName: string
    tone: string
  }
  constructionSummary: {
    selectedPlanId: string | null
    acceptedDiffCount: number
    rejectedDiffCount: number
  }
  logItems: Array<{
    id: string
    title: string
    body: string
  }>
  pPhoneMessages: Array<{
    id: string
    title: string
    body: string
  }>
  auditSummary: {
    warningCount: number
    messages: string[]
  }
  formalVisualModel: FormalVisualModel | null
}

export function buildMvpWorldViewModel(
  result: AiPetWorldMvpPipelineResult
): MvpWorldViewModel {
  return {
    worldSummary: {
      worldId: result.nextHomeMapState.worldId,
      ownerId: result.nextHomeMapState.ownerId,
      placementCount: result.nextHomeMapState.placements.length,
      mapDiffCount: result.nextHomeMapState.mapDiffs.length,
    },
    butlerSummary: {
      butlerId: result.butlerProfile.butlerId,
      displayName: result.butlerProfile.displayName,
      tone: result.butlerProfile.explanationTone,
    },
    constructionSummary: {
      selectedPlanId:
        result.runtimeTick.constructionResult.fullPipelineAudit.selectedPlanId,
      acceptedDiffCount:
        result.runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds
          .length,
      rejectedDiffCount:
        result.runtimeTick.constructionResult.fullPipelineAudit.rejectedDiffIds
          .length,
    },
    logItems: result.worldLogs.map((log) => ({
      id: log.id,
      title: log.title,
      body: log.body,
    })),
    pPhoneMessages: result.pPhoneData.messages.map((message) => ({
      id: message.id,
      title: message.title,
      body: message.body,
    })),
    auditSummary: {
      warningCount: result.audit.warnings.length,
      messages: result.audit.warnings,
    },
    formalVisualModel: result.formalVisualRefresh.formalVisualModel,
  }
}
