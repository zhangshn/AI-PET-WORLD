/**
 * 褰撳墠鏂囦欢鑱岃矗锛氬璁?runtime 鍒濆涓栫晫鐢熸垚缁撴灉銆?
 */

import type { HomeMapState, MapPlacement } from "@/world/map-state/home-map-state-schema"

import type { ButlerRuntimeProfile } from "@/world/butler/butler-runtime-profile-schema"

export type MvpInitialWorldAudit = {
  stableInitialWorldFingerprint: string
  worldId: string
  warnings: string[]
  tags: string[]
}

export function auditMvpInitialWorld(result: {
  homeMapState: HomeMapState
  worldSeed: string
  butlerProfile: ButlerRuntimeProfile
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
      "initial_runtime_world_audit",
      "initial_runtime_world_valid",
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
