/**
 * 当前文件职责：审计 MVP 初始世界生成结果。
 */

import type { HomeMapState, MapPlacement } from "@/world/map-state/home-map-state-schema"

import type { ButlerMvpProfile } from "@/world/butler/butler-mvp-schema"

export type MvpInitialWorldAudit = {
  stableInitialWorldFingerprint: string
  worldId: string
  warnings: string[]
  tags: string[]
}

export function auditMvpInitialWorld(result: {
  homeMapState: HomeMapState
  worldSeed: string
  butlerProfile: ButlerMvpProfile
}): MvpInitialWorldAudit {
  const warnings: string[] = []

  return {
    stableInitialWorldFingerprint: [
      result.homeMapState.worldId,
      result.homeMapState.ownerId,
      result.homeMapState.seed,
      result.worldSeed,
      result.butlerProfile.butlerId,
      fingerprintPlacements(result.homeMapState.placements),
    ].join("::"),
    worldId: result.homeMapState.worldId,
    warnings,
    tags: [
      "mvp_initial_world_audit",
      "mvp_initial_world_valid",
      "initial_world_fact_fingerprint",
    ],
  }
}

function fingerprintPlacements(placements: MapPlacement[]): string {
  return placements
    .map((placement) =>
      [
        placement.id,
        placement.layer,
        String(placement.x),
        String(placement.y),
        String(placement.alpha),
        placement.tags.slice().sort().join("+"),
      ].join(":")
    )
    .sort()
    .join("|")
}
