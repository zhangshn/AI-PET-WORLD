import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const views = {
  drafts: path.join("data", "ai-painter-datasets", "natural-home", "drafts", "contact-sheet.png"),
  imported: path.join("data", "ai-painter-datasets", "natural-home", "drafts", "imported-contact-sheet.png"),
  dataset: path.join(".runtime", "ai-painter", "natural-home-dataset", "contact-sheet.png"),
  cleanDataset: path.join(".runtime", "ai-painter", "natural-home-clean-dataset", "contact-sheet.png"),
  inference: path.join(".runtime", "ai-painter", "natural-home-inference", "natural-home-crop-v7-12-forest-stream-clean.png"),
  structureInference: path.join(".runtime", "ai-painter", "natural-home-structure-guided-inference", "generated.png"),
  structurePreview: path.join(".runtime", "ai-painter", "natural-home-structure-guided-inference", "structure-preview.png"),
  rgbRefinerInference: path.join(".runtime", "ai-painter", "natural-home-rgb-refiner-inference", "generated.png"),
  cleanStructureInference: path.join(".runtime", "ai-painter", "natural-home-clean-structure-guided-inference", "generated.png"),
  cleanStructurePreview: path.join(".runtime", "ai-painter", "natural-home-clean-structure-guided-inference", "structure-preview.png"),
  cleanRgbRefinerInference: path.join(".runtime", "ai-painter", "natural-home-clean-rgb-refiner-inference", "generated.png"),
  cleanRgbRefinerV2Inference: path.join(".runtime", "ai-painter", "natural-home-clean-rgb-refiner-v2-inference", "generated.png"),
  cleanRgbRefinerV3Inference: path.join(".runtime", "ai-painter", "natural-home-clean-rgb-refiner-v3-inference", "generated.png"),
  singleOverfitInference: path.join(".runtime", "ai-painter", "natural-home-single-overfit-inference", "generated.png"),
  singleDirectOverfitInference: path.join(".runtime", "ai-painter", "natural-home-single-direct-overfit-inference", "generated.png"),
  cleanDirectInference: path.join(".runtime", "ai-painter", "natural-home-clean-direct-inference", "generated.png"),
  localDetailInference: path.join(".runtime", "ai-painter", "natural-home-local-detail-inference", "contact-sheet.png"),
  localDetailV2Inference: path.join(".runtime", "ai-painter", "natural-home-local-detail-v2-inference", "contact-sheet.png"),
  localDetailV3Inference: path.join(".runtime", "ai-painter", "natural-home-local-detail-v3-inference", "contact-sheet.png"),
  localDetailV4GanInference: path.join(".runtime", "ai-painter", "natural-home-local-detail-v4-gan-inference", "contact-sheet.png"),
  localDetailV5DiscreteInference: path.join(".runtime", "ai-painter", "natural-home-local-detail-v5-discrete-inference", "contact-sheet.png"),
  localDetailV6SingleOverfitInference: path.join(".runtime", "ai-painter", "natural-home-local-detail-v6-single-overfit-inference", "contact-sheet.png"),
  localDetailV7SourceCurriculumInference: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v7-source-curriculum-inference",
    "contact-sheet.png",
  ),
  localDetailV8VisualCurriculumInference: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v8-visual-curriculum-inference",
    "contact-sheet.png",
  ),
  localDetailV9CategoryDetailUnetInference: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v9-category-detail-unet-inference",
    "contact-sheet.png",
  ),
  localDetailV10SourceLockedInference: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v10-source-locked-inference",
    "contact-sheet.png",
  ),
  localDetailV11MultisourceInference: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v11-multisource-inference",
    "contact-sheet.png",
  ),
  localDetailV12SourceConditionedInference: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v12-source-conditioned-inference",
    "contact-sheet.png",
  ),
  localDetailV13SourceExpertRoute: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v13-source-expert-route",
    "contact-sheet.png",
  ),
  localDetailV14SingleSourceCompose: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v14-single-source-compose-inference",
    "contact-sheet.png",
  ),
  localDetailV15MultisourceCompose: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v15-multisource-compose-inference",
    "contact-sheet.png",
  ),
  localDetailV16StyleMultisourceCompose: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v16-style-multisource-compose-inference",
    "contact-sheet.png",
  ),
  localDetailV17SourceExpertCompose: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v17-source-expert-compose-inference",
    "contact-sheet.png",
  ),
  localDetailV18SourceExpertBank: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v18-source-expert-bank",
    "contact-sheet.png",
  ),
  localDetailV19PromotedSource: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v19-promoted-source",
    "contact-sheet.png",
  ),
  localDetailV20MultisourceGeneralization: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v20-multisource-generalization",
    "contact-sheet.png",
  ),
  localDetailV22WarningFocus: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v22-warning-focus",
    "contact-sheet.png",
  ),
  localDetailV23CandidateConsolidation: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-local-detail-v23-candidate-consolidation",
    "contact-sheet.png",
  ),
  naturalHomeV24DiversityGeneration: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-v24-diversity-generation",
    "contact-sheet.png",
  ),
  naturalHomeV25DiversityGeneration: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-v25-diversity-generation",
    "contact-sheet.png",
  ),
  naturalHomeV26DiversityRefinerGeneration: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-v26-diversity-refiner-generation",
    "contact-sheet.png",
  ),
  naturalHomeV27DiversityRefinerGeneration: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-v27-diversity-refiner-generation",
    "contact-sheet.png",
  ),
  naturalHomeV28DiversityRefinerGeneration: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-v28-diversity-refiner-generation",
    "contact-sheet.png",
  ),
  naturalHomeV29DiverseSourceRefinerGeneration: path.join(
    ".runtime",
    "ai-painter",
    "natural-home-v29-diverse-source-refiner-generation",
    "contact-sheet.png",
  ),
} as const

export async function GET(_request: NextRequest, context: { params: Promise<{ view: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 403 })
  const { view } = await context.params
  const file = views[view as keyof typeof views]
  if (!file) return new NextResponse(null, { status: 404 })
  try {
    const image = await readFile(path.join(process.cwd(), file))
    return new NextResponse(image, { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
