import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { buildControlledSmokeContract } from "./lib/ai-painter-stage4-authoritative-semantic-carrier-smoke-v1.mjs"
import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const args = process.argv.slice(2)
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const capabilityVersion = option("--capability-version")
assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/)
const candidateRoot = inside(`.runtime/ai-painter/stage4-bounded-candidate-plans/${capabilityVersion}`)
const lifecycle = read(inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}/state.json`))
assert.equal(lifecycle.state, "readonly_gpu_qualified")
const bindings = [
  ["candidate", "phase-terminal.json"],
  ["cpu", "cpu-contract-terminal.json"],
  ["gpu", "readonly-gpu-terminal.json"],
  ["config", "authoritative-semantic-carrier-inactive-config.json"],
].map(([role, name]) => ({ role, ...bind(path.join(candidateRoot, name)) }))
const output = path.join(candidateRoot, "controlled-smoke-compilation")
assert.equal(fs.existsSync(output), false, "controlled Smoke compilation already exists")
const check = spawnSync(process.execPath, [inside("scripts/check-ai-painter-stage4-authoritative-semantic-carrier-smoke-contract.mjs")], { cwd: root, encoding: "utf8" })
assert.equal(check.status, 0, check.stderr || check.stdout)
fs.mkdirSync(output, { recursive: false })
const cpuReport = path.join(output, "cpu-report.json")
const contractPath = path.join(output, "controlled-smoke-contract.json")
writeJsonAtomic(cpuReport, JSON.parse(check.stdout))
writeJsonAtomic(contractPath, buildControlledSmokeContract({ capabilityVersion, evidence: bindings }))
const now = new Date().toISOString()
const nextAction = path.join(output, "local-next-action.json")
const terminal = path.join(output, "phase-terminal.json")
writeJsonAtomic(nextAction, { schemaVersion: "stage4-local-autonomous-next-action-v1", status: "materialized_not_started", action: "local_ai_integrate_and_execute_authoritative_semantic_carrier_controlled_smoke", capabilityVersion, ownerAuthorizationRequired: false, ownerResponseRequired: false, recordedAtUtc: now })
writeJsonAtomic(terminal, { schemaVersion: "stage4-authoritative-semantic-carrier-smoke-compilation-terminal-v1", executionState: "completed", status: "authoritative_semantic_carrier_controlled_smoke_contract_compiled", capabilityVersion, contract: bind(contractPath), cpuReport: bind(cpuReport), nextAction: bind(nextAction), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, gpuAuthorizationCreated: false, trainingStarted: false, recordedAtUtc: now })
for (const file of [cpuReport, contractPath, nextAction, terminal]) indexFile(file)
appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-smoke-contract-${capabilityVersion}`, timestamp: now, action: "stage4_authoritative_semantic_carrier_smoke_contract_compilation", runId: capabilityVersion, kind: "cpu_contract_compilation", status: "success", title: "Stage4 controlled Smoke contract compiled", titleZh: "Stage4权威语义载体受控Smoke闭环合同已编译", detailZh: "本地程序已冻结30 Epoch训练、自动审核、后期稳定资格与失败关闭边界；无需Owner逐步授权，训练尚未启动。", evidencePath: relative(terminal), evidenceSha256: sha(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
process.stdout.write(`${JSON.stringify({ status: read(terminal).status, contract: bind(contractPath), cpuReport: bind(cpuReport), terminal: bind(terminal), nextAction: bind(nextAction), ownerAuthorizationRequired: false, trainingStarted: false }, null, 2)}\n`)

function inside(rel) { assert.ok(typeof rel === "string" && rel && !path.isAbsolute(rel) && !rel.split(/[\\/]/).includes("..")); const target = path.resolve(root, rel); assert.ok(target.startsWith(`${root}${path.sep}`)); return target }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function relative(file) { return path.relative(root, file).replaceAll("\\", "/") }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: relative(file), sha256: sha(file) } }
function indexFile(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: capabilityVersion, artifactType: "stage4_authoritative_semantic_carrier_smoke_contract_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
