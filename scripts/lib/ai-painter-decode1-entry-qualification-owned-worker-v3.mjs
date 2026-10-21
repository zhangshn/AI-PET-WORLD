import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createNativeOwnerCommand, nativeOwnerSourceIdentity } from "./ai-painter-ecology-decode1-native-owner-v2.mjs";

const SELF = fileURLToPath(import.meta.url);
const STREAM_LIMIT = 8 * 1024 * 1024;
const FRAME_LIMIT = 65536;
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const message = error => String(error?.message ?? error).slice(0, 2048);
function put(file, bytes) {
  const fd = fs.openSync(file, "wx");
  let primary = null;
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
  catch (error) { primary = error; throw error; }
  finally {
    try { fs.closeSync(fd); }
    catch (error) { if (!primary) throw error; }
  }
}

// Pure shape/consistency check, never authority to release a guard. The caller
// below supplies observations from this invocation's retained child and pipes.
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

// CP60 invocation adapter only: private Job, existing unique active.json, no
// registry writes, service, retries, historical observations or guard recovery.
export function runParameter60OwnedWorker(executable, args, {
  ...options
} = {}) {
  return runOwnedWorker(executable, args, options, 180000);
}

// Same native Job transport; only the separately registered qualification
// package may use its CPU240/GPU720 phase budgets. Legacy callers retain180s.
export function runDecode1EntryQualificationOwnedWorkerV3(executable, args, {
  qualificationPolicy, phase, ...options
} = {}) {
  const logical="data/ai-painter/system-governance/ai-painter-decode1-entry-gpu-qualification-policy-v3.json";
  assert.equal(qualificationPolicy?.path,logical,"exact qualification policy required");
  assert.match(qualificationPolicy.sha256??"",/^[a-f0-9]{64}$/u);
  assert.ok(typeof options.cwd==="string"&&path.isAbsolute(options.cwd),"explicit qualification root required");
  const root=path.resolve(options.cwd),raw=fs.readFileSync(path.join(root,logical));
  assert.equal(hash(raw),qualificationPolicy.sha256,"qualification policy bytes differ");
  const policy=JSON.parse(raw);
  assert.equal(policy.schemaVersion,"ai-painter-decode1-entry-gpu-qualification-policy-v3");
  assert.equal(policy.capabilityVersion,"stage4_mvp256_dry_decode1_entry_gpu_qualification_v3");
  assert.equal(policy.outputRoot,".runtime/ai-painter/decode1-entry-gpu-qualifications-v3");
  assert.deepEqual(policy.allowedModes,["cpu_prepare","gpu_qualify"]);
  assert.equal(policy.executionBoundary.training,false);
  assert.equal(policy.resources.cpuPreparationSeconds,240);
  assert.equal(policy.resources.gpuQualificationSeconds,720);
  assert.ok(phase==="cpu"||phase==="qualification","registered qualification phase required");
  assert.ok(Array.isArray(args)&&args.length===6&&args[0]==="-B"&&args[2]==="--request"&&args[4]==="--request-sha256",
    "fixed qualification worker arguments required");
  assert.equal(path.resolve(args[1]),path.join(root,"ml/ai-painter/scripts/qualify_decode1_entry_gpu_v3.py"));
  assert.ok(typeof args[3]==="string"&&!/[\\:\x00-\x1f]/u.test(args[3])&&!args[3].startsWith("/")
    &&args[3].split("/").every(part=>part&&part!=="."&&part!==".."),"logical qualification request required");
  assert.match(args[5],/^[a-f0-9]{64}$/u);
  const requestRaw=fs.readFileSync(path.join(root,args[3]));
  assert.equal(hash(requestRaw),args[5],"qualification request bytes differ");
  const request=JSON.parse(requestRaw);
  assert.equal(request.schemaVersion,"decode1-entry-gpu-qualification-request-v3");
  assert.match(request.runId??"",/^decode1-entry-qualification-v3-[a-f0-9-]{36}$/u);
  assert.deepEqual(request.policy,qualificationPolicy);
  assert.equal(request.mode,phase==="cpu"?"cpu_prepare":"gpu_qualify","request/phase mismatch");
  assert.equal(request.outputRoot,policy.outputRoot+"/"+request.runId);
  return runOwnedWorker(executable,args,options,phase==="cpu"?240000:720000);
}

