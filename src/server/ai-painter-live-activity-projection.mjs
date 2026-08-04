const activeModelKinds = new Set(["training", "inferencing"]);

export function selectLiveActivityState(input) {
  const processActive =
    input.processTableClaimsExecution ||
    (input.heartbeatClaimsExecution &&
      !input.heartbeatStale &&
      input.childAlive);
  const stalled =
    input.heartbeatClaimsExecution &&
    !input.processTableClaimsExecution &&
    (input.heartbeatStale || !input.childAlive || !input.controllerAlive);

  if (stalled) {
    return {
      actor: "local_program",
      lifecycle: "stalled",
      localAiProcessActive: false,
      stalled: true,
    };
  }
  if (processActive) {
    const modelActive =
      activeModelKinds.has(input.heartbeatStatus) ||
      input.discoveredCommandIdentity === "model_training" ||
      input.discoveredCommandIdentity === "model_inference";
    return {
      actor: modelActive ? "local_ai_model" : "local_program",
      lifecycle: input.heartbeatStatus === "reviewing" ? "reviewing" : "running",
      localAiProcessActive: modelActive,
      stalled: false,
    };
  }
  if (input.waitingForOwner) {
    return {
      actor: "owner",
      lifecycle: "waiting_authorization",
      localAiProcessActive: false,
      stalled: false,
    };
  }
  if (input.recentFailure) {
    return {
      actor: "local_program",
      lifecycle: "failed",
      localAiProcessActive: false,
      stalled: false,
    };
  }
  if (input.recentCompletion) {
    return {
      actor: "local_program",
      lifecycle: "completed",
      localAiProcessActive: false,
      stalled: false,
    };
  }
  return {
    actor: "idle",
    lifecycle: "idle",
    localAiProcessActive: false,
    stalled: false,
  };
}
