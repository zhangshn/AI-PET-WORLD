import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { preflightSplitSmoke, inspectSplitSmokeComponent } from "../lib/ai-painter-stage4-split-smoke-preflight.mjs";
import { STAGE4_CORE_CHECK_IDENTITIES, stage4CoreArgsForComponent } from "../check-ai-painter-stage4-core.mjs";
import { readSplitSmokeCpuComponent } from "../check-ai-painter-stage4-split-smoke-component.mjs";
import { FROZEN_COMPILER, readFrozenCompilerFixture } from "./helpers/stage4-frozen-condition-compiler.mjs";

const PROJECT = fileURLToPath(new URL("../../", import.meta.url));
const CONTRACT = "data/ai-painter/system-governance/stage4-split-isolated-smoke-v1-d996ea91c73e7bcdf6c119fabe12d11d7e74a4d116e7e3e3de53faf350dd3dca.json";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  return v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
}
const digest = (v) => sha(Buffer.from(JSON.stringify(sorted(v))));
const PROGRAMS = [
  "scripts/lib/ai-painter-stage4-split-smoke-preflight.mjs", "scripts/lib/ai-painter-stage4-split-data-adjudication.mjs",
  "scripts/check-ai-painter-stage4-split-smoke-component.mjs", "scripts/check-ai-painter-stage4-core.mjs",
  "ml/ai-painter/tests/test_stage4_split_smoke.py", "scripts/audit-ai-painter-stage4-split-release.mjs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs", "scripts/lib/ai-painter-stage4-historical-geometry.mjs",
  "scripts/lib/ai-painter-stage4-historical-exposure.mjs", "scripts/lib/complete-map-semantic-topology-signature.mjs",
  "scripts/tests/test-ai-painter-stage4-dataset-audit.mjs", "scripts/tests/test-ai-painter-stage4-historical-exposure.mjs",
  "scripts/lib/ai-painter-stage4-lifecycle-projection.mjs", "scripts/reconcile-ai-painter-stage4-v2-capability-lifecycle.mjs",
  "scripts/tests/test-ai-painter-stage4-lifecycle-state-semantics.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-capability-lifecycle-reconciliation.mjs",
  "scripts/check-ai-painter-split-successor-cpu-contract.mjs", "scripts/lib/ai-painter-current-entrypoint-command.mjs",
  "scripts/check-ai-painter-current-entrypoints.mjs", "scripts/check-ai-console-current-execution-projection.mjs",
  "scripts/tests/helpers/current-execution-projection-cpu.mjs",
  "scripts/tests/test-ai-painter-historical-registry-receipt.mjs", "scripts/tests/test-ai-painter-current-entrypoint-command.mjs",
  "scripts/tests/test-ai-console-current-projection-availability.mjs",
];
const CORE_KEYS = ["schemaVersion", "parentCapability", "modelArchitectureId", "datasetManifest", "datasetReleaseIdentity",
  "baseConfig", "derivedCpuConfigSha256", "selections", "schedule", "boundaries", "frozenProgramBindings", "programBindings"];
