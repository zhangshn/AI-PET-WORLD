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
import { BUTTERFLY_STAGE_DESIGN_GROUP } from "./insects/butterfly-designs"
import { FIREFLY_STAGE_DESIGN_GROUP } from "./insects/firefly-designs"
import { BOARD_STAGE_DESIGN_GROUP } from "./structures/board-designs"
import { HOME_STAGE_DESIGN_GROUP } from "./structures/home-designs"
import { LIFE_CAPSULE_STAGE_DESIGN_GROUP } from "./structures/life-capsule-designs"
import { PATH_STRUCTURE_STAGE_DESIGN_GROUP } from "./structures/path-structure-designs"
import { LAKE_STAGE_DESIGN_GROUP } from "./water/lake-designs"
import { RIPPLE_STAGE_DESIGN_GROUP } from "./water/ripple-designs"
import { WATER_DETAIL_STAGE_DESIGN_GROUP } from "./water/water-detail-designs"
import { BUTLER_RESPONSE_SCENE_STAGE_DESIGN_GROUP } from "./zones/butler-response-scene-designs"
import { CORE_COURTYARD_STAGE_DESIGN_GROUP } from "./zones/core-courtyard-designs"
import { DUAL_AGENT_INTERACTION_SCENE_STAGE_DESIGN_GROUP } from "./zones/dual-agent-interaction-scene-designs"
import { PET_EXPRESSION_SCENE_STAGE_DESIGN_GROUP } from "./zones/pet-expression-scene-designs"

export const STAGE_DESIGN_CATALOG_GROUPS: StageDesignCatalogGroup[] = [
  CORE_COURTYARD_STAGE_DESIGN_GROUP,
  PET_EXPRESSION_SCENE_STAGE_DESIGN_GROUP,
  BUTLER_RESPONSE_SCENE_STAGE_DESIGN_GROUP,
  DUAL_AGENT_INTERACTION_SCENE_STAGE_DESIGN_GROUP,
  BUTTERFLY_STAGE_DESIGN_GROUP,
  FIREFLY_STAGE_DESIGN_GROUP,
  LAKE_STAGE_DESIGN_GROUP,
  RIPPLE_STAGE_DESIGN_GROUP,
  WATER_DETAIL_STAGE_DESIGN_GROUP,
  LIFE_CAPSULE_STAGE_DESIGN_GROUP,
  HOME_STAGE_DESIGN_GROUP,
  BOARD_STAGE_DESIGN_GROUP,
  PATH_STRUCTURE_STAGE_DESIGN_GROUP,
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
