/**
 * 当前文件职责：登记世界对象的基础生成与放置规则。
 */

import type { WorldObjectRule, WorldObjectType } from "./world-rule-schema"

export const WORLD_OBJECT_RULES = {
  tree: {
    objectType: "tree",
    allowedSurfaces: ["grass", "soil"],
    deniedSurfaces: ["water", "sand"],
    tags: ["vegetation", "nature"],
  },
  flower: {
    objectType: "flower",
    allowedSurfaces: ["grass", "soil"],
    deniedSurfaces: ["water", "sand"],
    tags: ["vegetation", "nature"],
  },
  fish: {
    objectType: "fish",
    allowedSurfaces: ["water"],
    tags: ["creature", "aquatic"],
  },
  house_foundation: {
    objectType: "house_foundation",
    allowedSurfaces: ["soil", "grass", "stone"],
    deniedSurfaces: ["water"],
    requiresSupport: true,
    supportSurfaces: ["soil", "grass", "stone"],
    tags: ["structure", "foundation"],
  },
  road: {
    objectType: "road",
    allowedSurfaces: ["soil", "grass", "stone", "sand"],
    deniedSurfaces: ["water"],
    tags: ["path", "infrastructure"],
  },
  bridge: {
    objectType: "bridge",
    allowedSurfaces: ["water", "soil", "grass"],
    allowWaterOverlap: true,
    tags: ["path", "infrastructure"],
  },
  pet_bed: {
    objectType: "pet_bed",
    allowedSurfaces: ["constructed_foundation", "wood", "grass"],
    tags: ["facility", "rest"],
  },
  food_bowl: {
    objectType: "food_bowl",
    allowedSurfaces: ["constructed_foundation", "wood", "grass"],
    tags: ["facility", "feeding"],
  },
  incubator: {
    objectType: "incubator",
    allowedSurfaces: ["constructed_foundation", "wood", "grass", "soil"],
    tags: ["facility", "birth"],
  },
} as const satisfies Record<WorldObjectType, WorldObjectRule>
