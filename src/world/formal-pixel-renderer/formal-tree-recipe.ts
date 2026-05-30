// 该文件用于让正式像素世界复用 Pixel Visual Lab 场景组合中的原始树木算法。

import { buildScenePalette } from "@/world/procedural-painter/scene-composer/scene-composer-palette"
import {
  renderSceneComposerTreeObject,
  renderSceneComposerTreeShadow,
} from "@/world/procedural-painter/scene-composer/scene-composer-tree-recipe"
import type { SceneObject, SceneObjectGrowthStage } from "@/world/procedural-painter/scene-composer/scene-composer-schema"

import type { FormalPixelObjectRenderItem } from "./formal-pixel-renderer-schema"

export function renderFormalTreeObject(object: FormalPixelObjectRenderItem): string {
  const palette = buildScenePalette("forest", 74)
  const tree = buildSceneTreeObject(object)

  return [
    `<g data-id="${escapeText(object.id)}" data-object-kind="tree" data-formal-recipe="formal_tree_recipe_v1" data-visual-scope="tree_only" data-tree-algorithm="scene_composer_tree_recipe" opacity="${object.opacity}">`,
    renderSceneComposerTreeShadow(tree, palette),
    renderSceneComposerTreeObject(tree, palette),
    `</g>`,
  ].join("\n")
}

function buildSceneTreeObject(object: FormalPixelObjectRenderItem): SceneObject {
  return {
    id: object.id,
    kind: "tree",
    x: object.x,
    y: object.y,
    scale: object.scale,
    layer: "middle",
    health: object.health,
    age: resolveAge(object.growthStage),
    ecologyRole: "canopy",
    moistureAffinity: 74,
    traceSensitivity: 40,
    ecologyHealth: object.health,
    growthStage: resolveGrowthStage(object.growthStage, object.health),
    stressLevel: Math.max(0, 100 - object.health),
  }
}

function resolveGrowthStage(growthStage: string, health: number): SceneObjectGrowthStage {
  const stage = growthStage.toLowerCase()
  if (health <= 28 || stage.includes("declin")) return "declining"
  if (stage.includes("seed") || stage.includes("sprout")) return "sprout"
  if (stage.includes("young") || stage.includes("sapling")) return "young"
  if (stage.includes("old")) return "old"
  return "mature"
}

function resolveAge(growthStage: string): number {
  const stage = growthStage.toLowerCase()
  if (stage.includes("seed") || stage.includes("sprout")) return 4
  if (stage.includes("sapling")) return 16
  if (stage.includes("young")) return 28
  if (stage.includes("old")) return 110
  return 54
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
