// Reproducible CPU verification of an explicitly bound inactive candidate.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { persistAudit } from "./audit-ai-painter-stage4-split-release.mjs";
import { createReader } from "./lib/ai-painter-stage4-dataset-audit.mjs";
import { validateStage4CoreQualificationSummary, stage4CoreArgsForComponent } from "./check-ai-painter-stage4-core.mjs";
import { inspectSplitSmokeComponent } from "./lib/ai-painter-stage4-split-smoke-preflight.mjs";

// Use the same versioned identity and lineage validation as the consumer.
// Importing this module never starts the CPU runner or writes evidence.
export function readSplitSmokeCpuComponent(root, binding) {
  const inspected = inspectSplitSmokeComponent({ root, componentContractBinding: binding });
  const reader = createReader(root);
  for (const receipt of inspected.inputReceipts) {
    const bytes = reader.bytes(receipt.path, receipt.sha256);
    assert.equal(bytes.length, receipt.bytes, "component_receipt_size_conflict");
  }
  reader.verifyStable();
  return { reader, contract: inspected.contract };
}

async function main() {
const { values } = parseArgs({ options: { contract: { type: "string" }, sha256: { type: "string" },
  write: { type: "boolean", default: false } } });
assert.ok(values.contract && /^[a-f0-9]{64}$/.test(values.sha256 ?? ""), "explicit --contract and --sha256 required");
const root = process.cwd();
const binding = { path: values.contract, sha256: values.sha256 };
const { reader, contract } = readSplitSmokeCpuComponent(root, binding);
for (const logical of ["scripts/check-ai-painter-stage4-split-smoke-component.mjs", "scripts/check-ai-painter-stage4-core.mjs",
  "ml/ai-painter/tests/test_stage4_split_smoke.py", "scripts/audit-ai-painter-stage4-split-release.mjs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
  "scripts/lib/ai-painter-stage4-historical-geometry.mjs",
  "scripts/lib/ai-painter-stage4-historical-exposure.mjs",
  "scripts/tests/test-ai-painter-stage4-dataset-audit.mjs",
  "scripts/tests/test-ai-painter-stage4-historical-exposure.mjs",
  "scripts/lib/ai-painter-stage4-lifecycle-projection.mjs",
  "scripts/reconcile-ai-painter-stage4-v2-capability-lifecycle.mjs",
  "scripts/tests/test-ai-painter-stage4-lifecycle-state-semantics.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-capability-lifecycle-reconciliation.mjs",
  "scripts/lib/ai-painter-stage4-split-data-adjudication.mjs",
  "scripts/tests/test-ai-painter-stage4-split-data-adjudication.mjs",
  "scripts/lib/ai-painter-stage4-split-smoke-preflight.mjs",
  "scripts/tests/test-ai-painter-stage4-split-smoke-preflight.mjs",
  "ml/ai-painter/src/ai_painter/complete_world/split_formal_training.py",
  "ml/ai-painter/tests/test_stage4_split_formal_training.py",
  "scripts/run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-formal-stage0-to-stage2-executor.mjs"]) reader.bytes(logical);
for (const logical of ["scripts/check-ai-painter-split-successor-cpu-contract.mjs",
  "scripts/tests/test-ai-painter-historical-registry-receipt.mjs", "scripts/tests/test-ai-painter-current-entrypoint-command.mjs",
  "scripts/lib/ai-painter-current-entrypoint-command.mjs", "scripts/check-ai-painter-current-entrypoints.mjs",
  "scripts/tests/test-ai-console-current-projection-availability.mjs", "scripts/tests/helpers/current-execution-projection-cpu.mjs",
  "scripts/tests/helpers/stage4-frozen-condition-compiler.mjs",
  "scripts/check-ai-console-current-execution-projection.mjs"]) reader.bytes(logical);
const registryPath = ".runtime/ai-painter/current-execution-registry/current.json";
const registry = reader.json(registryPath);
assert.equal(registry.activeExecution, null, "CPU verification must not overlap a current training execution");
const python = path.join(root, "ml/ai-painter/.venv/Scripts/python.exe");
assert.ok(fs.existsSync(python), "project Python environment missing");

function run(command, args, timeoutMs, relayCoreProgress = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const startedAtUtc = new Date().toISOString();
    let stdout = "", stderr = "", bytes = 0, interrupted = null;
    let progressLine = "";
    const stop = (reason) => { interrupted = reason; child.kill(); };
    const timer = setTimeout(() => stop("CPU check timed out"), timeoutMs);
    for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
      stream.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 64 * 1024 * 1024) { stop("CPU check output exceeds bound"); return; }
        if (name === "stdout") stdout += chunk.toString(); else {
          stderr += chunk.toString();
          if (relayCoreProgress) {
            const lines = (progressLine + chunk.toString()).split("\n");
            progressLine = lines.pop().slice(-4096);
            for (const line of lines) if (line.startsWith("[stage4-core] ")) process.stderr.write(line + "\n");
          }
        }
      });
    }
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ command, args, startedAtUtc, finishedAtUtc: new Date().toISOString(), exitCode, signal,
        interrupted, stdout, stderr });
    });
  });
}

