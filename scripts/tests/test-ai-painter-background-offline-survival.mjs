import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { materializeAutonomousClosedLoopPackage } from "../lib/ai-painter-autonomous-package-materializer-v1.mjs";
import { launchAutonomousClosedLoopBackground } from "../lib/ai-painter-autonomous-background-launcher-v1.mjs";

// Real background processes and production state machine; synthetic CPU adapters.
// This does NOT certify training, model quality, host reboot, or closing Codex itself.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const suiteRoot = path.join(project, ".runtime", "offline-survival-checks");
const registryPath = path.join(project, ".runtime/ai-painter/current-execution-registry/current.json");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const sourceFiles = [
  "scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
  "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
  "scripts/lib/ai-painter-local-autonomy-governance-v3.mjs",
  "scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs",
  "scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs",
  "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json",
  "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json",
];
const adapterSource = `
import fs from 'node:fs';
import path from 'node:path';
const pause = ms => new Promise(r => setTimeout(r, ms));
function mark(c, phase) {
  fs.appendFileSync(path.join(c.projectRoot, 'observations.jsonl'), JSON.stringify({phase, pid:process.pid, atUtc:new Date().toISOString()})+'\\n');
  c.reportProgress({ phasePercent:100, message:'CPU fixture '+phase });
}
export async function preflight(c) {
  mark(c,'preflight');
  const end=Date.now()+20000;
  while(!fs.existsSync(path.join(c.projectRoot,'starter-exited.json'))) {
    if(Date.now()>end) return {status:'failed',failureKind:'program',failureCode:'fixture_gate_timeout'};
    await pause(100);
  }
  if(JSON.parse(fs.readFileSync(path.join(c.projectRoot,'input.json'),'utf8')).reject)
    return {status:'failed',failureKind:'program',failureCode:'fixture_input_rejected'};
  return {status:'passed'};
}
export async function execute(c) { mark(c,'execute'); return {status:'passed'}; }
export async function validate(c) { mark(c,'validate'); return {status:'passed'}; }
export async function review(c) { mark(c,'review'); return {status:'passed'}; }
export async function adjudicate(c) { mark(c,'adjudicate'); return {status:'passed'}; }
export async function finalize(c) { mark(c,'finalize'); return {status:'passed'}; }
`;
const starterSource = `
import fs from 'node:fs';
import {launchAutonomousClosedLoopBackground} from './scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs';
const binding=JSON.parse(fs.readFileSync('binding.json','utf8'));
const receipt=await launchAutonomousClosedLoopBackground({...binding, root:process.cwd()});
fs.writeFileSync('starter-receipt.json',JSON.stringify({starterPid:process.pid,receipt}),{flag:'wx'});
`;

async function waitUntil(predicate, milliseconds = 30000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail("background fixture deadline exceeded; evidence retained");
}

