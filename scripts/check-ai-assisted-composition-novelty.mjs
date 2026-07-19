import fs from "node:fs"
import path from "node:path"
import { auditAiAssistedCompositionNovelty } from "./lib/ai-assisted-composition-novelty.mjs"

const ROOT = process.cwd()
const RECORD_ID = "ai-cold-start-condition-pair-004-moist-deciduous-teak-forest-v1"
const recordPath = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1", "complete-maps", RECORD_ID, "record.json")
const record = JSON.parse(fs.readFileSync(recordPath, "utf8"))
const imagePath = path.resolve(path.dirname(recordPath), record.originalImage.path)
const audit = await auditAiAssistedCompositionNovelty({ record, imagePath })
const matchedRejectedRecordIds = audit.rejectedCompositionMatches.map((entry) => entry.recordId)
const ok = audit.passed === false
  && audit.issues.some((entry) => entry.code === "historical_rejected_composition_duplicate")
  && matchedRejectedRecordIds.includes("ai-cold-start-condition-pair-002-inland-tropical-river-valley-v1")

const result = {
  ok,
  status: ok ? "ai_assisted_composition_novelty_regression_check_passed" : "ai_assisted_composition_novelty_regression_check_failed",
  recordId: RECORD_ID,
  matchedRejectedRecordIds,
  audit,
}
console[ok ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(ok ? 0 : 1)
