/**
 * 当前文件职责：生成管家自主意识结果的解释文本。
 */

import type {
  ButlerAutonomousIntent,
  ButlerAutonomyExplanation,
  ButlerConsciousState,
  ButlerMemoryEffect,
  ButlerMotivation,
  ButlerWorldPerception,
} from "./schema"

export function buildButlerAutonomyExplanations(input: {
  worldId: string
  now: number
  selectedIntent: ButlerAutonomousIntent
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  motivations: ButlerMotivation[]
  memoryEffects: ButlerMemoryEffect[]
}): ButlerAutonomyExplanation[] {
  return [
    {
      id: `butler-autonomy-explanation-${input.worldId}-${input.now}`,
      title: "管家自主意识判断",
      body: buildMainExplanation(input),
      tags: [
        "butler_autonomy_explanation",
        "read_only_explanation",
        "no_world_fact_write",
        input.selectedIntent.kind,
      ],
    },
    {
      id: `butler-autonomy-audit-note-${input.worldId}-${input.now}`,
      title: "本轮解释边界",
      body: "这段说明只解释管家的判断来源，不直接生成家园事实，也不绕过 MapDiff / SafeApply。",
      tags: ["explanation_boundary", "safe_apply_required"],
    },
  ]
}

function buildMainExplanation(input: {
  selectedIntent: ButlerAutonomousIntent
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  motivations: ButlerMotivation[]
  memoryEffects: ButlerMemoryEffect[]
}): string {
  const topMotivations = input.motivations
    .slice(0, 3)
    .map((motivation) => `${motivation.kind}:${motivation.intensity}`)
    .join("、")
  const riskText = input.perception.risks.length > 0
    ? `观察到的风险：${input.perception.risks.join("、")}。`
    : "本轮没有明显高强度风险。"
  const memoryText = input.memoryEffects.length > 0
    ? `记忆反馈：${input.memoryEffects.map((effect) => effect.reason).join("；")}。`
    : "本轮暂无新的记忆偏置变化。"

  return [
    `管家选择 ${input.selectedIntent.kind}。`,
    input.selectedIntent.reason,
    `当前意识状态为 ${input.consciousState.focus}/${input.consciousState.emotionalTone}。`,
    topMotivations ? `主要动机：${topMotivations}。` : "本轮动机较分散。",
    riskText,
    memoryText,
  ].join("")
}
