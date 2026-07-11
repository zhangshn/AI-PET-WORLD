import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const REQUIRED_SENTENCE = "不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。"
const SPEC_PATH = "docs/ai-painter-progress/GENERATED_RESULTS_PAGE_LOCKED_SPEC.md"
const PAGE_PATH = "src/app/ai-painter-progress/generated-results/page.tsx"

const requiredSpecTokens = [
  REQUIRED_SENTENCE,
  "/ai-painter-progress/generated-results",
  "不改版本名",
  "不改数据路径",
  "不替程序归档",
  ".runtime/ai-painter/generated-results/index.json",
  ".runtime/ai-painter/",
  ".runtime/game-map-material-slot-inference-runs/world-d0znz8/0/",
]

const requiredPageTokens = [
  "readAutoSavedRuns",
  "readAutoSavedRunRoot",
  ".runtime/ai-painter",
  ".runtime/game-map-material-slot-inference-runs/world-d0znz8/0",
  "generated-results",
  "natural-home-v",
  "natural-home-local-detail-v",
  "construction-home-v",
  "game-map-material-slot-v",
  "material-slot-inference-",
]

const findings = []
const spec = readText(SPEC_PATH)
const page = readText(PAGE_PATH)

for (const token of requiredSpecTokens) {
  if (!spec.includes(token)) findings.push(`${SPEC_PATH}: missing token "${token}"`)
}

for (const token of requiredPageTokens) {
  if (!page.includes(token)) findings.push(`${PAGE_PATH}: missing token "${token}"`)
}

if (findings.length > 0) {
  console.error("AI Painter generated-results page lock check failed:")
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log("AI Painter generated-results page lock check passed.")

function readText(relativePath) {
  const filePath = path.resolve(ROOT, relativePath)
  if (!filePath.startsWith(ROOT)) {
    findings.push(`${relativePath}: path escapes project root`)
    return ""
  }
  if (!fs.existsSync(filePath)) {
    findings.push(`${relativePath}: file missing`)
    return ""
  }
  return fs.readFileSync(filePath, "utf8")
}
