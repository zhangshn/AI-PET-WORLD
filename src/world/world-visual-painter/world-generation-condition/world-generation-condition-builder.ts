import type {
  WorldVisualAssetPlan,
  WorldVisualCompositionPlan,
  WorldVisualFactManifest,
  WorldVisualFixPlan,
  WorldVisualGenerationCondition,
  WorldVisualImageModelStatus,
  WorldVisualMotionPlan,
  WorldVisualRuleDataset,
  WorldVisualSceneIntent,
  WorldVisualTerrainPlan,
} from "../world-visual-painter-schema"
import { WORLD_VISUAL_MVP_TARGET_POLICY } from "../visual-target-policy"

export function buildWorldVisualGenerationCondition(input: {
  factManifest: WorldVisualFactManifest
  sceneIntent: WorldVisualSceneIntent
  compositionPlan: WorldVisualCompositionPlan
  terrainPlan: WorldVisualTerrainPlan
  assetPlan: WorldVisualAssetPlan
  motionPlan: WorldVisualMotionPlan
  ruleDataset: WorldVisualRuleDataset
  imageModelStatus: WorldVisualImageModelStatus
  latestFixPlan: WorldVisualFixPlan | null
}): WorldVisualGenerationCondition {
  return {
    conditionId: `world-generation-condition-${input.factManifest.worldId}-${input.factManifest.tick}`,
    version: "world-generation-condition-v1",
    worldId: input.factManifest.worldId,
    tick: input.factManifest.tick,
    modelVersion: input.imageModelStatus.modelVersion,
    sceneCondition: {
      sceneType: input.sceneIntent.sceneType,
      mainStory: input.sceneIntent.mainStory,
      mustShow: input.sceneIntent.mustShow,
      mayShow: input.sceneIntent.mayShow,
      mustNotShow: input.sceneIntent.mustNotShow,
    },
    spatialCondition: {
      camera: input.compositionPlan.camera,
      focalArea: input.compositionPlan.focalArea,
      background: input.compositionPlan.background,
      midground: input.compositionPlan.midground,
      foreground: input.compositionPlan.foreground,
      edgeFraming: input.compositionPlan.edgeFraming,
    },
    terrainCondition: {
      baseBiome: input.terrainPlan.baseBiome,
      groundTexture: input.terrainPlan.groundTexture,
      pathStrategy: input.terrainPlan.pathStrategy,
      waterStrategy: input.terrainPlan.waterStrategy,
      elevationStrategy: input.terrainPlan.elevationStrategy,
    },
    assetCondition: {
      constructionFocus: input.assetPlan.constructionFocus,
      natureLayers: input.assetPlan.natureLayers,
      materialLayers: input.assetPlan.materialLayers,
      blockedPlaceholderPolicy: input.assetPlan.blockedPlaceholderPolicy,
    },
    styleCondition: {
      imageMode: WORLD_VISUAL_MVP_TARGET_POLICY.imageMode,
      directions: WORLD_VISUAL_MVP_TARGET_POLICY.styleDirection,
      allowedWorldElements: WORLD_VISUAL_MVP_TARGET_POLICY.allowedWorldElements,
    },
    motionCondition: {
      enabled: false,
      reason: input.motionPlan.reason,
    },
    safetyCondition: {
      preserveWorldFacts: true,
      forbidProgrammaticFinalFrame: true,
      forbidPlaceholderFrame: true,
      forbidUnlicensedCopy: true,
      requireVisualJudge: true,
    },
    fixConditions: (input.latestFixPlan?.actions ?? []).map((action) => ({
      sourceCheckId: action.sourceCheckId,
      priority: action.priority,
      instruction: action.instruction,
      expectedResult: action.expectedResult,
      changesWorldFacts: false,
    })),
    ruleDataIds: input.ruleDataset.rules.map((rule) => rule.id),
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "world_generation_condition",
      "structured_model_input",
      "world_facts_bound",
      "scene_condition_bound",
      "spatial_condition_bound",
      "style_condition_bound",
      "visual_judge_required",
      "not_player_visible",
    ],
  }
}
