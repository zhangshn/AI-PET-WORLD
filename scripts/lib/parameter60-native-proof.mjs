// Pure native proof shape checks only. This function grants no live receipt or cleanup authority.
const STREAM_LIMIT = 8 * 1024 * 1024;

export function validateParameter60NativeProof(proof, observed = {}) {
  const errors = [];
  const require = (ok, field) => { if (!ok) errors.push(field); };
  require(proof !== null && typeof proof === "object" && !Array.isArray(proof), "live_R_required");
  if (errors.length) return { valid: false, emptyJob: false, errors };
  require(observed.ownerClosed === true && observed.ownerExitCode === 0 && observed.ownerSignal === null, "owner_close");
  require(observed.stdoutClosed === true && observed.stderrClosed === true, "owner_pipe_EOF");
  require(observed.protocolError === null && observed.ownerError === "" && observed.forced === false, "owner_transport");
  require(Number.isSafeInteger(observed.ownerPid) && observed.ownerPid > 0 && proof.ownerPid === observed.ownerPid, "ownerPid");
  require(typeof observed.bindingBase64 === "string" && observed.bindingBase64.length > 0
    && proof.bindingBase64 === observed.bindingBase64, "bindingBase64");
  require(proof.streamClosureVersion === "bounded-stream-capture-v2", "streamClosureVersion");
  for (const key of ["stdoutClosed", "stderrClosed", "transportCompleted", "assignedBeforeResume", "killOnJobClose"])
    require(proof[key] === true, key);
  for (const key of ["cleanupError", "observationError", "streamCaptureError", "streamTransportError"])
    require(proof[key] === null, key);
  require(Number.isSafeInteger(proof.rootPid) && proof.rootPid > 0, "rootPid");
  require(typeof proof.rootCreationDateUtc === "string" && Number.isFinite(Date.parse(proof.rootCreationDateUtc)), "rootCreationDateUtc");
  require(Number.isSafeInteger(proof.totalProcesses) && proof.totalProcesses >= 1, "totalProcesses");
  require(Number.isSafeInteger(proof.exitCode) && proof.exitCode >= 0 && proof.exitCode <= 0xffffffff, "exitCode");
  require(proof.stopReason === null || (typeof proof.stopReason === "string" && proof.stopReason.length > 0), "stopReason");
  const emptyJob = proof.activeProcessesAfterCleanup === 0;
  require(emptyJob && (!Object.hasOwn(proof, "emptyJob") || proof.emptyJob === true), "emptyJob");
  for (const name of ["stdout", "stderr"]) {
    const bytes = observed[name + "Bytes"];
    require(Number.isSafeInteger(bytes) && bytes >= 0 && proof[name + "Bytes"] === bytes, name + "Bytes");
  }
  require((observed.maxBuffer ?? STREAM_LIMIT) === STREAM_LIMIT
    && observed.stdoutBytes + observed.stderrBytes < STREAM_LIMIT, "total_stream_limit");
  return { valid: errors.length === 0, emptyJob: errors.length === 0 && emptyJob, errors };
}

