import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  bindProjectFile,
  readJsonObject,
  resolveProjectPath,
} from "./ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const AI_PAINTER_PROGRAM_GRAPH_SCHEMA =
  "ai-painter-program-graph-manifest-v1";

const SAFE_ROLE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const JS_EXTENSIONS = new Set([".mjs", ".js", ".cjs", ".json"]);

export function buildAiPainterProgramGraphManifest({
  projectRoot = process.cwd(),
  graphId,
  entrypoints,
  dynamicSuccessors = [],
  nonLiteralDynamicDispatches = [],
} = {}) {
  const root = path.resolve(projectRoot);
  assert.match(graphId ?? "", SAFE_ROLE, "program graph identity is invalid");
  const roots = normalizeRoots(root, entrypoints, "entrypoint");
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
      : parsePythonImports(source, logicalPath);
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
} = {}) {
  assert.ok(manifestBinding?.path && manifestBinding?.sha256,
    "program graph manifest binding is missing");
  const rebound = bindProjectFile(projectRoot,
    manifestBinding.path, manifestBinding.sha256);
  const manifest = readJsonObject(resolveProjectPath(projectRoot,
    rebound.path, { mustExist: true, kind: "file" }));
  assert.equal(manifest.schemaVersion, AI_PAINTER_PROGRAM_GRAPH_SCHEMA,
    "program graph manifest schema mismatch");
  if (expectedGraphId !== null) {
    assert.equal(manifest.graphId, expectedGraphId,
      "program graph manifest identity mismatch");
  }
  const rebuilt = buildAiPainterProgramGraphManifest({
    projectRoot,
    graphId: manifest.graphId,
    entrypoints: manifest.entrypoints?.map(({ role, path: value, language }) => ({
      role, path: value, language,
    })),
    dynamicSuccessors: manifest.dynamicSuccessors?.map(
      ({ role, path: value, language }) => ({ role, path: value, language }),
    ),
    nonLiteralDynamicDispatches: manifest.nonLiteralDynamicDispatches?.map(
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
  const text = stripJavascriptComments(source);
  const values = [];
  const staticPattern = /\b(?:import|export)\s+(?:[\w*$\s{},]*?\s+from\s+)?["']([^"']+)["']/gu;
  for (const match of text.matchAll(staticPattern)) {
    values.push({ kind: "static", specifier: match[1] });
  }
  const dynamicPattern = /\bimport\s*\(\s*([^)]*?)\s*\)/gu;
  for (const match of text.matchAll(dynamicPattern)) {
    const expression = match[1].trim();
    const literal = /^(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')$/u.exec(expression);
    if (literal) {
      values.push({
        kind: "dynamic_literal",
        specifier: JSON.parse(literal[1] !== undefined
          ? `"${literal[1]}"`
          : `"${literal[2].replaceAll('"', '\\"')}"`),
      });
    } else {
      values.push({
        kind: "nonliteral_dynamic",
        specifier: `nonliteral:${logicalPath}`,
      });
    }
  }
  return values;
}

function parsePythonImports(source, logicalPath) {
  const values = [];
  const fromPattern = /^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gmu;
  for (const match of source.matchAll(fromPattern)) {
    values.push({ kind: "python_static", specifier: match[1] });
  }
  const importPattern = /^\s*import\s+([A-Za-z0-9_.,\s]+?)(?:\s+#.*)?$/gmu;
  for (const match of source.matchAll(importPattern)) {
    for (const item of match[1].split(",")) {
      const specifier = item.trim().split(/\s+as\s+/u)[0];
      if (specifier) values.push({ kind: "python_static", specifier });
    }
  }
  const dynamicCount = [
    /\bimportlib\.import_module\s*\(/gu,
    /\b__import__\s*\(/gu,
    /\bspec_from_file_location\s*\(/gu,
  ].reduce((total, pattern) => total + [...source.matchAll(pattern)].length, 0);
  for (let index = 0; index < dynamicCount; index += 1) {
    values.push({
      kind: "nonliteral_dynamic",
      specifier: `nonliteral:${logicalPath}`,
    });
  }
  return values;
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

function stripJavascriptComments(source) {
  let output = "";
  let quote = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (quote !== null) {
      output += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = null;
      continue;
    }
    if (["\"", "'", "`"].includes(current)) {
      quote = current;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < source.length
        && !(source[index] === "*" && source[index + 1] === "/")) {
        output += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      index += 1;
      continue;
    }
    output += current;
  }
  return output;
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
