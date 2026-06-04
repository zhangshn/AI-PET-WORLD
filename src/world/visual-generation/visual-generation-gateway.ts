import { buildNaturalBushObjectRecipe } from "@/world/pixel-art-recipes/recipes/bush-object-recipe"
import { buildNaturalFlowerObjectRecipe } from "@/world/pixel-art-recipes/recipes/flower-object-recipe"
import { buildNaturalMushroomObjectRecipe } from "@/world/pixel-art-recipes/recipes/mushroom-object-recipe"
import { buildNaturalTreeObjectRecipe } from "@/world/pixel-art-recipes/recipes/tree-object-recipe"
import { buildNaturalStoneObjectRecipe } from "@/world/pixel-art-recipes/recipes/stone-object-recipe"
import { buildNaturalInsectSignalRecipe } from "@/world/pixel-art-recipes/recipes/insect-signal-recipe"
import {
  buildWorldFacilityObjectRecipe,
  buildWorldStructureObjectRecipe,
} from "@/world/pixel-art-recipes/recipes/world-asset-object-recipes"
import type { PixelObjectRecipeResult } from "@/world/pixel-primitives"
import type { WorldViewObject } from "@/world/world-view-model"

import type {
  VisualGenerationInput,
  VisualGenerationPixelBlock,
  VisualGenerationPlan,
  VisualGenerationObjectMigration,
  VisualObjectRecipe,
} from "./visual-generation-schema"

const BLOCK_ENABLED_OBJECT_KINDS = [
  "tree",
  "bush",
  "flower",
  "mushroom",
  "structure",
  "facility",
  "stone",
  "insect_signal",
] as const

export function buildVisualGenerationPlan(
  input: VisualGenerationInput
): VisualGenerationPlan {
  const model = input.worldViewModel
  const objectRecipes = model.objects.flatMap((object) =>
    buildVisualObjectRecipesForObject(object)
  )
  const warnings = auditVisualObjectRecipes({
    objectRecipes,
    canvasWidth: model.canvas.width,
    canvasHeight: model.canvas.height,
  })
  const objectMigration = buildObjectMigrationSummary({
    objects: model.objects,
    objectRecipes,
  })

  return {
    worldId: model.worldId,
    tick: model.tick,
    deterministicKey: `visual_generation_${model.worldId}_${model.tick}`,
    objectRecipes,
    objectMigration,
    actorSpriteFrames: [],
    traceVisuals: [],
    atmosphereVisuals: [],
    audit: {
      ok: warnings.length === 0,
      warnings,
      tags: [
        "visual_generation_audit",
        warnings.length === 0
          ? "visual_generation_audit_passed"
          : "visual_generation_audit_warning",
      ],
    },
    tags: [
      "visual_generation_plan",
      "world_view_model_is_only_semantic_input",
      "visual_generation_does_not_create_world_fact",
      "tree_recipe_blocks_enabled",
      "bush_recipe_blocks_enabled",
      "flower_recipe_blocks_enabled",
      "mushroom_recipe_blocks_enabled",
      "structure_recipe_blocks_enabled",
      "facility_recipe_blocks_enabled",
      "stone_recipe_blocks_enabled",
      "insect_signal_recipe_blocks_enabled",
      ...objectMigration.tags,
    ],
  }
}

