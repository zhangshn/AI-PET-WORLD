import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const INFERENCE_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-bootstrap-inference")
const REVIEW_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-machine-reviews")
const SOURCE_MANIFEST = path.join(ROOT, ".runtime", "ai-painter", "local-foundation-models", "manifest.json")
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const PYTHON_SCRIPT = path.join(ROOT, "ml", "ai-painter", "scripts", "judge_complete_map_with_clip.py")

const inferencePointer = readJson(path.join(INFERENCE_ROOT, "latest.json"))
const candidate = readJson(resolvePath(inferencePointer.manifestPath))
const outputPath = path.join(REVIEW_ROOT, `clip-${candidate.runId}.json`)

assert(fs.existsSync(SOURCE_MANIFEST), "local visual model source manifest is missing")
const child = spawnSync(PYTHON, [
  PYTHON_SCRIPT,
  "--image", resolvePath(candidate.outputImagePath),
  "--source-manifest", SOURCE_MANIFEST,
  "--output", outputPath,
], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" },
})
assert(child.status === 0, `local CLIP review failed: ${child.stderr || child.stdout}`)

const report = readJson(outputPath)
assert(report.imageSha256 === candidate.outputImageSha256, "CLIP review image identity mismatch")
writeJson(path.join(REVIEW_ROOT, "latest-clip-review.json"), {
  ...report,
  runId: candidate.runId,
  reviewPath: projectPath(outputPath),
})
console.log(JSON.stringify({
  status: report.status,
  runId: candidate.runId,
  averagePositiveProbability: report.averagePositiveProbability,
  failedCriterionIds: report.failedCriterionIds,
  reviewPath: projectPath(outputPath),
}, null, 2))

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function resolvePath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes root: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function assert(condition, message) { if (!condition) throw new Error(message) }
