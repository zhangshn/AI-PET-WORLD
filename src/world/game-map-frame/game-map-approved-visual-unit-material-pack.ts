import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import type { GameMapCompositeManifest } from "./game-map-composite-schema"
import {
  bindGameMapCompositeMaterials,
  type BindGameMapCompositeMaterialsResult,
  type GameMapApprovedVisualUnitMaterialInput,
} from "./game-map-composite-material-binding"

export type GameMapApprovedVisualUnitMaterialPack = {
  schemaVersion: "game-map-approved-visual-unit-material-pack-v1"
  packId: string
  worldId: string
  tick: number
  sourceFactIds: string[]
  materials: GameMapApprovedVisualUnitMaterialInput[]
  review: {
    status: "approved_visual_unit_material_pack"
    reviewer: "visual_judge" | "project_owner"
    reviewedAt: string
    notes: string[]
  }
  tags: string[]
}

export type LoadGameMapApprovedVisualUnitMaterialPackResult = {
  passed: boolean
  pack: GameMapApprovedVisualUnitMaterialPack | null
  blockedReasons: string[]
  tags: string[]
}

export async function loadGameMapApprovedVisualUnitMaterialPack(
  filePath: string
): Promise<LoadGameMapApprovedVisualUnitMaterialPackResult> {
  try {
    const parsed = JSON.parse(
      await readFile(resolve(filePath), "utf8")
    ) as GameMapApprovedVisualUnitMaterialPack
    const validation = validateGameMapApprovedVisualUnitMaterialPack(parsed)
    if (!validation.passed) {
      return blocked(validation.blockedReasons)
    }
    return {
      passed: true,
      pack: parsed,
      blockedReasons: [],
      tags: ["approved_visual_unit_material_pack_loaded"],
    }
  } catch {
    return blocked(["approved_visual_unit_material_pack_unreadable"])
  }
}

export function bindGameMapCompositeMaterialsFromPack(input: {
  manifest: GameMapCompositeManifest
  pack: GameMapApprovedVisualUnitMaterialPack
}): BindGameMapCompositeMaterialsResult {
  const { manifest, pack } = input
  const validation = validateGameMapApprovedVisualUnitMaterialPack(pack)
  if (!validation.passed) {
    return {
      status: "blocked_invalid_materials",
      passed: false,
      manifest: null,
      blockedReasons: validation.blockedReasons,
      tags: ["approved_visual_unit_material_pack_blocked"],
    }
  }
  if (pack.worldId !== manifest.worldId) {
    return blockedBinding(["material_pack_world_mismatch"])
  }
  if (pack.tick !== manifest.tick) {
    return blockedBinding(["material_pack_tick_mismatch"])
  }
  if (!sameStringSet(pack.sourceFactIds, manifest.sourceFactIds)) {
    return blockedBinding(["material_pack_source_facts_mismatch"])
  }

  return bindGameMapCompositeMaterials({
    manifest,
    materials: pack.materials,
  })
}

export function validateGameMapApprovedVisualUnitMaterialPack(
  pack: GameMapApprovedVisualUnitMaterialPack
): LoadGameMapApprovedVisualUnitMaterialPackResult {
  const blockedReasons: string[] = []

  if (pack.schemaVersion !== "game-map-approved-visual-unit-material-pack-v1") {
    blockedReasons.push("material_pack_schema_invalid")
  }
  if (!isNonEmptyString(pack.packId)) blockedReasons.push("material_pack_id_missing")
  if (!isNonEmptyString(pack.worldId)) blockedReasons.push("material_pack_world_missing")
  if (!Number.isInteger(pack.tick)) blockedReasons.push("material_pack_tick_invalid")
  if (!isNonEmptyStringArray(pack.sourceFactIds)) {
    blockedReasons.push("material_pack_source_facts_missing")
  }
  if (!Array.isArray(pack.materials) || pack.materials.length === 0) {
    blockedReasons.push("material_pack_materials_missing")
  }
  if (
    !pack.review ||
    pack.review.status !== "approved_visual_unit_material_pack" ||
    (pack.review.reviewer !== "visual_judge" &&
      pack.review.reviewer !== "project_owner") ||
    !isNonEmptyString(pack.review.reviewedAt) ||
    !Array.isArray(pack.review.notes)
  ) {
    blockedReasons.push("material_pack_review_missing")
  }
  if (!Array.isArray(pack.tags)) {
    blockedReasons.push("material_pack_tags_missing")
  } else {
    if (!pack.tags.includes("approved_visual_unit_material_pack")) {
      blockedReasons.push("material_pack_approved_tag_missing")
    }
    if (containsBlockedTag(pack.tags)) {
      blockedReasons.push("material_pack_has_candidate_or_training_tag")
    }
  }

  for (const material of pack.materials ?? []) {
    if (containsBlockedTag(material.tags)) {
      blockedReasons.push(`material_${material.slotId}_has_candidate_or_training_tag`)
    }
  }

  return {
    passed: blockedReasons.length === 0,
    pack: blockedReasons.length === 0 ? pack : null,
    blockedReasons,
    tags:
      blockedReasons.length === 0
        ? ["approved_visual_unit_material_pack_valid"]
        : ["approved_visual_unit_material_pack_blocked"],
  }
}

function blocked(reasons: string[]): LoadGameMapApprovedVisualUnitMaterialPackResult {
  return {
    passed: false,
    pack: null,
    blockedReasons: reasons,
    tags: ["approved_visual_unit_material_pack_blocked"],
  }
}

function blockedBinding(reasons: string[]): BindGameMapCompositeMaterialsResult {
  return {
    status: "blocked_source_facts_mismatch",
    passed: false,
    manifest: null,
    blockedReasons: reasons,
    tags: ["approved_visual_unit_material_pack_blocked"],
  }
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function containsBlockedTag(tags: string[]): boolean {
  return [
    "training_candidate",
    "candidate_only",
    "partial_or_crop_candidate",
    "single_model_output_only",
    "single_direct_output",
    "local_asset_preview",
  ].some((tag) => tags.includes(tag))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}
