/**
 * 当前文件职责：提供 MVP pipeline smoke scenario 输入。
 */

import type { AiPetWorldMvpPipelineInput } from "./mvp-core-schema"

export function buildMvpSmokeScenarioInputs(): AiPetWorldMvpPipelineInput[] {
  return [
    buildScenario({
      playerId: "smoke-player-stable-a",
      seed: "mvp-smoke-stable-seed",
      birthHour: 8,
      tags: ["same_seed_stability_scenario"],
    }),
    buildScenario({
      playerId: "smoke-player-stable-b",
      seed: "mvp-smoke-stable-seed",
      birthHour: 8,
      tags: ["same_seed_stability_scenario"],
    }),
    buildScenario({
      playerId: "smoke-player-different-personality",
      seed: "mvp-smoke-different-seed",
      birthHour: 21,
      tags: [
        "different_personality_scenario",
        "no_default_pet_scenario",
        "construction_run_scenario",
        "visual_refresh_request_scenario",
        "persistence_dry_run_scenario",
      ],
    }),
  ]
}

function buildScenario(input: {
  playerId: string
  seed: string
  birthHour: number
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
    runMode: "debug",
    persistenceMode: "memory_preview",
    visualMode: "formal_precheck",
    tags: [
      "mvp_smoke_scenario",
      ...input.tags,
    ],
  }
}
