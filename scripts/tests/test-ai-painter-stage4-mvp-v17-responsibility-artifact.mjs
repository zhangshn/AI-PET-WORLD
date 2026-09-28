// Cross-language fixture is produced by the real Python encoder in a fresh temp root.
import assert from "node:assert/strict"
import { after, test } from "node:test"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync, inflateSync } from "node:zlib"
import { decodeV17ResponsibilityArtifact } from "../lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v17-artifact-"))
after(() => {
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()))
  assert.ok(path.basename(temp).startsWith("v17-artifact-"))
  fs.rmSync(temp, { recursive: true, force: false })
})
const python = process.env.V17_CODEC_TEST_PYTHON || path.join(root, "ml/ai-painter/.venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
execFileSync(python, ["-B", path.join(root, "ml/ai-painter/tests/test_stage4_v17_responsibility_artifact.py"),
  "--emit-fixture", temp,
  path.join(root, "data/ai-painter/system-governance/stage4-mvp-structured-object-v17-review-pack-schema-v1.json")],
{ cwd: root, timeout: 120000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1",
  CUDA_VISIBLE_DEVICES: "", OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2" } })
const fixture = JSON.parse(fs.readFileSync(path.join(temp, "fixture.json"), "utf8"))
const schemaBytes = fs.readFileSync(path.join(temp, "interface.json"))
const archiveBytes = fs.readFileSync(path.join(temp, fixture.evidence.tensorArchive.path))
const raw = inflateSync(archiveBytes)
const roleSize = 8 * 192 * 256 * 4
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const decode = (overrides = {}) => decodeV17ResponsibilityArtifact({ ...fixture, schemaBytes,
  archiveBytes, ...overrides })
function modifiedArchive(bytes, updateRoleHashes = false) {
  const evidence = structuredClone(fixture.evidence)
  evidence.tensorArchive.sha256 = sha(bytes)
  if (updateRoleHashes) {
    const data = inflateSync(bytes)
    evidence.roleOrder.forEach((role, i) => {
      evidence.roleSha256[role] = sha(data.subarray(i * roleSize, (i + 1) * roleSize))
    })
  }
  return { archiveBytes: bytes, evidence }
}

test("real Python archive preserves every LE float32 CHW value and negative zero", () => {
  const result = decode()
  assert.deepEqual(result.tensorShapePerRole, [8, 192, 256])
  assert.deepEqual(result.roleOrder, fixture.evidence.roleOrder)
  result.roleOrder.forEach((role, roleIndex) => {
    const values = result.tensors[role]
    assert.equal(values.length, 8 * 192 * 256)
    assert.ok(Object.is(values[0], -0))
    for (let i = 1; i < values.length; i++) assert.equal(values[i], i / 1024 + roleIndex * 16)
  })
})

test("all seven identities require independently supplied matching expectations", () => {
  assert.throws(() => decode({ expectedIdentity: undefined }), /identity fields/)
  for (const key of Object.keys(fixture.expectedIdentity)) {
    const expectedIdentity = { ...fixture.expectedIdentity,
      [key]: key === "tick" ? 24 : ["worldId", "regionId"].includes(key) ? "other-world" : "d".repeat(64) }
    assert.throws(() => decode({ expectedIdentity }), /identity mismatch/, key)
    const missing = { ...fixture.expectedIdentity }
    delete missing[key]
    assert.throws(() => decode({ expectedIdentity: missing }), /identity fields/, key)
  }
  for (const [key, value] of [["regionId", ""], ["factHash", "not-a-sha"]])
    assert.throws(() => decode({ expectedIdentity: { ...fixture.expectedIdentity, [key]: value } }))
  for (const tick of [-1, 0.5, true, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => decode({ expectedIdentity: { ...fixture.expectedIdentity, tick } }), /tick/)
  }
})

test("interface hash and exact candidate pack version are bound", () => {
  assert.throws(() => decode({ schemaSha256: "0".repeat(64) }), /interface SHA/)
  assert.throws(() => decode({ candidatePackSchemaVersion: "old-v16" }), /pack schema/)
  assert.throws(() => decode({ schemaBytes: Buffer.concat([schemaBytes, Buffer.from(" ")]) }), /interface SHA/)
})

test("role order, shape, format, implementation mode and exact role hash map are checked", () => {
  for (const [key, value] of Object.entries({
    roleOrder: [...fixture.evidence.roleOrder].reverse(), tensorShapePerRole: [1, 8, 192, 256],
    tensorFormat: "other", responsibilityImplementationMode: "single_model",
    roleSha256: { ...fixture.evidence.roleSha256, extra: "0".repeat(64) },
  })) assert.throws(() => decode({ evidence: { ...fixture.evidence, [key]: value } }), undefined, key)
  const evidence = structuredClone(fixture.evidence)
  delete evidence.roleSha256[evidence.roleOrder[0]]
  assert.throws(() => decode({ evidence }), /keys differ/)
})

test("compressed hash, role hash, and swapped raw role slices are checked", () => {
  const corrupt = Buffer.from(archiveBytes)
  corrupt[corrupt.length - 1] ^= 1
  assert.throws(() => decode({ archiveBytes: corrupt }), /archive SHA/)
  const changed = Buffer.from(raw)
  changed.writeFloatLE(42, 0)
  assert.throws(() => decode(modifiedArchive(deflateSync(changed))), /role SHA/)
  const swapped = Buffer.concat([raw.subarray(roleSize, roleSize * 2), raw.subarray(0, roleSize),
    raw.subarray(roleSize * 2)])
  assert.throws(() => decode(modifiedArchive(deflateSync(swapped))), /role SHA/)
})

test("bounded decompression rejects short, oversized, truncated and trailing streams", () => {
  for (const bytes of [deflateSync(raw.subarray(0, raw.length - 4)),
    deflateSync(Buffer.concat([raw, Buffer.alloc(4)])), deflateSync(Buffer.concat([raw, raw])),
    archiveBytes.subarray(0, archiveBytes.length - 1),
    Buffer.concat([archiveBytes, Buffer.from("extra")]),
    Buffer.concat([archiveBytes, deflateSync(Buffer.from("second stream"))])]) {
    assert.throws(() => decode(modifiedArchive(bytes)))
  }
})

test("NaN and infinity are rejected even with recomputed matching hashes", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const changed = Buffer.from(raw)
    changed.writeFloatLE(value, 0)
    assert.throws(() => decode(modifiedArchive(deflateSync(changed), true)), /nonfinite/)
  }
})

test("archive binding requires exact keys and explicit project-relative path", () => {
  for (const value of ["../escape", "/absolute", "C:/absolute", "a\\b", "a:ads", "latest/file"]) {
    const evidence = structuredClone(fixture.evidence)
    evidence.tensorArchive.path = value
    assert.throws(() => decode({ evidence }), /path/)
  }
  const evidence = structuredClone(fixture.evidence)
  evidence.tensorArchive.extra = true
  assert.throws(() => decode({ evidence }), /keys differ/)
})
