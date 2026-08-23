import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = process.cwd()
const authorizationInput = process.argv[2]
const expectedSha = process.argv[3]
assert.ok(authorizationInput && /^[0-9a-f]{64}$/.test(expectedSha ?? ""), "authorization_path_and_sha_required")
const authorizationPath = path.resolve(ROOT, authorizationInput)
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
assert.equal(sha(authorizationPath), expectedSha, "authorization_sha256_mismatch")
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const output = path.resolve(ROOT, authorization.outputNamespace)
const preflight = path.resolve(ROOT, authorization.preflightReportPath)
assert.equal(fs.existsSync(output), false, "formal_output_already_exists")
assert.equal(fs.existsSync(path.join(path.dirname(authorizationPath), "gpu-consumption.json")), false, "authorization_already_consumed")
assert.equal(fs.existsSync(preflight), false, "preflight_report_already_exists")
const python = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const runner = path.join(ROOT, "ml", "ai-painter", "scripts", "run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification.py")
const result = spawnSync(python, [runner, "--authorization", authorizationInput, "--output-dir", authorization.outputNamespace, "--preflight-only"], { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
assert.equal(result.status, 0, `preflight_failed:${result.stderr || result.stdout}`)
const report = JSON.parse(result.stdout)
assert.equal(report.status, "passed_gpu_not_started_authorization_not_consumed_checkpoint_not_read")
assert.equal(report.authorization.sha256, expectedSha)
fs.mkdirSync(path.dirname(preflight), { recursive: true })
const temporary = `${preflight}.${process.pid}.${Date.now()}.tmp`
const fd = fs.openSync(temporary, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.renameSync(temporary, preflight)
console.log(JSON.stringify({ status: report.status, preflight: { path: path.relative(ROOT, preflight).replaceAll("\\", "/"), sha256: sha(preflight) }, cuda: report.cuda, disk: report.disk }, null, 2))
