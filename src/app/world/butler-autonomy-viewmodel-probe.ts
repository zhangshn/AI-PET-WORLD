/**
 * 当前文件职责：把管家自主意识开发探针转换为 /world ViewModel 可读摘要。
 */

import { buildButlerProfile } from "@/ai/gateway"
import { runButlerAutonomyDevProbe } from "@/ai/dev-probes/gateway"
import type { AiPetWorldMvpPipelineResult } from "@/world/mvp-core/mvp-core-schema"

export type MvpWorldButlerAutonomyProbeChecklistItem = {
  id: string
  title: string
  status: "passed" | "warning"
  evidence: string
}

export type MvpWorldButlerAutonomyProbeSummary = {
  statusLabel: string
  selectedIntentLabel: string
  selectedIntentReason: string
  consciousStateLabel: string
  topMotivationLabels: string[]
  topGoalLabels: string[]
  auditWarningCount: number
  explanationBodies: string[]
  checklist: MvpWorldButlerAutonomyProbeChecklistItem[]
  logItems: string[]
  tags: string[]
}

export function buildButlerAutonomyViewModelProbe(
  result: AiPetWorldMvpPipelineResult
): MvpWorldButlerAutonomyProbeSummary {
  const birthInput = result.butlerBuildResult.input
  const butlerProfile = buildButlerProfile({
    birth: {
      year: birthInput.birthYear,
      month: birthInput.birthMonth,
      day: birthInput.birthDay,
      hour: birthInput.birthHour,
      minute: 0,
    },
    mappingMode: "self_projection",
    displayName: result.butlerProfile.displayName,
  })
  const probe = runButlerAutonomyDevProbe({
    worldId: result.nextHomeMapState.worldId,
    ownerId: result.nextHomeMapState.ownerId,
    now: result.nextHomeMapState.updatedAt,
    worldDay: 1,
    homeMapState: result.nextHomeMapState,
    ecologyState: result.nextHomeMapState.ecologyState,
    butlerProfile,
    recentSafeApplyResult:
      result.runtimeTick.constructionResult.fullPipelineAudit,
    tags: [
      "mvp_world_view_model_probe",
      "readonly_probe",
      "no_home_map_write",
    ],
  })
  const autonomyResult = probe.autonomyResult

  return {
    statusLabel: probe.status === "passed"
      ? "AI 管家自主意识链路已跑通"
      : "AI 管家自主意识链路存在提醒",
    selectedIntentLabel: `${autonomyResult.selectedIntent.kind}｜${autonomyResult.selectedIntent.priority}/100`,
    selectedIntentReason: autonomyResult.selectedIntent.reason,
    consciousStateLabel: `${autonomyResult.consciousState.focus} / ${autonomyResult.consciousState.emotionalTone}`,
    topMotivationLabels: autonomyResult.motivations
      .slice(0, 4)
      .map((motivation) => `${motivation.kind} ${motivation.intensity}/100`),
    topGoalLabels: autonomyResult.candidateGoals
      .slice(0, 4)
      .map((goal) => `${goal.kind} ${goal.priority}/100`),
    auditWarningCount: autonomyResult.audit.warnings.length,
    explanationBodies: autonomyResult.explanations.map(
      (explanation) => explanation.body
    ),
    checklist: probe.checklist.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      evidence: item.evidence,
    })),
    logItems: probe.summaryLines,
    tags: [
      "butler_autonomy_view_model_probe",
      "readonly_projection",
      "ai_gateway_entry_verified",
      probe.status,
      ...probe.tags,
    ],
  }
}
