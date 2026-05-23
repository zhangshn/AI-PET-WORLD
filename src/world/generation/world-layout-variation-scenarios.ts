/**
 * 当前文件负责：定义 WORLD-GEN-03 布局差异化验证场景。
 */

import type {
  InitialHomeGenerationInput,
  WorldLayoutResourceInput,
} from "./generation-schema"

export type WorldLayoutVariationScenario = {
  id: string
  name: string
  description: string
  generationInput: InitialHomeGenerationInput
  resources: WorldLayoutResourceInput
  expectedDrivers: string[]
}

const FIXED_WORLD_GEN_03_NOW = 0

export const WORLD_LAYOUT_VARIATION_SCENARIOS: readonly WorldLayoutVariationScenario[] = [
  {
    id: "structured_direct_baseline",
    name: "结构型基准世界",
    description: "高结构倾向、低空间压力，用于作为 WORLD-GEN-03 对照基准。",
    generationInput: {
      worldId: "world-gen-03-structured-direct",
      ownerId: "owner-structured-direct",
      birthSignature: "1990-01-03-chen",
      worldSalt: "world-gen-03-alpha",
      biomeType: "grassland",
      now: FIXED_WORLD_GEN_03_NOW,
      butlerConstructionStyle: {
        structuredBuilder: 0.88,
        warmCaretaker: 0.42,
        protectiveKeeper: 0.46,
        aestheticOrganizer: 0.52,
        quietMaintainer: 0.36,
        adaptivePlanner: 0.28,
      },
    },
    resources: {
      materialReadiness: 54,
      careReadiness: 50,
      naturalGrowth: 42,
      groundHealth: 78,
      spacePressure: 18,
    },
    expectedDrivers: ["direct_path", "ordered_storage", "stable_seed"],
  },
  {
    id: "adaptive_curved_path",
    name: "适应型曲线路径世界",
    description: "高适应倾向与中等自然增长，用于验证路径风格和静区位置变化。",
    generationInput: {
      worldId: "world-gen-03-adaptive-curved",
      ownerId: "owner-adaptive-curved",
      birthSignature: "1994-06-18-wei",
      worldSalt: "world-gen-03-beta",
      biomeType: "oasis",
      now: FIXED_WORLD_GEN_03_NOW,
      butlerConstructionStyle: {
        structuredBuilder: 0.35,
        warmCaretaker: 0.58,
        protectiveKeeper: 0.38,
        aestheticOrganizer: 0.49,
        quietMaintainer: 0.44,
        adaptivePlanner: 0.86,
      },
    },
    resources: {
      materialReadiness: 44,
      careReadiness: 57,
      naturalGrowth: 52,
      groundHealth: 81,
      spacePressure: 22,
    },
    expectedDrivers: ["curved_path", "adaptive_waypoint", "care_ready"],
  },
  {
    id: "protective_dense_boundary",
    name: "保护型自然边界世界",
    description: "高保护倾向与高自然增长，用于验证自然边界密度差异。",
    generationInput: {
      worldId: "world-gen-03-protective-boundary",
      ownerId: "owner-protective-boundary",
      birthSignature: "1988-11-08-xu",
      worldSalt: "world-gen-03-gamma",
      biomeType: "forest",
      now: FIXED_WORLD_GEN_03_NOW,
      butlerConstructionStyle: {
        structuredBuilder: 0.48,
        warmCaretaker: 0.46,
        protectiveKeeper: 0.91,
        aestheticOrganizer: 0.43,
        quietMaintainer: 0.52,
        adaptivePlanner: 0.34,
      },
    },
    resources: {
      materialReadiness: 39,
      careReadiness: 49,
      naturalGrowth: 72,
      groundHealth: 83,
      spacePressure: 25,
    },
    expectedDrivers: ["edge_protected_shelter", "dense_boundary", "protective_layout"],
  },
  {
    id: "aesthetic_soft_boundary",
    name: "美感型柔化边界世界",
    description: "高美感倾向，用于验证装饰数量、边缘柔化和自然过渡差异。",
    generationInput: {
      worldId: "world-gen-03-aesthetic-soft",
      ownerId: "owner-aesthetic-soft",
      birthSignature: "1992-03-26-you",
      worldSalt: "world-gen-03-delta",
      biomeType: "oasis",
      now: FIXED_WORLD_GEN_03_NOW,
      butlerConstructionStyle: {
        structuredBuilder: 0.41,
        warmCaretaker: 0.55,
        protectiveKeeper: 0.37,
        aestheticOrganizer: 0.93,
        quietMaintainer: 0.48,
        adaptivePlanner: 0.51,
      },
    },
    resources: {
      materialReadiness: 47,
      careReadiness: 53,
      naturalGrowth: 58,
      groundHealth: 86,
      spacePressure: 20,
    },
    expectedDrivers: ["soft_boundary", "surface_decoration", "aesthetic_detail"],
  },
  {
    id: "quiet_nature_retreat",
    name: "安静型自然退让世界",
    description: "高安静倾向，用于验证安静生活区留白和 near_nature 偏移。",
    generationInput: {
      worldId: "world-gen-03-quiet-retreat",
      ownerId: "owner-quiet-retreat",
      birthSignature: "1996-09-14-hai",
      worldSalt: "world-gen-03-epsilon",
      biomeType: "forest",
      now: FIXED_WORLD_GEN_03_NOW,
      butlerConstructionStyle: {
        structuredBuilder: 0.36,
        warmCaretaker: 0.45,
        protectiveKeeper: 0.42,
        aestheticOrganizer: 0.50,
        quietMaintainer: 0.89,
        adaptivePlanner: 0.47,
      },
    },
    resources: {
      materialReadiness: 36,
      careReadiness: 51,
      naturalGrowth: 61,
      groundHealth: 82,
      spacePressure: 16,
    },
    expectedDrivers: ["near_nature_quiet_area", "quiet_clearance", "lower_decoration_pressure"],
  },
  {
    id: "compact_resource_pressure",
    name: "高空间压力资源世界",
    description: "高空间压力与较高材料准备，用于验证承托区紧凑度和住所靠近资源。",
    generationInput: {
      worldId: "world-gen-03-compact-resource",
      ownerId: "owner-compact-resource",
      birthSignature: "1991-12-02-chou",
      worldSalt: "world-gen-03-zeta",
      biomeType: "desert",
      now: FIXED_WORLD_GEN_03_NOW,
      butlerConstructionStyle: {
        structuredBuilder: 0.62,
        warmCaretaker: 0.43,
        protectiveKeeper: 0.44,
        aestheticOrganizer: 0.40,
        quietMaintainer: 0.35,
        adaptivePlanner: 0.39,
      },
    },
    resources: {
      materialReadiness: 66,
      careReadiness: 47,
      naturalGrowth: 39,
      groundHealth: 76,
      spacePressure: 48,
    },
    expectedDrivers: ["resource_adjacent_shelter", "compact_support", "space_pressure"],
  },
]
