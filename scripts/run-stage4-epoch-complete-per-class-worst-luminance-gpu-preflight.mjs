import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const authorizationInput = process.argv[2]
const expectedSha256 = process.argv[3]
assert.ok(authorizationInput && /^[0-9a-f]{64}$/.test(expectedSha256 ?? ""), "authorization_path_and_sha_required")
const authorizationPath = path.resolve(root, authorizationInput)
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
assert.equal(hash(authorizationPath), expectedSha256, "authorization_sha256_mismatch")
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const output = path.resolve(root, authorization.outputNamespace)
const preflightPath = path.resolve(root, authorization.preflightReportPath)
assert.equal(fs.existsSync(output), false, "formal_output_already_exists")
assert.equal(fs.existsSync(path.join(path.dirname(authorizationPath), "gpu-consumption.json")), false, "authorization_already_consumed")
assert.equal(fs.existsSync(preflightPath), false, "preflight_report_already_exists")
const python = path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const runner = path.join(root, "ml", "ai-painter", "scripts", "run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification.py")
const result = spawnSync(python, [
  runner,
  "--authorization", authorizationInput,
  "--output-dir", authorization.outputNamespace,
  "--preflight-only",
], { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
if (result.status !== 0) {
  throw new Error(`preflight_process_failed:${result.status}:${result.stderr || result.stdout}`)
}
const report = JSON.parse(result.stdout)
assert.equal(report.status, "passed_gpu_not_started_authorization_not_consumed_checkpoint_not_read", "preflight_status_invalid")
assert.equal(report.requestId, authorization.requestId, "preflight_request_identity_mismatch")
assert.equal(report.authorization.sha256, expectedSha256, "preflight_authorization_identity_mismatch")
assert.equal(report.authorizationConsumed, false, "preflight_consumed_authorization")
assert.equal(report.checkpointRead, false, "preflight_read_checkpoint")
assert.equal(report.gpuWorkloadStarted, false, "preflight_started_gpu_workload")
fs.mkdirSync(path.dirname(preflightPath), { recursive: true })
const temporary = `${preflightPath}.${process.pid}.${Date.now()}.tmp`
const descriptor = fs.openSync(temporary, "wx")
try {
  fs.writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  fs.fsyncSync(descriptor)
} finally {
  fs.closeSync(descriptor)
}
fs.renameSync(temporary, preflightPath)
console.log(JSON.stringify({ status: report.status, preflight: { path: path.relative(root, preflightPath).replaceAll("\\", "/"), sha256: hash(preflightPath) }, cuda: report.cuda, disk: report.disk }, null, 2))