function write(root, logical, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  const target = path.join(root, logical);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return { path: logical, sha256: sha(bytes) };
}
function snapshot(root, relative = "") {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const logical = [relative, entry.name].filter(Boolean).join("/");
    return entry.isDirectory() ? snapshot(root, logical) : [{ path: logical,
      sha256: sha(fs.readFileSync(path.join(root, logical))), bytes: fs.statSync(path.join(root, logical)).size }];
  }).sort((a, b) => a.path.localeCompare(b.path));
}
function noExecution(result) {
  assert.equal(result.nextMachineAction, null);
  for (const field of ["trainingAllowed", "gpuAllowed", "gpuStarted", "trainingStarted", "modelCreated", "optimizerCreated",
    "processCreated", "taskCreated", "ticketConsumed", "runtimeAdapterRegistered", "currentRegistryModified", "historicalFilesModified"])
    assert.equal(result[field], false, field);
  assert.deepEqual(result.qualification, { trainingAllowed: false, dataQualified: false });
  if (result.planCandidate) {
    assert.equal(result.planCandidate.dispatchable, false);
    assert.equal(result.planCandidate.entrypointId, null);
    assert.equal(result.planCandidate.inheritedParentQualification, false);
  }
}
function fixture(t, { v2 = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-split-preflight-test-"));
  t.after(() => {
    const target = fs.realpathSync(root), allowed = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(target).toLowerCase(), allowed.toLowerCase());
    assert.ok(path.basename(target).startsWith("stage4-split-preflight-test-"));
    fs.rmSync(target, { recursive: true });
  });
  // The immutable template defines the parent boundary, not current component
  // qualification. Preserve every frozen parent hash. Only the synthetic child
  // fixture is rebound to the present component bytes and assigned a new ID
  // below; neither production contracts nor production evidence are rewritten.
  const contract = JSON.parse(fs.readFileSync(path.join(PROJECT, CONTRACT), "utf8"));
  const bindings = [contract.parentCapability, contract.baseConfig,
    ...Object.values(contract.frozenProgramBindings)];
  for (const b of bindings) {
    // Test the historical protocol against its exact historical compiler in an
    // isolated fixture, not against moving working-tree bytes. No production
    // reader gets a fallback and every frozen digest is still enforced.
    const bytes = b.path === FROZEN_COMPILER.path
      ? readFrozenCompilerFixture(PROJECT) : fs.readFileSync(path.join(PROJECT, b.path));
    assert.equal(sha(bytes), b.sha256, `production frozen bytes changed: ${b.path}`);
    write(root, b.path, bytes);
  }
  contract.programBindings = contract.programBindings.map(b =>
    write(root, b.path, fs.readFileSync(path.join(PROJECT, b.path))));
  if (v2) {
    const graphPath = "data/ai-painter/system-governance/stage4-condition-compiler-lineage-v1-95e766c8e19ff23545612539426247948e801056c9ad82c454b06be656296206.json";
    const graphBytes = fs.readFileSync(path.join(PROJECT, graphPath)), graph = JSON.parse(graphBytes);
    contract.schemaVersion = "ai-painter-stage4-split-isolated-smoke-contract-v2";
    contract.compilerLineage = write(root, graphPath, graphBytes);
    for (const b of [...Object.values(graph.effectiveProgramBindings), ...graph.evaluatorBindings]) {
      const content = fs.readFileSync(path.join(PROJECT, b.path));
      assert.equal(sha(content), b.sha256);
      write(root, b.path, content);
    }
    for (const logical of ["scripts/lib/ai-painter-stage4-split-smoke-preflight.mjs",
      "scripts/lib/ai-painter-stage4-condition-compiler-lineage.mjs"])
      contract.programBindings.push(write(root, logical, fs.readFileSync(path.join(PROJECT, logical))));
  }
  write(root, CONTRACT, fs.readFileSync(path.join(PROJECT, CONTRACT)));
  for (const logical of PROGRAMS) write(root, logical, fs.readFileSync(path.join(PROJECT, logical)));
  const channels = Array.from({ length: 23 }, (_, i) => ({ id: `channel-${i}`,
    ...write(root, `fixture/channels/${i}.bin`, Buffer.from([i, i + 1])) }));
  const pack = write(root, "fixture/pack.json", { channels });
  const image = write(root, "fixture/image.bin", Buffer.from("fixture input bytes, not decoded RGB"));
  const counts = { train: 48, validation: 8, challenge: 4, regression: 4 };
  const rows = Object.entries(counts).flatMap(([split, count]) => Array.from({ length: count }, (_, i) => ({
    sampleId: `${split}-${i}`, split, ordinal: i, image, conditionPack: pack,
  })));
  const sourceIndex = write(root, "fixture/source-index.json", { schemaVersion: "ai-painter-stage4-v2-split-source-index-v1", sampleCount: 64, samples: rows });
  const splits = Object.fromEntries(Object.keys(counts).map((split) => [split, write(root, `fixture/splits/${split}.json`, {
    schemaVersion: "ai-painter-stage4-v2-split-membership-v1", split, sampleIds: rows.filter((r) => r.split === split).map((r) => r.sampleId),
  })]));
  const identityPayload = {
    parentRelease: write(root, "fixture/parent-release.json", { samples: rows }),
    selectionReproductionSha256: digest(rows), channelOrder: channels.map((c) => c.id),
    artifactHashes: Object.fromEntries([["source-index.json", sourceIndex.sha256],
      ...Object.entries(splits).map(([split, b]) => [`splits/${split}.json`, b.sha256])]),
  };
  const releaseIdentity = `stage4-v2-split64-${digest(identityPayload)}`;
  contract.datasetManifest = write(root, "fixture/manifest.json", {
    schemaVersion: "ai-painter-stage4-v2-independent-split-package-v1", immutable: true,
    status: "immutable_split_candidate_not_training_qualified", packageId: releaseIdentity, datasetReleaseIdentity: releaseIdentity,
    sampleCount: 64, splitCounts: counts, sourceIndex, splits, identityPayload, qualification: { trainingAllowed: false },
  });
  contract.datasetReleaseIdentity = releaseIdentity;
  for (const split of ["train", "validation"]) contract.selections[split] = {
    sampleIds: [`${split}-0`], rowsSha256: digest(rows.filter((r) => r.sampleId === `${split}-0`)), splitFile: splits[split],
  };
  const saveContract = () => {
    const coreKeys = v2 ? [...CORE_KEYS, "compilerLineage"] : CORE_KEYS;
    contract.capabilityVersion = `stage4-split-isolated-smoke-${v2 ? "v2" : "v1"}-${digest(Object.fromEntries(coreKeys.map((k) => [k, contract[k]])))}`;
    return write(root, "fixture/component.json", contract);
  };
  const componentContractBinding = saveContract();
  write(root, ".runtime/ai-painter/current-execution-registry/current.json", { registryRevision: 7, activeExecution: null });
  const dataEvidenceBindings = Object.fromEntries(["baseline", "geometry", "exposure"].map((name) => [`${name}Binding`,
    write(root, `fixture/${name}.json`, { schemaVersion: "fixture-untrusted-qualified-report", status: "qualified",
      qualification: { trainingAllowed: true, dataQualified: true }, trainingAllowed: true })]));
  const tensors = { status: "real_selected_tensors_verified_cpu_only", optimizerCreated: false, modelCreated: false, gpuStarted: false,
    samples: ["train", "validation"].map((split) => ({ sampleId: `${split}-0`, split,
      imageTensorSha256: sha(Buffer.from(`fixture-tensor-${split}`)), conditionsTensorSha256: sha(Buffer.from(`fixture-condition-${split}`)),
      datasetSelectionSha256: digest(rows.filter((r) => r.split === split)) })) };
  const coreSummary = { status: "passed", failures: [],
    ...(v2 ? {componentContract: componentContractBinding, inheritedParentQualification: false} : {}),
    checks: STAGE4_CORE_CHECK_IDENTITIES.map(identity => ({ identity, status: "passed" })),
    currentProjectionMode: "live_immutable_evidence", gpuStarted: false, trainingStarted: false };
  const execution = { command: "fixture-no-process-was-executed", exitCode: 0, signal: null, interrupted: null };
  const report = {
    schemaVersion: "ai-painter-stage4-split-smoke-component-cpu-verification-v1", status: "cpu_component_verified_runtime_inactive",
    contract: componentContractBinding, qualification: contract.qualification, selectedTensors: tensors,
    selectionExecution: { ...execution, args: ["-B", "-c", "fixture-code-never-executed", JSON.stringify(componentContractBinding)], stdout: JSON.stringify(tensors) },
    coreSummary, coreExecution: { ...execution, args: stage4CoreArgsForComponent(componentContractBinding, v2), stdout: `fixture checks\n${JSON.stringify(coreSummary, null, 2)}` },
    syntheticCpuOptimizerExecutedByTests: true, realDatasetOptimizerExecuted: false, gpuStarted: false,
    trainingStarted: false, runtimeAdapterRegistered: false, currentRegistryModified: false, inputReceipts: snapshot(root),
  };
  const saveCpu = () => write(root, "fixture/cpu-report.json", report);
  const options = { root, componentContractBinding, cpuEvidenceBinding: saveCpu(), dataEvidenceBindings };
  return { root, options, contract, report, rows, channels, saveContract, saveCpu };
}

