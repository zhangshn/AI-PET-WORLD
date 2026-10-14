import assert from "node:assert/strict"
import fs from "node:fs"
import { spawnSync } from "node:child_process"

const read = (file) => fs.readFileSync(file, "utf8")
const createRoute = read("src/app/api/world/create/route.ts")
const tickRoute = read("src/app/api/world/tick/route.ts")
const generateRoute = read("src/app/api/world/visual/generate/route.ts")
const judgeRoute = read("src/app/api/world/visual/judge/route.ts")
const createPage = read("src/app/create-world/create-world-route-page.tsx")
const creationRuntime = read("src/world/creation/world-creation-runtime.ts")
const runtimeGateway = read("src/world/runtime/world-runtime-gateway.ts")
const runtimeGate = read("src/world/world-visual-painter/runtime-frame/runtime-frame-gate.ts")
const worldPage = read("src/app/world/world-live-runtime-page.tsx")
const imageRoute = read("src/app/api/world/game-map-runtime-frame/image/route.ts")

for (const [name, source] of Object.entries({ createRoute, tickRoute, generateRoute, judgeRoute })) {
  assert.match(source, /verifyLocalOperatorMutation/u, `${name} must use the local operator session`)
  assert.doesNotMatch(source, /claimOwnerWriteAuthorization/u, `${name} must not require per-request Owner signing`)
}
assert.match(createPage, /api\/ai-console\/control\/session/u)
assert.match(createPage, /X-AI-Console-CSRF/u)
assert.match(creationRuntime, /worldInstanceId/u)
assert.match(runtimeGateway, /randomUUID\(\)/u)
assert.doesNotMatch(worldPage, /readOwnerRuntimeFrameReviewGate/u)
assert.doesNotMatch(imageRoute, /owner_review_game_map_runtime_frame/u)
assert.doesNotMatch(runtimeGate, /owner_final_world_approval_missing/u)

// Keep source-contract assertions, but do not let them stand in for behavior.
// The actual adapters/Gateway/tick/frame store execute only against closed,
// private CPU fixtures. This does not certify production or network exposure.
const behavior = spawnSync(process.execPath, [
  "--test", "--test-concurrency=1", "--test-timeout=230000", "--test-reporter=tap",
  "scripts/tests/world-runtime-store-consistency.test.mjs",
  "scripts/tests/world-runtime-tick-continuity.test.mjs",
  "scripts/tests/world-runtime-gateway-read-failure.test.mjs",
  "scripts/tests/game-map-runtime-frame-store-consistency.test.mjs",
], { cwd: process.cwd(), windowsHide: true, encoding: "utf8", timeout: 240000, maxBuffer: 8388608,
  env: { ...process.env, OMP_NUM_THREADS: "2", UV_THREADPOOL_SIZE: "2" } })
if (behavior.stdout) process.stdout.write(behavior.stdout)
if (behavior.stderr) process.stderr.write(behavior.stderr)
assert.equal(behavior.error, undefined, behavior.error?.message)
assert.equal(behavior.status, 0, "private runtime behavioral integration failed")
const behavioralTests = Number(behavior.stdout.match(/^# tests (\d+)$/m)?.[1] ?? 0)
assert.ok(behavioralTests > 0)
assert.match(behavior.stdout, /^# fail 0$/m)
assert.match(behavior.stdout, /^# skipped 0$/m)

process.stdout.write(`${JSON.stringify({
  status: "passed",
  normalWorldMutations: ["create", "tick", "visual_generate", "visual_judge"],
  authorization: "loopback_local_operator_session_with_csrf",
  ownerPerRequestAuthorization: false,
  worldIdentity: "birth_seed_plus_server_world_instance",
  worldDisplayGate: "machine_review_and_runtime_frame",
  behavioralTests,
  behaviorScope: "private_cpu_runtime_adapters_gateway_tick_frame_store",
  networkPeerVerified: false,
  productionDeploymentVerified: false,
  fullMvpAccepted: false,
}, null, 2)}\n`)
