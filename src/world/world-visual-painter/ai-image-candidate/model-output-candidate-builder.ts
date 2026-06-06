import type {
  WorldVisualAiImageCandidate,
  WorldVisualFactManifest,
  WorldVisualPromptPackage,
} from "../world-visual-painter-schema"

type ModelOutputRecord = Record<string, unknown>

export function buildWorldVisualCandidateFromModelOutput(input: {
  output: unknown
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
}): WorldVisualAiImageCandidate | null {
  const output = readModelOutput