const selectionCode = `import json,sys
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/"ml/ai-painter/scripts"))
from stage4_split_isolated_smoke import verify_inactive_contract,selected_indices
from ai_painter.complete_world.split_release import SplitReleaseDataset
from ai_painter.complete_world.split_training import state_hash
root=Path.cwd()
contract=verify_inactive_contract(root,json.loads(sys.argv[1]))
import torch
torch.set_num_threads(1)
samples=[]
for split in ("train","validation"):
    dataset=SplitReleaseDataset(root,contract["datasetManifest"],split,(256,192))
    ids=contract["selections"][split]["sampleIds"]
    for index in selected_indices(dataset,ids,split):
        sample=dataset[index]
        assert sample["sampleId"] in ids and sample["split"]==split
        for key,shape in (("image",(3,192,256)),("conditions",(23,192,256))):
            tensor=sample[key]
            assert tensor.device.type=="cpu" and tuple(tensor.shape)==shape
            assert torch.isfinite(tensor).all() and tensor.min()>=0 and tensor.max()<=1
        samples.append({"sampleId":sample["sampleId"],"split":split,
                        "imageTensorSha256":state_hash(sample["image"]),
                        "conditionsTensorSha256":state_hash(sample["conditions"]),
                        "datasetSelectionSha256":dataset.selection_sha256})
print(json.dumps({"status":"real_selected_tensors_verified_cpu_only","samples":samples,
                  "optimizerCreated":False,"modelCreated":False,"gpuStarted":False}))`;
process.stderr.write(`${new Date().toISOString()} verify_real_selected_tensors_without_model_or_optimizer\n`);
const selection = await run(python, ["-B", "-c", selectionCode, JSON.stringify(binding)], 60_000);
assert.equal(selection.exitCode, 0, selection.stderr);
const selectedTensors = JSON.parse(selection.stdout);
process.stderr.write(`${new Date().toISOString()} run_full_stage4_cpu_regressions\n`);
const core = await run(process.execPath, stage4CoreArgsForComponent(binding, Boolean(contract.compilerLineage)), 900_000, true);
const summaryOffset = core.stdout.lastIndexOf('\n{\n  "status":');
const summary = summaryOffset < 0 ? null : JSON.parse(core.stdout.slice(summaryOffset + 1));
reader.verifyStable();
let coreSummaryValidationError = null;
try { validateStage4CoreQualificationSummary(summary); }
catch (error) { coreSummaryValidationError = error.message.split("\n")[0]; }
const passed = core.exitCode === 0 && core.signal === null && core.interrupted === null
  && coreSummaryValidationError === null;
const report = { schemaVersion: "ai-painter-stage4-split-smoke-component-cpu-verification-v1",
  status: passed ? "cpu_component_verified_runtime_inactive" : "cpu_regression_failed",
  recordedAtUtc: new Date().toISOString(), contract: binding, selectedTensors, selectionExecution: selection,
  coreExecution: core, coreSummary: summary, coreSummaryValidationError, registryRevision: registry.registryRevision,
  inputReceipts: reader.receipts(), syntheticCpuOptimizerExecutedByTests: true,
  realDatasetOptimizerExecuted: false, gpuStarted: false, trainingStarted: false,
  runtimeAdapterRegistered: false, currentRegistryModified: false,
  qualification: contract.qualification };
const evidence = values.write ? persistAudit(root, report) : null;
console.log(JSON.stringify({ status: report.status, evidence, checks: summary?.checks.length,
  failures: summary?.failures, coreSummaryValidationError,
  samples: selectedTensors.samples, inputReceipts: report.inputReceipts.length,
  trainingAllowed: false, runtimeAdapterRegistered: false }, null, 2));
if (!passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
