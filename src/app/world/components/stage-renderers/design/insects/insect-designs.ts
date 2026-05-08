/**
 * 当前文件负责：聚合主世界昆虫类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

import {
  BUTTERFLY_STAGE_DESIGN_GROUP,
  BUTTERFLY_STAGE_DESIGN_ITEMS,
} from "./butterfly-designs"
import {
  FIREFLY_STAGE_DESIGN_GROUP,
  FIREFLY_STAGE_DESIGN_ITEMS,
} from "./firefly-designs"

export const INSECT_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  ...BUTTERFLY_STAGE_DESIGN_ITEMS,
  ...FIREFLY_STAGE_DESIGN_ITEMS,
]

export const INSECT_STAGE_DESIGN_GROUPS: StageDesignCatalogGroup[] = [
  BUTTERFLY_STAGE_DESIGN_GROUP,
  FIREFLY_STAGE_DESIGN_GROUP,
]

export const INSECT_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "insect_all",
  label: "昆虫类",
  description: "聚合蝴蝶、萤火虫等主世界小型生命动态元素。",
  items: INSECT_STAGE_DESIGN_ITEMS,
}