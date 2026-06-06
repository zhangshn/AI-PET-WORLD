import type {
  WorldVisualAiImageCandidate,
  WorldVisualFactManifest,
  WorldVisualPromptPackage,
} from "../world-visual-painter-schema"

type CandidateOutput = {
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: true
}

export function buildWorldVisualCandidateFromModelOutput(input: {
  output: unknown
  fact