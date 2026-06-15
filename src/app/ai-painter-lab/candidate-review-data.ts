import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

const CANDIDATE_ROOT = path.join(process.cwd(), "data", "ai-painter-assets", "candidates")
const SAFE_ID = /^[a-z0-9_-]+$/

export type CandidateReviewDecision = "acceptable" | "unacceptable" | "redraw"

export type CandidateReviewRecord = {
  decision: CandidateReviewDecision
  reasonZh: string
  reviewedAt: string
  qualitySampleId: string | null
}

export type CandidateReviewItem = {
  assetId: string
  category: string
  technicalPassed: boolean
  review: CandidateReviewRecord | null
  drawingProfile: TreeDrawingProfile | null
  referenceComparison: TreeReferenceComparison | null
}

export type TreeDrawingProfile = {
  sourceParameters: Record<string, unknown>
  silhouette: { bounds: number[] | null; coverageRatio: number; widthHeightRatio: number; edgeDensity: number; horizontalSymmetry: number }
  trunk: { bounds: number[] | null; areaRatio: number; centroid: number[] | null }
  crown: { bounds: number[] | null; areaRatio: number; centroid: number[] | null; edgeDensity: number }
  structure: { trunkCrownConnected: boolean; anchorAligned: boolean; verticalOrderValid: boolean }
  colorAndLight: { paletteColorCount: number; luminanceRange: number; meanRgb: number[] }
}

export type TreeReferenceComparison = {
  referenceCount: number
  rejectedReferenceCount: number
  similarityScore: number
  rejectionSimilarityScore: number
  qualityMargin: number
  recommendation: "reference_match" | "reference_mismatch" | "uncertain"
  warningsZh: string[]
  nearestReferences: Array<{ assetId: string; similarityScore: number; mainDifferencesZh: string[] }>
  nearestRejectedReferences: Array<{ assetId: string; similarityScore: number }>
}

export async function readCandidateReviewItems(): Promise<CandidateReviewItem[]> {
  try {
    const entries = await readdir(CANDIDATE_ROOT, { withFileTypes: true })
    const items = await Promise.all(entries
      .filter((entry) => entry.isDirectory() && SAFE_ID.test(entry.name))
      .map(async (entry) => {
        try {
          const root = path.join(CANDIDATE_ROOT, entry.name)
          const metadata = JSON.parse(await readFile(path.join(root, "metadata.json"), "utf8")) as { category: string }
          const technical = JSON.parse(await readFile(path.join(root, "visual-review.json"), "utf8")) as {
            status: string
            vjB?: { status?: string }
          }
          let review: CandidateReviewRecord | null = null
          let drawingProfile: TreeDrawingProfile | null = null
          let referenceComparison: TreeReferenceComparison | null = null
          try {
            review = JSON.parse(await readFile(path.join(root, "vj-b2-review.json"), "utf8")) as CandidateReviewRecord
          } catch {
            review = null
          }
          try {
            drawingProfile = JSON.parse(await readFile(path.join(root, "drawing-profile.json"), "utf8")) as TreeDrawingProfile
            referenceComparison = JSON.parse(await readFile(path.join(root, "reference-comparison.json"), "utf8")) as TreeReferenceComparison
          } catch {
            drawingProfile = null
            referenceComparison = null
          }
          return {
            assetId: entry.name,
            category: metadata.category,
            technicalPassed: technical.status === "passed" && technical.vjB?.status === "passed",
            review,
            drawingProfile,
            referenceComparison,
          }
        } catch {
          return null
        }
      }))
    return items
      .filter((item): item is CandidateReviewItem => item !== null)
      .sort((left, right) => left.assetId.localeCompare(right.assetId))
  } catch {
    return []
  }
}