for (const v2 of [false, true]) test(`CPU writer accepts verified v${v2 ? 2 : 1} identity without execution`, t => {
  const f = fixture(t, { v2 }), before = snapshot(f.root);
  const result = readSplitSmokeCpuComponent(f.root, f.options.componentContractBinding);
  assert.deepEqual(result.contract, f.contract);
  assert.equal(result.contract.qualification.trainingAllowed, false);
  const inspected = inspectSplitSmokeComponent({root: f.root, componentContractBinding: f.options.componentContractBinding});
  assert.deepEqual(result.reader.receipts(), inspected.inputReceipts);
  assert.deepEqual(snapshot(f.root), before);
});

test("CPU writer keeps old compiler hash enforcement and rejects modified v2 dependencies", t => {
  for (const v2 of [false, true]) {
    const f = fixture(t, { v2 });
    write(f.root, FROZEN_COMPILER.path, Buffer.from("not the bound compiler"));
    assert.throws(() => readSplitSmokeCpuComponent(f.root, f.options.componentContractBinding), /SHA mismatch/);
  }
});

test("CPU writer rejects forged self-reported training qualification", t => {
  const f = fixture(t, { v2: true });
  f.contract.qualification.trainingAllowed = true;
  assert.throws(() => readSplitSmokeCpuComponent(f.root, f.saveContract()), /component_qualification_conflict/);
});

