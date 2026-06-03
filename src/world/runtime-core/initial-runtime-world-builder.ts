/**
 * 褰撳墠鏂囦欢鑱岃矗锛氭瀯寤?runtime 鍒濆涓栫晫瀹瑰櫒銆?
 */

import type { ButlerRuntimeProfile } from "@/world/butler/butler-runtime-profile-schema"
import type { WorldLayoutBiomeType } from "@/world/generation/generation-schema"
import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import { buildStableWorldSeed } from "@/world/generation/world-seed"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import {
  auditMvpInitialWorld,
  type MvpInitialWorldAudit,
} from "./initial-runtime-world-audit"

export type MvpInitialWorldInput = {
  worldId: string
  ownerId: string
  seed: string
  butlerProfile: ButlerRuntimeProfile
  worldDay: number
  now: number
  biomeType?: WorldLayoutBiomeType
  tags: string[]
}

export type MvpInitialWorldResult = {
  homeMapState: HomeMapState
  worldSeed: string
  butlerProfile: ButlerRuntimeProfile
  audit: MvpInitialWorldAudit
  messages: string[]
  tags: string[]
}

export function buildInitialRuntimeWorld(
  input: MvpInitialWorldInput
): MvpInitialWorldResult {
  const birthSignature = [
    input.butlerProfile.playerId,
    input.ownerId,
    input.worldId,
    input.seed,
  ].join("-")
  const worldSeed = buildStableWorldSeed({
    ownerId: input.ownerId,
    birthSignature,
    worldSalt: input.seed,
  })
  const homeMapState = generateInitialHomeMap({
    worldId: input.worldId,
    ownerId: input.ownerId,
    birthSignature,
    worldSalt: input.seed,
    butlerConstructionStyle: input.butlerProfile.constructionStyle,
    biomeType: input.biomeType,
    now: input.now,
  })
  const resultWithoutAudit = {
    homeMapState,
    worldSeed,
    butlerProfile: input.butlerProfile,
  }
  const audit = auditMvpInitialWorld(resultWithoutAudit)

  return {
    ...resultWithoutAudit,
    audit,
    messages: [
      `Initial runtime world built for day ${input.worldDay}.`,
      ...audit.warnings,
    ],
    tags: [
      "initial_runtime_world_result",
      "initial_home_generator_driven",
      "home_map_state_source",
      "no_unplanned_life_entry",
      ...input.tags,
    ],
  }
}
