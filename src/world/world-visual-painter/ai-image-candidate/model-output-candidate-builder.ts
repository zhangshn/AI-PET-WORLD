import type { WorldVisualAiImageCandidate, WorldVisualFactManifest, WorldVisualPromptPackage } from "../world-visual-painter-schema"

type Output = Record<string, unknown>

export function buildWorldVisualCandidateFromModelOutput(input: { output: unknown; factManifest: WorldVisualFactManifest; promptPackage: WorldVisualPromptPackage }): WorldVisualAiImageCandidate | null {
  if (!is