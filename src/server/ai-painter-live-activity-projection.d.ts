export type LiveActivityProjectionInput = {
  heartbeatClaimsExecution: boolean;
  heartbeatStale: boolean;
  heartbeatStatus: string | null;
  controllerAlive: boolean;
  childAlive: boolean;
  processTableClaimsExecution: boolean;
  discoveredCommandIdentity: string | null;
  waitingForOwner: boolean;
  recentFailure: boolean;
  recentCompletion: boolean;
};

export type LiveActivityProjection = {
  actor: "local_ai_model" | "local_program" | "owner" | "idle";
  lifecycle:
    | "idle"
    | "waiting_authorization"
    | "running"
    | "reviewing"
    | "completed"
    | "failed"
    | "stalled";
  localAiProcessActive: boolean;
  stalled: boolean;
};

export function selectLiveActivityState(
  input: LiveActivityProjectionInput,
): LiveActivityProjection;
