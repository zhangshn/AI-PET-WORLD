import { randomUUID } from "node:crypto"

const MAX_SAMPLE_ID_LENGTH = 64

export function createDatasetSampleId(input: {
  fileName: string
  layer: string
  domain: string
}) {
  const baseName = input.fileName.replace(/\.[^.]+$/u, "")
  const prefix = [input.layer, input.domain, baseName]
    .map(normalizeSegment)
    .filter(Boolean)
    .join("-") || "training-sample"
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8)
  const availableLength = MAX_SAMPLE_ID_LENGTH - suffix.length - 1
  return `${prefix.slice(0, availableLength).replace(/-+$/u, "")}-${suffix}`
}

function normalizeSegment(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
}
