import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as acorn from "acorn";

import {
  buildAiPainterProgramGraphManifest,
  buildStage4V2QualificationProgramGraph,
  buildStage4V2SmokeProgramGraph,
  validateAiPainterProgramGraphManifest,
} from "../lib/ai-painter-program-graph-manifest-v1.mjs";
import {
  bindProjectFile,
} from "../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const results = [];

await test("qualification and Smoke profiles include declared reboot recovery and its real import closure", () => {
  const root = process.cwd();
  const registryPath = "src/server/ai-painter-current-execution-registry.mjs";
  const recoveryPath = "scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs";
  for (const builder of [buildStage4V2QualificationProgramGraph, buildStage4V2SmokeProgramGraph]) {
    const graph = builder({ projectRoot: root,
      programLineage: { registry: bindProjectFile(root, registryPath) } });
    assert.ok(graph.dynamicSuccessors.some(({ path: value }) => value === recoveryPath));
    assert.ok(graph.imports.some(({ from, to, kind }) => from === registryPath
      && to === recoveryPath && kind === "dynamic_literal"));
    assert.ok(graph.imports.some(({ from, to, kind }) => from === recoveryPath
      && to === registryPath && kind === "static"));
    const recovery = graph.files.find(({ path: value }) => value === recoveryPath);
    assert.equal(recovery.sha256, bindProjectFile(root, recoveryPath).sha256);
    assert.ok(graph.files.some(({ path: value }) => value === registryPath));
  }
});

await test("static, literal-dynamic, declared non-literal and Python closures are deterministic", () => {
  const fixture = createFixture();
  try {
    const first = build(fixture);
    const second = build(fixture);
    assert.deepEqual(second, first);
    assert.equal(first.files.some((item) => item.path === "scripts/dep.mjs"), true);
    assert.equal(first.files.some((item) => item.path === "scripts/dynamic.mjs"), true);
    assert.equal(first.files.some((item) => item.path === "scripts/alternate.mjs"), true);
    assert.equal(first.files.some((item) => item.path === "scripts/common.cjs"), true,
      "CommonJS literal dependency was not represented");
    assert.equal(first.files.some((item) => item.path === "scripts/fake.mjs"), false,
      "JavaScript string content was misclassified as an import");
    assert.equal(first.files.some((item) => item.path === "ml/ai-painter/scripts/helper.py"), true);
    assert.equal(first.imports.some((item) => item.from === "scripts/dep.mjs"
      && item.to === "scripts/root.mjs"), true,
    "cyclic local import was not represented");
    const binding = persistManifest(fixture, first);
    validate(fixture, binding);
  } finally {
    fixture.cleanup();
  }
});

await test("transitive dependency byte replacement invalidates persisted graph", () => {
  const fixture = createFixture();
  try {
    const binding = persistManifest(fixture, build(fixture));
    fs.appendFileSync(path.join(fixture.root, "scripts", "dep.mjs"), "// replacement\n");
    assert.throws(() => validate(fixture, binding),
      /program graph manifest differs/u);
  } finally {
    fixture.cleanup();
  }
});

await test("new local import invalidates persisted graph", () => {
  const fixture = createFixture();
  try {
    const binding = persistManifest(fixture, build(fixture));
    write(fixture.root, "scripts/added.mjs", "export const added = true;\n");
    fs.appendFileSync(path.join(fixture.root, "scripts", "root.mjs"),
      "import './added.mjs';\n");
    assert.throws(() => validate(fixture, binding),
      /program graph manifest differs/u);
  } finally {
    fixture.cleanup();
  }
});

await test("removed local import invalidates persisted graph", () => {
  const fixture = createFixture();
  try {
    const binding = persistManifest(fixture, build(fixture));
    write(fixture.root, "scripts/root.mjs",
      "export async function load() { return import('./dynamic.mjs'); }\n");
    assert.throws(() => validate(fixture, binding),
      /program graph manifest differs/u);
  } finally {
    fixture.cleanup();
  }
});

await test("undeclared literal dynamic import fails graph construction", () => {
  const fixture = createFixture();
  try {
    assert.throws(() => buildAiPainterProgramGraphManifest({
      projectRoot: fixture.root,
      graphId: fixture.graphId,
      entrypoints: fixture.entrypoints,
      dynamicSuccessors: [{ role: "alternate", path: "scripts/alternate.mjs" }],
      nonLiteralDynamicDispatches: fixture.nonLiteralDynamicDispatches,
    }), /literal dynamic import is not declared/u);
  } finally {
    fixture.cleanup();
  }
});

