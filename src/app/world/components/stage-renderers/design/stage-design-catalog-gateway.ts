/**
 * 当前文件负责：聚合主世界设计目录的公开入口。
 */

import type {
  StageDesignCatalogGroup,
  StageDesignCategory,
  StageDesignItem,
  StageDesignPriority,
} from "./stage-design-types"

import {
  getEnabledStageDesignItems,
  getStageDesignItemsByCategory,
  getStageDesignItemsByPriority,
} from "./stage-design-types"
import { BUTLER_RESPONSE_SCENE_STAGE_DESIGN_GROUP } from "./zones/butler-response-scene-designs"
import { CORE_COURTYARD_STAGE_DESIGN_GROUP } from "./zones/core-courtyard-designs"
import { DUAL_AGENT_INTERACTION_SCENE_STAGE_DESIGN_GROUP } from "./zones/dual-agent-interaction-scene-designs"
import { PET_EXPRESSION_SCENE_STAGE_DESIGN_GROUP } from "./zones/pet-expression-scene-designs"

export const STAGE_DESIGN_CATALOG_GROUPS: StageDesignCatalogGroup[] = [
  CORE_COURTYARD_STAGE_DESIGN_GROUP,
  PET_EXPRESSION_SCENE_STAGE_DESIGN_GROUP,
  BUTLER_RESPONSE_SCENE_STAGE_DESIGN_GROUP,
  DUAL_AGENT_INTERACTION_SCENE_STAGE_DESIGN_GROUP,
]

export const STAGE_DESIGN_CATALOG_ITEMS: StageDesignItem[] =
  STAGE_DESIGN_CATALOG_GROUPS.flatMap((group) => group.items)

export function getEnabledStageDesignCatalogItems(): StageDesignItem[] {
  return getEnabledStageDesignItems(STAGE_DESIGN_CATALOG_ITEMS)
}

export function getStageDesignCatalogItemsByCategory(
  category: StageDesignCategory
): StageDesignItem[] {
  return getStageDesignItemsByCategory(STAGE_DESIGN_CATALOG_ITEMS, category)
}

export function getStageDesignCatalogItemsByPriority(
  priority: StageDesignPriority
): StageDesignItem[] {
  return getStageDesignItemsByPriority(STAGE_DESIGN_CATALOG_ITEMS, priority)
}

export function getStageDesignCatalogGroupById(
  groupId: string
): StageDesignCatalogGroup | undefined {
  return STAGE_DESIGN_CATALOG_GROUPS.find((group) => group.groupId === groupId)
}
