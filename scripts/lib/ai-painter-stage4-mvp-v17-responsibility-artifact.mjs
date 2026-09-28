// Pure byte/identity verification. No filesystem, registry or qualification writes.
// Caller supplies trusted interface/identity bindings and reads the logical archive
// path. Successful decoding proves byte/identity consistency, never eligibility.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { inflateSync } from "node:zlib"

const INTERFACE_ID = "stage4-mvp-structured-object-v17-review-pack-schema-v1"
const FORMAT = "zlib_compressed_float32_le_chw_concat_v1"
const IDENTITIES = ["worldId", "regionId", "tick", "factHash", "visualFactManifestSha256",
  "conditionPackSha256", "modelStateSha256"]
const ROLES = ["terrain_path_ground", "terrain_water", "terrain_shoreline",
  "object_footprints", "object_tree", "object_rock", "object_vegetation"]
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const validSha = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
const object = value => value !== null && typeof value === "object" && !Array.isArray(value)
function exactKeys(value, keys, label) {
  assert.ok(object(value), `${label} must be an object`)
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} keys differ`)
}
function identity(value) {
  assert.ok(object(value) && IDENTITIES.every(key => Object.hasOwn(value, key)), "identity fields missing")
  assert.ok(typeof value.worldId === "string" && value.worldId.trim(), "invalid worldId")
  assert.ok(typeof value.regionId === "string" && value.regionId.trim(), "invalid regionId")
  assert.ok(Number.isSafeInteger(value.tick) && value.tick >= 0, "invalid tick")
  assert.ok(IDENTITIES.slice(3).every(key => validSha(value[key])), "invalid identity SHA-256")
  return Object.fromEntries(IDENTITIES.map(key => [key, value[key]]))
}
function archivePath(value) {
  assert.ok(typeof value === "string" && value && !/[\\:\x00-\x1f]/u.test(value)
    && value.split("/").every(part => !["", ".", "..", "latest", "latest.json"].includes(part)),
  "archive path must be explicit project-relative")
}

export function loadV17ResponsibilityInterface({ schemaBytes, schemaSha256, candidatePackSchemaVersion }) {
  assert.ok(Buffer.isBuffer(schemaBytes) && validSha(schemaSha256)
    && sha(schemaBytes) === schemaSha256, "interface SHA-256 mismatch")
  const schema = JSON.parse(schemaBytes.toString("utf8"))
  assert.equal(schema.schemaVersion, INTERFACE_ID, "unsupported interface")
  assert.equal(typeof candidatePackSchemaVersion, "string")
  assert.equal(schema.candidatePackSchemaVersion, candidatePackSchemaVersion, "candidate pack schema mismatch")
  assert.ok(Array.isArray(schema.requiredResponsibilityIds))
  assert.deepEqual([...schema.requiredResponsibilityIds].sort(), [...ROLES].sort(), "interface roles differ")
  const spec = schema.responsibilityEvidence
  assert.ok(IDENTITIES.every(key => spec.requiredFields.includes(key)), "interface identity fields missing")
  assert.equal(spec.tensorFormat, FORMAT)
  assert.deepEqual(spec.tensorShapePerRole, [8, 192, 256])
  assert.equal(spec.responsibilityImplementationMode, "declared_shared_substrate")
  assert.equal(spec.roleSha256Rule, "sha256_of_each_uncompressed_float32_le_chw_role_slice")
  assert.equal(spec.archiveRule, "decompress_then_verify_exact_size_order_and_each_role_sha256")
  return schema
}

export function decodeV17ResponsibilityArtifact({ archiveBytes, evidence, expectedIdentity,
  schemaBytes, schemaSha256, candidatePackSchemaVersion }) {
  const schema = loadV17ResponsibilityInterface({ schemaBytes, schemaSha256, candidatePackSchemaVersion })
  const spec = schema.responsibilityEvidence
  const roles = schema.requiredResponsibilityIds
  assert.ok(object(evidence) && spec.requiredFields.every(key => Object.hasOwn(evidence, key)),
    "responsibility evidence fields missing")
  assert.deepEqual(identity(evidence), identity(expectedIdentity), "responsibility identity mismatch")
  for (const key of ["tensorFormat", "tensorShapePerRole", "responsibilityImplementationMode"])
    assert.deepEqual(evidence[key], spec[key], `${key} differs`)
  assert.deepEqual(evidence.roleOrder, roles, "role order differs")
  exactKeys(evidence.roleSha256, roles, "role SHA-256 map")
  assert.ok(Object.values(evidence.roleSha256).every(validSha), "invalid role SHA-256")
  exactKeys(evidence.tensorArchive, ["path", "sha256"], "archive binding")
  archivePath(evidence.tensorArchive.path)
  assert.ok(Buffer.isBuffer(archiveBytes) && validSha(evidence.tensorArchive.sha256)
    && sha(archiveBytes) === evidence.tensorArchive.sha256, "archive SHA-256 mismatch")
  const roleSize = 8 * 192 * 256 * 4
  const expectedSize = roles.length * roleSize
  const inflated = inflateSync(archiveBytes, { maxOutputLength: expectedSize + 1, info: true })
  const raw = inflated.buffer
  assert.equal(raw.length, expectedSize, "archive uncompressed size differs")
  assert.equal(inflated.engine.bytesWritten, archiveBytes.length, "trailing compressed bytes")
  const tensors = Object.create(null)
  for (const [index, role] of roles.entries()) {
    const part = raw.subarray(index * roleSize, (index + 1) * roleSize)
    assert.equal(sha(part), evidence.roleSha256[role], `role SHA-256 mismatch: ${role}`)
    const values = new Float32Array(roleSize / 4)
    for (let i = 0; i < values.length; i++) {
      const value = part.readFloatLE(i * 4)
      assert.ok(Number.isFinite(value), `nonfinite archive tensor: ${role}`)
      values[i] = value
    }
    tensors[role] = values
  }
  return { roleOrder: [...roles], tensorShapePerRole: [...spec.tensorShapePerRole], tensors }
}
