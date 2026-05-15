/**
 * 当前文件负责：定义地图摆放的基础规则常量。
 */

import type { PlacementRule } from "./placement-schema"

export const PLACEMENT_RULES = {
  noIsolatedAssets: {
    id: "no_isolated_assets",
    description: "素材不能孤立摆放，必须属于明确区域或连接关系。",
    severity: "warn",
    tags: ["placement", "semantic_context"],
  },
  requiresGroundSupport: {
    id: "requires_ground_support",
    description: "建筑、设施、角色必须有地面或区域承托。",
    severity: "block",
    tags: ["placement", "ground_support"],
  },
  continuousPath: {
    id: "continuous_path",
    description: "主要道路必须保持连续，不能出现断裂路径。",
    severity: "warn",
    tags: ["placement", "path"],
  },
  avoidCollision: {
    id: "avoid_collision",
    description: "同一图层的主要对象不能占用完全相同坐标。",
    severity: "block",
    tags: ["placement", "collision"],
  },
  zoneDensityLimit: {
    id: "zone_density_limit",
    description: "区域内对象密度必须受控，避免大面积堆叠。",
    severity: "warn",
    tags: ["placement", "density"],
  },
} as const satisfies Record<string, PlacementRule>

export const INITIAL_HOME_PLACEMENT_RULE_SET: PlacementRule[] = [
  PLACEMENT_RULES.noIsolatedAssets,
  PLACEMENT_RULES.requiresGroundSupport,
  PLACEMENT_RULES.continuousPath,
  PLACEMENT_RULES.avoidCollision,
  PLACEMENT_RULES.zoneDensityLimit,
]
