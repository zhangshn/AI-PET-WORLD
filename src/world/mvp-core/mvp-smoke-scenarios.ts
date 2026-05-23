/**
 * 当前文件职责：提供 MVP pipeline smoke scenario 输入。
 */

import type { AiPetWorldMvpPipelineInput } from "./mvp-core-schema"
import type { WorldLayoutBiomeType } from "@/world/generation/generation-schema"

export function buildMvpSmokeScenarioInputs(): AiPetWorldMvpPipelineInput[] {
  return [
    buildScenario({
      playerId: "smoke-player-stable-a",
      seed: "mvp-smoke-stable-seed",
      birthHour: 8,
      biomeType: "grassland",
      tags: ["same_seed_stability_scenario"],
    }),
    buildScenario({
      playerId: "smoke-player-stable-b",
      seed: "mvp-smoke-stable-seed",
      birthHour: 8,
      biomeType: "grassland",
      tags: ["same_seed_stability_scenario"],
    }),
    buildScenario({
      playerId: "smoke-player-different-personality",
      seed: "mvp-smoke-different-seed",
      birthHour: 21,
      biomeType: "forest",
      tags: [
        "different_personality_scenario",
        "no_default_pet_scenario",
        "construction_run_scenario",
        "visual_refresh_request_scenario",
        "persistence_dry_run_scenario",
      ],
    }),
    buildScenario({
      playerId: "smoke-player-desert-resource",
      seed: "mvp-smoke-desert-seed",
      birthHour: 14,
      biomeType: "desert",
      tags: ["desert_resource_cycle_scenario"],
    }),
    buildScenario({
      playerId: "smoke-player-oasis-resource",
      seed: "mvp-smoke-oasis-seed",
      birthHour: 6,
      biomeType: "oasis",
      tags: ["oasis_resource_cycle_scenario"],
    }),
  ]
}

function buildScenario(input: {
  playerId: string
  seed: string
  birthHour: number
  biomeType: WorldLayoutBiomeType
  tags: string[]
}): AiPetWorldMvpPipelineInput {
  return {
    playerId: input.playerId,
    ownerId: `owner-${input.playerId}`,
    worldId: `world-${input.playerId}`,
    birthYear: 1991,
    birthMonth: 6,
    birthDay: 18,
    birthHour: input.birthHour,
    timezone: "Asia/Shanghai",
    worldDay: 1,
    now: 1000,
    seed: input.seed,
    biomeType: input.biomeType,
    runMode: "debug",
    persistenceMode: "memory_preview",
    visualMode: "formal_precheck",
    tags: [
      "mvp_smoke_scenario",
      ...input.tags,
    ],
  }
}
