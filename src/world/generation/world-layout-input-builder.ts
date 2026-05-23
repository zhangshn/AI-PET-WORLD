/**
 * 当前文件负责：从世界生成输入派生稳定的布局生成输入。
 */

import type {
  InitialHomeGenerationInput,
  WorldLayoutGenerationBuildResult,
  WorldLayoutGenerationInput,
  WorldLayoutBiomeInput,
  WorldLayoutBiomeType,
  WorldLayoutCandidate,
  WorldLayoutConstraint,
  WorldLayoutNatureBias,
  WorldLayoutPathStyle,
  WorldLayoutPhaseInput,
  WorldLayoutQuietAreaBias,
  WorldLayoutResourceInput,
  WorldLayoutShelterBias,
  WorldLayoutVariantInput,
} from "./generation-schema"
import { buildSeededNumber, pickSeededItem } from "./world-seed"

export function buildWorldLayoutGenerationInput(input: {
  generationInput: InitialHomeGenerationInput
  seed: string
  resources: WorldLayoutResourceInput
}): WorldLayoutGenerationBuildResult {
  const { generationInput, seed, resources } = input
  const personality = {
    structurePreference: clampPreference(
      generationInput.butlerConstructionStyle.structuredBuilder
    ),
    carePreference: clampPreference(
      generationInput.butlerConstructionStyle.warmCaretaker
    ),
    protectionPreference: clampPreference(
      generationInput.butlerConstructionStyle.protectiveKeeper
    ),
    aestheticPreference: clampPreference(
      generationInput.butlerConstructionStyle.aestheticOrganizer
    ),
    quietPreference: clampPreference(
      generationInput.butlerConstructionStyle.quietMaintainer
    ),
    adaptabilityPreference: clampPreference(
      generationInput.butlerConstructionStyle.adaptivePlanner
    ),
  }
  const phase = buildLayoutPhaseInput(resources, personality.structurePreference)
  const biome = buildLayoutBiomeInput({
    requestedBiomeType: generationInput.biomeType,
    seed,
    personality,
    resources,
  })
  const constraints = buildLayoutConstraints({ biome, resources })
  const candidates = buildLayoutCandidates({
    seed,
    personality,
    resources,
    biome,
    phase,
  })
  const selectedCandidate = selectLayoutCandidate(candidates)
  const variant = selectedCandidate.variant
  const layoutInput: WorldLayoutGenerationInput = {
    worldId: generationInput.worldId,
    ownerId: generationInput.ownerId,
    seed,
    birthSignature: generationInput.birthSignature,
    worldSalt: generationInput.worldSalt,
    personality,
    resources,
    biome,
    phase,
    variant,
    selectedCandidate,
    candidates,
    constraints,
    tags: [
      "world_layout_generation_input",
      "stable_seed_driven",
      "personality_layout_driven",
      "resource_layout_driven",
      "biome_layout_driven",
      "layout_candidate_selected",
      biome.biomeType,
    ],
  }

  return {
    layoutInput,
    audit: {
      selectedVariant: variant,
      selectedCandidateId: selectedCandidate.candidateId,
      personalityDrivers: buildPersonalityDrivers(personality),
      resourceDrivers: buildResourceDrivers(resources),
      biomeDrivers: buildBiomeDrivers(biome),
      phaseDrivers: buildPhaseDrivers(phase),
      constraintDrivers: constraints.map((constraint) => constraint.id),
      stableSeed: seed,
      warnings: [],
      tags: [
        "world_layout_generation_audit",
        "stable_seed_verified",
        "no_default_companion_layout",
      ],
    },
  }
}

function buildLayoutPhaseInput(
  resources: WorldLayoutResourceInput,
  structurePreference: number
): WorldLayoutPhaseInput {
  const developmentPressure = clampPreference(
    resources.spacePressure / 100 + (100 - resources.materialReadiness) / 240
  )
  const expansionReadiness = clampPreference(
    resources.materialReadiness / 120 + structurePreference / 3
  )

  if (resources.materialReadiness >= 45 && resources.careReadiness >= 55) {
    return {
      phase: "basic_living_preparation",
      developmentPressure,
      expansionReadiness,
    }
  }

  if (resources.materialReadiness >= 32 || resources.careReadiness >= 50) {
    return {
      phase: "first_home_seed",
      developmentPressure,
      expansionReadiness,
    }
  }

  return {
    phase: "initial_empty_land",
    developmentPressure,
    expansionReadiness,
  }
}

