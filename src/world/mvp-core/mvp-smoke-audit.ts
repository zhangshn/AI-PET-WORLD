/**
 * 当前文件职责：运行 MVP pipeline smoke audit。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type { AiPetWorldMvpPipelineResult } from "./mvp-core-schema"
import { runAiPetWorldMvpPipeline } from "./mvp-core-pipeline"
import { buildMvpSmokeScenarioInputs } from "./mvp-smoke-scenarios"
import {
  assertWorldLayoutVariationAuditPassed,
  buildWorldLayoutVariationAudit,
  summarizeWorldLayoutVariationAudit,
  type WorldLayoutVariationAudit,
} from "@/world/generation/world-layout-variation-audit"
import { runResourceCycle } from "@/world/resource-cycle/resource-cycle"
import type { ResourcePoolState } from "@/world/resource-cycle/resource-schema"

export type MvpSmokeAuditResult = {
  scenarioCount: number
  passed: boolean
  stableScenarioMatched: boolean
  layoutVariationPassed: boolean
  layoutVariationAudit: WorldLayoutVariationAudit
  resourceCyclePassed: boolean
  resourceCycleWarnings: string[]
  autonomousConstructionPassed: boolean
  autonomousConstructionWarnings: string[]
  houseStylePassed: boolean
  houseStyleWarnings: string[]
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
  const resourceCycleWarnings = auditResourceCycle(results)
  const resourceCyclePassed = resourceCycleWarnings.length === 0
  const autonomousConstructionWarnings = auditAutonomousConstruction(results)
  const autonomousConstructionPassed =
    autonomousConstructionWarnings.length === 0
  const houseStyleWarnings = auditHouseStyle(results)
  const houseStylePassed = houseStyleWarnings.length === 0
  const warningCount =
    results.reduce((total, result) => total + result.audit.warnings.length, 0) +
    forbiddenTokenWarnings.length +
    layoutVariationAudit.warnings.length +
    resourceCycleWarnings.length +
    autonomousConstructionWarnings.length +
    houseStyleWarnings.length
  const passed =
    results.length >= 5 &&
    stableScenarioMatched &&
    forbiddenTokenWarnings.length === 0 &&
    layoutVariationPassed &&
    resourceCyclePassed &&
    autonomousConstructionPassed &&
    houseStylePassed

  return {
    scenarioCount: results.length,
    passed,
    stableScenarioMatched,
    layoutVariationPassed,
    layoutVariationAudit,
    resourceCyclePassed,
    resourceCycleWarnings,
    autonomousConstructionPassed,
    autonomousConstructionWarnings,
    houseStylePassed,
    houseStyleWarnings,
    warningCount,
    forbiddenTokenWarnings,
    results,
    summary: [
      `MVP smoke audit ${passed ? "passed" : "has warnings"}.`,
      `Scenarios: ${results.length}.`,
      `Stable seed matched: ${String(stableScenarioMatched)}.`,
      `Layout variation passed: ${String(layoutVariationPassed)}.`,
      `Resource cycle passed: ${String(resourceCyclePassed)}.`,
      `Autonomous construction passed: ${String(autonomousConstructionPassed)}.`,
      `House style passed: ${String(houseStylePassed)}.`,
      `Forbidden token warnings: ${forbiddenTokenWarnings.length}.`,
    ].join(" "),
    messages: [
      `Smoke scenarios: ${results.length}`,
      `Stable seed matched: ${String(stableScenarioMatched)}`,
      ...summarizeWorldLayoutVariationAudit(layoutVariationAudit),
      `Resource cycle passed: ${String(resourceCyclePassed)}`,
      `Autonomous construction passed: ${String(autonomousConstructionPassed)}`,
      `House style passed: ${String(houseStylePassed)}`,
      `Forbidden token warnings: ${forbiddenTokenWarnings.length}`,
    ],
    tags: [
      "mvp_smoke_audit_result",
      passed ? "mvp_smoke_passed" : "mvp_smoke_warning",
    ],
  }
}

function auditHouseStyle(results: AiPetWorldMvpPipelineResult[]): string[] {
  const houseStyles = results.flatMap((result) => {
    const protocol =
      result.runtimeTick.constructionResult.runtimeCycleResult
        .worldLoopProtocolResult

    return protocol.selectedPlan?.houseStyle ? [protocol.selectedPlan.houseStyle] : []
  })
  const warnings: string[] = []

  if (houseStyles.length !== results.length) {
    warnings.push("MVP smoke audit missing house style on selected plans.")
  }

  const archetypes = new Set(houseStyles.map((style) => style.archetype))
  const biomes = new Set(houseStyles.map((style) => style.sourceBiome))
  const materialPreferences = new Set(
    houseStyles.map((style) => style.materialPreference)
  )
  const scalePreferences = new Set(
    houseStyles.map((style) => style.scalePreference)
  )

  if (archetypes.size < 2) {
    warnings.push("House style smoke audit did not vary by butler personality.")
  }
  if (biomes.size < 4 || materialPreferences.size < 3) {
    warnings.push("House style smoke audit did not reflect biome material differences.")
  }
  if (scalePreferences.size < 2) {
    warnings.push("House style smoke audit did not reflect resource scale differences.")
  }
  if (
    houseStyles.some(
      (style) =>
        style.personalityDrivers.length === 0 ||
        style.resourceDrivers.length === 0 ||
        style.styleTags.length === 0
    )
  ) {
    warnings.push("House style smoke audit found incomplete structured metadata.")
  }

  return warnings
}

function auditAutonomousConstruction(
  results: AiPetWorldMvpPipelineResult[]
): string[] {
  return results.flatMap((result) => {
    const protocol =
      result.runtimeTick.constructionResult.runtimeCycleResult
        .worldLoopProtocolResult
    const executionResult = protocol.executionResult
    const safeApplyResult = protocol.safeApplyResult
    const warnings: string[] = []

    if (!protocol.selectedPlan) {
      warnings.push(`${result.initialWorld.homeMapState.worldId}: no autonomous plan selected.`)
    }

    if (!executionResult) {
      warnings.push(`${result.initialWorld.homeMapState.worldId}: no construction execution result.`)
      return warnings
    }

    if (executionResult.resourceTransactions.length === 0) {
      warnings.push(`${result.initialWorld.homeMapState.worldId}: no construction resource transactions.`)
    }

    if (
      executionResult.resourceTransactions.some(
        (transaction) => transaction.status === "blocked"
      ) &&
      executionResult.mapDiffs.length > 0
    ) {
      warnings.push(`${result.initialWorld.homeMapState.worldId}: blocked construction still produced MapDiff.`)
    }

    if (!safeApplyResult) {
      warnings.push(`${result.initialWorld.homeMapState.worldId}: no construction safe apply result.`)
      return warnings
    }

    if (
      executionResult.mapDiffs.length > 0 &&
      safeApplyResult.acceptedDiffIds.length === 0
    ) {
      warnings.push(`${result.initialWorld.homeMapState.worldId}: MapDiff proposal was not accepted.`)
    }

    if (
      safeApplyResult.acceptedDiffIds.length > 0 &&
      !safeApplyResult.nextHomeMapState.resources.resourcePoolState
    ) {
      warnings.push(`${result.initialWorld.homeMapState.worldId}: accepted construction did not keep resource pool state.`)
    }

    return warnings
  })
}

function auditResourceCycle(results: AiPetWorldMvpPipelineResult[]): string[] {
  const pools = results
    .map((result) => result.initialWorld.homeMapState.resources.resourcePoolState)
    .filter((pool): pool is ResourcePoolState => Boolean(pool))

  if (pools.length !== results.length) {
    return ["MVP smoke audit missing resource pool state."]
  }

  const biomeTypes = new Set(pools.map((pool) => pool.biomeType))

  if (
    !(["grassland", "forest", "desert", "oasis"] as const).every((biome) =>
      biomeTypes.has(biome)
    )
  ) {
    return ["MVP smoke audit did not cover every required biome."]
  }

  const blockedSpendResult = runResourceCycle({
    resourcePool: pools[0],
    cycleId: "mvp-smoke-resource-underflow",
    reason: "Smoke audit verifies that resources cannot be deducted below min.",
    includeNaturalRegeneration: false,
    requests: [
      {
        transactionId: "mvp-smoke-block-material-underflow",
        resourceKey: "materialReadiness",
        amount: -999,
        reason: "Smoke audit resource underflow guard.",
        source: "audit",
        tags: ["mvp_smoke_resource_underflow_guard"],
      },
    ],
    tags: ["mvp_smoke_audit"],
  })
  const blockedTransaction = blockedSpendResult.transactions[0]

  if (
    blockedTransaction?.status !== "blocked" ||
    blockedTransaction.after < pools[0].resources.materialReadiness.min
  ) {
    return ["MVP smoke audit resource underflow was not blocked."]
  }

  return []
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
