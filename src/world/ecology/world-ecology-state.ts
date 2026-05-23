/**
 * 当前文件职责：从 HomeMapState 生成只读世界生态状态。
 */

import type { HomeMapState, MapPlacement } from "@/world/map-state/home-map-state-schema"

import { selectBiomeType } from "./biome-rules"

export type WorldEcologyStatus = "seeded" | "observing" | "expanding"

export type WorldEcologyFact = {
  id: string
  kind: "terrain" | "plant" | "insect_trace" | "wild_trace" | "resource" | "climate"
  label: string
  status: "latent" | "observable" | "emerging" | "stable"
  strength: number
  reason: string
  tags: string[]
}

export type WorldEcologyState = {
  biomeType: ReturnType<typeof selectBiomeType>
  status: WorldEcologyStatus
  facts: WorldEcologyFact[]
  generatedAt: number
  tags: string[]
}

export function buildWorldEcologyState(input: {
  homeMapState: HomeMapState
  generatedAt: number
}): WorldEcologyState {
  const biomeType = selectBiomeType({
    requestedBiomeType: undefined,
    seed: input.homeMapState.seed,
  })
  const facts = [
    buildTerrainFact(input.homeMapState),
    buildPlantFact(input.homeMapState),
    buildInsectTraceFact(input.homeMapState),
    buildWildTraceFact(input.homeMapState),
    buildResourceFact(input.homeMapState),
    buildClimateFact(input.homeMapState),
  ]

  return {
    biomeType,
    status: facts.some((fact) => fact.status === "emerging")
      ? "expanding"
      : "observing",
    facts,
    generatedAt: input.generatedAt,
    tags: [
      "world_ecology_state",
      "readonly_world_fact_projection",
      "not_butler_construction",
      "no_actor_spawn",
      biomeType,
    ],
  }
}

function buildTerrainFact(homeMapState: HomeMapState): WorldEcologyFact {
  return {
    id: "terrain-foundation",
    kind: "terrain",
    label: "自然地貌",
    status: homeMapState.resources.groundHealth >= 60 ? "stable" : "observable",
    strength: clampScore(homeMapState.resources.groundHealth),
    reason: "土地健康、自然边界和空间压力属于世界自然基础。",
    tags: ["terrain", "world_fact", "not_construction_fact"],
  }
}

function buildPlantFact(homeMapState: HomeMapState): WorldEcologyFact {
  const naturalPlacementCount = countNaturalPlacements(homeMapState.placements)
  const strength = Math.max(
    homeMapState.resources.naturalGrowth,
    naturalPlacementCount * 12
  )

  return {
    id: "plant-growth",
    kind: "plant",
    label: "植物生长",
    status: strength >= 60 ? "stable" : strength >= 35 ? "observable" : "latent",
    strength: clampScore(strength),
    reason: `当前自然对象 ${naturalPlacementCount} 个，自然生长值 ${homeMapState.resources.naturalGrowth}。`,
    tags: ["plant", "natural_growth", "world_fact"],
  }
}

function buildInsectTraceFact(homeMapState: HomeMapState): WorldEcologyFact {
  const strength = Math.round(
    (homeMapState.resources.naturalGrowth + homeMapState.resources.groundHealth) / 2
  )

  return {
    id: "insect-trace",
    kind: "insect_trace",
    label: "昆虫迹象",
    status: strength >= 70 ? "emerging" : strength >= 45 ? "observable" : "latent",
    strength: clampScore(strength),
    reason: "昆虫迹象只来自自然条件，不由管家建设生成。",
    tags: ["insect_trace", "ecology_signal", "world_fact"],
  }
}

function buildWildTraceFact(homeMapState: HomeMapState): WorldEcologyFact {
  const strength = Math.round(
    (homeMapState.resources.naturalGrowth +
      homeMapState.resources.groundHealth -
      homeMapState.resources.spacePressure) /
      2
  )

  return {
    id: "wild-trace",
    kind: "wild_trace",
    label: "野外活动迹象",
    status: strength >= 65 ? "emerging" : strength >= 40 ? "observable" : "latent",
    strength: clampScore(strength),
    reason: "野外活动迹象是生态背景，不等同于宠物或伙伴入场。",
    tags: ["wild_trace", "ecology_signal", "no_pet_spawn"],
  }
}

function buildResourceFact(homeMapState: HomeMapState): WorldEcologyFact {
  const strength = Math.round(
    (homeMapState.resources.materialReadiness +
      homeMapState.resources.careReadiness) /
      2
  )

  return {
    id: "natural-resource-base",
    kind: "resource",
    label: "自然资源基础",
    status: strength >= 55 ? "observable" : "latent",
    strength: clampScore(strength),
    reason: "自然资源供管家判断和消耗，但资源本身属于世界。",
    tags: ["resource", "world_fact", "butler_can_use_later"],
  }
}

function buildClimateFact(homeMapState: HomeMapState): WorldEcologyFact {
  const strength = clampScore(100 - homeMapState.resources.spacePressure)

  return {
    id: "micro-climate",
    kind: "climate",
    label: "微气候舒适度",
    status: strength >= 70 ? "stable" : strength >= 45 ? "observable" : "latent",
    strength,
    reason: "微气候由空间压力、地貌和自然生长共同影响。",
    tags: ["micro_climate", "world_fact", "space_pressure"],
  }
}

function countNaturalPlacements(placements: MapPlacement[]): number {
  return placements.filter(
    (placement) =>
      placement.layer === "nature" || placement.tags.includes("world_nature_fact")
  ).length
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
