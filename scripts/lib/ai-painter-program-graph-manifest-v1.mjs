import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";

import {
  bindProjectFile,
  readJsonObject,
  resolveProjectPath,
} from "./ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const AI_PAINTER_PROGRAM_GRAPH_SCHEMA =
  "ai-painter-program-graph-manifest-v1";
export const STAGE4_V2_QUALIFICATION_PROGRAM_GRAPH_ID =
  "stage4-v2-readonly-gpu-qualification-program-graph-v1";
export const STAGE4_V2_SMOKE_PROGRAM_GRAPH_ID =
  "stage4-v2-controlled-smoke-program-graph-v1";

const QUALIFICATION_CONTINUATION_PATH =
  "scripts/lib/ai-painter-stage4-v2-qualification-continuation-v1.mjs";
const AUTONOMOUS_CLOSED_LOOP_PATH =
  "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs";
const SMOKE_PLANNER_PATH = "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs";
const SMOKE_BACKGROUND_LAUNCHER_PATH =
  "scripts/launch-ai-painter-stage4-v2-controlled-smoke-background.mjs";
const SMOKE_CHILD_RUNNER_PATH = "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs";
const SMOKE_FORMAL_PLANNER_PATH =
  "scripts/plan-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs";
const SMOKE_FORMAL_EXECUTOR_PATH =
  "scripts/run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs";
const SMOKE_FAILURE_ADJUDICATOR_PATH =
  "scripts/adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary.mjs";
const QUALIFICATION_FAILURE_ADJUDICATOR_PATH =
  "scripts/adjudicate-ai-painter-stage4-v2-readonly-gpu-qualification-failure.mjs";
const SMOKE_ADAPTER_PATH =
  "scripts/lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";

const SAFE_ROLE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const JS_EXTENSIONS = new Set([".mjs", ".js", ".cjs", ".json"]);
const PYTHON_AST_HELPER_PATH =
  "scripts/lib/ai-painter-python-import-ast-v1.py";
const PYTHON_IMPORT_AST_CACHE = new Map();

export function buildStage4V2QualificationProgramGraph({
  projectRoot = process.cwd(), programLineage,
} = {}) {
  return buildAiPainterProgramGraphManifest({
    projectRoot,
    ...stage4V2GraphDefinition({
      graphId: STAGE4_V2_QUALIFICATION_PROGRAM_GRAPH_ID,
      programLineage,
    }),
  });
}

export function validateStage4V2QualificationProgramGraph({
  projectRoot = process.cwd(), manifestBinding, programLineage,
} = {}) {
  return validateAiPainterProgramGraphManifest({
    projectRoot,
    manifestBinding,
    ...stage4V2GraphDefinition({
      graphId: STAGE4_V2_QUALIFICATION_PROGRAM_GRAPH_ID,
      programLineage,
    }),
  });
}

export function buildStage4V2SmokeProgramGraph({
  projectRoot = process.cwd(), programLineage,
} = {}) {
  return buildAiPainterProgramGraphManifest({
    projectRoot,
    ...stage4V2GraphDefinition({
      graphId: STAGE4_V2_SMOKE_PROGRAM_GRAPH_ID,
      programLineage,
    }),
  });
}

export function validateStage4V2SmokeProgramGraph({
  projectRoot = process.cwd(), manifestBinding, programLineage,
} = {}) {
  return validateAiPainterProgramGraphManifest({
    projectRoot,
    manifestBinding,
    ...stage4V2GraphDefinition({
      graphId: STAGE4_V2_SMOKE_PROGRAM_GRAPH_ID,
      programLineage,
    }),
  });
}

