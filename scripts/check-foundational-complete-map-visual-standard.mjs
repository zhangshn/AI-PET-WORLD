import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { validateFoundationalCompleteMapVisualStandard } from "./lib/foundational-complete-map-visual-standard.mjs"

const ROOT = process.cwd()
const pointerPath = path.join(ROOT, ".runtime", "ai-painter", "foundational-complete-map-visual-standards", "latest.json")
assert(fs.existsSync(pointerPath), "latest foundational complete-map visual standard pointer is missing")
const pointer = readJson(pointerPath)
assert(pointer.standardPath, "latest foundational standard path is missing")
const standardPath = resolveProjectPath(pointer.standardPath)
assert(fs.existsSync(standardPath), "foundational complete-map visual standard file is missing")
const standard = readJson(standardPath)
const validation = validateFoundationalCompleteMapVisualStandard(standard)
assert(validation.passed, `foundational complete-map visual standard failed: ${validation.issues.join(",")}`)
assert(pointer.standardId === standard.standardId, "foundational visual standard pointer identity mismatch")
assert(pointer.inputSha256 === standard.inputSha256, "foundational visual standard pointer input hash mismatch")

console.log(JSON.stringify({
  status: "passed",
  standardId: standard.standardId,
  standardPath: projectPath(standardPath),
  standardSha256: crypto.createHash("sha256").update(fs.readFileSync(standardPath)).digest("hex"),
  sourceRecordCount: standard.sourceRecordCount,
  historicalCompleteMapRgbReferenceCount: standard.historicalCompleteMapRgbReferenceCount,
  generatorProfileContainsHistoricalImagePath: false,
}, null, 2))

function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`); return resolved }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function assert(condition, message) { if (!condition) throw new Error(message) }