for (const [name, mutate, expected] of [
  ["legacy core command", r => { r.coreExecution.args = ["scripts/check-ai-painter-stage4-core.mjs"]; }, "cpu_core_entrypoint_conflict"],
  ["different core candidate", r => { r.coreSummary.componentContract.sha256 = "0".repeat(64); }, "cpu_core_component_binding_conflict"],
  ["inherited parent success", r => { r.coreSummary.inheritedParentQualification = true; }, "cpu_core_parent_qualification_inherited"],
]) test(`v2 CPU evidence rejects ${name}`, t => {
  const f = fixture(t, {v2: true});
  // Separate reference identity from its echoed summary before tampering.
  f.report.coreSummary = structuredClone(f.report.coreSummary);
  mutate(f.report);
  f.report.coreExecution.stdout = `fixture checks\n${JSON.stringify(f.report.coreSummary, null, 2)}`;
  f.options.cpuEvidenceBinding = f.saveCpu();
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.ok(result.blockers.some(b => b.details?.reason === expected), JSON.stringify(result.blockers));
});

test("bound file-chain produces only a non-dispatchable CPU repair proposal; real data API rejects forged audit grant", (t) => {
  const f = fixture(t), before = snapshot(f.root);
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.equal(result.checks.component, "explicit_bindings_verified", JSON.stringify(result.blockers));
  assert.equal(result.checks.cpu, "bound_cpu_component_report_verified", JSON.stringify(result.blockers));
  assert.equal(result.status, "unknown_or_stale");
  assert.ok(result.dataAdjudication.blockers.some((b) => b.details?.reason?.includes("unsupported_baseline_schema")));
  assert.ok(result.planCandidate);
  assert.equal(result.planCandidate.cpuComponentEvidence.sha256, f.options.cpuEvidenceBinding.sha256);
  assert.deepEqual(result.planCandidate.dataEvidenceBindings, f.options.dataEvidenceBindings);
  assert.equal(result.cpuComponentEvidence.syntheticOptimizerEvidenceOnly, true);
  assert.equal(result.cpuComponentEvidence.tensorsReexecuted, false);
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(preflightSplitSmoke(f.options).planCandidate.planCandidateId, result.planCandidate.planCandidateId);
});

test("current compiler cannot silently satisfy the historical parent binding", (t) => {
  const f = fixture(t);
  const current = fs.readFileSync(path.join(PROJECT, FROZEN_COMPILER.path));
  assert.notEqual(sha(current), FROZEN_COMPILER.sha256);
  write(f.root, FROZEN_COMPILER.path, current);
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.equal(result.checks.component, "unknown_or_stale");
  assert.equal(result.planCandidate, null);
  assert.ok(result.blockers.some(b => b.details?.reason === `SHA mismatch: ${FROZEN_COMPILER.path}`));
});

test("v2 graph reaches the data gate without inheriting training or GPU qualification", t => {
  const f = fixture(t, { v2: true }), before = snapshot(f.root);
  const inspected = inspectSplitSmokeComponent({root: f.root, componentContractBinding: f.options.componentContractBinding});
  assert.equal(inspected.status, "component_identity_verified_not_execution_qualified");
  assert.equal(inspected.trainingAllowed, false);
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.equal(result.checks.component, "explicit_bindings_verified", JSON.stringify(result.blockers));
  assert.equal(result.checks.cpu, "bound_cpu_component_report_verified", JSON.stringify(result.blockers));
  assert.equal(result.checks.data, "unknown_or_stale");
  assert.equal(result.planCandidate.schemaVersion, "ai-painter-stage4-split-smoke-plan-candidate-v2");
  assert.deepEqual(result.planCandidate.compilerLineage, f.contract.compilerLineage);
  assert.deepEqual(snapshot(f.root), before);
});

