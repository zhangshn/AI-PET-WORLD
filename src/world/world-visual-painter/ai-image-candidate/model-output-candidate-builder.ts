export type WorldVisualModelImageOutput = {
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: true
}

export function isWorldVisualModelImageOutput(
  value: unknown
): value is WorldVisualModelImageOutput {
  if (!value || typeof value !== "object") return