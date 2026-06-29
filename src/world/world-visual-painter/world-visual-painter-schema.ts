import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import type {
  HomeZoneType,
  MapPlacementLayer,
  MapBounds,
  MapCoordinate,
  MapDiffOperation,
} from "@/world/map-state/home-map-state-schema"

export type WorldVisualPainterStatus =
  | "blocked_until_ai_painter_ready"
  | "approved"

export type WorldVisualPainterStage =
  | "world_facts"
  | "scene_intent"
  | "composition_plan"
  | "terrain_plan"
  | "asset_plan"
  | "motion_plan"
  | "ai_image_candidate"
  | "visual_review"
  | "approved_frame"

export type WorldVisualBilingualText = {
  zh: string
  en: string
}

export type WorldVisualMvpTargetPolicy = {
  title: WorldVisualBilingualText
  styleDirection: WorldVisualBilingualText[]
  imageMode: "static_world_frame"
  allowedWorldElements: WorldVisualBilingualText[]
  painterFreedom: WorldVisualBilingualText
  forbiddenMajorFactCreation: WorldVisualBilingualText
  displayGate: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualReferenceLicense =
  | "self_owned"
  | "cc0"
  | "commercial_license"
  | "public_design_principle_only"
  | "blocked_unknown_or_unlicensed"

export type WorldVisualReferenceDataSource = {
  id: string
  title: WorldVisualBilingualText
  sourceKind:
    | "self_made_reference"
    | "licensed_reference"
    | "public_design_article"
    | "public_style_principle"
    | "blocked_reference"
  license: WorldVisualReferenceLicense
  usage:
    | "training_allowed"
    | "rule_extraction_only"
    | "style_principle_only"
    | "blocked"
  canTrainOnImagePixels: boolean
  canExtractRules: boolean
  mustAvoidDirectCopy: true
  notes: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualRuleDataItem = {
  id: string
  category:
    | "composition"
    | "terrain"
    | "asset_density"
    | "lighting"
    | "color"
    | "pixel_detail"
    | "copyright_safety"
    | "display_gate"
  rule: WorldVisualBilingualText
  auditSignal: WorldVisualBilingualText
  weight: 1 | 2 | 3 | 4 | 5
  sourceDataIds: string[]
  tags: string[]
}

export type WorldVisualRuleDataset = {
  datasetId: string
  version: "mvp-static-world-v1"
  sources: WorldVisualReferenceDataSource[]
  rules: WorldVisualRuleDataItem[]
  blockedSourceCount: number
  trainableSourceCount: number
  ruleExtractionSourceCount: number
  tags: string[]
}

export type WorldVisualAuthorizedDataKind =
  | "self_created_bitmap"
  | "licensed_bitmap"
  | "cc0_bitmap"
  | "ai_assisted_manual_bitmap"
  | "self_written_rule_note"
  | "public_abstract_principle_note"
  | "blocked_unlicensed_reference"

export type WorldVisualAuthorizedDataUsage =
  | "train_image_model"
  | "extract_visual_rules"
  | "condition_reference_only"
  | "blocked"

export type WorldVisualAuthorizedDataItem = {
  id: string
  title: WorldVisualBilingualText
  dataKind: WorldVisualAuthorizedDataKind
  usage: WorldVisualAuthorizedDataUsage
  license: WorldVisualReferenceLicense
  sourcePathOrUrl: string
  licenseEvidence: WorldVisualBilingualText
  canTrainOnImagePixels: boolean
  canExtractRules: boolean
  canUseAsConditionReference: boolean
  mustAvoidDirectCopy: true
  status: "accepted" | "blocked"
  notes: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualAuthorizedDataManifest = {
  manifestId: string
  version: "authorized-data-mvp-v1"
  items: WorldVisualAuthorizedDataItem[]
  acceptedTrainableCount: number
  acceptedRuleOnlyCount: number
  blockedCount: number
  importPolicy: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualFactImportance = "primary" | "supporting" | "ambient"

export type WorldVisualFactRef = {
  sourceId: string
  sourceType:
    | "world"
    | "zone"
    | "placement"
    | "construction_plan"
    | "map_diff"
    | "recent_event"
    | "resource_state"
    | "trace_field"
  importance: WorldVisualFactImportance
  label: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualZoneFact = {
  id: string
  zoneType: HomeZoneType
  name: string
  purpose: string
  bounds: MapBounds
  importance: WorldVisualFactImportance
  tags: string[]
}

export type WorldVisualPlacementFact = {
  id: string
  assetId: string
  layer: MapPlacementLayer
  coordinate: MapCoordinate
  scale: number
  alpha: number
  label: string
  source: "scene_recipe" | "placement_engine" | "construction_plan"
  importance: WorldVisualFactImportance
  tags: string[]
}

export type WorldVisualConstructionFact = {
  id: string
  title: string
  targetZoneType: HomeZoneType
  status: "planned" | "active" | "paused" | "completed"
  progress: number
  reason: string
  importance: WorldVisualFactImportance
  tags: string[]
}

export type WorldVisualMapDiffFact = {
  id: string
  operation: MapDiffOperation
  placementId: string
  reason: string
  createdAt: number
  importance: WorldVisualFactImportance
  tags: string[]
}

export type WorldVisualResourceFact = {
  groundHealth: number
  naturalGrowth: number
  materialReadiness: number
  careReadiness: number
  spacePressure: number
  importance: WorldVisualFactImportance
  tags: string[]
}

export type WorldVisualRecentEventFact = {
  id: string
  tick: number
  title: string
  body: string
  source: "runtime" | "butler" | "construction" | "safe_apply" | "audit"
  importance: WorldVisualFactImportance
  tags: string[]
}

export type WorldVisualFactManifest = {
  worldId: string
  tick: number
  factSource: "world_runtime_save_record"
  hasRuntimeWorld: boolean
  hasButlerProfile: boolean
  hasHomeMapState: boolean
  hasTraceField: boolean
  hasConstructionState: boolean
  zoneCount: number
  placementCount: number
  constructionPlanCount: number
  recentEventCount: number
  sourceFactIds: string[]
  primaryFacts: WorldVisualFactRef[]
  supportingFacts: WorldVisualFactRef[]
  ambientFacts: WorldVisualFactRef[]
  zoneFacts: WorldVisualZoneFact[]
  placementFacts: WorldVisualPlacementFact[]
  constructionFacts: WorldVisualConstructionFact[]
  mapDiffFacts: WorldVisualMapDiffFact[]
  resourceFact: WorldVisualResourceFact
  recentEventFacts: WorldVisualRecentEventFact[]
  tags: string[]
}

export type WorldVisualFactManifestAudit = {
  ok: boolean
  warnings: WorldVisualBilingualText[]
  tags: string[]
}

export type WorldVisualSceneIntent = {
  sceneType: "forest_construction_clearing" | "world_foundation_hidden"
  title: WorldVisualBilingualText
  mainStory: WorldVisualBilingualText
  mustShow: WorldVisualBilingualText[]
  mayShow: WorldVisualBilingualText[]
  mustNotShow: WorldVisualBilingualText[]
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualCompositionPlan = {
  camera: "top_down_pixel_scene"
  focalArea: WorldVisualBilingualText
  background: WorldVisualBilingualText
  midground: WorldVisualBilingualText
  foreground: WorldVisualBilingualText
  edgeFraming: WorldVisualBilingualText
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualTerrainPlan = {
  baseBiome: "green_forest_clearing"
  groundTexture: WorldVisualBilingualText
  pathStrategy: WorldVisualBilingualText
  waterStrategy: WorldVisualBilingualText
  elevationStrategy: WorldVisualBilingualText
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualAssetPlan = {
  constructionFocus: WorldVisualBilingualText
  natureLayers: WorldVisualBilingualText[]
  materialLayers: WorldVisualBilingualText[]
  blockedPlaceholderPolicy: WorldVisualBilingualText
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualMotionPlan = {
  enabled: false
  plannedLayers: WorldVisualBilingualText[]
  reason: WorldVisualBilingualText
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualReviewCheck = {
  id: string
  passed: boolean
  score: number
  label: WorldVisualBilingualText
  evidence: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualImageInspectionSummary = {
  ok: boolean
  format: "png" | "webp" | "jpg" | null
  width: number | null
  height: number | null
  contentType: string | null
  byteLength: number
  minimumPayloadBytes: number
  payloadQualityPassed: boolean
  sha256: string | null
  error: string | null
  errorZh: string | null
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualVj1QualitySummary = {
  status: "vj_1_failed" | "vj_1_passed"
  sampleWidth: number
  sampleHeight: number
  meanLuminance: number
  luminanceStdDev: number
  quantizedColorCount: number
  dominantColorRatio: number
  edgeDensity: number
  laplacianVariance: number
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualReviewReport = {
  status: "not_run" | "vj_0_failed" | "vj_1_failed" | "vj_1_passed"
  vj0Status: "vj_0_failed" | "vj_0_passed"
  vj1Status: "vj_1_failed" | "vj_1_passed"
  vj2Status: "vj_2_not_implemented" | "vj_2_passed"
  approvalScope:
    | "not_approved"
    | "approved_for_controlled_mvp"
    | "approved_for_game_world"
  productionApprovalStatus: "not_approved_for_production"
  canShowToPlayer: false
  reason: WorldVisualBilingualText
  score: number
  imageInspectionSummary: WorldVisualImageInspectionSummary
  vj1QualitySummary: WorldVisualVj1QualitySummary
  checks: WorldVisualReviewCheck[]
  requiredChecks: WorldVisualBilingualText[]
  fixInstructions: WorldVisualBilingualText[]
  tags: string[]
}

export type WorldVisualFixAction = {
  id: string
  sourceCheckId: string
  actionType:
    | "add_visual_detail"
    | "rebalance_composition"
    | "restore_fact_source"
    | "increase_layer_depth"
    | "generate_ai_image_candidate"
    | "repair_generation_condition"
  priority: "high" | "medium" | "low"
  changesWorldFacts: false
  targetLayerId: string | null
  instruction: WorldVisualBilingualText
  expectedResult: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualFixPlan = {
  planId: string
  status: "not_needed" | "required"
  canShowToPlayer: false
  summary: WorldVisualBilingualText
  actions: WorldVisualFixAction[]
  sourceReviewScore: number
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualGenerationCondition = {
  conditionId: string
  version: "world-generation-condition-v1"
  worldId: string
  tick: number
  modelVersion: string | null
  sceneCondition: {
    sceneType: WorldVisualSceneIntent["sceneType"]
    mainStory: WorldVisualBilingualText
    mustShow: WorldVisualBilingualText[]
    mayShow: WorldVisualBilingualText[]
    mustNotShow: WorldVisualBilingualText[]
  }
  spatialCondition: {
    camera: WorldVisualCompositionPlan["camera"]
    focalArea: WorldVisualBilingualText
    background: WorldVisualBilingualText
    midground: WorldVisualBilingualText
    foreground: WorldVisualBilingualText
    edgeFraming: WorldVisualBilingualText
  }
  terrainCondition: Omit<WorldVisualTerrainPlan, "sourceFactIds" | "tags">
  assetCondition: Omit<WorldVisualAssetPlan, "sourceFactIds" | "tags">
  styleCondition: {
    imageMode: WorldVisualMvpTargetPolicy["imageMode"]
    directions: WorldVisualBilingualText[]
    allowedWorldElements: WorldVisualBilingualText[]
  }
  motionCondition: {
    enabled: false
    reason: WorldVisualBilingualText
  }
  safetyCondition: {
    preserveWorldFacts: true
    forbidProgrammaticFinalFrame: true
    forbidPlaceholderFrame: true
    forbidUnlicensedCopy: true
    requireVisualJudge: true
  }
  fixConditions: Array<{
    sourceCheckId: string
    priority: WorldVisualFixAction["priority"]
    instruction: WorldVisualBilingualText
    expectedResult: WorldVisualBilingualText
    changesWorldFacts: false
  }>
  ruleDataIds: string[]
  sourceFactIds: string[]
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualImageModelStatus = {
  status: "not_implemented" | "disabled" | "ready"
  modelVersion: string | null
  canGenerate: boolean
  reason: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualCandidateSourceKind =
  | "project_model_generated"
  | "development_test_asset"

export type WorldVisualAiImageGenerationRequest = {
  requestId: string
  modelVersion: string
  condition: WorldVisualGenerationCondition
  output: {
    width: number
    height: number
    imageFormat: "png" | "webp"
  }
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualAiImageGenerationResult = {
  ok: boolean
  candidate: WorldVisualAiImageCandidate | null
  error: WorldVisualBilingualText | null
  tags: string[]
}

export type WorldVisualAiImageCandidate = {
  candidateId: string
  sourceKind: WorldVisualCandidateSourceKind
  modelVersion: string | null
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: boolean
  sourceDescription: WorldVisualBilingualText
  conditionId: string
  sourceFactIds: string[]
  canShowToPlayer: false
  generationNotes: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualApprovedFrame = {
  frameId: string
  worldId: string
  tick: number
  approvedAt: string
  sourceImageCandidateId: string
  reviewScore: number
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  sourceImageSha256: string
  sourceImageByteLength: number
  sourceImageContentType: string | null
  sourceImagePayloadQualityPassed: boolean
  approvalScope: "approved_for_controlled_mvp" | "approved_for_game_world"
  productionApprovalStatus: "not_approved_for_production"
  approvedForProduction: false
  vj0Status: "vj_0_passed"
  vj1Status: "vj_1_passed"
  vj2Status: "vj_2_not_implemented" | "vj_2_passed"
  canShowToPlayer: true
  approvalReason: WorldVisualBilingualText
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualPainterDecision = {
  status: WorldVisualPainterStatus
  canShowToPlayer: boolean
  currentStage: WorldVisualPainterStage
  reason: WorldVisualBilingualText
  mvpTargetPolicy: WorldVisualMvpTargetPolicy
  ruleDataset: WorldVisualRuleDataset
  authorizedDataManifest: WorldVisualAuthorizedDataManifest
  factManifest: WorldVisualFactManifest
  factManifestAudit: WorldVisualFactManifestAudit
  sceneIntent: WorldVisualSceneIntent
  compositionPlan: WorldVisualCompositionPlan
  terrainPlan: WorldVisualTerrainPlan
  assetPlan: WorldVisualAssetPlan
  motionPlan: WorldVisualMotionPlan
  reviewReport: WorldVisualReviewReport
  fixPlan: WorldVisualFixPlan
  generationCondition: WorldVisualGenerationCondition
  imageModelStatus: WorldVisualImageModelStatus
  aiImageGenerationRequest: WorldVisualAiImageGenerationRequest | null
  aiImageCandidate: WorldVisualAiImageCandidate | null
  approvedFrame: WorldVisualApprovedFrame | null
  requiredChain: WorldVisualPainterStage[]
  tags: string[]
}

export type BuildWorldVisualPainterDecisionInput = {
  saveRecord: WorldRuntimeSaveRecord
}
