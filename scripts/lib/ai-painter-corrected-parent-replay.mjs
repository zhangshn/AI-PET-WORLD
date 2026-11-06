import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const run = promisify(execFile)
const project = fs.realpathSync(fileURLToPath(new URL("../../", import.meta.url)))
const packageId = "stage4-src64-4c32aee371b5fcaaa36b316199c7e7560892af7c0a5b908cfd6a6d44b4f0e6f7"
const published = {
  path: `data/world-samples/ai-assisted-cold-start-dataset-packages/${packageId}/manifest.json`,
  sha256: "499daf40061da91ce1e367ee5c4e3493491b5e5c1701806d8c4246502e73cd23",
}
const entry = "scripts/build-ai-assisted-cold-start-dataset-package.mjs"
const requestSha = "9840bc46c6e63484e458b6e76e757b107438ffca1e3c521d5965a24c2d883812"
const requestPath = `.runtime/ai-painter/source-correction-publications/${requestSha}/verification-request.json`
const archiveRoot = "data/ai-painter/system-governance/document-baselines/"
const publicationArchive = path.posix.dirname(requestPath) + "/"
const historicalInputs = [
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", archiveRoot + "ai-painter-data-policy-1.10-66c537ce.txt",
    "66c537ceba18642698173c79d4f1d0aa2440cf6502ef6e5c6972402eb12b9448"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", archiveRoot + "review-storage-1.25-48d9b177.txt",
    "48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909"],
  ["data/world-samples/original-image-library/natural-home-v1/index.json",
    publicationArchive + "original-library-index-a9092022.json",
    "a90920224d7ed8c79f7530f600d9cc7ebe76f35aec0ce848c6ab73c8059bc7a4"],
  ["scripts/review-ai-assisted-cold-start-image.mjs", publicationArchive + "review-entry-ea46241f.mjs",
    "ea46241fc667795faa7685699cc0859a9838b7753e78dd36e42191551e4419dd"],
  ["scripts/run-ai-assisted-cold-start-review-pipeline.mjs", publicationArchive + "pipeline-entry-3206698a.mjs",
    "3206698a963fc0ea8318b7a460abe09f0daf1593b359564545da8b5ad563ff83"],
]
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const rawRead = fs.readFileSync.bind(fs)

function boundBytes(logical, expected) {
  assert(!logical.includes("\\") && !logical.includes(":") && logical.split("/").every(s => s && s !== "." && s !== ".."))
  const allowed = logical.startsWith(".runtime/") ? fs.realpathSync(path.join(project, ".runtime")) : project
  const file = fs.realpathSync(path.join(project, logical))
  const relative = path.relative(allowed, file)
  assert(relative && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))
  const bytes = rawRead(file)
  assert.equal(sha(bytes), expected, `historical binding differs: ${logical}`)
  return bytes
}

// Only the original, verification-only Node subprocess sees the historical inputs.
// Its original command checks absolute paths embedded in the edit receipt.
const fixedPreload = `--import=${import.meta.url}`
if (process.env.CORRECTED_PARENT_164_REPLAY === "1") {
  assert.equal(process.env.NODE_OPTIONS, fixedPreload)
  assert.equal(fs.realpathSync(process.cwd()), project)
  assert.deepEqual(process.argv.slice(1), [path.join(project, entry), "--source-correction", path.join(project, requestPath)])
  const manifest = JSON.parse(boundBytes(published.path, published.sha256))
  assert.equal(sha(rawRead(process.execPath)), manifest.identityPayload.nodeRuntime.sha256)
  for (const program of manifest.identityPayload.verifierPrograms) boundBytes(program.path, program.sha256)
  const request = boundBytes(requestPath, requestSha)
  assert.equal(JSON.parse(request).operation, "verify")
  const reads = new Map([[path.resolve(project, requestPath), request]])
  for (const [logical, archived, hash] of historicalInputs) {
    reads.set(path.resolve(project, logical), boundBytes(archived, hash))
  }
  fs.readFileSync = function readHistoricalDocument(file, options) {
    const bytes = typeof file === "string" && reads.get(path.resolve(file))
    if (!bytes) return rawRead(file, options)
    const encoding = typeof options === "string" ? options : options?.encoding
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes)
  }
}

