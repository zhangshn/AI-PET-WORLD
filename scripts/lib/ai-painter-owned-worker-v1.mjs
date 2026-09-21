import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createNativeOwnerCommand, nativeOwnerSourceIdentity } from "./ai-painter-owned-worker-native-v1.mjs";
const SELF = fileURLToPath(import.meta.url);

// Invocation-local Windows containment. No service, replay selection or retry.
export function runOwnedWorker(executable, args, { cwd, env, timeout, maxBuffer = 8 * 1024 * 1024, abortReason = () => null } = {}) {
  assert.equal(process.platform, "win32", "owned_worker_windows_required");
  assert.ok(Number.isInteger(timeout) && timeout > 0 && timeout <= 900000);
  assert.equal(maxBuffer, 8 * 1024 * 1024, "AB stream limit must remain 8 MiB");
  assert.ok(Array.isArray(args) && args.every(v => typeof v === "string"));
  const started = Date.now();
  const candidates = [path.resolve(cwd, executable), ...(!/[\\/]/.test(executable) ? String(env?.Path ?? env?.PATH ?? process.env.Path ?? process.env.PATH ?? "").split(path.delimiter).map(p=>path.resolve(p,executable)) : [])];
  executable = candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  assert.ok(executable, "owned worker executable not found");
  const guardRoot = path.resolve(cwd, ".runtime/ai-painter/owned-worker-guards");
  fs.mkdirSync(guardRoot, { recursive: true });
  const guardPath = path.join(guardRoot, "active.json"), guardIdentity = crypto.randomUUID();
  const guardRecord = { identity: guardIdentity, runnerPid: process.pid, recordedAtUtc: new Date().toISOString(), executable,
    executableSha256: crypto.createHash("sha256").update(fs.readFileSync(executable)).digest("hex"),
    helperSha256: crypto.createHash("sha256").update(fs.readFileSync(SELF)).digest("hex"),
    nativeOwnerSource: nativeOwnerSourceIdentity(),
    commandSha256: crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex"),
    startedEvidence: path.join(guardRoot, guardIdentity + "-started.json") };
  const guardBytes = JSON.stringify(guardRecord);
  try { fs.writeFileSync(guardPath, guardBytes, { flag: "wx" }); }
  catch (error) { Object.assign(error, { code: "OWNED_GUARD_BUSY", ownedReceipt: { cleanupConfirmed: false, cleanupState: "unknown", guard: { path: guardPath, state: "existing_guard_refused" } } }); throw error; }
  const cleanupMs = Math.min(1000, Math.max(1, Math.floor(timeout / 3)));
  const deadline = started + timeout - cleanupMs;
  let command;
  const unknownGuard = () => ({ cleanupConfirmed: false, cleanupState: "unknown", guard: { path: guardPath, identity: guardIdentity, state: "retained" } });
  try { command = createNativeOwnerCommand(executable, args, cwd, deadline, cleanupMs, guardRecord, guardBytes); }
  catch (error) { error.ownedReceipt = unknownGuard(); throw error; }
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(command.executable, command.args, { cwd, env, windowsHide: true, detached: true, shell: false, stdio: ["pipe", "pipe", "pipe"] }); }
    catch (error) { error.ownedReceipt = unknownGuard(); reject(error); return; }
    const ownerIdentity = { pid: child.pid ?? null, executable: command.executable,
      commandSha256: crypto.createHash("sha256").update(JSON.stringify(command.args)).digest("hex"),
      spawnedAtUtc: new Date().toISOString(), identitySource: "retained_child_handle" };
    let firstStop = null, termination = null, proof = null, settled = false, ownerClosed = false;
    let protocol = "", ownerError = "", protocolError = null;
    const buffers = { stdout: [], stderr: [] }, counts = { stdout: 0, stderr: 0 };
    function stop(code, reason) {
      if (firstStop) return;
      firstStop = { code, reason: String(reason).slice(0, 2048), requestedAtUtc: new Date().toISOString() };
      // A closed/failed control channel is evidence, never successful cleanup.
      if (!child.stdin.destroyed) child.stdin.write(Buffer.from(firstStop.reason).toString("base64") + "\n");
    }
    function forceOwnerStop() {
      if (termination || ownerClosed) return;
      termination = { method: "retained_owner_handle_SIGKILL", sent: false, requestedAtUtc: new Date().toISOString() };
      try { termination.sent = child.kill("SIGKILL"); }
      catch (error) { termination.error = { code: error.code ?? null, message: String(error.message).slice(0, 1024) }; }
    }
    function finish() {
      if (settled) return; settled = true;
      clearInterval(poll); clearTimeout(forceTimer); clearTimeout(finalTimer);
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
      const stdout = Buffer.concat(buffers.stdout).toString("utf8"), stderr = Buffer.concat(buffers.stderr).toString("utf8");
      // Only the live retained owner's framed response can confirm this invocation.
      // Durable observations are never read to recover or release an unknown guard.
      const liveOwnerCleanupConfirmed = ownerClosed && !protocolError && proof?.ownerPid === child.pid
        && proof?.bindingBase64 === command.bindingBase64
        && proof?.assignedBeforeResume === true && proof?.activeProcessesAfterCleanup === 0;
      const cleanupConfirmed = liveOwnerCleanupConfirmed && !proof?.observationError;
      const receipt = { ownerIdentity, ownerClosed, liveOwnerCleanupConfirmed,
        cleanupConfirmed: false, cleanupState: "unknown", guardReleaseConfirmed: false,
        evidenceRole: "live_owner_response_before_guard_release_not_recovery_authority",
        firstStop, termination, proof, protocolError, ownerError, streamBytes: counts, elapsedMs: Date.now() - started,
        nativeBuild: command.nativeBuild, observationPath: command.observationPath,
        guard: { path: guardPath, identity: guardIdentity, state: "retained", startedEvidence: guardRecord.startedEvidence } };
      try {
        const history = path.join(guardRoot, guardIdentity + "-terminal.json");
        fs.writeFileSync(history, JSON.stringify(receipt), { flag: "wx" });
        if (cleanupConfirmed) {
          assert.equal(fs.readFileSync(guardPath, "utf8"), guardBytes, "guard identity changed");
          fs.unlinkSync(guardPath); receipt.guard.state = "released_after_confirmed_cleanup";
          receipt.cleanupConfirmed = true; receipt.cleanupState = "confirmed_empty_job"; receipt.guardReleaseConfirmed = true;
        }
        receipt.guard.terminalEvidence = history;
      } catch (error) { receipt.guard.error = String(error.message).slice(0, 1024); receipt.cleanupConfirmed = false; receipt.cleanupState = "unknown"; }
      let code = firstStop?.code ?? (protocolError ? "OWNED_PROTOCOL_ERROR" : null);
      if (!code && receipt.guard.error) code = "OWNED_GUARD_PERSISTENCE_ERROR";
      if (!code && !cleanupConfirmed) code = "OWNED_CLEANUP_UNKNOWN";
      if (!code && (counts.stdout > maxBuffer || counts.stderr > maxBuffer || proof.stdoutBytes > maxBuffer || proof.stderrBytes > maxBuffer)) code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
      if (!code && proof.stopReason) code = proof.stopReason === "wall_timeout" ? "ETIMEDOUT" : "ABORT_ERR";
      if (!code && proof.exitCode !== 0) code = proof.exitCode;
      if (code !== null) {
        const error = new Error(firstStop?.reason ?? proof?.stopReason ?? protocolError ?? "owned worker failed or cleanup unconfirmed");
        Object.assign(error, { code, stdout, stderr, killed: termination?.sent === true, ownedReceipt: receipt });
        reject(error);
      } else resolve({ stdout, stderr, ownedReceipt: receipt });
    }
    child.stdin.on("error", error => { ownerError ||= String(error.message).slice(0, 8192); });
    child.on("error", error => { protocolError = String(error.message).slice(0, 1024); stop("OWNED_SPAWN_ERROR", protocolError); });
    child.stdout.on("data", chunk => {
      protocol += chunk.toString("ascii");
      let newline;
      while ((newline = protocol.indexOf("\n")) >= 0) {
        const line = protocol.slice(0, newline).trimEnd(); protocol = protocol.slice(newline + 1);
        try {
          if (line.startsWith("O:") || line.startsWith("E:")) {
            const name = line[0] === "O" ? "stdout" : "stderr", b = Buffer.from(line.slice(2), "base64");
            const keep = Math.max(0, maxBuffer - counts[name]); counts[name] += b.length;
            if (keep) buffers[name].push(b.subarray(0, keep));
            if (counts[name] > maxBuffer) stop("ERR_CHILD_PROCESS_STDIO_MAXBUFFER", name + " maxBuffer exceeded");
          } else if (line.startsWith("R:")) {
            assert.equal(proof, null, "duplicate owner receipt"); proof = JSON.parse(Buffer.from(line.slice(2), "base64").toString("utf8"));
          } else throw new Error("unexpected owner frame");
        } catch (error) { protocolError = String(error.message).slice(0, 1024); stop("OWNED_PROTOCOL_ERROR", protocolError); }
      }
      if (protocol.length > 65536) { protocolError = "owner frame overflow"; protocol = ""; stop("OWNED_PROTOCOL_ERROR", protocolError); }
    });
    child.stderr.on("data", b => { ownerError = (ownerError + b.toString("utf8")).slice(0, 8192); });
    child.once("close", () => { ownerClosed = true; if (protocol.trim()) protocolError ||= "incomplete owner frame"; finish(); });
    const poll = setInterval(() => {
      try { const reason = abortReason(); if (reason) stop("ABORT_ERR", reason); }
      catch (error) { stop("ABORT_ERR", error); }
      if (Date.now() >= deadline) stop("ETIMEDOUT", "wall_timeout");
    }, 500);
    const remaining = Math.max(1, timeout - (Date.now() - started));
    const forceTimer = setTimeout(() => { stop("ETIMEDOUT", "wall_timeout"); forceOwnerStop(); }, Math.max(1, remaining - Math.min(250, cleanupMs)));
    const finalTimer = setTimeout(() => { stop("ETIMEDOUT", "wall_timeout"); forceOwnerStop(); finish(); }, remaining);
    // All listeners and finite cleanup timers exist before fallible evidence IO.
    try { fs.writeFileSync(guardRecord.startedEvidence, JSON.stringify({ ...guardRecord, ownerIdentity }), { flag: "wx" }); }
    catch (error) { protocolError = "started_evidence: " + String(error.message).slice(0, 1024); stop("OWNED_START_EVIDENCE_ERROR", protocolError); forceOwnerStop(); }
  });
}
