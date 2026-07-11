import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const latestPath = path.join(root, ".runtime/world-visual-dictionary-trials/latest.json");

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
  return JSON.parse(await readFile(path.isAbsolute(filePath) ? filePath : path.join(root, filePath), "utf8"));
}

const latest = await readJson(latestPath);
assert(latest.schemaVersion === "world-visual-dictionary-trial-latest-pointer-v1", "invalid trial latest schema");
assert(await fileExists(path.join(root, latest.latestRecordPath)), "missing latest review record");
assert(await fileExists(path.join(root, latest.latestImagePath)), "missing latest stored image");

const record = await readJson(latest.latestRecordPath);
assert(record.schemaVersion === "world-visual-dictionary-trial-review-v1", "invalid review record schema");
assert(record.recordId === latest.latestRecordId, "latest pointer record id mismatch");
assert(record.dictionaryVersionId === latest.dictionaryVersionId, "dictionary version mismatch");
assert(record.ownerStatus === "pending", "trial record must wait for owner review");
assert(record.canPromoteToWorld === false, "trial record must not promote to world directly");
assert(Array.isArray(record.failureCodes), "failureCodes must be an array");
assert(record.failureCodes.length >= 1, "trial review must record at least one review code");
assert(record.imageHash && record.imageHash.length === 64, "stored image hash is required");
assert(record.imageMetrics.width > 0 && record.imageMetrics.height > 0, "image metrics must include dimensions");

console.log("World visual dictionary trial review check passed");
console.log(`recordId=${record.recordId}`);
console.log(`machineStatus=${record.machineStatus}`);
console.log(`trainingEligibility=${record.trainingEligibility}`);
console.log(`failureCodes=${record.failureCodes.join(",")}`);
