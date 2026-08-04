import assert from "node:assert/strict";
import { selectLiveActivityState } from "../src/server/ai-painter-live-activity-projection.mjs";

const base = {
  heartbeatClaimsExecution: false,
  heartbeatStale: false,
  heartbeatStatus: null,
  controllerAlive: false,
  childAlive: false,
  processTableClaimsExecution: false,
  discoveredCommandIdentity: null,
  waitingForOwner: false,
  recentFailure: false,
  recentCompletion: false,
};

assert.deepEqual(selectLiveActivityState(base), {
  actor: "idle",
  lifecycle: "idle",
  localAiProcessActive: false,
  stalled: false,
});

assert.deepEqual(
  selectLiveActivityState({
    ...base,
    heartbeatClaimsExecution: true,
    heartbeatStatus: "training",
    controllerAlive: true,
    childAlive: true,
  }),
  {
    actor: "local_ai_model",
    lifecycle: "running",
    localAiProcessActive: true,
    stalled: false,
  },
);

assert.equal(
  selectLiveActivityState({
    ...base,
    heartbeatClaimsExecution: true,
    heartbeatStatus: "training",
    heartbeatStale: true,
  }).lifecycle,
  "stalled",
);

assert.equal(
  selectLiveActivityState({ ...base, recentFailure: true }).lifecycle,
  "failed",
);

assert.equal(
  selectLiveActivityState({
    ...base,
    processTableClaimsExecution: true,
    discoveredCommandIdentity: "validation",
  }).actor,
  "local_program",
);

assert.equal(
  selectLiveActivityState({
    ...base,
    processTableClaimsExecution: true,
    discoveredCommandIdentity: "model_training",
  }).localAiProcessActive,
  true,
);

console.log("AI Painter live observability: 6 state projections passed.");
