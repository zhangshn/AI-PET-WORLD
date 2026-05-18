/**
 * 当前文件职责：从管家行为意图候选中选择最终意图。
 */

import { buildButlerIntentCandidates } from "./butler-intent-score"
import type {
  BuildButlerIntentDecisionInput,
  IntentCandidate,
  IntentDecision,
} from "./intent-schema"

export function buildButlerIntentDecision(
  input: BuildButlerIntentDecisionInput
): IntentDecision {
  const candidates = [...buildButlerIntentCandidates(input)].sort(
    (a, b) => b.score - a.score
  )
  const selectedIntent = candidates[0] ?? buildFallbackIntent()
  const shouldAct =
    selectedIntent.type !== "do_nothing" && selectedIntent.score >= 45

  return {
    selectedIntent,
    candidates,
    shouldAct,
    decisionReason: shouldAct
      ? `选择 ${selectedIntent.type} 意图，当前评分为 ${selectedIntent.score}。`
      : "当前人格与环境更倾向于停滞、等待或低强度观察。",
    tags: [
      "intent_decision_v0",
      `selected:${selectedIntent.type}`,
      shouldAct ? "should_act" : "should_wait",
    ],
  }
}

function buildFallbackIntent(): IntentCandidate {
  return {
    type: "do_nothing",
    score: 0,
    urgency: "low",
    reason: "没有可用候选意图，保持等待。",
    drivers: [],
    blockers: ["缺少候选意图"],
    tags: ["intent_v0", "fallback"],
  }
}
