import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json";
const registry = JSON.parse(fs.readFileSync(path.join(root, registryPath), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.equal(registry.schemaVersion, "ai-painter-current-entrypoint-registry-v1");
assert.equal(registry.status, "active");
assert.equal(registry.normalAuthority, "local_ai_pet_world_program");
assert.equal(registry.ownerInNormalStateMachine, false);
assert.equal(registry.historicalIsolation.autonomousResolverMayInvokeUnregisteredEntrypoint, false);

const seen = new Set();
const results = [];
const enforcementFiles = new Set(registry.tokenEnforcementFiles ?? []);
for (const entry of registry.currentEntrypoints) {
  assert.ok(!seen.has(entry.packageScript), `duplicate current package script: ${entry.packageScript}`);
  seen.add(entry.packageScript);
  const command = packageJson.scripts?.[entry.packageScript];
  assert.equal(command, `node ${entry.entryFile}`, `current package entry mismatch: ${entry.packageScript}`);
  const absolute = path.resolve(root, entry.entryFile);
  assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`));
  assert.ok(fs.existsSync(absolute), `current entry file missing: ${entry.entryFile}`);
  const graph = collectImportGraph(absolute);
  for (const file of graph) {
    const source = fs.readFileSync(file, "utf8");
    const relativeFile = path.relative(root, file).replaceAll("\\", "/");
    if (enforcementFiles.has(relativeFile) || entry.role.endsWith("_regression")) continue;
    for (const token of registry.forbiddenCurrentSourceTokens) {
      assert.ok(!source.includes(token), `current entry graph contains forbidden token ${token}: ${path.relative(root, file)}`);
    }
  }
  results.push({ packageScript: entry.packageScript, entryFile: entry.entryFile, entrySha256: sha256File(absolute), graphFileCount: graph.size });
}

for (const relativeFile of enforcementFiles) {
  const source = fs.readFileSync(path.join(root, relativeFile), "utf8");
  assert.ok(/owner/i.test(source) && /(forbid|must not|=== false|!== true|reject)/i.test(source), `security enforcement file lacks Owner exclusion checks: ${relativeFile}`);
}

for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (name.startsWith("legacy:")) continue;
  if (/owner-(action|decision|authorization)|owner:(action|decision|authorization)|authorize:ai-painter/i.test(name)) {
    assert.fail(`historical Owner command is exposed without legacy namespace: ${name} -> ${command}`);
  }
}

process.stdout.write(`${JSON.stringify({ status: "passed", currentEntrypointCount: results.length, ownerRuntimeEntrypointCount: 0, results }, null, 2)}\n`);

function collectImportGraph(start) {
  const visited = new Set();
  const visit = (file) => {
    const resolved = path.resolve(file);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    const source = fs.readFileSync(resolved, "utf8");
    const importPattern = /(?:from\s+|import\s*\()?["'](\.\.?\/[^"']+)["']/g;
    for (const match of source.matchAll(importPattern)) {
      let target = path.resolve(path.dirname(resolved), match[1]);
      if (!path.extname(target)) target += ".mjs";
      if (fs.existsSync(target) && target.startsWith(`${path.resolve(root)}${path.sep}`)) visit(target);
    }
  };
  visit(start);
  return visited;
}
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
