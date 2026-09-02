import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  authorizationBinding,
  canonicalJson,
  consumeOwnerAuthorization,
  OwnerAuthorizationCoreError,
  verifyOwnerAuthorization,
} from "../src/server/project-owner-authorization-core.mjs"
import { evaluateV7TrainingGpuResourceGate } from "./lib/ai-assisted-v7-training-resource-gate.mjs"

const root = process.cwd()
const routeRoot = path.join(root, "src", "app", "api")
const allowedReadOnlyMutationHandlers = new Set([
  "src/app/api/ziwei/full-chart/route.ts",
])
const expectedAuthorizedRoutes = new Map([
  ["src/app/api/ai-painter/candidate-reviews/route.ts", "ai_painter.candidate_review"],
  ["src/app/api/ai-painter/original-images/[categoryId]/[recordId]/owner-review/route.ts", "ai_painter.original_image.owner_review"],
  ["src/app/api/ai-painter/training-control/route.ts", "ai_painter.training_control."],
])
const localOperatorRoutes = new Set([
  "src/app/api/world/create/route.ts",
  "src/app/api/world/tick/route.ts",
  "src/app/api/world/visual/generate/route.ts",
  "src/app/api/world/visual/judge/route.ts",
])

const mutationRoutes = listFiles(routeRoot)
  .filter((file) => /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/u.test(fs.readFileSync(file, "utf8")))
  .map((file) => path.relative(root, file).replaceAll("\\", "/"))
  .sort()

assert.deepEqual(
  mutationRoutes,
  [...expectedAuthorizedRoutes.keys(), ...localOperatorRoutes, ...allowedReadOnlyMutationHandlers].sort(),
  "Every mutation-shaped API handler must be explicitly classified",
)