function buildLayoutVariantInput(input: {
  seed: string
  personality: WorldLayoutGenerationInput["personality"]
  resources: WorldLayoutResourceInput
  biome: WorldLayoutBiomeInput
  candidateSalt: string
}): WorldLayoutVariantInput {
  const pathStyles: readonly WorldLayoutPathStyle[] = [
    "direct",
    "curved",
    "clustered",
  ]
  const shelterBiases: readonly WorldLayoutShelterBias[] = [
    "near_center",
    "edge_protected",
    "resource_adjacent",
  ]
  const natureBiases: readonly WorldLayoutNatureBias[] = [
    "open",
    "soft_boundary",
    "dense_boundary",
  ]
  const quietAreaBiases: readonly WorldLayoutQuietAreaBias[] = [
    "near_shelter",
    "near_nature",
    "near_care",
  ]
  const pathStyle =
    input.personality.structurePreference > 0.68
      ? "direct"
      : input.personality.adaptabilityPreference +
            input.biome.layoutModifiers.pathFlexibilityBias >
          0.68
        ? "curved"
        : pickSeededItem(pathStyles, input.seed, `${input.candidateSalt}-path-style`)
  const shelterBias =
    input.personality.protectionPreference +
        input.biome.layoutModifiers.shelterSafetyBias >
      0.7
      ? "edge_protected"
    : input.resources.materialReadiness > 48
      ? "resource_adjacent"
        : pickSeededItem(shelterBiases, input.seed, `${input.candidateSalt}-shelter-bias`)
  const natureBias =
    input.personality.protectionPreference +
        input.biome.layoutModifiers.boundaryDensityBias >
      0.72 ||
    input.resources.naturalGrowth > 58
      ? "dense_boundary"
    : input.personality.aestheticPreference > 0.66
        ? "soft_boundary"
        : pickSeededItem(natureBiases, input.seed, `${input.candidateSalt}-nature-bias`)
  const quietAreaBias =
    input.personality.quietPreference > 0.68
      ? "near_nature"
    : input.personality.carePreference > 0.7
        ? "near_care"
        : pickSeededItem(quietAreaBiases, input.seed, `${input.candidateSalt}-quiet-bias`)

  return {
    variantId: `layout_${Math.floor(
      buildSeededNumber(input.seed, `${input.candidateSalt}-variant-id`) * 100000
    ).toString(36)}`,
    pathStyle,
    shelterBias,
    natureBias,
    quietAreaBias,
  }
}

function buildLayoutBiomeInput(input: {
  requestedBiomeType: WorldLayoutBiomeType | undefined
  seed: string
  personality: WorldLayoutGenerationInput["personality"]
  resources: WorldLayoutResourceInput
}): WorldLayoutBiomeInput {
  const biomeType =
    input.requestedBiomeType ??
    pickSeededItem(
      ["grassland", "forest", "desert", "oasis"] as const,
      input.seed,
      "layout-biome"
    )

  const profile = {
    grassland: {
      resourceCaps: {
        materialReadiness: 72,
        careReadiness: 76,
        naturalGrowth: 70,
        groundHealth: 86,
        spacePressure: 62,
      },
      regenerationBias: { material: 0.7, care: 0.75, natural: 0.8, ground: 0.8 },
      layoutModifiers: {
        compactnessBias: 0,
        boundaryDensityBias: 0,
        pathFlexibilityBias: 0,
        shelterSafetyBias: 0,
      },
      constructionModifiers: { materialCostMultiplier: 1, maintenanceRisk: 0.24 },
      visualTokens: ["open_ground", "soft_grass", "mvp_starting_biome"],
    },
    forest: {
      resourceCaps: {
        materialReadiness: 82,
        careReadiness: 70,
        naturalGrowth: 92,
        groundHealth: 82,
        spacePressure: 72,
      },
      regenerationBias: { material: 0.9, care: 0.68, natural: 1, ground: 0.72 },
      layoutModifiers: {
        compactnessBias: 0.08,
        boundaryDensityBias: 0.18,
        pathFlexibilityBias: 0.08,
        shelterSafetyBias: 0.06,
      },
      constructionModifiers: { materialCostMultiplier: 0.92, maintenanceRisk: 0.4 },
      visualTokens: ["forest_edge", "dense_boundary", "wood_rich"],
    },
    desert: {
      resourceCaps: {
        materialReadiness: 64,
        careReadiness: 58,
        naturalGrowth: 42,
        groundHealth: 62,
        spacePressure: 55,
      },
      regenerationBias: { material: 0.55, care: 0.5, natural: 0.35, ground: 0.45 },
      layoutModifiers: {
        compactnessBias: 0.16,
        boundaryDensityBias: -0.12,
        pathFlexibilityBias: -0.06,
        shelterSafetyBias: 0.16,
      },
      constructionModifiers: { materialCostMultiplier: 1.18, maintenanceRisk: 0.52 },
      visualTokens: ["dry_ground", "water_stress", "shade_priority"],
    },
    oasis: {
      resourceCaps: {
        materialReadiness: 70,
        careReadiness: 90,
        naturalGrowth: 86,
        groundHealth: 78,
        spacePressure: 78,
      },
      regenerationBias: { material: 0.68, care: 1, natural: 0.92, ground: 0.7 },
      layoutModifiers: {
        compactnessBias: 0.12,
        boundaryDensityBias: 0.1,
        pathFlexibilityBias: 0.12,
        shelterSafetyBias: 0.02,
      },
      constructionModifiers: { materialCostMultiplier: 1.04, maintenanceRisk: 0.34 },
      visualTokens: ["water_adjacent", "life_event_ready_later", "space_pressure"],
    },
  }[biomeType]

  return {
    biomeType,
    ...profile,
  }
}