for (const reject of [false, true]) {
  test(`starter exits: ${reject ? "rejected preflight never executes" : "all six phases finish exactly once"}`, {
    skip: process.platform !== "win32", timeout: 60000,
  }, async () => {
    fs.mkdirSync(suiteRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(suiteRoot, reject ? "rejected-" : "success-"));
    const registryBefore = fs.existsSync(registryPath) ? hash(fs.readFileSync(registryPath)) : null;
    const sourceBindings = [];
    function write(relative, bytes) {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: "wx" });
    }
    for (const relative of sourceFiles) {
      const bytes = fs.readFileSync(path.join(project, relative));
      write(relative, bytes);
      sourceBindings.push({ path: relative, sha256: hash(bytes) });
    }
    write("input.json", JSON.stringify({ reject, syntheticCpuOnly: true }));
    write("adapters.mjs", adapterSource);
    write("starter.mjs", starterSource);
    const packageIdentity = `offline-survival-${crypto.randomUUID()}`;
    const phases = ["preflight", "execute", "validate", "review", "adjudicate", "finalize"];
    const binding = materializeAutonomousClosedLoopPackage({
      schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1",
      packageIdentity, capabilityVersion: "offline-survival-cpu-fixture-only",
      ownerAuthorizationRequired: false, maxInfrastructureRecoveryAttempts: 0,
      outputRoot: `.runtime/ai-painter/fixture-outputs/${packageIdentity}`,
      programFiles: { adapters: "adapters.mjs" }, inputEvidencePaths: ["input.json"],
      phaseAdapters: Object.fromEntries(phases.map(phase => [phase, { path: "adapters.mjs", exportName: phase }])),
    }, { root });
    write("binding.json", JSON.stringify(binding));
    const starter = spawn(process.execPath, ["starter.mjs"], {
      cwd: root, windowsHide: true, shell: false,
      env: { ...process.env, CUDA_VISIBLE_DEVICES: "", OMP_NUM_THREADS: "2", UV_THREADPOOL_SIZE: "2" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    starter.stdout.resume();
    starter.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-8192); });
    const exitCode = await new Promise((resolve, rejectPromise) => {
      starter.once("error", rejectPromise);
      starter.once("close", resolve);
    });
    assert.equal(exitCode, 0, stderr);
    const starterExitedAtUtc = new Date().toISOString();
    const { receipt } = JSON.parse(fs.readFileSync(path.join(root, "starter-receipt.json"), "utf8"));
    assert.notEqual(receipt.processId, starter.pid);
    const executionRoot = path.join(root, ".runtime/ai-painter/autonomous-closed-loop-executions", packageIdentity);
    const terminalPath = path.join(executionRoot, "phase-terminal.json");
    assert.equal(fs.existsSync(terminalPath), false, "fixture cannot finish before starter exit gate");
    write("starter-exited.json", JSON.stringify({ starterPid: starter.pid, starterExitedAtUtc }));
    await waitUntil(() => fs.existsSync(terminalPath));
    const terminalBytes = fs.readFileSync(terminalPath);
    const terminal = JSON.parse(terminalBytes);
    assert.equal(terminal.status, reject ? "failed_closed" : "completed");
    const observations = fs.readFileSync(path.join(root, "observations.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(observations.map(value => value.phase), reject ? ["preflight"] : phases);
    for (const observation of observations.slice(1)) {
      assert.ok(Date.parse(observation.atUtc) >= Date.parse(starterExitedAtUtc));
      assert.equal(observation.pid, receipt.processId);
    }
    const db = new DatabaseSync(path.join(executionRoot, "execution.sqlite"), { readOnly: true });
    try {
      const state = db.prepare("SELECT state, owner_response_required FROM executions WHERE package_identity = ?").get(packageIdentity);
      assert.equal(state.state, terminal.status);
      assert.equal(state.owner_response_required, 0);
    } finally { db.close(); }
    const replayReceipt = await launchAutonomousClosedLoopBackground({ root, ...binding });
    assert.deepEqual(replayReceipt, receipt, "repeated launch must return the original receipt");
    assert.equal(hash(fs.readFileSync(terminalPath)), hash(terminalBytes), "repeated launch cannot alter terminal");
    assert.deepEqual(fs.readFileSync(path.join(root, "observations.jsonl"), "utf8").trim().split("\n").map(JSON.parse), observations);
    const registryAfter = fs.existsSync(registryPath) ? hash(fs.readFileSync(registryPath)) : null;
    assert.equal(registryAfter, registryBefore, "production registry must remain untouched");
    write("acceptance.json", JSON.stringify({
      status: "passed", scope: "production_background_launcher_and_state_machine_with_synthetic_cpu_adapters",
      starterPid: starter.pid, backgroundPid: receipt.processId, starterExitedAtUtc,
      observations, terminal: { path: terminalPath, sha256: hash(terminalBytes), status: terminal.status },
      sourceBindings, registryBefore, registryAfter,
      repeatedLaunchReceiptUnchanged: true,
      noGpu: true, noModelQualification: true, codexApplicationActuallyClosed: false,
      hostRebootTested: false, recordedAtUtc: new Date().toISOString(),
    }, null, 2));
    process.stdout.write(`Evidence: ${path.join(root, "acceptance.json")}\n`);
  });
}