for (const [route, action] of expectedAuthorizedRoutes) {
  const source = fs.readFileSync(path.join(root, route), "utf8")
  assert.match(source, /claimOwnerWriteAuthorization\s*\(/u, `${route} must claim Owner authorization`)
  assert.ok(source.includes(action), `${route} must bind action ${action}`)
  assert.match(source, /target:\s*\{/u, `${route} must bind a concrete target`)
  assert.match(source, /payload:\s*/u, `${route} must bind the write payload`)
}

for (const route of localOperatorRoutes) {
  const source = fs.readFileSync(path.join(root, route), "utf8")
  assert.match(source, /verifyLocalOperatorMutation\s*\(/u, `${route} must verify the local operator session`)
  assert.doesNotMatch(source, /claimOwnerWriteAuthorization\s*\(/u, `${route} must not require a per-request Owner authorization`)
}

const readOnlyZiwei = fs.readFileSync(path.join(root, "src/app/api/ziwei/full-chart/route.ts"), "utf8")
assert.doesNotMatch(readOnlyZiwei, /\b(writeFile|appendFile|mkdir|rename|rm|unlink)\b/u)

const fullTraining = fs.readFileSync(path.join(root, "scripts/run-ai-assisted-v7-bounded-repair-r1-full-training.mjs"), "utf8")
const consumeIndex = fullTraining.indexOf("const authorizationConsumption = consumeFullTrainingAuthorization()")
const pythonPreflightIndex = fullTraining.indexOf("const pythonPreflight = runReadOnlyPythonPreflight()")
const preflightEventIndex = fullTraining.indexOf('appendEvent("training_preflight_started"')
assert.ok(consumeIndex > 0)
assert.ok(pythonPreflightIndex > 0 && pythonPreflightIndex < consumeIndex)
assert.ok(fullTraining.indexOf("if (preflightOnly)") > pythonPreflightIndex)
assert.ok(fullTraining.includes("fs.mkdtempSync(path.join(os.tmpdir()"))
assert.ok(fullTraining.includes('"--preflight-only"'))
assert.ok(consumeIndex < preflightEventIndex)
assert.ok(consumeIndex < fullTraining.indexOf("writeJson(derivedConfigPath"))
assert.ok(consumeIndex < fullTraining.indexOf("acquireFullTrainingLock()"))
assert.match(fullTraining, /status:\s*"read_only_preflight_passed"/u)
assert.match(fullTraining, /openSync\(AUTHORIZATION_CONSUMPTION_PATH,\s*"wx"\)/u)

const build = fs.readFileSync(path.join(root, "scripts/build-next-production.mjs"), "utf8")
const buildConsumeIndex = build.indexOf("consumeOwnerAuthorization(authorization")
const firstRuntimeRenameIndex = build.indexOf("fs.renameSync(runtimePath, holdPath)")
assert.ok(buildConsumeIndex > 0 && firstRuntimeRenameIndex > buildConsumeIndex)
assert.ok(build.lastIndexOf("try {", firstRuntimeRenameIndex) > buildConsumeIndex, "Runtime mutation must start inside try/finally")
assert.ok(build.indexOf("finally", firstRuntimeRenameIndex) > firstRuntimeRenameIndex)
assert.ok(build.includes('const buildAction = "platform.production_build"') && build.includes("action: buildAction"))
assert.ok(build.indexOf("prepareRuntimePlaceholder()") < firstRuntimeRenameIndex)
assert.ok(build.includes("entries.length === 0 || (entries.length === 1 && entries[0] === markerName)"))

const idleGpu = { available: true, pythonComputeProcessCount: 0, utilizationPercent: 0, memoryTotalMiB: 8151, memoryUsedMiB: 1000 }
assert.deepEqual(evaluateV7TrainingGpuResourceGate(idleGpu), [])
assert.ok(evaluateV7TrainingGpuResourceGate({ ...idleGpu, utilizationPercent: 100, memoryUsedMiB: 1000 }).includes("gpu_compute_busy_with_nontraining_workload"))
assert.ok(evaluateV7TrainingGpuResourceGate({ ...idleGpu, utilizationPercent: 0, memoryUsedMiB: 5000 }).includes("gpu_memory_busy_with_nontraining_workload"))
assert.ok(evaluateV7TrainingGpuResourceGate({ ...idleGpu, memoryTotalMiB: 6000, memoryUsedMiB: 2500 }).includes("gpu_free_memory_insufficient_for_v7_training"))

runCryptographicAuthorizationChecks()
console.log(`Project owner write authorization checks passed: ${expectedAuthorizedRoutes.size} write APIs enumerated; cryptographic, binding, one-time consumption, training and build contracts passed.`)

function runCryptographicAuthorizationChecks() {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-pet-owner-auth-check-"))
  try {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519")
    const registryPath = path.join(testRoot, "trust-registry.json")
    const registry = {
      schemaVersion: "project-owner-trust-registry-v1",
      status: "active",
      keys: [{
        keyId: "test-owner-key",
        status: "active",
        algorithm: "ed25519",
        publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
        allowedActions: ["world.create"],
        allowedScopes: ["world:test-world"],
      }],
    }
    fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8")
    const registrySha256 = sha256(fs.readFileSync(registryPath))
    const expectation = {
      action: "world.create",
      method: "POST",
      route: "/api/world/create",
      target: { worldId: "test-world" },
      payload: { ownerId: "owner-1", worldId: "test-world" },
    }
    const authorizationPath = writeAuthorization({ testRoot, privateKey, expectation, authorizationId: "valid-once" })
    const providedSha256 = sha256(fs.readFileSync(path.join(testRoot, authorizationPath)))
    const verified = verifyOwnerAuthorization({
      root: testRoot,
      authorizationPath,
      providedSha256,
      ownerCommandRef: "test-owner-command",
      scope: "world:test-world",
      expectation,
      trustRegistryPath: registryPath,
      trustRegistrySha256: registrySha256,
      now: new Date("2026-08-03T00:00:00.000Z"),
    })
    const consumptionPath = consumeOwnerAuthorization(verified, { root: testRoot })
    assert.ok(fs.existsSync(path.join(testRoot, consumptionPath)))
    assertCoreError(() => consumeOwnerAuthorization(verified, { root: testRoot }), "owner_authorization_already_consumed")

    const mismatchPath = writeAuthorization({ testRoot, privateKey, expectation, authorizationId: "binding-check" })
    const mismatchSha = sha256(fs.readFileSync(path.join(testRoot, mismatchPath)))
    assertCoreError(() => verifyOwnerAuthorization({
      root: testRoot,
      authorizationPath: mismatchPath,
      providedSha256: mismatchSha,
      ownerCommandRef: "test-owner-command",
      scope: "world:test-world",
      expectation: { ...expectation, target: { worldId: "different-world" } },
      trustRegistryPath: registryPath,
      trustRegistrySha256: registrySha256,
      now: new Date("2026-08-03T00:00:00.000Z"),
    }), "owner_authorization_binding_mismatch")
    assertCoreError(() => verifyOwnerAuthorization({
      root: testRoot,
      authorizationPath: mismatchPath,
      providedSha256: mismatchSha,
      ownerCommandRef: "test-owner-command",
      scope: "world:test-world",
      expectation: { ...expectation, payload: { ownerId: "attacker", worldId: "test-world" } },
      trustRegistryPath: registryPath,
      trustRegistrySha256: registrySha256,
      now: new Date("2026-08-03T00:00:00.000Z"),
    }), "owner_authorization_binding_mismatch")
    assertCoreError(() => verifyOwnerAuthorization({
      root: testRoot,
      authorizationPath: mismatchPath,
      providedSha256: mismatchSha,
      ownerCommandRef: "test-owner-command",
      scope: "world:test-world",
      expectation,
      trustRegistryPath: registryPath,
      trustRegistrySha256: "0".repeat(64),
      now: new Date("2026-08-03T00:00:00.000Z"),
    }), "owner_trust_registry_hash_mismatch")

    const forged = JSON.parse(fs.readFileSync(path.join(testRoot, mismatchPath), "utf8"))
    forged.signature.valueBase64 = Buffer.alloc(64, 7).toString("base64")
    fs.writeFileSync(path.join(testRoot, mismatchPath), `${JSON.stringify(forged, null, 2)}\n`, "utf8")
    assertCoreError(() => verifyOwnerAuthorization({
      root: testRoot,
      authorizationPath: mismatchPath,
      providedSha256: sha256(fs.readFileSync(path.join(testRoot, mismatchPath))),
      ownerCommandRef: "test-owner-command",
      scope: "world:test-world",
      expectation,
      trustRegistryPath: registryPath,
      trustRegistrySha256: registrySha256,
      now: new Date("2026-08-03T00:00:00.000Z"),
    }), "owner_signature_invalid")
    assertCoreError(() => verifyOwnerAuthorization({
      root: testRoot,
      authorizationPath: "../request.json",
      providedSha256: "0".repeat(64),
      ownerCommandRef: "test-owner-command",
      scope: "world:test-world",
      expectation,
      trustRegistryPath: registryPath,
      trustRegistrySha256: registrySha256,
    }), "owner_authorization_path_invalid")
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true })
  }
}

function writeAuthorization({ testRoot, privateKey, expectation, authorizationId }) {
  const unsigned = {
    schemaVersion: "project-owner-write-authorization-v2",
    authorizationId,
    status: "authorized",
    validFromUtc: "2026-08-02T00:00:00.000Z",
    expiresAtUtc: "2026-08-04T00:00:00.000Z",
    ownerDecision: { decision: "authorized", commandRef: "test-owner-command", scope: "world:test-world" },
    authorizedActions: [expectation.action],
    binding: authorizationBinding(expectation),
  }
  const authorization = {
    ...unsigned,
    signature: {
      algorithm: "ed25519",
      keyId: "test-owner-key",
      valueBase64: sign(null, Buffer.from(canonicalJson(unsigned), "utf8"), privateKey).toString("base64"),
    },
  }
  const relativePath = `.runtime/ai-painter/owner-action-requests/${authorizationId}/request.json`
  const absolutePath = path.join(testRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${JSON.stringify(authorization, null, 2)}\n`, "utf8")
  return relativePath
}

function assertCoreError(callback, expectedCode) {
  assert.throws(callback, (error) => error instanceof OwnerAuthorizationCoreError && error.code === expectedCode)
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(absolute) : [absolute]
  })
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}
