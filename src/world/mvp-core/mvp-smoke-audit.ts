/**
 * 当前文件职责：运行 MVP pipeline smoke audit。
 */

import type { AiPetWorldMvpPipelineResult } from "./mvp-core-schema"
import { runAiPetWorldMvpPipeline } from "./mvp-core-pipeline"
import { buildMvpSmokeScenarioInputs } from "./mvp-smoke-scenarios"
import {
  assertWorldLayoutVariationAuditPassed,
  buildWorldLayoutVariationAudit,
  summarizeWorldLayoutVariationAudit,
  type WorldLayoutVariationAudit,
} from "@/world/generation/world-layout-variation-audit"

export type MvpSmokeAuditResult = {
  scenarioCount: number
  passed: boolean
  stableScenarioMatched: boolean
  layoutVariationPassed: boolean
  layoutVariationAudit: WorldLayoutVariationAudit
  warningCount: number
  forbiddenTokenWarnings: string[]
  results: AiPetWorldMvpPipelineResult[]
  summary: string
  messages: string[]
  tags: string[]
}

const FORBIDDEN_SMOKE_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet-near-arrival-point",
  "pet-bed",
  "pet_actor",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

export function runMvpSmokeAudit(): MvpSmokeAuditResult {
  const inputs = buildMvpSmokeScenarioInputs()
  const results = inputs.map(runAiPetWorldMvpPipeline)
  const layoutVariationAudit = buildWorldLayoutVariationAudit()
  const layoutVariationPassed =
    assertWorldLayoutVariationAuditPassed(layoutVariationAudit)
  const stableScenarioMatched =
    results[0]?.initialWorld.homeMapState.seed ===
    results[1]?.initialWorld.homeMapState.seed
  const forbiddenTokenWarnings = auditForbiddenTokens(results)
  const warningCount =
    results.reduce((total, result) => total + result.audit.warnings.length, 0) +
    forbiddenTokenWarnings.length +
    layoutVariationAudit.warnings.length
  const passed =
    results.length >= 3 &&
    stableScenarioMatched &&
    forbiddenTokenWarnings.length === 0 &&
    layoutVariationPassed

  return {
    scenarioCount: results.length,
    passed,
    stableScenarioMatched,
    layoutVariationPassed,
    layoutVariationAudit,
    warningCount,
    forbiddenTokenWarnings,
    results,
    summary: [
      `MVP smoke audit ${passed ? "passed" : "has warnings"}.`,
      `Scenarios: ${results.length}.`,
      `Stable seed matched: ${String(stableScenarioMatched)}.`,
      `Layout variation passed: ${String(layoutVariationPassed)}.`,
      `Forbidden token warnings: ${forbiddenTokenWarnings.length}.`,
    ].join(" "),
    messages: [
      `Smoke scenarios: ${results.length}`,
      `Stable seed matched: ${String(stableScenarioMatched)}`,
      ...summarizeWorldLayoutVariationAudit(layoutVariationAudit),
      `Forbidden token warnings: ${forbiddenTokenWarnings.length}`,
    ],
    tags: [
      "mvp_smoke_audit_result",
      passed ? "mvp_smoke_passed" : "mvp_smoke_warning",
    ],
  }
}

function auditForbiddenTokens(
  results: AiPetWorldMvpPipelineResult[]
): string[] {
  const tokens = results.flatMap((result) => [
    ...result.tags,
    ...result.messages,
    ...result.nextHomeMapState.placements.flatMap((placement) => [
      placement.id,
      placement.assetId,
      placement.layer,
      placement.label,
      ...placement.tags,
    ]),
  ]).map((token) => token.toLowerCase())

  return FORBIDDEN_SMOKE_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`MVP smoke audit 包含禁止 token：${token}`]
      : []
  )
}
