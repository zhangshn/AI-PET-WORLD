import {
  BUILDING_LIFECYCLE_FRAME,
  CHARACTER_IDLE_FRAME,
  NATURAL_LOOP_FRAME,
  NATURAL_STATIC_FRAME,
} from "./visual-unit-state-frame"
import type { VisualUnitDefinition, VisualUnitV0Status } from "./visual-unit-schema"

const strictWorldFactBinding = {
  requiresWorldId: true,
  requiresTick: true,
  requiresSourceFactIds: true,
  mayAddMajorWorldFact: false,
}

export const visualUnitRegistry: VisualUnitDefinition[] = [
  {
    unitId: "natural-home-environment",
    unitType: "natural",
    labelZh: "自然家园环境底座",
    phase: "mvp_current",
    trainingStatus: "training",
    allowedInCurrentNaturalHomeMvp: true,
    worldFactBindingPolicy: strictWorldFactBinding,
    frameSet: [NATURAL_STATIC_FRAME, NATURAL_LOOP_FRAME],
    trainingContract: {
      targetDirectories: ["data/visual-units/natural/target"],
      maskDirectories: ["data/visual-units/natural/mask"],
      metadataRequired: ["sourceId", "license", "sha256", "worldFactTags", "state"],
      minimumAcceptedSamples: 100,
      storesRejectedSamples: true,
    },
  },
  {
    unitId: "butler-character",
    unitType: "butler",
    labelZh: "管家角色视觉单元",
    phase: "next",
    trainingStatus: "not_started",
    allowedInCurrentNaturalHomeMvp: false,
    worldFactBindingPolicy: strictWorldFactBinding,
    frameSet: [CHARACTER_IDLE_FRAME],
    trainingContract: {
      targetDirectories: ["data/visual-units/butler/target"],
      maskDirectories: ["data/visual-units/butler/mask"],
      metadataRequired: ["sourceId", "license", "sha256", "personalityTags", "state", "direction"],
      minimumAcceptedSamples: 120,
      storesRejectedSamples: true,
    },
  },
  {
    unitId: "human-character",
    unitType: "character",
    labelZh: "人物视觉单元",
    phase: "future",
    trainingStatus: "not_started",
    allowedInCurrentNaturalHomeMvp: false,
    worldFactBindingPolicy: strictWorldFactBinding,
    frameSet: [CHARACTER_IDLE_FRAME],
    trainingContract: {
      targetDirectories: ["data/visual-units/character/target"],
      maskDirectories: ["data/visual-units/character/mask"],
      metadataRequired: ["sourceId", "license", "sha256", "state", "direction"],
      minimumAcceptedSamples: 120,
      storesRejectedSamples: true,
    },
  },
  {
    unitId: "settlement-building",
    unitType: "building",
    labelZh: "住所与建筑视觉单元",
    phase: "next",
    trainingStatus: "not_started",
    allowedInCurrentNaturalHomeMvp: false,
    worldFactBindingPolicy: strictWorldFactBinding,
    frameSet: [BUILDING_LIFECYCLE_FRAME],
    trainingContract: {
      targetDirectories: ["data/visual-units/building/target"],
      maskDirectories: ["data/visual-units/building/mask"],
      metadataRequired: ["sourceId", "license", "sha256", "buildingStage", "materials", "state"],
      minimumAcceptedSamples: 160,
      storesRejectedSamples: true,
    },
  },
  {
    unitId: "facility-and-item",
    unitType: "facility",
    labelZh: "设施与道具视觉单元",
    phase: "future",
    trainingStatus: "not_started",
    allowedInCurrentNaturalHomeMvp: false,
    worldFactBindingPolicy: strictWorldFactBinding,
    frameSet: [BUILDING_LIFECYCLE_FRAME],
    trainingContract: {
      targetDirectories: ["data/visual-units/facility/target"],
      maskDirectories: ["data/visual-units/facility/mask"],
      metadataRequired: ["sourceId", "license", "sha256", "facilityType", "state"],
      minimumAcceptedSamples: 120,
      storesRejectedSamples: true,
    },
  },
  {
    unitId: "ambient-effect",
    unitType: "effect",
    labelZh: "环境动效视觉单元",
    phase: "future",
    trainingStatus: "not_started",
    allowedInCurrentNaturalHomeMvp: false,
    worldFactBindingPolicy: strictWorldFactBinding,
    frameSet: [NATURAL_LOOP_FRAME],
    trainingContract: {
      targetDirectories: ["data/visual-units/effect/target"],
      maskDirectories: ["data/visual-units/effect/mask"],
      metadataRequired: ["sourceId", "license", "sha256", "effectType", "state"],
      minimumAcceptedSamples: 120,
      storesRejectedSamples: true,
    },
  },
]

export function buildVisualUnitV0Status(): VisualUnitV0Status {
  const currentMvpUnitCount = visualUnitRegistry.filter((unit) => unit.phase === "mvp_current").length
  const futureUnitCount = visualUnitRegistry.filter((unit) => unit.phase !== "mvp_current").length
  const approvedUnitCount = visualUnitRegistry.filter((unit) => unit.trainingStatus === "approved").length
  return {
    schemaVersion: "visual-unit-v0",
    status: "schema_ready_registry_seeded",
    currentMvpUnitCount,
    futureUnitCount,
    approvedUnitCount,
    missingForDynamicWorld: visualUnitRegistry
      .filter((unit) => unit.trainingStatus === "not_started")
      .map((unit) => unit.labelZh),
    nextModule: "建立 VisualUnit 数据目录并接入第一个自然/树木状态样例",
  }
}