export function buildAiPainterProgramGraphManifest({
  projectRoot = process.cwd(),
  graphId,
  entrypoints,
  dynamicSuccessors = [],
  nonLiteralDynamicDispatches = [],
} = {}) {
  const root = path.resolve(projectRoot);
  assert.match(graphId ?? "", SAFE_ROLE, "program graph identity is invalid");
  const roots = normalizeRoots(root, [
    ...(entrypoints ?? []),
    { role: "programGraphPythonAstParser", path: PYTHON_AST_HELPER_PATH },
  ], "entrypoint");
  const successors = normalizeRoots(root, dynamicSuccessors, "dynamic successor");
  const rootByPath = new Map();
  for (const value of [...roots, ...successors]) {
    const roles = rootByPath.get(value.path) ?? new Set();
    roles.add(value.role);
    rootByPath.set(value.path, roles);
  }
  const dispatches = normalizeDispatches(root, nonLiteralDynamicDispatches);
  for (const dispatch of dispatches) {
    for (const target of dispatch.targets) {
      const roles = rootByPath.get(target.path) ?? new Set();
      roles.add(`${dispatch.role}.target`);
      rootByPath.set(target.path, roles);
    }
  }

  const nodes = new Map();
  const edges = [];
  const externalModules = new Set();
  const pending = [...rootByPath.keys()].sort();
  const processed = new Set();
  const literalDynamicTargets = new Set();
  const observedNonLiteralDispatches = new Map();
  while (pending.length > 0) {
    const logicalPath = pending.shift();
    if (processed.has(logicalPath)) continue;
    processed.add(logicalPath);
    const absolute = resolveProjectPath(root, logicalPath, {
      mustExist: true,
      kind: "file",
    });
    const language = languageFor(logicalPath);
    const binding = bindProjectFile(root, logicalPath);
    nodes.set(logicalPath, {
      path: binding.path,
      sha256: binding.sha256,
      byteSize: binding.byteSize,
      language,
      importedBy: new Set(),
    });
    if (language === "json") continue;
    const source = fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/u, "");
    const imports = language === "javascript"
      ? parseJavascriptImports(source, logicalPath)
      : parsePythonImports(source, logicalPath, root);
    for (const imported of imports) {
      if (imported.kind === "nonliteral_dynamic") {
        const observed = observedNonLiteralDispatches.get(logicalPath) ?? 0;
        observedNonLiteralDispatches.set(logicalPath, observed + 1);
        continue;
      }
      const targets = language === "javascript"
        ? resolveJavascriptImport(root, logicalPath, imported.specifier)
        : resolvePythonImport(root, logicalPath, imported);
      if (targets.length === 0) {
        if (!isProjectRelative(imported.specifier)) {
          externalModules.add(imported.specifier.replace(/^node:/u, "node:"));
        }
        continue;
      }
      for (const target of targets) {
        edges.push({
          from: logicalPath,
          to: target,
          kind: imported.kind,
          specifier: imported.specifier,
        });
        if (imported.kind === "dynamic_literal") literalDynamicTargets.add(target);
        if (!nodes.has(target) && !processed.has(target)) pending.push(target);
      }
      pending.sort();
    }
  }

  for (const edge of edges) {
    const target = nodes.get(edge.to);
    assert.ok(target, `program graph import target was not materialized: ${edge.to}`);
    target.importedBy.add(edge.from);
  }
  const explicitSuccessorPaths = new Set(successors.map((item) => item.path));
  for (const target of literalDynamicTargets) {
    assert.equal(explicitSuccessorPaths.has(target), true,
      `literal dynamic import is not declared as a dynamic successor: ${target}`);
  }
  const dispatchByImporter = new Map(dispatches.map((item) => [item.importer.path, item]));
  for (const [importer, count] of observedNonLiteralDispatches) {
    const declaration = dispatchByImporter.get(importer);
    assert.ok(declaration,
      `non-literal dynamic import is not declared: ${importer}`);
    assert.equal(declaration.siteCount, count,
      `non-literal dynamic import site count changed: ${importer}`);
  }
  for (const declaration of dispatches) {
    assert.equal(observedNonLiteralDispatches.get(declaration.importer.path),
      declaration.siteCount,
    `declared non-literal dynamic dispatch is absent: ${declaration.importer.path}`);
  }

  const files = [...nodes.values()].map((value) => ({
    role: [...(rootByPath.get(value.path) ?? [])].sort()[0]
      ?? "transitive_dependency",
    path: value.path,
    sha256: value.sha256,
    byteSize: value.byteSize,
    language: value.language,
    importedBy: [...value.importedBy].sort(),
  })).sort(comparePath);
  const normalizedEdges = uniqueBy(edges, (edge) => JSON.stringify(edge))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const core = {
    schemaVersion: AI_PAINTER_PROGRAM_GRAPH_SCHEMA,
    status: "immutable_program_graph_verified",
    graphId,
    entrypoints: roots,
    dynamicSuccessors: successors,
    nonLiteralDynamicDispatches: dispatches,
    files,
    imports: normalizedEdges,
    externalModules: [...externalModules].sort(),
    fileCount: files.length,
    importEdgeCount: normalizedEdges.length,
    ownerAuthorizationRequired: false,
  };
  return Object.freeze({
    ...core,
    graphContentSha256: sha256Canonical(core),
  });
}