for (const [name, mutate] of [
  ["lineage omitted", f => {delete f.contract.compilerLineage;}],
  ["lineage hash forged", f => {f.contract.compilerLineage.sha256 = "0".repeat(64);}],
  ["v1 schema with v2 graph", f => {f.contract.schemaVersion = "ai-painter-stage4-split-isolated-smoke-contract-v1";}],
  ["validation used as optimizer split", f => {f.contract.boundaries.optimizerSplit = "validation";}],
  ["training claimed", f => {f.contract.qualification.trainingAllowed = true;}],
  ["reader omitted", f => {f.contract.programBindings.pop();}],
  ["historical parent overwritten", f => {f.contract.frozenProgramBindings.conditionCompiler.sha256 = "0".repeat(64);}],
]) test(`v2 rejects ${name} even with a recomputed candidate identity`, t => {
  const f = fixture(t, {v2: true}); mutate(f);
  f.options.componentContractBinding = f.saveContract();
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.equal(result.checks.component, "unknown_or_stale");
  assert.equal(result.planCandidate, null);
});

for (const logical of ["scripts/lib/current-world-condition-raster.mjs",
  "scripts/compile-current-world-visual-conditions.mjs",
  "scripts/lib/ai-painter-stage4-split-smoke-preflight.mjs"]) {
  test(`v2 rejects changed dependency: ${logical}`, t => {
    const f = fixture(t, {v2: true});
    fs.appendFileSync(path.join(f.root, logical), "\n// drift\n");
    const result = preflightSplitSmoke(f.options);
    noExecution(result); assert.equal(result.checks.component, "unknown_or_stale");
    assert.equal(result.planCandidate, null);
  });
}

test("v2 cannot reuse CPU evidence bound to a different component", t => {
  const f = fixture(t, {v2: true});
  f.report.contract = {path: CONTRACT, sha256: sha(fs.readFileSync(path.join(PROJECT, CONTRACT)))};
  f.options.cpuEvidenceBinding = f.saveCpu();
  const result = preflightSplitSmoke(f.options);
  noExecution(result); assert.equal(result.checks.component, "explicit_bindings_verified");
  assert.equal(result.checks.cpu, "unknown_or_stale");
  assert.equal(result.planCandidate, null);
});

for (const extra of [{ trainingAllowed: true }, { dataQualified: true }, { adjudicateStage4SplitData: () => ({ trainingAllowed: true }) },
  { nextMachineAction: "run_gpu" }, { dataAdjudication: { status: "qualified" } }]) {
  test(`caller cannot inject qualification/evaluator/action: ${Object.keys(extra)[0]}`, (t) => {
    const f = fixture(t), result = preflightSplitSmoke({ ...f.options, ...extra });
    noExecution(result);
    assert.equal(result.planCandidate, null);
    assert.ok(result.blockers.some((b) => b.code === "input_evidence_invalid_or_stale"));
  });
}

test("different self-consistent candidate cannot reuse the old CPU contract binding", (t) => {
  const f = fixture(t);
  f.contract.selections.train.sampleIds = ["train-1"];
  f.contract.selections.train.rowsSha256 = digest(f.rows.filter((r) => r.sampleId === "train-1"));
  f.options.componentContractBinding = f.saveContract();
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.equal(result.checks.component, "explicit_bindings_verified");
  assert.equal(result.planCandidate, null);
  assert.ok(result.blockers.some((b) => b.details?.reason?.includes("cpu_contract_binding_conflict")));
});

test("a self-consistent partial core report cannot claim complete CPU verification", (t) => {
  const f = fixture(t);
  f.report.coreSummary.checks = [{ identity: "split-smoke-real-trainer-cpu-integration", status: "passed" }];
  f.report.coreExecution.stdout = `fixture checks\n${JSON.stringify(f.report.coreSummary, null, 2)}`;
  f.options.cpuEvidenceBinding = f.saveCpu();
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.equal(result.checks.cpu, "unknown_or_stale");
  assert.equal(result.planCandidate, null);
});

