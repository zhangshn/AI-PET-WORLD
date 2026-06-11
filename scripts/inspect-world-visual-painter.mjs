const enabled = process.env.AI_PET_WORLD_IMAGE_MODEL_ENABLED === "true"
const modelVersion = process.env.AI_PET_WORLD_IMAGE_MODEL_VERSION || null
const modelAssetDir = process.env.AI_PET_WORLD_IMAGE_MODEL_ASSET_DIR || null

console.log(
  JSON.stringify(
    {
      architecture: "internal_world_image_model",
      enabled,
      modelVersion,
      modelAssetDirConfigured: Boolean(modelAssetDir),
      canGenerate: Boolean(enabled && modelVersion && modelAssetDir),
      externalDrawingApiAllowed: false,
      formalManualImportAllowed: false,
      displayRule: "Only a current-runtime ApprovedFrame may be shown to players.",
      currentModule: "Module B: VJ-0 hard gate",
    },
    null,
    2
  )
)
