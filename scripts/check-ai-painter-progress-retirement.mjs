import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyUiRoot = path.join(projectRoot, "src", "app", "ai-painter-progress");
const redirectPath = path.join(legacyUiRoot, "[[...legacyPath]]", "page.tsx");
const sharedTypesPath = path.join(projectRoot, "src", "server", "ai-painter-current-training-types.ts");
const currentTrainingServerPath = path.join(projectRoot, "src", "server", "ai-painter-current-training.ts");
const localTaskServerPath = path.join(projectRoot, "src", "server", "ai-painter-local-task-console.ts");
const sharedApiRoot = path.join(projectRoot, "src", "app", "api", "ai-painter");

function listFiles(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

assert.ok(fs.existsSync(redirectPath), "retired legacy route must keep one compatibility redirect");
assert.deepEqual(
  listFiles(legacyUiRoot).map((value) => path.relative(projectRoot, value).split(path.sep).join("/")),
  ["src/app/ai-painter-progress/[[...legacyPath]]/page.tsx"],
  "legacy UI tree must contain only the compatibility redirect",
);

const redirectSource = fs.readFileSync(redirectPath, "utf8");
assert.match(redirectSource, /permanentRedirect\(["']\/ai-console["']\)/u);
assert.doesNotMatch(redirectSource, /api\/ai-painter|current-training|\.runtime|data\/ai-painter/u);

assert.ok(fs.existsSync(sharedTypesPath), "server-owned training snapshot types must exist");
for (const serverPath of [currentTrainingServerPath, localTaskServerPath]) {
  const source = fs.readFileSync(serverPath, "utf8");
  assert.match(source, /@\/server\/ai-painter-current-training-types/u);
  assert.doesNotMatch(source, /@\/app\/ai-painter-progress/u);
}

assert.ok(fs.existsSync(sharedApiRoot), "shared AI Painter APIs must remain available for non-retired consumers");
for (const requiredApi of [
  "assets/[assetId]/[view]/route.ts",
  "candidate-reviews/route.ts",
  "quality-samples/[sampleId]/image/route.ts",
]) {
  assert.ok(fs.existsSync(path.join(sharedApiRoot, ...requiredApi.split("/"))), `shared API removed: ${requiredApi}`);
}

console.log("ai-painter-progress retirement: passed");
