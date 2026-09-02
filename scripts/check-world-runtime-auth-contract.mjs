import assert from "node:assert/strict"
import fs from "node:fs"

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

process.stdout.write(`${JSON.stringify({
  status: "passed",
  normalWorldMutations: ["create", "tick", "visual_generate", "visual_judge"],
  authorization: "loopback_local_operator_session_with_csrf",
  ownerPerRequestAuthorization: false,
  worldIdentity: "birth_seed_plus_server_world_instance",
  worldDisplayGate: "machine_review_and_runtime_frame",
}, null, 2)}\n`)
