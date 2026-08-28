import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const latestPath = path.join(root, "data/world-visual-data-dictionary/latest.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function hasDuplicate(values) {
  return new Set(values).size !== values.length;
}

const latest = await readJson(latestPath);
assert(latest.schemaVersion === "world-visual-data-dictionary-latest-pointer-v1", "invalid latest pointer schema");
assert(typeof latest.dictionaryPath === "string", "latest pointer must include dictionaryPath");

const dictionaryPath = resolveProjectPath(latest.dictionaryPath);
assert(await fileExists(dictionaryPath), `missing dictionary export: ${latest.dictionaryPath}`);

const dictionary = await readJson(dictionaryPath);
assert(dictionary.schemaVersion === "world-visual-data-dictionary-export-v1", "invalid dictionary export schema");
assert(dictionary.dictionaryVersionId === latest.dictionaryVersionId, "dictionary version mismatch");
assert(dictionary.status === "draft", "dictionary vocabulary status must remain draft until a machine-verified capability release binds it");
assert(Array.isArray(dictionary.entries), "entries must be an array");
assert(dictionary.entries.length >= 40, "dictionary should contain at least 40 entries after current expansion");
assert(!hasDuplicate(dictionary.entries.map((entry) => entry.id)), "entry ids must be unique");

for (const category of dictionary.requiredCategories) {
  assert(
    dictionary.entries.some((entry) => entry.category === category),
    `missing required category: ${category}`,
  );
}

for (const entry of dictionary.entries) {
  assert(entry.id === `${entry.category}/${entry.name}`, `entry id must match category/name: ${entry.id}`);
  assert(/^[a-z0-9-]+\/[a-z0-9-]+$/.test(entry.id), `entry id must be kebab-case path: ${entry.id}`);
  assert(
    entry.sourcePath.startsWith("data/world-visual-data-dictionary/source/") && entry.sourcePath.endsWith(`#${entry.id}`),
    `invalid structured source path: ${entry.id}`,
  );
  assert(entry.type, `entry must declare Type: ${entry.id}`);
  assert(entry.version, `entry must declare Version: ${entry.id}`);
}

assert(Array.isArray(dictionary.registeredFailureCodes), "registeredFailureCodes must be an array");
assert(dictionary.registeredFailureCodes.length >= 10, "failure-code registry is too small");
assert(!hasDuplicate(dictionary.registeredFailureCodes.map((item) => item.code)), "registered failure codes must be unique");

assert(Array.isArray(dictionary.trainingLabels), "trainingLabels must be an array");
assert(dictionary.trainingLabels.length >= 6, "training label registry is too small");
assert(!hasDuplicate(dictionary.trainingLabels.map((item) => item.label)), "training labels must be unique");

assert(
  Number.isInteger(dictionary.summary.unregisteredHardFailureCodeCount),
  "unregistered hard failure count must be recorded",
);

console.log("World visual data dictionary check passed");
console.log(`dictionaryVersionId=${dictionary.dictionaryVersionId}`);
console.log(`entries=${dictionary.entries.length}`);
console.log(`categories=${Object.keys(dictionary.summary.categories).length}`);
console.log(`registeredFailureCodes=${dictionary.registeredFailureCodes.length}`);
console.log(`hardFailureCodes=${dictionary.hardFailureCodes.length}`);
console.log(`unregisteredHardFailureCodes=${dictionary.unregisteredHardFailureCodes.length}`);