// Run the original load_package, including its parent-chain checks, original
// Node review, reconstructed manifest, all four memberships and physical assets.
const loadPackage = `
import hashlib, json, sys
from pathlib import Path
root = Path.cwd()
sys.path.insert(0, str(root / "ml/ai-painter/src"))
from ai_painter.complete_world.split_release import load_package, bound_json, project_file
from ai_painter.complete_world import source_correction_release
historical = {}
for logical, archive, expected in json.loads(${JSON.stringify(JSON.stringify(historicalInputs))}):
    content = project_file(root, archive).read_bytes()
    if hashlib.sha256(content).hexdigest() != expected:
        raise ValueError("historical input changed: " + logical)
    historical[logical] = (expected, content)
# Original verify_with_node also checks the bytes via read_bound in Python.
# Keep both readers on exactly the same immutable snapshot for these paths.
read_bound = source_correction_release.read_bound
def historical_read(base, binding):
    snapshot = historical.get(binding["path"])
    if snapshot is None:
        return read_bound(base, binding)
    if binding["sha256"] != snapshot[0]:
        raise ValueError("different historical input requested")
    return snapshot[1]
source_correction_release.read_bound = historical_read
binding = json.loads(sys.stdin.read())
manifest, rows = load_package(root, binding)
source = bound_json(root, manifest["sourceIndex"])
if source["samples"] != rows:
    raise ValueError("reproduced source rows differ")
print(json.dumps({"id": manifest["packageId"], "rows": len(rows)}))
`

export async function verifyPublishedCorrectionParent({root, binding}) {
  assert.equal(fs.realpathSync(root), project, "historical parent must use the original repository")
  assert.equal(binding?.path, published.path, "unsupported published correction parent path")
  assert.equal(binding.sha256, published.sha256, "unsupported published correction parent SHA")
  const raw = boundBytes(published.path, published.sha256)
  if (binding.bytes !== undefined) assert.equal(binding.bytes, raw.length, "published parent size differs")
  const manifest = JSON.parse(raw)
  const identity = manifest.identityPayload
  function verifyInputs() {
    assert.equal(fs.realpathSync(process.execPath), fs.realpathSync(identity.nodeRuntime.path))
    assert.equal(sha(rawRead(process.execPath)), identity.nodeRuntime.sha256)
    for (const file of identity.verifierPrograms) boundBytes(file.path, file.sha256)
    for (const file of identity.verification.inputBindings) {
      const historical = historicalInputs.find(([logical]) => logical === file.path)
      if (historical) assert.equal(historical[2], file.sha256)
      boundBytes(historical ? historical[1] : file.path, file.sha256)
    }
    assert.deepEqual(identity.verificationRequest, {path: requestPath, sha256: requestSha})
    assert.equal(JSON.parse(boundBytes(requestPath, requestSha)).operation, "verify")
  }
  verifyInputs()
  const env = {}
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"]) {
    if (process.env[key]) env[key] = process.env[key]
  }
  env.PATH = path.dirname(process.execPath) + path.delimiter + (process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32") : "/usr/bin")
  Object.assign(env, {NODE_OPTIONS: fixedPreload, CORRECTED_PARENT_164_REPLAY: "1", UV_THREADPOOL_SIZE: "2",
    CUDA_VISIBLE_DEVICES: "", OMP_NUM_THREADS: "1", MKL_NUM_THREADS: "1"})
  const python = path.join(project, "ml/ai-painter/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
  const job = run(python, ["-I", "-B", "-X", "utf8", "-c", loadPackage], {
    cwd: project, env, timeout: 120000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  })
  job.child.stdin.on("error", () => {}) // Process/launch errors are delivered by the awaited job.
  job.child.stdin.end(JSON.stringify(published))
  const {stdout} = await job
  assert.deepEqual(JSON.parse(stdout), {id: packageId, rows: 64})
  verifyInputs()
  boundBytes(published.path, published.sha256)
  const source = JSON.parse(boundBytes(manifest.sourceIndex.path, manifest.sourceIndex.sha256))
  return {manifest, source}
}
