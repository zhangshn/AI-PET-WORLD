import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildAiPainterProgramGraphManifest,
  validateAiPainterProgramGraphManifest,
} from "../lib/ai-painter-program-graph-manifest-v1.mjs";
import {
  bindProjectFile,
} from "../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const results = [];

await test("static, literal-dynamic, declared non-literal and Python closures are deterministic", () => {
  const fixture = createFixture();
  try {
    const first = build(fixture);
    const second = build(fixture);
    assert.deepEqual(second, first);
    assert.equal(first.files.some((item) => item.path === "scripts/dep.mjs"), true);
    assert.equal(first.files.some((item) => item.path === "scripts/dynamic.mjs"), true);
    assert.equal(first.files.some((item) => item.path === "scripts/alternate.mjs"), true);
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
  write(root, "scripts/root.mjs",
    "import './dep.mjs';\nexport async function load() { return import('./dynamic.mjs'); }\n");
  write(root, "scripts/dep.mjs", "import './root.mjs';\nexport const dep = true;\n");
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