export function validateAiPainterProgramGraphManifest({
  projectRoot = process.cwd(),
  manifestBinding,
  expectedGraphId = null,
  graphId = null,
  entrypoints = null,
  dynamicSuccessors = null,
  nonLiteralDynamicDispatches = null,
} = {}) {
  assert.ok(manifestBinding?.path && manifestBinding?.sha256,
    "program graph manifest binding is missing");
  const rebound = bindProjectFile(projectRoot,
    manifestBinding.path, manifestBinding.sha256);
  const manifest = readJsonObject(resolveProjectPath(projectRoot,
    rebound.path, { mustExist: true, kind: "file" }));
  assert.equal(manifest.schemaVersion, AI_PAINTER_PROGRAM_GRAPH_SCHEMA,
    "program graph manifest schema mismatch");
  const requiredGraphId = graphId ?? expectedGraphId;
  if (requiredGraphId !== null) {
    assert.equal(manifest.graphId, requiredGraphId,
      "program graph manifest identity mismatch");
  }
  const useDeclaredProfile = entrypoints !== null
    || dynamicSuccessors !== null
    || nonLiteralDynamicDispatches !== null;
  const rebuilt = buildAiPainterProgramGraphManifest({
    projectRoot,
    graphId: manifest.graphId,
    entrypoints: useDeclaredProfile ? entrypoints
      : manifest.entrypoints?.map(({ role, path: value, language }) => ({
          role, path: value, language,
        })),
    dynamicSuccessors: useDeclaredProfile ? dynamicSuccessors
      : manifest.dynamicSuccessors?.map(
          ({ role, path: value, language }) => ({ role, path: value, language }),
        ),
    nonLiteralDynamicDispatches: useDeclaredProfile
      ? nonLiteralDynamicDispatches
      : manifest.nonLiteralDynamicDispatches?.map(
          ({ role, importer, targets, siteCount }) => ({
            role,
            importerPath: importer.path,
            targetPaths: targets.map((target) => target.path),
            siteCount,
          }),
        ),
  });
  assert.deepEqual(manifest, rebuilt,
    "program graph manifest differs from the current import closure");
  return Object.freeze({ manifest: Object.freeze(manifest), binding: rebound });
}

function stage4V2GraphDefinition({ graphId, programLineage }) {
  assert.ok(programLineage && typeof programLineage === "object"
    && !Array.isArray(programLineage),
  "Stage4 V2 program lineage is missing");
  const entrypoints = Object.entries(programLineage).map(([role, binding]) => ({
    role,
    path: binding?.path,
  }));
  return {
    graphId,
    entrypoints,
    dynamicSuccessors: [
      { role: "qualificationContinuationRuntime", path: QUALIFICATION_CONTINUATION_PATH },
      { role: "autonomousClosedLoopRuntime", path: AUTONOMOUS_CLOSED_LOOP_PATH },
      { role: "controlledSmokePhaseAdapter", path: SMOKE_ADAPTER_PATH },
      { role: "controlledSmokePlanner", path: SMOKE_PLANNER_PATH },
      { role: "controlledSmokeBackgroundLauncher", path: SMOKE_BACKGROUND_LAUNCHER_PATH },
      { role: "controlledSmokeChildRunner", path: SMOKE_CHILD_RUNNER_PATH },
      { role: "controlledSmokeFormalPlanner", path: SMOKE_FORMAL_PLANNER_PATH },
      { role: "controlledSmokeFormalExecutor", path: SMOKE_FORMAL_EXECUTOR_PATH },
      { role: "controlledSmokeFailureAdjudicator", path: SMOKE_FAILURE_ADJUDICATOR_PATH },
      { role: "qualificationFailureAdjudicator", path: QUALIFICATION_FAILURE_ADJUDICATOR_PATH },
    ],
    nonLiteralDynamicDispatches: [
      {
        role: "qualificationContinuationDispatch",
        importerPath: QUALIFICATION_CONTINUATION_PATH,
        targetPaths: [
          SMOKE_PLANNER_PATH,
          SMOKE_BACKGROUND_LAUNCHER_PATH,
          QUALIFICATION_FAILURE_ADJUDICATOR_PATH,
        ],
        siteCount: 1,
      },
      {
        role: "closedLoopPhaseAdapterDispatch",
        importerPath: AUTONOMOUS_CLOSED_LOOP_PATH,
        targetPaths: [SMOKE_ADAPTER_PATH],
        siteCount: 1,
      },
    ],
  };
}

function normalizeRoots(root, entries, label) {
  assert.ok(Array.isArray(entries) && entries.length > 0,
    `program graph ${label}s are missing`);
  const roles = new Set();
  const values = entries.map((entry) => {
    assert.match(entry?.role ?? "", SAFE_ROLE,
      `program graph ${label} role is invalid`);
    assert.equal(roles.has(entry.role), false,
      `program graph ${label} role is duplicated: ${entry.role}`);
    roles.add(entry.role);
    const binding = bindProjectFile(root, normalizeLogicalPath(root, entry.path));
    const language = entry.language ?? languageFor(binding.path);
    assert.equal(language, languageFor(binding.path),
      `program graph ${label} language mismatch: ${binding.path}`);
    return Object.freeze({ role: entry.role, ...binding, language });
  });
  return values.sort((left, right) => left.role.localeCompare(right.role));
}