function buildLayoutConstraints(input: {
  biome: WorldLayoutBiomeInput
  resources: WorldLayoutResourceInput
}): WorldLayoutConstraint[] {
  const constraints: WorldLayoutConstraint[] = [
    {
      id: `biome:${input.biome.biomeType}`,
      description: "Biome must constrain resource caps and layout behavior.",
      severity: "info",
      tags: ["biome_constraint", input.biome.biomeType],
    },
    {
      id: "no_default_companion_fact",
      description: "Initial layout must not create pet or companion facts.",
      severity: "block",
      tags: ["no_default_pet", "life_event_deferred"],
    },
    {
      id: "state_before_visual",
      description: "Layout decisions must enter HomeMapState before rendering.",
      severity: "block",
      tags: ["home_map_state_first", "formal_visual_model_readonly"],
    },
  ]

  if (input.resources.spacePressure > 35) {
    constraints.push({
      id: "space_pressure_compact_layout",
      description: "High space pressure should favor compact support regions.",
      severity: "warn",
      tags: ["resource_constraint", "space_pressure"],
    })
  }

  if (input.resources.naturalGrowth > input.biome.resourceCaps.naturalGrowth) {
    constraints.push({
      id: "natural_growth_clamped_by_biome",
      description: "Natural growth should respect biome capacity.",
      severity: "warn",
      tags: ["resource_cap", "natural_growth"],
    })
  }

  return constraints
}

function buildLayoutCandidates(input: {
  seed: string
  personality: WorldLayoutGenerationInput["personality"]
  resources: WorldLayoutResourceInput
  biome: WorldLayoutBiomeInput
  phase: WorldLayoutPhaseInput
}): WorldLayoutCandidate[] {
  const salts = ["primary", "compact", "adaptive"] as const

  return salts
    .map((salt, index) => {
      const variant = buildLayoutVariantInput({
        seed: input.seed,
        personality: input.personality,
        resources: input.resources,
        biome: input.biome,
        candidateSalt: `layout-candidate-${salt}`,
      })
      const zoneOffsets = buildZoneOffsets({
        seed: input.seed,
        personality: input.personality,
        resources: input.resources,
        biome: input.biome,
        salt,
      })
      const scoreReasons = buildCandidateScoreReasons({
        variant,
        biome: input.biome,
        personality: input.personality,
        resources: input.resources,
        phase: input.phase,
        index,
      })

      return {
        candidateId: `layout-candidate-${salt}`,
        variant,
        zoneOffsets,
        score: scoreReasons.reduce((total, reason) => total + reason.score, 0),
        scoreReasons: scoreReasons.map((reason) => reason.label),
        tags: [
          "layout_candidate",
          input.biome.biomeType,
          variant.pathStyle,
          variant.shelterBias,
          variant.natureBias,
          variant.quietAreaBias,
        ],
      }
    })
    .sort((a, b) => b.score - a.score)
}