function buildVisualObjectRecipesForObject(
  object: WorldViewObject
): VisualObjectRecipe[] {
  if (!isBlockEnabledObjectKind(object.kind)) {
    return []
  }
  if (object.opacity <= 0) return []

  const visualScale = resolveVisualObjectScale(object)
  const deterministicKey = `${object.kind}:${object.id}:${safeNumber(
    visualScale
  )}:${safeNumber(object.health)}:${object.growthStage}`
  const recipe =
    object.kind === "tree"
      ? buildNaturalTreeObjectRecipe({
          sourceObjectId: object.id,
          x: object.x + Math.round(12 * visualScale),
          y: object.y + Math.round(32 * visualScale),
          scale: visualScale,
          health: object.health,
          growthStage: object.growthStage,
          stressLevel: object.tags.includes("stressed") ? 72 : 0,
          deterministicKey,
          stateTags: [...object.tags, object.growthStage, object.source],
        })
      : object.kind === "bush"
        ? buildNaturalBushObjectRecipe({
            sourceObjectId: object.id,
            x: object.x + Math.round(12 * visualScale),
            y: object.y + Math.round(24 * visualScale),
            scale: visualScale,
            health: object.health,
            growthStage: object.growthStage,
            stressLevel: object.tags.includes("stressed") ? 72 : 0,
          deterministicKey,
          stateTags: [...object.tags, object.growthStage, object.source],
        })
        : object.kind === "flower"
          ? buildNaturalFlowerObjectRecipe({
              sourceObjectId: object.id,
              x: object.x + Math.round(12 * visualScale),
              y: object.y + Math.round(22 * visualScale),
              scale: visualScale,
              health: object.health,
              growthStage: object.growthStage,
              stressLevel: object.tags.includes("stressed") ? 72 : 0,
              deterministicKey,
              stateTags: [...object.tags, object.growthStage, object.source],
            })
          : object.kind === "mushroom"
            ? buildNaturalMushroomObjectRecipe({
                sourceObjectId: object.id,
                x: object.x + Math.round(12 * visualScale),
                y: object.y + Math.round(22 * visualScale),
                scale: visualScale,
                health: object.health,
                growthStage: object.growthStage,
                stressLevel: object.tags.includes("stressed") ? 72 : 0,
                deterministicKey,
                stateTags: [...object.tags, object.growthStage, object.source],
              })
            : object.kind === "structure"
              ? buildWorldStructureObjectRecipe({
                  sourceObjectId: object.id,
                  x: object.x + Math.round(18 * visualScale),
                  y: object.y + Math.round(40 * visualScale),
                  scale: visualScale,
                  health: object.health,
                  growthStage: object.growthStage,
                  stressLevel: object.tags.includes("stressed") ? 72 : 0,
                  deterministicKey,
                  stateTags: [...object.tags, object.growthStage, object.source],
                })
              : object.kind === "facility"
                ? buildWorldFacilityObjectRecipe({
                    sourceObjectId: object.id,
                    x: object.x + Math.round(14 * visualScale),
                    y: object.y + Math.round(32 * visualScale),
                    scale: visualScale,
                    health: object.health,
                    growthStage: object.growthStage,
                    stressLevel: object.tags.includes("stressed") ? 72 : 0,
                    deterministicKey,
                    stateTags: [...object.tags, object.growthStage, object.source],
                  })
        : object.kind === "stone"
          ? buildNaturalStoneObjectRecipe({
              sourceObjectId: object.id,
              x: object.x + Math.round(12 * visualScale),
              y: object.y + Math.round(26 * visualScale),
              scale: visualScale,
              deterministicKey: `stone:${object.id}:${safeNumber(visualScale)}:${safeNumber(
                object.health
              )}:${object.growthStage}`,
            })
          : buildNaturalInsectSignalRecipe({
            sourceObjectId: object.id,
            x: object.x + Math.round(12 * visualScale),
            y: object.y + Math.round(16 * visualScale),
            scale: visualScale,
          })

  return [mapPixelObjectRecipeToVisualObjectRecipe({ object, recipe, deterministicKey })]
}

function resolveVisualObjectScale(object: WorldViewObject): number {
  if (!isWorldStoryAnchorObject(object)) return object.scale

  const storyScale =
    object.kind === "facility"
      ? Math.max(1.22, object.scale * 2.2)
      : Math.max(1.16, object.scale * 1.45)

  return Number(Math.min(object.kind === "facility" ? 1.65 : 1.45, storyScale).toFixed(2))
}

function isWorldStoryAnchorObject(object: WorldViewObject): boolean {
  if (object.kind !== "facility" && object.kind !== "structure") return false

  return object.tags.some(
    (tag) =>
      tag === "butler_construction_result" ||
      tag === "construction_plan_add_diff" ||
      tag.startsWith("construction_stage:") ||
      tag.startsWith("construction_project:") ||
      tag.includes("care_station") ||
      tag.includes("under_construction")
  )
}