function normalizeDispatches(root, values) {
  assert.ok(Array.isArray(values),
    "program graph non-literal dynamic dispatches are invalid");
  const roles = new Set();
  return values.map((value) => {
    assert.match(value?.role ?? "", SAFE_ROLE,
      "program graph dynamic dispatch role is invalid");
    assert.equal(roles.has(value.role), false,
      `program graph dynamic dispatch role is duplicated: ${value.role}`);
    roles.add(value.role);
    assert.ok(Number.isInteger(value.siteCount) && value.siteCount > 0,
      "program graph dynamic dispatch site count is invalid");
    const importer = bindProjectFile(root,
      normalizeLogicalPath(root, value.importerPath));
    assert.ok(Array.isArray(value.targetPaths) && value.targetPaths.length > 0,
      "program graph dynamic dispatch targets are missing");
    const targets = value.targetPaths.map((target) => bindProjectFile(
      root, normalizeLogicalPath(root, target),
    )).sort(comparePath);
    return Object.freeze({
      role: value.role,
      importer,
      targets,
      siteCount: value.siteCount,
    });
  }).sort((left, right) => left.role.localeCompare(right.role));
}

function parseJavascriptImports(source, logicalPath) {
  const values = [];
  let tree;
  try {
    tree = acorn.parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowHashBang: true,
    });
  } catch (error) {
    throw new Error(`program graph JavaScript AST parse failed: ${logicalPath}: ${error.message}`);
  }
  walkJavascriptAst(tree, (node) => {
    if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"]
      .includes(node.type) && typeof node.source?.value === "string") {
      values.push({ kind: "static", specifier: node.source.value });
      return;
    }
    if (node.type === "ImportExpression") {
      const literal = javascriptStaticString(node.source);
      values.push(literal === null
        ? { kind: "nonliteral_dynamic", specifier: `nonliteral:${logicalPath}` }
        : { kind: "dynamic_literal", specifier: literal });
      return;
    }
    if (node.type === "CallExpression"
      && node.callee?.type === "Identifier"
      && node.callee.name === "require") {
      const literal = node.arguments?.length === 1
        ? javascriptStaticString(node.arguments[0]) : null;
      values.push(literal === null
        ? { kind: "nonliteral_dynamic", specifier: `nonliteral:${logicalPath}` }
        : { kind: "commonjs_literal", specifier: literal });
    }
  });
  return values;
}

function javascriptStaticString(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral"
    && node.expressions?.length === 0
    && node.quasis?.length === 1) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}

function walkJavascriptAst(root, visit) {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    if (typeof node.type === "string") visit(node);
    for (const [key, value] of Object.entries(node)) {
      if (["start", "end", "loc", "range"].includes(key)) continue;
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index -= 1) {
          if (value[index] && typeof value[index] === "object") pending.push(value[index]);
        }
      } else if (value && typeof value === "object") pending.push(value);
    }
  }
}

