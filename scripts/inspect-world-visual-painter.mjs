const provider = process.env.AI_PET_WORLD_IMAGE_PROVIDER || "not_configured"
const manualUrl = process.env.AI_PET_WORLD_MANUAL_IMAGE_URL || ""
const manualLicense = process.env.AI_PET_WORLD_MANUAL_IMAGE_LICENSE || ""
const manualConfirmed =
  process.env.AI_PET_WORLD_MANUAL_IMAGE_ORIGINALITY_CONFIRMED === "true"

console.log(
  JSON.stringify(
    {
      provider,
      manualImportConfigured: Boolean(
        manualUrl && manualLicense && manualConfirmed
      ),
      manualUrl,
      manualLicense,
      manualOriginalityConfirmed: manualConfirmed,
      displayRule: "Only ApprovedFrame can be shown to players",
      authorizedDataManifest: {
        version: "authorized-data-mvp-v1",
        acceptedTrainableCount: 0,
        acceptedRuleOnlyCount: 1,
        blockedCount: 0,
        importPolicy:
          "Only self-owned, CC0, or explicitly licensed data may be imported.",
      },
    },
    null,
    2
  )
)
