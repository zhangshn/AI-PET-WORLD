/**
 * 当前文件职责：构建 MVP 初始世界容器。
 */

import type { ButlerMvpProfile } from "@/world/butler/butler-mvp-schema"
import type { WorldLayoutBiomeType } from "@/world/generation/generation-schema"
import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import { buildStableWorldSeed } from "@/world/generation/world-seed"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import {
  auditMvpInitialWorld,
  type MvpInitialWorldAudit,
} from "./mvp-initial-world-audit"

export type MvpInitialWorldInput = {
  worldId: string
  ownerId: string
  seed: string
  butlerProfile: ButlerMvpProfile
  worldDay: number
  now: number
  biomeType?: WorldLayoutBiomeType
  tags: string[]
}

export type MvpInitialWorldResult = {
  homeMapState: HomeMapState
  worldSeed: string
  butlerProfile: ButlerMvpProfile
  audit: MvpInitialWorldAudit
  messages: string[]
  tags: string[]
}

export function buildMvpInitialWorld(
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
      `MVP initial world built for day ${input.worldDay}.`,
      ...audit.warnings,
    ],
    tags: [
      "mvp_initial_world_result",
      "initial_home_generator_driven",
      "home_map_state_source",
      "no_default_adoption_entry",
      ...input.tags,
    ],
  }
}
