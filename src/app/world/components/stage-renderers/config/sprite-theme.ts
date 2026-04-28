/**
 * 当前文件负责：定义世界实体与角色未来 sprite 主题选择策略。
 */

import { STAGE_ASSET_MANIFEST } from "./asset-manifest"
import { STAGE_VISUAL_CONFIG } from "./stage-visual-config"

export type StageSpriteKind =
  | "pet"
  | "butler"
  | "incubator"
  | "tree"
  | "flower"
  | "water"
  | "butterfly"
  | "home"
  | "shelter"
  | "garden"

export type StageSpriteThemeDefinition = {
  kind: StageSpriteKind
  mode: "procedural_graphics" | "asset_sprite"
  assetIds: string[]
  shadowColor: number
  highlightColor: number
}

export function getStageSpriteTheme(
  kind: StageSpriteKind
): StageSpriteThemeDefinition {
  return {
    kind,
    mode: "procedural_graphics",
    assetIds: getSpriteAssetIds(kind),
    shadowColor: STAGE_VISUAL_CONFIG.shadowColor,
    highlightColor: STAGE_VISUAL_CONFIG.highlightColor,
  }
}

function getSpriteAssetIds(kind: StageSpriteKind): string[] {
  if (kind === "pet") {
    return Object.values(STAGE_ASSET_MANIFEST.actors.pet)
  }

  if (kind === "butler") {
    return Object.values(STAGE_ASSET_MANIFEST.actors.butler)
  }

  if (kind === "incubator") {
    return Object.values(STAGE_ASSET_MANIFEST.actors.incubator)
  }

  if (kind === "tree") return STAGE_ASSET_MANIFEST.objects.tree
  if (kind === "flower") return STAGE_ASSET_MANIFEST.objects.flower
  if (kind === "water") return STAGE_ASSET_MANIFEST.objects.water
  if (kind === "butterfly") return STAGE_ASSET_MANIFEST.objects.butterfly
  if (kind === "home") return STAGE_ASSET_MANIFEST.objects.home
  if (kind === "shelter") return STAGE_ASSET_MANIFEST.objects.shelter
  if (kind === "garden") return STAGE_ASSET_MANIFEST.objects.garden

  return []
}