for (const [name, mutate] of [
  ["missing typecheck", summary => { summary.checks = summary.checks.filter(c => c.identity !== "typescript-noemit"); }],
  ["unknown replacement check", summary => { summary.checks[0].identity = "unregistered-replacement"; }],
  ["duplicate check", summary => { summary.checks[0] = { ...summary.checks[1] }; }],
  ["reordered execution", summary => { summary.checks.reverse(); }],
  ["static projection", summary => { summary.currentProjectionMode = "static_contract_plus_atomic_fixture"; }],
  ["missing projection scope", summary => { delete summary.currentProjectionMode; }],
  ["GPU run presented as CPU", summary => { summary.gpuStarted = true; }],
  ["missing execution scope", summary => { delete summary.trainingStarted; }],
]) test(`self-consistent core evidence rejects ${name}`, (t) => {
  const f = fixture(t);
  mutate(f.report.coreSummary);
  f.report.coreExecution.stdout = `fixture checks\n${JSON.stringify(f.report.coreSummary, null, 2)}`;
  f.options.cpuEvidenceBinding = f.saveCpu();
  const result = preflightSplitSmoke(f.options);
  noExecution(result);
  assert.equal(result.checks.cpu, "unknown_or_stale");
  assert.equal(result.planCandidate, null);
});