function buildZoneOffsets(input: {
  seed: string
  personality: WorldLayoutGenerationInput["personality"]
  resources: WorldLayoutResourceInput
  biome: WorldLayoutBiomeInput
  salt: string
}): WorldLayoutCandidate["zoneOffsets"] {
  const compact =
    input.resources.spacePressure / 100 + input.biome.layoutModifiers.compactnessBias
  const adaptiveShift =
    input.personality.adaptabilityPreference +
    input.biome.layoutModifiers.pathFlexibilityBias
  const protectiveShift =
    input.personality.protectionPreference +
    input.biome.layoutModifiers.shelterSafetyBias
  const direction = buildSeededNumber(input.seed, `${input.salt}-direction`) > 0.5 ? 1 : -1

  return {
    visual_center: { x: Math.round(adaptiveShift * direction), y: compact > 0.5 ? -1 : 0 },
    temporary_shelter: {
      x: protectiveShift > 0.7 ? 2 * direction : Math.round(adaptiveShift * direction),
      y: protectiveShift > 0.7 ? -2 : compact > 0.5 ? -1 : 1,
    },
    initial_care: {
      x: input.personality.carePreference > 0.65 ? -1 * direction : 0,
      y: input.biome.biomeType === "oasis" ? -1 : 0,
    },
    storage_tools: {
      x: compact > 0.48 ? -2 * direction : direction,
      y: input.resources.materialReadiness > 52 ? -1 : 1,
    },
    quiet_living: {
      x: input.personality.quietPreference > 0.65 ? 2 * direction : direction,
      y: input.personality.quietPreference > 0.65 ? 2 : 0,
    },
    natural_boundary: {
      x: input.biome.layoutModifiers.boundaryDensityBias > 0.1 ? direction : 0,
      y: input.biome.layoutModifiers.boundaryDensityBias > 0.1 ? 1 : 0,
    },
  }
}

function buildCandidateScoreReasons(input: {
  variant: WorldLayoutVariantInput
  biome: WorldLayoutBiomeInput
  personality: WorldLayoutGenerationInput["personality"]
  resources: WorldLayoutResourceInput
  phase: WorldLayoutPhaseInput
  index: number
}): Array<{ label: string; score: number }> {
  return [
    {
      label: `biome-fit:${input.biome.biomeType}`,
      score: 2 + input.biome.layoutModifiers.compactnessBias,
    },
    {
      label: `phase-fit:${input.phase.phase}`,
      score: input.phase.expansionReadiness,
    },
    {
      label: `resource-fit:material-${input.resources.materialReadiness}`,
      score: input.resources.materialReadiness / 100,
    },
    {
      label: `personality-fit:${input.variant.pathStyle}`,
      score:
        input.variant.pathStyle === "direct"
          ? input.personality.structurePreference
          : input.variant.pathStyle === "curved"
            ? input.personality.adaptabilityPreference
            : input.personality.carePreference,
    },
    {
      label: `candidate-order:${input.index}`,
      score: (3 - input.index) / 10,
    },
  ]
}

function selectLayoutCandidate(
  candidates: WorldLayoutCandidate[]
): WorldLayoutCandidate {
  return candidates[0]
}

function buildPersonalityDrivers(
  personality: WorldLayoutGenerationInput["personality"]
): string[] {
  return [
    `structure:${personality.structurePreference.toFixed(2)}`,
    `care:${personality.carePreference.toFixed(2)}`,
    `protection:${personality.protectionPreference.toFixed(2)}`,
    `aesthetic:${personality.aestheticPreference.toFixed(2)}`,
    `quiet:${personality.quietPreference.toFixed(2)}`,
    `adaptability:${personality.adaptabilityPreference.toFixed(2)}`,
  ]
}

function buildResourceDrivers(resources: WorldLayoutResourceInput): string[] {
  return [
    `material:${resources.materialReadiness}`,
    `care:${resources.careReadiness}`,
    `natural:${resources.naturalGrowth}`,
    `ground:${resources.groundHealth}`,
    `space:${resources.spacePressure}`,
  ]
}

function buildBiomeDrivers(biome: WorldLayoutBiomeInput): string[] {
  return [
    `biome:${biome.biomeType}`,
    `materialCap:${biome.resourceCaps.materialReadiness}`,
    `careCap:${biome.resourceCaps.careReadiness}`,
    `naturalCap:${biome.resourceCaps.naturalGrowth}`,
    `groundCap:${biome.resourceCaps.groundHealth}`,
    `spaceCap:${biome.resourceCaps.spacePressure}`,
    `materialCost:${biome.constructionModifiers.materialCostMultiplier}`,
    `maintenanceRisk:${biome.constructionModifiers.maintenanceRisk}`,
    ...biome.visualTokens.map((token) => `visual:${token}`),
  ]
}

function buildPhaseDrivers(phase: WorldLayoutPhaseInput): string[] {
  return [
    `phase:${phase.phase}`,
    `development:${phase.developmentPressure.toFixed(2)}`,
    `expansion:${phase.expansionReadiness.toFixed(2)}`,
  ]
}

function clampPreference(value: number): number {
  return Math.min(1, Math.max(0, value))
}
