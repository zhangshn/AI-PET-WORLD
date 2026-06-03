/**
 * Current file responsibility: audit world layout generation input against
 * the V2.0 runtime world-generation boundaries.
 */

import type {
  WorldLayoutGenerationAudit,
  WorldLayoutGenerationInput,
} from "./generation-schema"

export function auditWorldLayoutGenerationInput(
  input: WorldLayoutGenerationInput
): WorldLayoutGenerationAudit {
  const warnings = auditRequiredFields(input)

  return {
    selectedVariant: input.variant,
    selectedCandidateId: input.selectedCandidate.candidateId,
    personalityDrivers: [
      `structure:${input.personality.structurePreference.toFixed(2)}`,
      `care:${input.personality.carePreference.toFixed(2)}`,
      `protection:${input.personality.protectionPreference.toFixed(2)}`,
      `aesthetic:${input.personality.aestheticPreference.toFixed(2)}`,
      `quiet:${input.personality.quietPreference.toFixed(2)}`,
      `adaptability:${input.personality.adaptabilityPreference.toFixed(2)}`,
    ],
    resourceDrivers: [
      `material:${input.resources.materialReadiness}`,
      `care:${input.resources.careReadiness}`,
      `natural:${input.resources.naturalGrowth}`,
      `ground:${input.resources.groundHealth}`,
      `space:${input.resources.spacePressure}`,
    ],
    biomeDrivers: [
      `biome:${input.biome.biomeType}`,
      `materialCap:${input.biome.resourceCaps.materialReadiness}`,
      `careCap:${input.biome.resourceCaps.careReadiness}`,
      `naturalCap:${input.biome.resourceCaps.naturalGrowth}`,
      `groundCap:${input.biome.resourceCaps.groundHealth}`,
      `spaceCap:${input.biome.resourceCaps.spacePressure}`,
      ...input.biome.visualTokens.map((token) => `visual:${token}`),
    ],
    phaseDrivers: [
      `phase:${input.phase.phase}`,
      `development:${input.phase.developmentPressure.toFixed(2)}`,
      `expansion:${input.phase.expansionReadiness.toFixed(2)}`,
    ],
    constraintDrivers: input.constraints.map((constraint) => constraint.id),
    stableSeed: input.seed,
    warnings,
    tags: [
      "world_layout_generation_audit",
      warnings.length === 0 ? "layout_input_valid" : "layout_input_warning",
      "layout_candidate_audit",
      "biome_constraint_audit",
      "no_direct_life_layout",
    ],
  }
}

function auditRequiredFields(input: WorldLayoutGenerationInput): string[] {
  const warnings: string[] = []

  if (!input.seed.trim()) warnings.push("layout input missing stable seed.")
  if (!input.variant.variantId.trim()) warnings.push("layout input missing variantId.")
  if (!input.selectedCandidate.candidateId.trim()) {
    warnings.push("layout input missing selected candidate.")
  }
  if (input.candidates.length === 0) {
    warnings.push("layout input missing layout candidates.")
  }
  if (input.constraints.length === 0) {
    warnings.push("layout input missing layout constraints.")
  }
  if (input.tags.length === 0) warnings.push("layout input missing tags.")

  return warnings
}
