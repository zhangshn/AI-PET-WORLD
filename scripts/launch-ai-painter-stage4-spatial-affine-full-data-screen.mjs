import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"


const ROOT = process.cwd()
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const WORKER = inside("ml/ai-painter/scripts/execute_stage4_spatial_affine_full_data_screen.py")
const LAUNCH_PARENT = inside(".runtime/ai-painter/stage4-spatial-affine-full-data-screen-launches")
const args = parseArgs(process.argv.slice(2))
const runId = args.get("run-id") ?? createRunId()
assert.match(runId, /^spatial-affine-screen-[A-Za-z0-9._-]{8,96}$/u, "invalid screen runId")
assert.equal(fs.existsSync(PYTHON), true, "project Python is missing")
assert.equal(fs.existsSync(WORKER), true, "screen worker is missing")

for (const relative of [
  `.runtime/ai-painter/stage4-spatial-affine-full-data-screen-launches/${runId}`,
  `.runtime/ai-painter/stage4-spatial-affine-full-data-screen-executions/${runId}`,
  `.runtime/ai-painter/stage4-spatial-affine-full-data-screen-preflights/${runId}`,
  `.runtime/ai-painter/stage4-spatial-affine-full-data-screens/${runId}`,
]) {
  assert.equal(fs.existsSync(inside(relative)), false, `run output already exists: ${relative}`)
}

fs.mkdirSync(LAUNCH_PARENT, { recursive: true })
const launchRoot = path.join(LAUNCH_PARENT, runId)
fs.mkdirSync(launchRoot, { recursive: false })
const commandLine = [PYTHON, WORKER, "--run-id", runId].map(quoteWindowsArgument).join(" ")
const powershell = [
  `$commandLine = '${escapePowerShell(commandLine)}'`,
  `$workingDirectory = '${escapePowerShell(ROOT)}'`,
  "$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly",
  "$startup.ShowWindow = 0",
  "$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; CurrentDirectory = $workingDirectory; ProcessStartupInformation = $startup }",
  "if ($result.ReturnValue -ne 0) { throw ('Win32_Process.Create failed with code ' + $result.ReturnValue) }",
  "$result.ProcessId",
].join("\n")
const encoded = Buffer.from(powershell, "utf16le").toString("base64")
const output = execFileSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
  { cwd: ROOT, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
).trim()
const processId = Number(output.split(/\r?\n/u).at(-1))
assert.ok(Number.isInteger(processId) && processId > 0, "WMI returned an invalid worker pid")

const receipt = {
  schemaVersion: "stage4-spatial-affine-full-data-screen-background-launch-receipt-v1",
  status: "background_worker_started",
  runId,
  processId,
  launchMethod: "windows_wmi_win32_process_create",
  detachedFromCodex: true,
  ownerAuthorizationRequired: false,
  workerPath: projectPath(WORKER),
  workerSha256: sha256File(WORKER),
  executionStatePath: `.runtime/ai-painter/stage4-spatial-affine-full-data-screen-executions/${runId}/execution-state.json`,
  progressPath: `.runtime/ai-painter/stage4-spatial-affine-full-data-screen-executions/${runId}/progress.json`,
  heartbeatPath: `.runtime/ai-painter/stage4-spatial-affine-full-data-screen-executions/${runId}/heartbeat.json`,
  recordedAtUtc: new Date().toISOString(),
}
fs.writeFileSync(path.join(launchRoot, "launch-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" })
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`)

function createRunId() {
  const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/gu, "").slice(0, 17)
  return `spatial-affine-screen-${stamp}-${crypto.randomBytes(4).toString("hex")}`
}
function parseArgs(values) {
  const parsed = new Map()
  for (let index = 0; index < values.length; index += 2) {
    assert.ok(values[index]?.startsWith("--"), "invalid launcher argument")
    assert.ok(values[index + 1] && !values[index + 1].startsWith("--"), `missing value for ${values[index]}`)
    parsed.set(values[index].slice(2), values[index + 1])
  }
  return parsed
}
function inside(relative) {
  const resolved = path.resolve(ROOT, relative)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return resolved
}
function projectPath(absolute) { return path.relative(ROOT, absolute).replaceAll("\\", "/") }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function escapePowerShell(value) { return String(value).replaceAll("'", "''") }
function quoteWindowsArgument(value) {
  const text = String(value)
  if (!/[\s"]/u.test(text)) return text
  return `"${text.replace(/(\\*)"/gu, "$1$1\\\"").replace(/(\\*)$/u, "$1$1")}"`
}