test("importing the shared core inventory does not execute the core runner", () => {
  const url = new URL("../check-ai-painter-stage4-core.mjs", import.meta.url).href;
  const result = childProcess.spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { STAGE4_CORE_CHECK_IDENTITIES as ids } from ${JSON.stringify(url)};
     if (!Object.isFrozen(ids) || new Set(ids).size !== ids.length) throw new Error('mutable or duplicate inventory');
     process.stdout.write(JSON.stringify(ids));`],
  { cwd: PROJECT, encoding: "utf8", windowsHide: true, timeout: 10_000, maxBuffer: 128 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), STAGE4_CORE_CHECK_IDENTITIES);
});

for (const [name, mutate] of [
  ["candidate caller qualification", (f) => { f.contract.qualification.trainingAllowed = true; }],
  ["GPU requirement missing", (f) => { delete f.contract.qualification.newCapabilityGpuQualificationRequired; }],
  ["train/validation swapped", (f) => { f.contract.boundaries.optimizerSplit = "validation"; }],
  ["selection rows hash forged", (f) => { f.contract.selections.train.rowsSha256 = "0".repeat(64); }],
  ["V2 parent substituted", (f) => { f.contract.parentCapability.sha256 = "0".repeat(64); }],
]) test(`component rejects ${name}`, (t) => {
  const f = fixture(t); mutate(f); f.options.componentContractBinding = f.saveContract();
  const result = preflightSplitSmoke(f.options);
  noExecution(result); assert.equal(result.planCandidate, null); assert.equal(result.checks.component, "unknown_or_stale");
});

for (const [name, mutate] of [
  ["legacy V2 success", (r) => { r.schemaVersion = "stage4-v2-cpu-contract-acceptance-terminal-v1"; }],
  ["real optimizer claim", (r) => { r.realDatasetOptimizerExecuted = true; }],
  ["caller qualification", (r) => { r.qualification = { ...r.qualification, trainingAllowed: true }; }],
  ["failed child masked by passed report", (r) => { r.coreExecution.exitCode = 1; }],
  ["interrupted child", (r) => { r.selectionExecution.interrupted = "timeout"; }],
  ["synthetic only without selected tensor reads", (r) => { r.selectedTensors.status = "synthetic_only"; }],
  ["selected split tampered", (r) => { r.selectedTensors.samples[0].split = "validation"; }],
  ["passed summary differs from child output", (r) => { r.coreExecution.stdout = `\n${JSON.stringify({ ...r.coreSummary, status: "failed" }, null, 2)}`; }],
  ["required receipt removed", (r) => { r.inputReceipts = r.inputReceipts.filter((v) => v.path !== "scripts/check-ai-painter-stage4-core.mjs"); }],
  ["receipt duplicated", (r) => { r.inputReceipts.push(r.inputReceipts[0]); }],
  ["receipt size forged", (r) => { r.inputReceipts[0].bytes++; }],
]) test(`CPU evidence rejects ${name}`, (t) => {
  const f = fixture(t); mutate(f.report); f.options.cpuEvidenceBinding = f.saveCpu();
  const result = preflightSplitSmoke(f.options);
  noExecution(result); assert.equal(result.planCandidate, null); assert.equal(result.checks.cpu, "unknown_or_stale");
});

for (const logical of ["ml/ai-painter/scripts/stage4_split_isolated_smoke.py", "scripts/run-ai-painter-stage4-v2-cpu-contract-acceptance.mjs",
  "scripts/check-ai-painter-stage4-core.mjs", "fixture/component.json", "fixture/source-index.json",
  "fixture/splits/train.json", "fixture/image.bin", "fixture/channels/0.bin"]) {
  test(`actual file-byte drift invalidates: ${logical}`, (t) => {
    const f = fixture(t); fs.appendFileSync(path.join(f.root, logical), "\n ");
    const result = preflightSplitSmoke(f.options);
    noExecution(result); assert.equal(result.planCandidate, null);
    assert.ok(result.blockers.some((b) => /SHA mismatch|input changed/u.test(b.details?.reason ?? "")));
  });
}

test("explicit audit binding hash drift remains blocked and is not caller-relabelled as qualified", (t) => {
  const f = fixture(t);
  f.options.dataEvidenceBindings.baselineBinding = { ...f.options.dataEvidenceBindings.baselineBinding, sha256: "0".repeat(64) };
  const result = preflightSplitSmoke(f.options);
  noExecution(result); assert.equal(result.checks.data, "unknown_or_stale");
  assert.ok(result.dataAdjudication.blockers.some((b) => b.code === "data_evidence_invalid_or_stale"));
});

for (const badPath of ["latest/report.json", "fixture/../fixture/cpu-report.json", "C:/fixture/cpu-report.json"]) {
  test(`no implicit latest or escaping path: ${badPath}`, (t) => {
    const f = fixture(t);
    f.options.cpuEvidenceBinding.path = badPath;
    const result = preflightSplitSmoke(f.options);
    noExecution(result); assert.equal(result.planCandidate, null);
  });
}

test("rejected data allows only registry reads, never writes, optimizer/GPU subprocesses or dispatch", (t) => {
  const f = fixture(t), before = snapshot(f.root), restored = [];
  const prohibit = (object, name) => {
    const previous = object[name];
    object[name] = () => { throw new Error(`forbidden side effect: ${name}`); };
    restored.push(() => { object[name] = previous; });
  };
  for (const name of ["writeFileSync", "appendFileSync", "mkdirSync", "renameSync", "unlinkSync", "rmSync", "truncateSync"]) prohibit(fs, name);
  for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) prohibit(childProcess, name);
  let result;
  try { result = preflightSplitSmoke(f.options); } finally { restored.reverse().forEach((restore) => restore()); }
  noExecution(result);
  assert.equal(result.checks.cpu, "bound_cpu_component_report_verified", JSON.stringify(result.blockers));
  const registryPath = ".runtime/ai-painter/current-execution-registry/current.json";
  assert.equal(result.inputReceipts.find(r => r.path === registryPath)?.sha256,
    sha(fs.readFileSync(path.join(f.root, registryPath))));
  assert.deepEqual(snapshot(f.root), before);
});

for (const logical of ["fixture/component.json", "fixture/cpu-report.json", "fixture/channels/0.bin"]) {
  test(`final stability recheck catches evidence replacement: ${logical}`, (t) => {
    const f = fixture(t), originalRead = fs.readFileSync;
    const target = path.resolve(f.root, logical);
    let reads = 0;
    fs.readFileSync = function (file, ...args) {
      if (typeof file === "string" && path.resolve(file) === target && ++reads === (logical === "fixture/cpu-report.json" ? 2 : 3))
        fs.appendFileSync(target, "\n ");
      return originalRead.call(this, file, ...args);
    };
    let result;
    try { result = preflightSplitSmoke(f.options); } finally { fs.readFileSync = originalRead; }
    noExecution(result); assert.equal(result.planCandidate, null);
    assert.ok(result.blockers.some((b) => b.code === "preflight_input_changed_during_read"), JSON.stringify(result.blockers));
  });
}
