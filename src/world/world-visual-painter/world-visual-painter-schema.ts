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
  | "self_written_rule_note"
  | "public_abstract_principle_note"
  | "blocked_unlicensed_reference"

export type WorldVisualAuthorizedDataUsage =
  | "train_image_model"
  | "extract_visual_rules"
  | "prompt_reference_only"
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
  canUseAsPromptReference: boolean
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

export type WorldVisualReviewReport = {
  status: "not_run" | "failed" | "passed_candidate"
  canShowToPlayer: false
  reason: WorldVisualBilingualText
  score: number
  imageInspectionSummary: WorldVisualImageInspectionSummary
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
    | "repair_prompt_package"
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

export type WorldVisualPromptPackage = {
  packageId: string
  modelRole: "ai_image_generation_model"
  positivePrompt: WorldVisualBilingualText
  negativePrompt: WorldVisualBilingualText
  compositionGuide: WorldVisualBilingualText
  terrainGuide: WorldVisualBilingualText
  assetGuide: WorldVisualBilingualText
  motionGuide: WorldVisualBilingualText
  ruleDataIds: string[]
  sourceFactIds: string[]
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualAiImageProviderKind =
  | "not_configured"
  | "manual_import"
  | "external_api"
  | "local_model"

export type WorldVisualAiImageProviderStatus = {
  providerKind: WorldVisualAiImageProviderKind
  configured: boolean
  canGenerateAutomatically: boolean
  canUseManualImport: boolean
  reason: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualImageOutputSize = {
  width: number
  height: number
  imageFormat: "png" | "webp" | "jpg"
}

export type WorldVisualControlSketch = {
  controlSketchId: string
  type: "composition_control_only"
  canShowToPlayer: false
  cannotApprove: true
  reason: WorldVisualBilingualText
  outputSize: WorldVisualImageOutputSize
  semanticLayout: {
    focalArea: WorldVisualBilingualText
    terrainAnchor: WorldVisualBilingualText
    assetAnchor: WorldVisualBilingualText
    motionNote: WorldVisualBilingualText
  }
  compositionHints: string[]
  forbiddenUse: string[]
  sourceFactIds: string[]
  tags: string[]
}

export type WorldVisualImageStyle = {
  styleTarget: string
  camera: "top_down_world_view"
  frameType: "static_world_frame"
  qualityTarget: "mvp_approved_candidate"
  canShowToPlayer: false
}

export type WorldVisualImageGenerationSafety = {
  noProgrammaticRenderer: true
  noSvgAsFinalFrame: true
  noCanvasAsFinalFrame: true
  noPrimitiveMapAsFinalFrame: true
  noPlaceholderFrame: true
  noUnlicensedThirdPartyCopy: true
  noAddedWorldFacts: true
  mustPassVisualJudge: true
}

export type WorldVisualImageGenerationResponseContract = {
  requiredFields: Array<
    | "imageUrl"
    | "imageFormat"
    | "width"
    | "height"
    | "license"
    | "originalityConfirmed"
  >
  allowedImageFormats: Array<"png" | "webp" | "jpg">
  allowedLicenses: Array<"self_owned" | "cc0" | "commercial_license">
  minimumWidth: number
  minimumHeight: number
  canShowToPlayer: false
  mustPersistAsAiImageCandidate: true
  mustPassVisualJudge: true
  tags: string[]
}

export type WorldVisualImageGenerationFixHint = {
  sourceCheckId: string
  actionType: WorldVisualFixAction["actionType"]
  priority: WorldVisualFixAction["priority"]
  instructionZh: string
  instructionEn: string
  expectedResultZh: string
  expectedResultEn: string
  changesWorldFacts: false
  tags: string[]
}

export type WorldVisualImageGenerationModelTask = {
  taskKind: "generate_hidden_world_bitmap_candidate"
  modelRole: "ai_image_generation_model"
  outputPurpose: "hidden_ai_image_candidate"
  worldFrameKind: "static_top_down_pixel_world_frame"
  mustReturnResponseContract: true
  mustNotDisplayDirectly: true
  mustNotRewriteWorldFacts: true
  mustNotUseProgrammaticRenderer: true
  mustNotCopyUnlicensedThirdPartyWorks: true
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualAiImageGenerationRequestBody = {
  modelTask: WorldVisualImageGenerationModelTask
  positivePrompt: string
  negativePrompt: string
  width: number
  height: number
  imageFormat: "png" | "webp" | "jpg"
  promptPackage: {
    packageId: string
    modelRole: "ai_image_generation_model"
    positivePromptZh: string
    positivePromptEn: string
    negativePromptZh: string
    negativePromptEn: string
    compositionGuide: WorldVisualBilingualText
    terrainGuide: WorldVisualBilingualText
    assetGuide: WorldVisualBilingualText
    motionGuide: WorldVisualBilingualText
    sourceFactIds: string[]
    ruleDataIds: string[]
    canShowToPlayer: false
  }
  controlSketch: WorldVisualControlSketch
  outputSize: WorldVisualImageOutputSize
  imageStyle: WorldVisualImageStyle
  safety: WorldVisualImageGenerationSafety
  responseContract: WorldVisualImageGenerationResponseContract
  visualFixHints: WorldVisualImageGenerationFixHint[]
  metadata: {
    worldId: string
    tick: number
    promptPackageId: string
    sourceFactIds: string[]
    ruleDataIds: string[]
    controlSketchId: string
    visualFixPlanId: string | null
    visualFixHintCount: number
    canShowToPlayer: false
    cannotApprove: true
  }
}

export type WorldVisualAiImageGenerationRequest = {
  requestId: string
  providerKind: Exclude<
    WorldVisualAiImageProviderKind,
    "not_configured" | "manual_import"
  >
  endpoint: string
  method: "POST"
  headers: Record<string, string>
  body: WorldVisualAiImageGenerationRequestBody
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
  providerKind: WorldVisualAiImageProviderKind
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: boolean
  sourceDescription: WorldVisualBilingualText
  promptPackageId: string
  sourceFactIds: string[]
  canShowToPlayer: false
  generationNotes: WorldVisualBilingualText
  tags: string[]
}

export type WorldVisualApprovedFrame = {
  frameId: string
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
  promptPackage: WorldVisualPromptPackage | null
  aiImageProviderStatus: WorldVisualAiImageProviderStatus
  aiImageGenerationRequest: WorldVisualAiImageGenerationRequest | null
  aiImageCandidate: WorldVisualAiImageCandidate | null
  approvedFrame: WorldVisualApprovedFrame | null
  requiredChain: WorldVisualPainterStage[]
  tags: string[]
}

export type BuildWorldVisualPainterDecisionInput = {
  saveRecord: WorldRuntimeSaveRecord
}