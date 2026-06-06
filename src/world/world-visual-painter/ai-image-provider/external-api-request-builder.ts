import type {
  WorldVisualAiImageGenerationRequest,
  WorldVisualAiImageGenerationRequestBody,
  WorldVisualAiImageProviderStatus,
  WorldVisualControlSketch,
  WorldVisualFactManifest,
  WorldVisualImageOutputSize,
  WorldVisualPromptPackage,
} from "../world-visual-painter-schema"

const OUTPUT_WIDTH = 1536
const OUTPUT_HEIGHT = 1024
const OUTPUT_FORMAT = "png" as const

export function buildWorldVisualExternalApiRequest(input: {
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
  providerStatus: WorldVisualAiImageProviderStatus
}): WorldVisualAiImageGenerationRequest | null {
  if (!input.providerStatus.canGenerateAutomatically) return null

  if (input.providerStatus.providerKind === "external_api") {
    const endpoint = process.env.AI_PET_WORLD_IMAGE_API_ENDPOINT?.trim()
    const apiKey = process.env.AI_PET_WORLD_IMAGE_API_KEY?.trim()
    if (!endpoint || !apiKey) return null

    return buildRequest({
      endpoint,
      providerKind: "external_api",
      authorization: `Bearer ${apiKey}`,
      ...input,
    })
  }

  if (input.providerStatus.providerKind === "local_model") {
    const endpoint = process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT?.trim()
    if (!endpoint) return null

    return buildRequest({
      endpoint,
      providerKind: "local_model",
      authorization: "",
      ...input,
    })
  }

  return null
}

function buildRequest(input: {
  endpoint: string
  authorization: string
  providerKind: "external_api" | "local_model"
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
}): WorldVisualAiImageGenerationRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }
  if (input.authorization) {
    headers.authorization = input.authorization
  }

  const outputSize: WorldVisualImageOutputSize = {
    width: OUTPUT_WIDTH,
    height: OUTPUT_HEIGHT,
    imageFormat: OUTPUT_FORMAT,
  }

  const controlSketch = buildCompositionControlSketch({
    factManifest: input.factManifest,
    promptPackage: input.promptPackage,
    outputSize,
  })

  const body: WorldVisualAiImageGenerationRequestBody = {
    positivePrompt: input.promptPackage.positivePrompt.en,
    negativePrompt: input.promptPackage.negativePrompt.en,
    width: outputSize.width,
    height: outputSize.height,
    imageFormat: outputSize.imageFormat,
    promptPackage: {
      packageId: input.promptPackage.packageId,
      modelRole: input.promptPackage.modelRole,
      positivePromptZh: input.promptPackage.positivePrompt.zh,
      positivePromptEn: input.promptPackage.positivePrompt.en,
      negativePromptZh: input.promptPackage.negativePrompt.zh,
      negativePromptEn: input.promptPackage.negativePrompt.en,
      compositionGuide: input.promptPackage.compositionGuide,
      terrainGuide: input.promptPackage.terrainGuide,
      assetGuide: input.promptPackage.assetGuide,
      motionGuide: input.promptPackage.motionGuide,
      sourceFactIds: input.promptPackage.sourceFactIds,
      ruleDataIds: input.promptPackage.ruleDataIds,
      canShowToPlayer: false,
    },
    controlSketch,
    outputSize,
    imageStyle: {
      styleTarget:
        "bright healing detailed top-down pixel-art static world bitmap",
      camera: "top_down_world_view",
      frameType: "static_world_frame",
      qualityTarget: "mvp_approved_candidate",
      canShowToPlayer: false,
    },
    safety: {
      noProgrammaticRenderer: true,
      noSvgAsFinalFrame: true,
      noCanvasAsFinalFrame: true,
      noPrimitiveMapAsFinalFrame: true,
      noPlaceholderFrame: true,
      noUnlicensedThirdPartyCopy: true,
      noAddedWorldFacts: true,
      mustPassVisualJudge: true,
    },
    metadata: {
      worldId: input.factManifest.worldId,
      tick: input.factManifest.tick,
      promptPackageId: input.promptPackage.packageId,
      sourceFactIds: input.factManifest.sourceFactIds,
      ruleDataIds: input.promptPackage.ruleDataIds,
      controlSketchId: controlSketch.controlSketchId,
      canShowToPlayer: false,
      cannotApprove: true,
    },
  }

  return {
    requestId: `ai-image-request-${input.factManifest.worldId}-${input.factManifest.tick}`,
    providerKind: input.providerKind,
    endpoint: input.endpoint,
    method: "POST",
    headers,
    body,
    canShowToPlayer: false,
    tags: [
      "ai_image_generation_request",
      input.providerKind,
      "prompt_package_bound",
      "control_sketch_bound",
      "control_sketch_not_player_visible",
      "not_player_visible",
      "approved_frame_required",
    ],
  }
}

function buildCompositionControlSketch(input: {
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
  outputSize: WorldVisualImageOutputSize
}): WorldVisualControlSketch {
  return {
    controlSketchId: `control-sketch-${input.factManifest.worldId}-${input.factManifest.tick}`,
    type: "composition_control_only",
    canShowToPlayer: false,
    cannotApprove: true,
    reason: {
      zh: "控制草图只用于约束 AI 图像生成模型的构图关系，不能作为正式世界画面展示或进入 ApprovedFrame。",
      en: "The control sketch is only used to constrain AI image model composition. It must not be displayed as the formal world frame or enter ApprovedFrame.",
    },
    outputSize: input.outputSize,
    semanticLayout: {
      focalArea: input.promptPackage.compositionGuide,
      terrainAnchor: input.promptPackage.terrainGuide,
      assetAnchor: input.promptPackage.assetGuide,
      motionNote: input.promptPackage.motionGuide,
    },
    compositionHints: [
      "clear_world_focal_point",
      "terrain_layer_depth",
      "path_logic",
      "natural_boundary",
      "material_construction_relation",
    ],
    forbiddenUse: [
      "do_not_display_to_player",
      "do_not_approve_as_final_frame",
      "do_not_use_as_svg_renderer",
      "do_not_use_as_canvas_renderer",
      "do_not_treat_as_world_fact",
    ],
    sourceFactIds: input.promptPackage.sourceFactIds,
    tags: [
      "control_sketch",
      "composition_control_only",
      "not_player_visible",
      "cannot_approve",
      "ai_image_model_input_only",
    ],
  }
}