await test("undeclared non-literal dynamic import fails graph construction", () => {
  const fixture = createFixture();
  try {
    assert.throws(() => buildAiPainterProgramGraphManifest({
      projectRoot: fixture.root,
      graphId: fixture.graphId,
      entrypoints: fixture.entrypoints,
      dynamicSuccessors: fixture.dynamicSuccessors,
      nonLiteralDynamicDispatches: [],
    }), /non-literal dynamic import is not declared/u);
  } finally {
    fixture.cleanup();
  }
});

await test("declared non-literal target set cannot be substituted", () => {
  const fixture = createFixture();
  try {
    const manifest = build(fixture);
    const forged = structuredClone(manifest);
    forged.nonLiteralDynamicDispatches[0].targets.pop();
    forged.graphContentSha256 = canonicalSha256(stripGraphHash(forged));
    const binding = persistManifest(fixture, forged);
    assert.throws(() => validate(fixture, binding),
      /program graph manifest differs/u);
  } finally {
    fixture.cleanup();
  }
});

await test("path escape is rejected before graph construction", () => {
  const fixture = createFixture();
  try {
    assert.throws(() => buildAiPainterProgramGraphManifest({
      projectRoot: fixture.root,
      graphId: fixture.graphId,
      entrypoints: [{ role: "escape", path: "../outside.mjs" }],
      dynamicSuccessors: fixture.dynamicSuccessors,
      nonLiteralDynamicDispatches: fixture.nonLiteralDynamicDispatches,
    }), /escapes project root|path is missing/u);
  } finally {
    fixture.cleanup();
  }
});

await test("qualification and Smoke launchers retain graph checks before side effects", () => {
  const root = process.cwd();
  assertOrderedWithinExport(root,
    "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs",
    "export async function launchStage4V2ReadonlyGpuQualificationBackground",
    "validateStage4V2QualificationProgramGraph({",
    "const launchDirectory =");
  assertOrderedWithinExport(root,
    "scripts/launch-ai-painter-stage4-v2-controlled-smoke-background.mjs",
    "export async function launchStage4V2ControlledSmokeBackground",
    "validateStage4V2SmokePackagePayload(payload",
    "const currentEvidence =");
  assertOrderedWithinExport(root,
    "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs",
    "export async function runStage4V2ControlledSmoke",
    "validateStage4V2SmokePackagePayload(payload",
    "writeExclusiveJson(lockPath");
});

await test("new qualification rejects changed graph before directory creation, ticket consumption or invocation", async () => {
  const fixture = createQualificationBoundaryFixture();
  try {
    fs.appendFileSync(path.join(fixture.root, "scripts/dep.mjs"), "// changed bytes\n");
    const result = await fixture.run();
    assert.equal(result.status, "fixture_failed_closed");
    assert.match(result.error.message, /program graph manifest differs/u);
    assert.deepEqual(fixture.calls, ["graph", "failed_closed"]);
    assert.equal(fs.existsSync(fixture.preflightRoot), false);
    assert.equal(fs.existsSync(fixture.outputRoot), false);
  } finally {
    fixture.cleanup();
  }
});

await test("new qualification with unchanged graph reaches directory creation only after graph validation", async () => {
  const fixture = createQualificationBoundaryFixture();
  try {
    const result = await fixture.run();
    assert.match(result.error.message, /fixture_stop_before_resource_commands/u);
    assert.deepEqual(fixture.calls, ["graph", "preflight_created", "failed_closed"]);
    assert.equal(fs.existsSync(fixture.preflightRoot), true);
    assert.equal(fs.existsSync(fixture.outputRoot), false);
  } finally {
    fixture.cleanup();
  }
});

await test("existing qualification preflight routes to publication recovery without new execution side effects", async () => {
  const fixture = createQualificationBoundaryFixture();
  try {
    fs.mkdirSync(fixture.preflightRoot, { recursive: true });
    fs.writeFileSync(fixture.journalPath, "{\"state\":\"event_committed\",\"evidence\":{\"terminal\":{\"path\":\"evidence/terminal.json\"}}}\n");
    fs.writeFileSync(path.join(fixture.root, "evidence/terminal.json"),
      "{\"status\":\"stage4_v2_readonly_gpu_qualification_failed_closed\"}\n");
    fs.appendFileSync(path.join(fixture.root, "scripts/dep.mjs"), "// post-execution change\n");
    const before = fs.readFileSync(fixture.journalPath);
    const result = await fixture.run();
    assert.equal(result.status, "fixture_publication_recovery");
    assert.deepEqual(fixture.calls, ["publication_recovery"]);
    assert.deepEqual(fs.readFileSync(fixture.journalPath), before);
    assert.equal(fs.existsSync(fixture.outputRoot), false);
  } finally {
    fixture.cleanup();
  }
});