function buildObjectMigrationSummary(input: {
  objects: WorldViewObject[]
  objectRecipes: VisualObjectRecipe[]
}): VisualGenerationObjectMigration {
  const visibleObjects = input.objects.filter((object) => object.opacity > 0)
  const blockEnabledObjectIds = new Set(
    input.objectRecipes.map((recipe) => recipe.sourceObjectId)
  )
  const blockEnabledKinds = uniqueKinds(
    visibleObjects
      .filter((object) => blockEnabledObjectIds.has(object.id))
      .map((object) => object.kind)
  )
  const markerFallbackObjects = visibleObjects.filter(
    (object) => !blockEnabledObjectIds.has(object.id)
  )
  const markerFallbackKinds = uniqueKinds(
    markerFallbackObjects.map((object) => object.kind)
  )

  return {
    blockEnabledKinds,
    markerFallbackKinds,
    blockEnabledObjectCount: visibleObjects.length - markerFallbackObjects.length,
    markerFallbackObjectCount: markerFallbackObjects.length,
    tags: [
      "visual_generation_object_migration",
      `block_enabled_kinds:${blockEnabledKinds.join("|") || "none"}`,
      `marker_fallback_kinds:${markerFallbackKinds.join("|") || "none"}`,
      markerFallbackObjects.length > 0
        ? "marker_fallback_remaining"
        : "marker_fallback_cleared",
    ],
  }
}

function isBlockEnabledObjectKind(
  kind: WorldViewObject["kind"]
): kind is (typeof BLOCK_ENABLED_OBJECT_KINDS)[number] {
  return BLOCK_ENABLED_OBJECT_KINDS.includes(
    kind as (typeof BLOCK_ENABLED_OBJECT_KINDS)[number]
  )
}

function uniqueKinds(kinds: WorldViewObject["kind"][]): WorldViewObject["kind"][] {
  return Array.from(new Set(kinds)).sort()
}

function mapPixelObjectRecipeToVisualObjectRecipe(input: {
  object: WorldViewObject
  recipe: PixelObjectRecipeResult
  deterministicKey: string
}): VisualObjectRecipe {
  return {
    recipeId: input.recipe.recipeId,
    recipeVersion: input.recipe.recipeVersion,
    sourceObjectId: input.object.id,
    kind: input.object.kind,
    anchor: input.recipe.anchor,
    bounds: input.recipe.bounds,
    blocks: input.recipe.blocks.map<VisualGenerationPixelBlock>((block) => ({
      id: block.id,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      color: block.color,
      opacity: block.opacity,
      layer: block.layer,
      stateTags: [
        ...input.object.tags,
        input.object.growthStage,
        input.object.source,
        block.primitiveKind,
      ],
    })),
    deterministicKey: input.deterministicKey,
    stateTags: [
      ...input.object.tags,
      input.object.growthStage,
      input.object.source,
    ],
  }
}

function auditVisualObjectRecipes(input: {
  objectRecipes: VisualObjectRecipe[]
  canvasWidth: number
  canvasHeight: number
}): string[] {
  const warnings: string[] = []

  input.objectRecipes.forEach((recipe) => {
    if (recipe.blocks.length === 0) {
      warnings.push(`Visual recipe ${recipe.recipeId} has no blocks.`)
    }

    recipe.blocks.forEach((block) => {
      if (block.width <= 0 || block.height <= 0) {
        warnings.push(`Visual block ${block.id} has invalid size.`)
      }
      if (block.x + block.width < 0 || block.y + block.height < 0) {
        warnings.push(`Visual block ${block.id} is fully outside the canvas.`)
      }
      if (block.x > input.canvasWidth || block.y > input.canvasHeight) {
        warnings.push(`Visual block ${block.id} is fully outside the canvas.`)
      }
    })
  })

  return warnings
}

function safeNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0"
}
