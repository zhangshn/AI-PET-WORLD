import type {
  WorldVisualAiImageGenerationRequest,
  WorldVisualAiImageProviderStatus,
  WorldVisualFactManifest,
  WorldVisualPromptPackage,
} from "../world-visual-painter-schema"

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

  return {
    requestId: `ai-image-request-${input.factManifest.worldId}-${input.factManifest.tick}`,
    providerKind: input.providerKind,
    endpoint: input.endpoint,
    method: "POST",
    headers,
    body: {
      positivePrompt: input.promptPackage.positivePrompt.en,
      negativePrompt: input.promptPackage.negativePrompt.en,
      width: 1536,
      height: 1024,
      imageFormat: "png",
      metadata: {
        worldId: input.factManifest.worldId,
        tick: input.factManifest.tick,
        promptPackageId: input.promptPackage.packageId,
        sourceFactIds: input.factManifest.sourceFactIds,
        ruleDataIds: input.promptPackage.ruleDataIds,
      },
    },
    canShowToPlayer: false,
    tags: [
      "ai_image_generation_request",
      input.providerKind,
      "not_player_visible",
      "approved_frame_required",
    ],
  }
}