await test("existing qualification preflight without recovery journal fails without starting new execution", async () => {
  const fixture = createQualificationBoundaryFixture();
  try {
    fs.mkdirSync(fixture.preflightRoot, { recursive: true });
    const result = await fixture.run();
    assert.match(result.error.message, /existing qualification preflight has no outer journal/u);
    assert.deepEqual(fixture.calls, ["failed_closed"]);
    assert.equal(fs.existsSync(fixture.outputRoot), false);
  } finally {
    fixture.cleanup();
  }
});

process.stdout.write(`${JSON.stringify({
  status: "passed",
  testCount: results.length,
  results,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

async function test(name, body) {
  await body();
  results.push({ name, status: "passed" });
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-program-graph-"));
  const parserPath = "scripts/lib/ai-painter-python-import-ast-v1.py";
  const parserTarget = path.join(root, ...parserPath.split("/"));
  fs.mkdirSync(path.dirname(parserTarget), { recursive: true });
  fs.copyFileSync(path.join(process.cwd(), ...parserPath.split("/")), parserTarget);
  write(root, "scripts/root.mjs",
    "import './dep.mjs';\nconst common = require('./common.cjs');\nconst text = \"import('./fake.mjs')\";\nexport async function load() { return import('./dynamic.mjs'); }\nexport { common, text };\n");
  write(root, "scripts/dep.mjs", "import './root.mjs';\nexport const dep = true;\n");
  write(root, "scripts/common.cjs", "module.exports = true;\n");
  write(root, "scripts/dynamic.mjs", "export const dynamic = true;\n");
  write(root, "scripts/alternate.mjs", "export const alternate = true;\n");
  write(root, "scripts/dispatcher.mjs",
    "export async function dispatch(moduleUrl) { return import(moduleUrl); }\n");
  write(root, "ml/ai-painter/scripts/python_root.py", "import helper\n");
  write(root, "ml/ai-painter/scripts/helper.py", "VALUE = 1\n");
  return {
    root,
    graphId: "test-program-graph-v1",
    entrypoints: [
      { role: "javascriptRoot", path: "scripts/root.mjs" },
      { role: "dispatcher", path: "scripts/dispatcher.mjs" },
      { role: "pythonRoot", path: "ml/ai-painter/scripts/python_root.py" },
    ],
    dynamicSuccessors: [
      { role: "dynamic", path: "scripts/dynamic.mjs" },
      { role: "alternate", path: "scripts/alternate.mjs" },
    ],
    nonLiteralDynamicDispatches: [{
      role: "runtimeDispatch",
      importerPath: "scripts/dispatcher.mjs",
      targetPaths: ["scripts/dynamic.mjs", "scripts/alternate.mjs"],
      siteCount: 1,
    }],
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function createQualificationBoundaryFixture() {
  const fixture = createFixture();
  const binding = persistManifest(fixture, build(fixture));
  const calls = [];
  const payload = {
    preflightDirectory: "evidence/preflight",
    outputDirectory: "evidence/output",
    programGraphManifest: binding,
  };
  const manifest = { programGraphManifest: binding };
  const terminal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-terminal-v1",
    status: "stage4_v2_readonly_gpu_qualification_package_materialized",
    executionState: "completed",
    ownerAuthorizationRequired: false,
    manifest: {},
  };
  const preflightRoot = path.join(fixture.root, payload.preflightDirectory);
  const outputRoot = path.join(fixture.root, payload.outputDirectory);
  const journalPath = path.join(preflightRoot, "outer-journal.json");
  // Run the actual exported runner control flow with isolated dependencies.
  // Signature/lifecycle internals are outside this unit: the real graph validator
  // runs against private files, and every new-execution effect is observed or
  // forbidden. No production runner order or test-only gate is introduced.
  const source = fs.readFileSync(path.join(process.cwd(),
    "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs"), "utf8");
  const tree = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const declaration = tree.body.find((node) => node.type === "ExportNamedDeclaration"
    && node.declaration?.id?.name === "runStage4V2ReadonlyGpuQualification")?.declaration;
  assert.ok(declaration, "qualification runner export is missing");
  const forbidden = () => { assert.fail("qualification crossed a forbidden execution boundary"); };
  const scope = {
    assert, fs, path,
    spawnSync: forbidden,
    readCurrentExecutionRegistry: async () => ({ ok: true, registry: {}, currentTaskTerminal: terminal }),
    recoverInterruptedQualification: forbidden,
    invokePythonQualification: forbidden,
    verifyMaterializedRegistry: () => {},
    bindProjectFile: () => {},
    readProjectJson: () => manifest,
    verifyPackageManifest: () => {},
    readBoundProjectJson: (_root, value) => value?.path === "evidence/terminal.json"
      ? JSON.parse(fs.readFileSync(path.join(fixture.root, value.path), "utf8"))
      : value === manifest.packagePayload ? payload : {},
    resolveProjectPath: (root, value) => path.join(root, value),
    readJsonObject: (target) => JSON.parse(fs.readFileSync(target, "utf8")),
    buildExecutionPaths: () => ({ outerJournal: journalPath }),
    assertProjectBinding: (_root, value) => assert.ok(value?.path),
    recoverCommittedQualificationPublication: async ({ context }) => {
      assert.equal(context.outerJournal.state, "event_committed");
      calls.push("publication_recovery");
      return { status: "fixture_publication_recovery" };
    },
    validatePackagePayload: () => {},
    validateStage4V2PreReleaseQualificationTicket: () => ({
      issuer: { protectedPrivateKey: { protectionScheme: "windows_dpapi_local_machine_v1" } },
    }),
    validateStage4V2QualificationProgramGraph: () => {
      calls.push("graph");
      validate(fixture, binding);
    },
    verifyProgramLineageRoles: () => {},
    initializeQualificationOuterJournal: () => {
      calls.push("preflight_created");
      return { state: "fixture_preflight" };
    },
    runResourcePreflight: () => { throw new Error("fixture_stop_before_resource_commands"); },
    consumeStage4V2QualificationTicket: forbidden,
    registerCurrentActiveExecution: forbidden,
    persistFailedClosed: async ({ error, context }) => {
      assert.equal(context.ticketConsumed, false);
      assert.equal(context.outputCreated, false);
      assert.equal(context.activeExecutionRegistered, false);
      calls.push("failed_closed");
      return { status: "fixture_failed_closed", error };
    },
    stopActiveExecutionHeartbeat: () => {},
  };
  // Distinct binding objects keep fixture payload and ticket reads unambiguous.
  manifest.packagePayload = { path: "fixture-payload" };
  manifest.preReleaseQualificationTicket = { path: "fixture-ticket" };
  const runner = new Function(...Object.keys(scope),
    `return (${source.slice(declaration.start, declaration.end)});`)(...Object.values(scope));
  return {
    ...fixture, calls, preflightRoot, outputRoot, journalPath,
    run: () => runner({ projectRoot: fixture.root, commitCurrentRegistry: false,
      appendProgramEvent: false }),
  };
}

function build(fixture) {
  return buildAiPainterProgramGraphManifest({
    projectRoot: fixture.root,
    graphId: fixture.graphId,
    entrypoints: fixture.entrypoints,
    dynamicSuccessors: fixture.dynamicSuccessors,
    nonLiteralDynamicDispatches: fixture.nonLiteralDynamicDispatches,
  });
}

function validate(fixture, manifestBinding) {
  return validateAiPainterProgramGraphManifest({
    projectRoot: fixture.root,
    manifestBinding,
    graphId: fixture.graphId,
    entrypoints: fixture.entrypoints,
    dynamicSuccessors: fixture.dynamicSuccessors,
    nonLiteralDynamicDispatches: fixture.nonLiteralDynamicDispatches,
  });
}

function persistManifest(fixture, manifest) {
  const target = write(fixture.root, "evidence/program-graph-manifest.json",
    `${JSON.stringify(manifest, null, 2)}\n`);
  return bindProjectFile(fixture.root,
    path.relative(fixture.root, target).replaceAll("\\", "/"));
}

function write(root, logicalPath, bytes) {
  const target = path.join(root, ...logicalPath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, "utf8");
  return target;
}

function stripGraphHash(value) {
  const copy = structuredClone(value);
  delete copy.graphContentSha256;
  return copy;
}

function canonicalSha256(value) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(canonical(value))).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function assertOrderedWithinExport(root, logicalPath, exportMarker,
  verificationMarker, boundaryMarker) {
  const source = fs.readFileSync(path.join(root, ...logicalPath.split("/")), "utf8");
  const start = source.indexOf(exportMarker);
  assert.ok(start >= 0, `${logicalPath} export marker is missing`);
  const body = source.slice(start);
  const verification = body.indexOf(verificationMarker);
  const boundary = body.indexOf(boundaryMarker);
  assert.ok(verification >= 0, `${logicalPath} graph verification is missing`);
  assert.ok(boundary >= 0, `${logicalPath} protected boundary is missing`);
  assert.ok(verification < boundary,
    `${logicalPath} graph verification occurs after the protected boundary`);
}
