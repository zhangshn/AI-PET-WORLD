import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { preflightJointConditionLocalTransportFullDataScreen } from "../lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

const root = path.resolve(process.cwd())
const sourcePlanPath = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-contract-compilations/stage4-joint-full-data-screen-compilation-20260830022124154/execution-plan.json"
const runId = "20260830-029999998-joint-condition-local-transport-full-data-screen"
const packageIdentity = "joint-condition-local-transport-full-data-screen-preflight-test"
const outputRoot = `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens/${runId}`
const workRoot = `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-review-work/${runId}`
const screenWorkRoot = `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-work/${runId}`
const planPath = `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-preflight-tests/${runId}/execution-plan.json`
const absolutePlan = resolve(planPath)

try {
  fs.mkdirSync(path.dirname(absolutePlan), { recursive: true })
  const source = JSON.parse(fs.readFileSync(resolve(sourcePlanPath), "utf8"))
  const plan = replaceIdentity(source)
  fs.writeFileSync(absolutePlan, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" })
  const inputEvidence = [
    { path: planPath, sha256: sha256File(absolutePlan) },
    ...Object.values(plan.evidenceBindings),
  ]
  const progress = []
  const result = await preflightJointConditionLocalTransportFullDataScreen({
    projectRoot: root, packageIdentity, capabilityVersion: plan.capabilityVersion,
    outputRoot, inputEvidence, heartbeat: () => {}, reportProgress: (value) => progress.push(value),
  })
  if (result.status !== "passed") {
    const failedReport = resolve(`${outputRoot}/preflight-report.json`)
    process.stderr.write(`${JSON.stringify({ result, report: fs.existsSync(failedReport) ? JSON.parse(fs.readFileSync(failedReport, "utf8")) : null }, null, 2)}\n`)
  }
  assert.equal(result.status, "passed", JSON.stringify(result))
  assert.equal(fs.existsSync(resolve(`${outputRoot}/training-output`)), false)
  const report = JSON.parse(fs.readFileSync(resolve(`${outputRoot}/preflight-report.json`), "utf8"))
  assert.equal(report.status, "all_preflight_checks_passed")
  assert.deepEqual(report.checks, { cpuContract: true, activeConfigAudit: true, trainerReadonlyPreflight: true, cudaResource: true, diskCapacity: true, trainingOutputAbsent: true })
  assert.equal(progress.at(-1).message, "preflight_completed")
  process.stdout.write(`${JSON.stringify({ status: "passed", realNodeSpawn: true, realTrainerPreflight: true, realCudaResourceReadOnly: true, realDiskPreflight: true, trainingOutputCreated: false, gpuTrainingStarted: false }, null, 2)}\n`)
} finally {
  for (const relative of [outputRoot, workRoot, screenWorkRoot, path.posix.dirname(planPath)]) safeRemove(relative)
}

function replaceIdentity(source) {
  const serialized = JSON.stringify(source)
    .replaceAll(source.runId, runId)
    .replaceAll(source.packageIdentity, packageIdentity)
    .replaceAll(source.outputRoot, outputRoot)
    .replaceAll(source.reviewWorkRoot, workRoot)
  const plan = JSON.parse(serialized)
  for (const command of [...plan.commands.preflight, plan.commands.activation, plan.commands.trainer]) {
    command.program.sha256 = sha256File(resolve(command.program.path))
  }
  const sourceContract = JSON.parse(fs.readFileSync(resolve(source.evidenceBindings.compiledScreenContract.path), "utf8"))
  const contract = JSON.parse(JSON.stringify(sourceContract).replaceAll(source.runId, runId).replaceAll(source.outputRoot, outputRoot))
  const contractPath = path.posix.join(path.posix.dirname(planPath), "full-data-screen-contract.json")
  fs.writeFileSync(resolve(contractPath), `${JSON.stringify(contract, null, 2)}\n`, { flag: "wx" })
  plan.evidenceBindings.compiledScreenContract = { path: contractPath, sha256: sha256File(resolve(contractPath)) }
  const cpu = plan.commands.preflight.find((row) => row.id === "cpu-contract")
  cpu.arguments[cpu.arguments.indexOf("--plan") + 1] = planPath
  return plan
}
function resolve(relative) { const target = path.resolve(root, relative); assert.ok(target.startsWith(`${root}${path.sep}`)); return target }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function safeRemove(relative) { const target = resolve(relative); const allowed = ["stage4-joint-condition-local-transport-full-data-screens", "stage4-joint-condition-local-transport-full-data-screen-review-work", "stage4-joint-condition-local-transport-full-data-screen-work", "stage4-joint-condition-local-transport-full-data-screen-preflight-tests"].some((segment) => target.includes(`${path.sep}${segment}${path.sep}`)); assert.ok(allowed); if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: false }) }
