import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const AUDITOR = path.join(ROOT, "ml", "ai-painter", "scripts", "audit_ai_assisted_autoencoder_versions.py")
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-autoencoder-version-comparisons")
const baseline = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted/latest.json")
const candidate = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const timestamp = new Date().toISOString()
const comparisonId = `ai-assisted-autoencoder-v1-v2-${timestamp.replace(/[:.]/g, "-")}`
const outputDir = path.join(OUTPUT_ROOT, comparisonId)

if (!baseline?.manifestPath || !candidate?.manifestPath) throw new Error("native-stage v1/v2 manifests are required")
const child = spawnSync(PYTHON, [
  AUDITOR,
  "--baseline-manifest", path.resolve(ROOT, baseline.manifestPath),
  "--candidate-manifest", path.resolve(ROOT, candidate.manifestPath),
  "--output-dir", outputDir,
], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1" },
})
if (child.status !== 0) {
  fs.mkdirSync(path.join(OUTPUT_ROOT, "failures"), { recursive: true })
  const failure = {
    schemaVersion: "ai-assisted-autoencoder-version-comparison-failure-v1",
    status: "failed",
    comparisonId,
    createdAtUtc: timestamp,
    exitCode: child.status,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    automaticStorage: true,
  }
  fs.writeFileSync(path.join(OUTPUT_ROOT, "failures", `${comparisonId}.json`), `${JSON.stringify(failure, null, 2)}\n`)
  console.error(JSON.stringify(failure, null, 2))
  process.exit(child.status ?? 1)
}
const reportPath = path.join(outputDir, "comparison.json")
const report = readJson(reportPath)
const reportSha256 = crypto.createHash("sha256").update(fs.readFileSync(reportPath)).digest("hex")
fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
fs.writeFileSync(path.join(OUTPUT_ROOT, "latest.json"), `${JSON.stringify({
  ...report,
  reportPath: projectPath(reportPath),
  reportSha256,
}, null, 2)}\n`)
console.log(JSON.stringify({
  status: report.status,
  sampleCount: report.sampleCount,
  baselineAverage: report.baselineAverage,
  candidateAverage: report.candidateAverage,
  averageImprovement: report.averageImprovement,
  reportPath: projectPath(reportPath),
  reportSha256,
  visualOwnerReviewRequired: true,
}, null, 2))

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) } catch { return null } }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
