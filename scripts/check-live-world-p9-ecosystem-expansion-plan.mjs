import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const pageGatePath = path.join(root, "data/live-world/page-gates/p7-runtime-page-gate.json");
const planPath = path.join(root, "data/live-world/ecosystem-expansions/p9-ecosystem-expansion-plan.json");
const latestPath = path.join(root, "data/live-world/ecosystem-expansions/latest-ecosystem-expansion-plan.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const pageGate = JSON.parse(await readFile(pageGatePath, "utf8"));
const plan = JSON.parse(await readFile(planPath, "utf8"));
const latest = JSON.parse(await readFile(latestPath, "utf8"));

assert(plan.expansionPlanVersion === "live-world-p9-ecosystem-expansion-plan-v1", "invalid plan version");
assert(plan.status === "planned_not_applied", "P9 must stay planned_not_applied");
assert(plan.sourceWorldStatePayloadHash === worldState.worldStatePayloadHash, "source world hash mismatch");
assert(plan.sourceRuntimePageGateStatus === pageGate.status, "source page gate status mismatch");
assert(plan.definitions.length === 11, "P9 should define 11 expansion entries");

const expectedCategories = new Set(["character", "building", "animal", "ecology"]);
const seenCategories = new Set(plan.definitions.map((definition) => definition.category));
for (const category of expectedCategories) {
  assert(seenCategories.has(category), `missing category: ${category}`);
}

const expectedKinds = [
  "butler_npc",
  "villager_npc",
  "storage_shed",
  "water_well",
  "workbench",
  "rabbit",
  "bird",
  "butterfly",
  "tree_seedling_spread",
  "flower_pollination",
  "berry_bush_regrowth",
];
for (const kind of expectedKinds) {
  assert(plan.definitions.some((definition) => definition.entityKind === kind), `missing entity kind: ${kind}`);
}

for (const definition of plan.definitions) {
  assert(definition.introductionMode === "dictionary_only", `${definition.entityKind} must not be applied to WorldState in P9`);
  assert(typeof definition.displayName === "string" && definition.displayName.length > 0, `${definition.entityKind} missing displayName`);
  assert(typeof definition.purpose === "string" && definition.purpose.length > 0, `${definition.entityKind} missing purpose`);
  assert(Array.isArray(definition.allowedBiomes), `${definition.entityKind} missing allowedBiomes`);
  assert(Array.isArray(definition.forbiddenTerrains), `${definition.entityKind} missing forbiddenTerrains`);
  assert(typeof definition.lifecyclePolicy === "string", `${definition.entityKind} missing lifecyclePolicy`);
  assert(typeof definition.collisionPolicy === "string", `${definition.entityKind} missing collisionPolicy`);
  assert(typeof definition.visualProfilePrefix === "string" && definition.visualProfilePrefix.includes("."), `${definition.entityKind} invalid visual profile`);
  assert(Array.isArray(definition.behaviorHooks), `${definition.entityKind} missing behaviorHooks`);
  assert(Array.isArray(definition.requiredBeforeWorldStateApply), `${definition.entityKind} missing requiredBeforeWorldStateApply`);
  assert(definition.requiredBeforeWorldStateApply.length > 0, `${definition.entityKind} must list blockers before WorldState apply`);
}

assert(plan.safetyBoundary.canModifyWorldState === false, "P9 plan must not modify WorldState");
assert(plan.safetyBoundary.canWriteImageFiles === false, "P9 plan must not write image files");
assert(plan.safetyBoundary.canWriteTrainingSamples === false, "P9 plan must not write training samples");
assert(plan.safetyBoundary.canWriteApprovedVisuals === false, "P9 plan must not write approved visuals");
assert(plan.safetyBoundary.canBypassRuntimePageGate === false, "P9 plan must not bypass runtime page gate");
assert(plan.nextRequiredPipelines.schemaMerge === true, "P9 must require schema merge before apply");
assert(plan.nextRequiredPipelines.placementRules === true, "P9 must require placement rules");
assert(plan.nextRequiredPipelines.lifecycleRules === true, "P9 must require lifecycle rules");
assert(plan.nextRequiredPipelines.collisionProjectionRules === true, "P9 must require collision projection rules");
assert(plan.nextRequiredPipelines.visualInputRules === true, "P9 must require visual input rules");
assert(plan.nextRequiredPipelines.ownerApprovalBeforeRuntimePage === true, "P9 must preserve owner approval before runtime page");

assert(latest.expansionPlanId === plan.expansionPlanId, "latest expansionPlanId mismatch");
assert(latest.definitionCount === plan.definitions.length, "latest definition count mismatch");
assert(latest.canModifyWorldState === false, "latest must not allow WorldState modification");
assert(latest.canBypassRuntimePageGate === false, "latest must not bypass page gate");

console.log("P9 ecosystem expansion plan check passed");
console.log(`expansionPlanId=${plan.expansionPlanId}`);
console.log(`status=${plan.status}`);
console.log(`definitionCount=${plan.definitions.length}`);
console.log(`categories=${[...seenCategories].sort().join(",")}`);
