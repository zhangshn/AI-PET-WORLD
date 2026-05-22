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
  const warnings = auditForbiddenTokens(result.homeMapState)

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
      warnings.length === 0 ? "mvp_initial_world_valid" : "mvp_initial_world_warning",
      "no_default_companion_entry",
    ],
  }
}

const FORBIDDEN_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet-near-arrival-point",
  "pet-bed",
  "pet_actor",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

function auditForbiddenTokens(homeMapState: HomeMapState): string[] {
  const tokens = [
    ...homeMapState.tags,
    ...homeMapState.zones.flatMap((zone) => [
      zone.id,
      zone.type,
      zone.name,
      zone.purpose,
      ...zone.tags,
    ]),
    ...homeMapState.placements.flatMap(collectPlacementTokens),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`MVP initial world 包含禁止 token：${token}`]
      : []
  )
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

function collectPlacementTokens(placement: MapPlacement): string[] {
  return [
    placement.id,
    placement.assetId,
    placement.layer,
    placement.label,
    ...placement.tags,
  ]
}