function runOwnedWorker(executable, args, {
  cwd, env, timeout, maxBuffer = STREAM_LIMIT, abortReason = () => null, onSpawn = null,
} = {}, maximumTimeoutMs=180000) {
  const started = Date.now(), monotonicStarted = performance.now();
  assert.equal(process.platform, "win32", "parameter60_owned_worker_windows_required");
  assert.ok(Number.isInteger(timeout) && timeout > 1000 && timeout <= maximumTimeoutMs, "total timeout must include the 1000ms cleanup reserve and be <="+(maximumTimeoutMs/1000)+"s");
  assert.equal(maxBuffer, STREAM_LIMIT, "CP60 total stream limit must remain 8 MiB");
  assert.ok(typeof cwd === "string" && path.isAbsolute(cwd), "explicit absolute cwd required");
  assert.ok(typeof executable === "string" && executable.length > 0 && !executable.includes("\0"));
  assert.ok(Array.isArray(args) && args.every(arg => typeof arg === "string" && !arg.includes("\0")));
  assert.equal(typeof abortReason, "function");
  assert.ok(onSpawn === null || typeof onSpawn === "function");
  cwd = path.resolve(cwd);
  const elapsed = () => Math.max(Date.now() - started, performance.now() - monotonicStarted);
  const requireTime = reserve => {
    if (elapsed() >= timeout - reserve)
      throw Object.assign(new Error("parameter60 total deadline exhausted"), { code: "ETIMEDOUT" });
  };
  const candidates = [path.resolve(cwd, executable), ...(!/[\\/]/.test(executable)
    ? String(env?.Path ?? env?.PATH ?? process.env.Path ?? process.env.PATH ?? "").split(path.delimiter)
      .filter(Boolean).map(directory => path.resolve(directory, executable)) : [])];
  executable = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  assert.ok(executable, "owned worker executable not found");
  const initialAbort = abortReason();
  if (initialAbort) {
    const error = initialAbort instanceof Error ? initialAbort : new Error(message(initialAbort));
    error.code ??= "ABORT_ERR";
    throw error;
  }
  const guardRoot = path.join(cwd, ".runtime/ai-painter/owned-worker-guards");
  const guardPath = path.join(guardRoot, "active.json"), identity = crypto.randomUUID();
  const nativeEvidenceRoot = path.join(guardRoot, identity + "-native");
  const terminalEvidence = path.join(guardRoot, identity + "-terminal.json");
  const guardTerminalPath = path.join(guardRoot, identity + "-guard-terminal.json");
  const guardRecord = { identity, runnerPid: process.pid, recordedAtUtc: new Date().toISOString(), executable,
    executableSha256: hash(fs.readFileSync(executable)), helperSha256: hash(fs.readFileSync(SELF)),
    nativeOwnerSource: nativeOwnerSourceIdentity(), commandSha256: hash(JSON.stringify(args)),
    startedEvidence: path.join(guardRoot, identity + "-started.json"), nativeEvidenceRoot };
  const guardBytes = JSON.stringify(guardRecord);
  requireTime(1000);
  fs.mkdirSync(guardRoot, { recursive: true });
  try { put(guardPath, guardBytes); }
  catch (error) {
    // EEXIST is not inspected, parsed, renamed or removed.
    error.ownedReceipt = { cleanupConfirmed: false, cleanupState: "unknown", nativeBuild: null,
      guard: { path: guardPath, identity, state: error.code === "EEXIST" ? "existing_guard_refused" : "acquisition_failed" } };
    if (error.code === "EEXIST") error.code = "OWNED_GUARD_BUSY";
    throw error;
  }
  const guard = { path: guardPath, identity, state: "retained", startedEvidence: guardRecord.startedEvidence,
    nativeEvidenceRoot, terminalEvidence, terminalPath: guardTerminalPath };
  let command, spawnAttempted = false;
  function beforeSpawnFailure(error) {
    const receipt = { cleanupConfirmed: false, cleanupState: "unknown", nativeOwnerSpawnAttempted: spawnAttempted,
      nativeBuild: command?.nativeBuild ?? null, guard, elapsedMs: elapsed(), primaryError: { code: error.code ?? null, message: message(error) } };
    error.ownedReceipt = receipt;
    try { requireTime(0); put(terminalEvidence, JSON.stringify(receipt)); receipt.terminalEvidenceWritten = true; }
    catch (secondary) { receipt.persistenceError = message(secondary); error.secondaryEvidenceError = secondary; }
    return error;
  }
  const cleanupMs = 1000, deadline = started + timeout - cleanupMs;
  try {
    requireTime(cleanupMs);
    command = createNativeOwnerCommand(executable, args, cwd, deadline, cleanupMs, guardRecord, guardBytes);
    requireTime(cleanupMs);
    assert.equal(hash(fs.readFileSync(executable)), guardRecord.executableSha256, "worker executable changed during build");
    assert.equal(hash(fs.readFileSync(command.executable)), command.nativeBuild.binarySha256, "native binary changed before spawn");
    assert.equal(command.executable, command.nativeBuild.binary);
    assert.equal(path.dirname(command.executable), nativeEvidenceRoot, "native evidence root must belong to this guard UUID");
    assert.equal(command.bindingBase64, command.args[5]);
    requireTime(cleanupMs);
  } catch (error) { throw beforeSpawnFailure(error); }

  return new Promise((resolve, reject) => {
    let child;
    try { spawnAttempted = true; child = spawn(command.executable, command.args, { cwd, env, windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] }); }
    catch (error) { reject(beforeSpawnFailure(error)); return; }
    const ownerIdentity = { pid: child.pid ?? null, executable: command.executable,
      executableSha256: command.nativeBuild.binarySha256, commandSha256: hash(JSON.stringify(command.args)),
      spawnedAtUtc: new Date().toISOString(), identitySource: "retained_child_handle" };
    let firstStop = null, primaryError = null, termination = null, proof = null, settled = false;
    let ownerClosed = false, ownerExitCode = null, ownerSignal = null, stdoutClosed = false, stderrClosed = false;
    let pending = "", protocolError = null, ownerError = "", ownerErrorBytes = 0, wireBytes = 0, persistenceError = null;
    let poll, forceTimer, finalTimer;
    const buffers = { stdout: [], stderr: [] }, counts = { stdout: 0, stderr: 0 };
    function fail(code, reason) {
      if (settled || firstStop) return;
      primaryError = reason instanceof Error ? reason : new Error(message(reason));
      primaryError.code ??= code;
      firstStop = { code, reason: message(reason), requestedAtUtc: new Date().toISOString() };
      try {
        if (!child.stdin.destroyed) child.stdin.write(Buffer.from(firstStop.reason).toString("base64") + "\n");
      } catch (error) { protocolError ??= "control_write: " + message(error); }
    }
    function forceOwnerStop() {
      if (termination || ownerClosed) return;
      termination = { method: "retained_owner_handle_SIGKILL", sent: false, requestedAtUtc: new Date().toISOString() };
      try { termination.sent = child.kill("SIGKILL"); }
      catch (error) { termination.error = { code: error.code ?? null, message: message(error) }; }
    }
    function checkLimits() {
      try { const reason = abortReason(); if (reason) fail("ABORT_ERR", reason); }
      catch (error) { fail("ABORT_ERR", error); }
      if (elapsed() >= timeout - cleanupMs) fail("ETIMEDOUT", "wall_timeout");
    }
    function finish() {
      if (settled) return;
      if (elapsed() >= timeout) fail("ETIMEDOUT", "wall_timeout");
      if (!firstStop && proof?.stopReason) fail(proof.stopReason === "wall_timeout" ? "ETIMEDOUT" : "ABORT_ERR", proof.stopReason);
      if (!firstStop && Number.isInteger(proof?.exitCode) && proof.exitCode !== 0) fail(proof.exitCode, "worker_exit_" + proof.exitCode);
      settled = true;
      clearInterval(poll); clearTimeout(forceTimer); clearTimeout(finalTimer);
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
      const validation = validateParameter60NativeProof(proof, { ownerPid: child.pid, bindingBase64: command.bindingBase64,
        ownerClosed, ownerExitCode, ownerSignal, stdoutClosed, stderrClosed, protocolError, ownerError,
        forced: termination !== null, stdoutBytes: counts.stdout, stderrBytes: counts.stderr, maxBuffer });
      const receipt = { schema: "parameter60-live-native-owner-receipt-v1", ownerIdentity, ownerClosed,
        ownerExitCode, ownerSignal, liveOwnerCleanupConfirmed: validation.valid, emptyJob: validation.emptyJob,
        ownerPipeEOF: { stdout: stdoutClosed, stderr: stderrClosed },
        cleanupConfirmed: false, cleanupState: "unknown", guardReleaseConfirmed: false,
        evidenceRole: "current_live_R_before_guard_release_not_historical_cleanup_authority",
        firstStop, termination, proof, validation, protocolError, ownerError, streamBytes: counts,
        elapsedMs: elapsed(), nativeBuild: command.nativeBuild, observationPath: command.observationPath,
        guard: { ...guard }, persistenceError, terminalEvidenceWritten: false,
        primaryError: primaryError ? { code: primaryError.code ?? null, message: message(primaryError) } : null };
      try {
        // Persist the live receipt first. Archive the exact guard bytes with one
        // rename as the LAST filesystem action; no fallible writes after release.
        // The on-disk receipt describes pre-release facts, while terminalPath is
        // the exact archived guard. The returned receipt records the rename result.
        requireTime(0);
        put(terminalEvidence, JSON.stringify(receipt));
        receipt.terminalEvidenceWritten = true;
        requireTime(0);
        if (validation.valid && !persistenceError) {
          const stat = fs.lstatSync(guardPath);
          assert.ok(stat.isFile() && !stat.isSymbolicLink(), "guard must remain an ordinary file");
          assert.equal(fs.readFileSync(guardPath, "utf8"), guardBytes, "guard identity changed");
          assert.equal(fs.existsSync(guardTerminalPath), false, "guard terminal target already exists");
          requireTime(0);
          fs.renameSync(guardPath, guardTerminalPath);
          receipt.guard.state = "released_after_confirmed_cleanup";
          receipt.cleanupConfirmed = true; receipt.cleanupState = "confirmed_empty_job"; receipt.guardReleaseConfirmed = true;
        }
      } catch (error) {
        receipt.persistenceError = message(error);
        primaryError ??= error;
        primaryError.code ??= "OWNED_GUARD_PERSISTENCE_ERROR";
      }
      const value = { stdout: Buffer.concat(buffers.stdout).toString("utf8"), stderr: Buffer.concat(buffers.stderr).toString("utf8"),
        nativeBuild: command.nativeBuild, nativeEvidenceRoot, guardTerminalPath, ownedReceipt: receipt };
      receipt.elapsedMs = elapsed();
      if (receipt.elapsedMs >= timeout)
        primaryError ??= Object.assign(new Error("parameter60 total deadline exhausted"), { code: "ETIMEDOUT" });
      if (!primaryError && !receipt.cleanupConfirmed)
        primaryError = Object.assign(new Error("live native cleanup unconfirmed: " + validation.errors.join(",")), { code: "OWNED_CLEANUP_UNKNOWN" });
      if (primaryError) { Object.assign(primaryError, value); reject(primaryError); }
      else resolve(value);
    }
    child.stdin.on("error", error => { protocolError ??= "control_stream: " + message(error); fail("OWNED_CONTROL_ERROR", error); });
    child.stdout.on("error", error => { protocolError ??= "stdout_stream: " + message(error); fail("OWNED_PROTOCOL_ERROR", error); });
    child.stderr.on("error", error => { protocolError ??= "stderr_stream: " + message(error); fail("OWNED_PROTOCOL_ERROR", error); });
    child.once("error", error => { protocolError ??= "spawn: " + message(error); fail("OWNED_SPAWN_ERROR", error); });
    child.stdout.once("end", () => { stdoutClosed = true; });
    child.stderr.once("end", () => { stderrClosed = true; });
    child.stdout.on("data", chunk => {
      if (settled) return;
      try {
        wireBytes += chunk.length;
        assert.ok(wireBytes <= 2 * maxBuffer, "native transport limit exceeded");
        pending += chunk.toString("latin1");
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, newline).replace(/\r$/u, ""); pending = pending.slice(newline + 1);
          assert.ok(line.length <= FRAME_LIMIT, "native frame overflow");
          assert.equal(proof, null, "frame after terminal R");
          assert.match(line, /^[OER]:[A-Za-z0-9+/]+={0,2}$/u, "unexpected owner frame");
          const raw = Buffer.from(line.slice(2), "base64");
          assert.equal(raw.toString("base64"), line.slice(2), "noncanonical native base64");
          if (line[0] === "R") {
            const parsed = JSON.parse(raw.toString("utf8"));
            assert.ok(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed), "invalid R object");
            proof = parsed;
          }
          else {
            const name = line[0] === "O" ? "stdout" : "stderr";
            const keep = Math.max(0, maxBuffer - 1 - counts.stdout - counts.stderr);
            counts[name] += raw.length;
            if (keep) buffers[name].push(raw.subarray(0, keep));
            if (counts.stdout + counts.stderr >= maxBuffer) fail("ERR_CHILD_PROCESS_STDIO_MAXBUFFER", "total stream limit reached");
          }
        }
        assert.ok(pending.length <= FRAME_LIMIT, "incomplete native frame overflow");
      } catch (error) { protocolError ??= message(error); pending = ""; fail("OWNED_PROTOCOL_ERROR", error); }
      checkLimits();
    });
    child.stderr.on("data", chunk => {
      if (settled) return;
      ownerErrorBytes += chunk.length;
      ownerError = (ownerError + chunk.toString("utf8")).slice(0, 8192);
      fail("OWNED_OWNER_ERROR", ownerError);
      if (ownerErrorBytes >= 8192) forceOwnerStop();
    });
    child.once("close", (code, signal) => {
      ownerClosed = true; ownerExitCode = code; ownerSignal = signal;
      if (pending.length) { protocolError ??= "incomplete owner frame"; fail("OWNED_PROTOCOL_ERROR", protocolError); }
      finish();
    });
    // Supervision is fully installed before either evidence IO or caller code.
    poll = setInterval(checkLimits, 50);
    forceTimer = setTimeout(() => { fail("ETIMEDOUT", "wall_timeout"); forceOwnerStop(); }, Math.max(1, timeout - elapsed() - 250));
    finalTimer = setTimeout(() => { fail("ETIMEDOUT", "wall_timeout"); forceOwnerStop(); finish(); }, Math.max(1, timeout - elapsed()));
    try {
      requireTime(cleanupMs);
      assert.ok(Number.isInteger(child.pid) && child.pid > 0, "native owner PID unavailable");
      try { put(guard.startedEvidence, JSON.stringify({ ...guardRecord, ownerIdentity, bindingBase64: command.bindingBase64, nativeBuild: command.nativeBuild })); }
      catch (error) { persistenceError = message(error); throw error; }
      requireTime(cleanupMs);
      checkLimits();
      if (!firstStop && onSpawn) {
        const result = onSpawn({ ownerPid: child.pid, ownerIdentity: Object.freeze({ ...ownerIdentity }),
          program: Object.freeze({ path: command.executable, sha256: command.nativeBuild.binarySha256 }),
          bindingBase64: command.bindingBase64, guard: Object.freeze({ ...guard }),
          guardRecord: Object.freeze(structuredClone(guardRecord)), guardPath,
          startedEvidence: guardRecord.startedEvidence, nativeBuildDirectory: nativeEvidenceRoot, nativeEvidenceRoot,
          getStreamBytes: () => ({ stdout: counts.stdout, stderr: counts.stderr }),
          nativeBuild: Object.freeze(structuredClone(command.nativeBuild)) });
        if (result && typeof result.then === "function") {
          Promise.resolve(result).catch(() => {});
          throw new Error("onSpawn must be synchronous");
        }
        requireTime(cleanupMs);
      }
    } catch (error) { fail("OWNED_START_ERROR", error); }
  });
}