function parsePythonImports(source, logicalPath, root) {
  const helper = resolveProjectPath(root, PYTHON_AST_HELPER_PATH, {
    mustExist: true,
    kind: "file",
  });
  const python = process.env.AI_PAINTER_PYTHON
    ?? (process.platform === "win32"
      && fs.existsSync(path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe"))
      ? path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
      : process.platform === "win32" ? "python" : "python3");
  const cacheKey = crypto.createHash("sha256")
    .update(fs.readFileSync(helper))
    .update("\0")
    .update(logicalPath)
    .update("\0")
    .update(source)
    .digest("hex");
  const cached = PYTHON_IMPORT_AST_CACHE.get(cacheKey);
  if (cached) return cached.map((item) => ({ ...item }));
  const result = spawnSync(python, [helper], {
    input: Buffer.from(JSON.stringify({ source, logicalPath }), "utf8"),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
  });
  assert.equal(result.status, 0,
    `program graph Python AST parse failed: ${logicalPath}: ${result.stderr || result.error?.message}`);
  const parsed = JSON.parse(result.stdout);
  assert.ok(Array.isArray(parsed),
    `program graph Python AST result is invalid: ${logicalPath}`);
  for (const item of parsed) {
    assert.ok(["python_static", "nonliteral_dynamic"].includes(item?.kind)
      && typeof item.specifier === "string" && item.specifier.length > 0,
    `program graph Python AST item is invalid: ${logicalPath}`);
  }
  PYTHON_IMPORT_AST_CACHE.set(cacheKey,
    parsed.map((item) => Object.freeze({ ...item })));
  return parsed.map((item) => ({ ...item }));
}

function resolveJavascriptImport(root, importer, specifier) {
  if (!specifier.startsWith(".")) return [];
  assert.equal(/[?#]/u.test(specifier), false,
    `program graph import query/fragment is forbidden: ${importer}`);
  const importerAbsolute = resolveProjectPath(root, importer,
    { mustExist: true, kind: "file" });
  const base = path.resolve(path.dirname(importerAbsolute), specifier);
  const candidates = [
    base,
    `${base}.mjs`,
    `${base}.js`,
    `${base}.json`,
    path.join(base, "index.mjs"),
    path.join(base, "index.js"),
  ];
  const target = candidates.find((candidate) => fs.existsSync(candidate)
    && fs.lstatSync(candidate).isFile()
    && !fs.lstatSync(candidate).isSymbolicLink());
  assert.ok(target, `program graph local import is missing: ${importer} -> ${specifier}`);
  return [normalizeLogicalPath(root, target)];
}

function resolvePythonImport(root, importer, imported) {
  const specifier = imported.specifier;
  const importerAbsolute = resolveProjectPath(root, importer,
    { mustExist: true, kind: "file" });
  const moduleParts = specifier.replace(/^\.+/u, "").split(".").filter(Boolean);
  const leadingDots = specifier.match(/^\.+/u)?.[0].length ?? 0;
  const bases = [];
  if (leadingDots > 0) {
    let base = path.dirname(importerAbsolute);
    for (let index = 1; index < leadingDots; index += 1) base = path.dirname(base);
    bases.push(path.join(base, ...moduleParts));
  } else {
    bases.push(path.join(root, "ml", "ai-painter", "scripts", ...moduleParts));
    bases.push(path.join(root, "ml", "ai-painter", "src", ...moduleParts));
  }
  const resolved = [];
  for (const base of bases) {
    const file = `${base}.py`;
    const init = path.join(base, "__init__.py");
    if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
      resolved.push(normalizeLogicalPath(root, file));
      addPythonPackageInitializers(root, file, resolved);
      break;
    }
    if (fs.existsSync(init) && fs.lstatSync(init).isFile()) {
      resolved.push(normalizeLogicalPath(root, init));
      addPythonPackageInitializers(root, init, resolved);
      break;
    }
  }
  return [...new Set(resolved)].sort();
}

function addPythonPackageInitializers(root, target, output) {
  const sourceRoot = path.join(root, "ml", "ai-painter", "src");
  let directory = path.dirname(target);
  while (isInside(sourceRoot, directory) && directory !== sourceRoot) {
    const init = path.join(directory, "__init__.py");
    if (fs.existsSync(init) && fs.lstatSync(init).isFile()) {
      output.push(normalizeLogicalPath(root, init));
    }
    directory = path.dirname(directory);
  }
}

function normalizeLogicalPath(root, value) {
  assert.ok(typeof value === "string" && value.length > 0,
    "program graph path is missing");
  const absolute = path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(root, ...value.replaceAll("\\", "/").split("/"));
  assert.equal(isInside(root, absolute), true,
    `program graph path escapes project root: ${value}`);
  assert.equal(fs.existsSync(absolute), true,
    `program graph path is missing: ${value}`);
  assert.equal(fs.lstatSync(absolute).isSymbolicLink(), false,
    `program graph path cannot be a symbolic link: ${value}`);
  assert.equal(fs.lstatSync(absolute).isFile(), true,
    `program graph path is not a file: ${value}`);
  return path.relative(root, absolute).replaceAll("\\", "/");
}

function languageFor(logicalPath) {
  const extension = path.extname(logicalPath).toLowerCase();
  if (extension === ".py") return "python";
  if (extension === ".json") return "json";
  assert.equal(JS_EXTENSIONS.has(extension), true,
    `program graph file type is unsupported: ${logicalPath}`);
  return "javascript";
}

function isProjectRelative(specifier) {
  return specifier.startsWith(".") || specifier.startsWith("ai_painter")
    || specifier.startsWith("ai_painter_") || specifier.startsWith("train_ai_")
    || specifier.startsWith("run_stage4_") || specifier.startsWith("stage4_");
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function uniqueBy(values, selector) {
  return [...new Map(values.map((value) => [selector(value), value])).values()];
}

function comparePath(left, right) {
  return left.path.localeCompare(right.path);
}

function sha256Canonical(value) {
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
