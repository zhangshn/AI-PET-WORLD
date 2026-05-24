/**
 * 当前文件职责：把客观世界状态转成管家的主观世界感知。
 */

import { buildWorldEcologyState } from "@/world/ecology/world-ecology-state"

import type {
  ButlerAutonomyInput,
  ButlerWorldPerception,
} from "./schema"

export function buildButlerWorldPerception(
  input: ButlerAutonomyInput
): ButlerWorldPerception {
  const ecologyState =
    input.ecologyState ??
    input.homeMapState.ecologyState ??
    buildWorldEcologyState({
      homeMapState: input.homeMapState,
      generatedAt: input.now,
    })
  const resources = input.homeMapState.resources
  const resourcePressure = clampScore(
    100 - Math.round((resources.materialReadiness + resources.careReadiness) / 2)
  )
  const ecologicalStability = clampScore(
    Math.round((resources.groundHealth + resources.naturalGrowth) / 2)
  )
  const constructionDebt = clampScore(
    100 - Math.min(100, input.homeMapState.constructionPlans.length * 25)
  )
  const shelterNeed = clampScore(
    input.homeMapState.placements.some((placement) =>
      placement.tags.includes("temporary_shelter")
    )
      ? 30
      : 72
  )
  const careNeed = clampScore(100 - resources.careReadiness)
  const storageNeed = clampScore(100 - resources.materialReadiness)
  const quietSpaceNeed = clampScore(
    resources.spacePressure > 50 ? resources.spacePressure : 35
  )
  const boundaryMaintenanceNeed = clampScore(100 - resources.groundHealth)
  const adoptionReadinessConcern = clampScore(
    Math.round((resourcePressure + resources.spacePressure + careNeed) / 3)
  )

  return {
    worldId: input.worldId,
    observedAt: input.now,
    resourcePressure,
    ecologicalStability,
    spacePressure: clampScore(resources.spacePressure),
    constructionDebt,
    shelterNeed,
    careNeed,
    storageNeed,
    quietSpaceNeed,
    boundaryMaintenanceNeed,
    adoptionReadinessConcern,
    perceivedFacts: [
      `生态状态 ${ecologyState.status}`,
      `地貌 ${ecologyState.biomeType}`,
      `材料准备 ${resources.materialReadiness}/100`,
      `照护准备 ${resources.careReadiness}/100`,
      `空间压力 ${resources.spacePressure}/100`,
      `已有建设计划 ${input.homeMapState.constructionPlans.length} 个`,
    ],
    risks: [
      ...(resourcePressure >= 55 ? ["资源压力偏高"] : []),
      ...(resources.spacePressure >= 60 ? ["空间压力偏高"] : []),
      ...(careNeed >= 55 ? ["照护准备不足"] : []),
      ...(boundaryMaintenanceNeed >= 55 ? ["自然边界需要维护"] : []),
    ],
    opportunities: ecologyState.facts
      .filter((fact) => fact.status !== "latent")
      .map((fact) => `${fact.label}:${fact.status}`),
    tags: [
      "butler_world_perception",
      "readonly_world_fact_input",
      "no_home_map_write",
      ecologyState.status,
      ecologyState.biomeType,
    ],
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
