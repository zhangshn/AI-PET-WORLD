import fs from 'node:fs'

// Shared bounded publication only; no training entrypoint or task scheduling.
export const heartbeatPublicationRule = Object.freeze({
  maxReplaceAttempts: 21, retryDelayMilliseconds: 100, maxWaitMilliseconds: 2000,
  sameStagedBytesOnly: true, preservePreviousHeartbeat: true, automaticTrainingRetries: 0,
});

export function replaceHeartbeatFile(temporary, target, {
  rename = fs.renameSync,
  pause = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds),
  now = () => performance.now(),
} = {}) {
  // Retry only publication of these exact staged bytes. A bounded sharing
  // violation is not a model retry; permanent errors still fail closed. Keep
  // the old heartbeat readable, and never delete it to force replacement.
  const started = now();
  let lastError;
  let attempts = 0;
  const elapsed = () => Math.max(0, now() - started);
  const fail = error => {
    error.heartbeatPublication = { ...heartbeatPublicationRule, attempts, elapsedMilliseconds: elapsed(),
      temporary, target, errorCode: error.code ?? null };
    throw error;
  };
  while (attempts < heartbeatPublicationRule.maxReplaceAttempts) {
    if (lastError && elapsed() >= heartbeatPublicationRule.maxWaitMilliseconds) fail(lastError);
    attempts += 1;
    try {
      rename(temporary, target);
      return { attempts, elapsedMilliseconds: elapsed(), recovered: attempts > 1 };
    } catch (error) {
      lastError = error;
      const remaining = heartbeatPublicationRule.maxWaitMilliseconds - elapsed();
      if (!["EPERM", "EACCES", "EBUSY"].includes(error.code)
        || attempts >= heartbeatPublicationRule.maxReplaceAttempts || remaining <= 0) fail(error);
      pause(Math.min(heartbeatPublicationRule.retryDelayMilliseconds, remaining));
    }
  }
}

export function guardedHeartbeat(heartbeat, onFailure) {
  try { heartbeat(); return true; }
  catch (error) { onFailure(error); return false; }
}

export function ownedWorkerIsRunning(child) {
  return Boolean(child && child.exitCode === null && child.signalCode === null && Number.isInteger(child.pid) && child.pid > 0);
}
