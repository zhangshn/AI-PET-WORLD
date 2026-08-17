import fs from "node:fs"

const source = process.argv[2]
if (!source) throw new Error("review path is required")
const review = JSON.parse(fs.readFileSync(source, "utf8"))
console.log(JSON.stringify({
  status: review.status,
  previewCount: review.previewCount,
  previewPassCount: review.previewPassCount,
  previewFailCount: review.previewFailCount,
  reviews: review.reviews.map((item) => ({
    epoch: item.epoch,
    passed: item.passed,
    issueCodes: item.issueCodes,
    objectSemantics: Object.fromEntries(
      (item.conditionAlignment?.objectSemanticAudits ?? [])
        .filter((audit) => audit.channelId.startsWith("object_"))
        .map((audit) => [audit.channelId, {
          passed: audit.passed,
          maskedRgbMae: audit.referenceResponse?.maskedRgbMae ?? null,
          maskedEdgeMae: audit.referenceResponse?.maskedEdgeMae ?? null,
          maskedLumaCorrelation: audit.referenceResponse?.maskedLumaCorrelation ?? null,
        }]),
    ),
  })),
}, null, 2))
