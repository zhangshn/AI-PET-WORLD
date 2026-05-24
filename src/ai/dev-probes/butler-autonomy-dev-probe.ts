/**
 * 当前文件职责：提供 AI 管家自主意识核心的开发探针。
 */

import {
  buildAiButlerAutonomy,
  type ButlerAutonomyInput,
  type ButlerAutonomyResult,
} from "@/ai/gateway"

export type ButlerAutonomyDevProbeStatus = "passed" | "warning"

export type ButlerAutonomyDevProbeChecklistItem = {
  id: string
  title: string
  status: ButlerAutonomyDevProbeStatus
  evidence: string
  tags: string[]
}

export type ButlerAutonomyDevProbeResult = {
  probeId: string
  worldId: string
  ownerId: string
  status: ButlerAutonomyDevProbeStatus
  autonomyResult: ButlerAutonomyResult
  checklist: ButlerAutonomyDevProbeChecklistItem[]
  summaryLines: string[]
  tags: string[]
}

export function runButlerAutonomyDevProbe(
  input: ButlerAutonomyInput
): ButlerAutonomyDevProbeResult {
  const autonomyResult = buildAiButlerAutonomy(input)
  const checklist = buildProbeChecklist(autonomyResult)
  const status = checklist.every((item) => item.status === "passed")
    ? "passed"
    : "warning"

  return {
    probeId: `butler-autonomy-dev-probe-${input.worldId}-${input.now}`,
    worldId: input.worldId,
    ownerId: input.ownerId,
    status,
    autonomyResult,
    checklist,
    summaryLines: [
      `灵魂底盘：${autonomyResult.soulProfile.soulId}`,
      `世界感知：资源压力 ${autonomyResult.perception.resourcePressure}/100，空间压力 ${autonomyResult.perception.spacePressure}/100。`,
      `当前意识：${autonomyResult.consciousState.focus}/${autonomyResult.consciousState.emotionalTone}。`,
      `主意图：${autonomyResult.selectedIntent.kind}，优先级 ${autonomyResult.selectedIntent.priority}/100。`,
      `审计：${autonomyResult.audit.warnings.length} 条提醒。`,
      `解释：${autonomyResult.explanations.length} 条。`,
    ],
    tags: [
      "butler_autonomy_dev_probe",
      "ai_gateway_entry_verified",
      "readonly_probe",
      status,
      ...autonomyResult.tags,
    ],
  }
}

function buildProbeChecklist(
  result: ButlerAutonomyResult
): ButlerAutonomyDevProbeChecklistItem[] {
  return [
    {
      id: "soul-profile-ready",
      title: "灵魂底盘已生成",
      status: result.soulProfile.soulId.length > 0 ? "passed" : "warning",
      evidence: result.soulProfile.summary,
      tags: ["soul_profile"],
    },
    {
      id: "world-perception-ready",
      title: "世界感知已生成",
      status: result.perception.perceivedFacts.length > 0 ? "passed" : "warning",
      evidence: result.perception.perceivedFacts.join("；"),
      tags: ["world_perception"],
    },
    {
      id: "conscious-state-ready",
      title: "当前意识状态已生成",
      status: result.consciousState.stateId.length > 0 ? "passed" : "warning",
      evidence: `${result.consciousState.focus}/${result.consciousState.emotionalTone}：${result.consciousState.reason}`,
      tags: ["conscious_state"],
    },
    {
      id: "motivation-ready",
      title: "动机列表已生成",
      status: result.motivations.length > 0 ? "passed" : "warning",
      evidence: result.motivations
        .slice(0, 4)
        .map((motivation) => `${motivation.kind}:${motivation.intensity}`)
        .join("；"),
      tags: ["motivation_engine"],
    },
    {
      id: "goal-ready",
      title: "自主目标候选已生成",
      status: result.candidateGoals.length > 0 ? "passed" : "warning",
      evidence: result.candidateGoals
        .slice(0, 4)
        .map((goal) => `${goal.kind}:${goal.priority}`)
        .join("；"),
      tags: ["goal_generator"],
    },
    {
      id: "intent-ready",
      title: "主意图已生成",
      status: result.selectedIntent.intentId.length > 0 ? "passed" : "warning",
      evidence: `${result.selectedIntent.kind} / ${result.selectedIntent.nextExpectedConsumer}`,
      tags: ["intent_ranking"],
    },
    {
      id: "audit-ready",
      title: "意图审计已生成",
      status: result.audit.checkedIntentId === result.selectedIntent.intentId
        ? "passed"
        : "warning",
      evidence: `${result.audit.warnings.length} 条审计提醒。`,
      tags: ["autonomy_audit"],
    },
    {
      id: "explanation-ready",
      title: "解释层已生成",
      status: result.explanations.length > 0 ? "passed" : "warning",
      evidence: result.explanations.map((explanation) => explanation.title).join("；"),
      tags: ["explanation_layer"],
    },
  ]
}
