import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { runParameter60OwnedWorker, validateParameter60NativeProof } from "../lib/ai-painter-parameter60-owned-worker-v1.mjs";

const LIMIT = 8 * 1024 * 1024;
const sourcePath = fileURLToPath(new URL("../lib/ai-painter-parameter60-owned-worker-v1.mjs", import.meta.url));
const source = fs.readFileSync(sourcePath, "utf8");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const b64 = value => Buffer.from(value).toString("base64");
function proofFor(observed) {
  return { ownerPid: observed.ownerPid, rootPid: 6789, rootCreationDateUtc: "2026-10-14T08:00:00.000Z",
    bindingBase64: observed.bindingBase64, assignedBeforeResume: true, killOnJobClose: true,
    activeProcessesAfterCleanup: 0, totalProcesses: 1, exitCode: 0, stopReason: null,
    streamClosureVersion: "bounded-stream-capture-v2", stdoutClosed: true, stderrClosed: true, transportCompleted: true,
    cleanupError: null, observationError: null, streamCaptureError: null, streamTransportError: null,
    stdoutBytes: observed.stdoutBytes, stderrBytes: observed.stderrBytes };
}
const observed = { ownerPid: 4321, bindingBase64: b64("current invocation"), ownerClosed: true,
  ownerExitCode: 0, ownerSignal: null, stdoutClosed: true, stderrClosed: true, protocolError: null,
  ownerError: "", forced: false, stdoutBytes: 3, stderrBytes: 2, maxBuffer: LIMIT };

test("V2 proof requires all live closure, Job, identity and counting fields", () => {
  assert.deepEqual(validateParameter60NativeProof(proofFor(observed), observed), { valid: true, emptyJob: true, errors: [] });
  const changes = {
    ownerPid: 9999, bindingBase64: b64("historical invocation"), streamClosureVersion: "v1",
    stdoutClosed: false, stderrClosed: false, transportCompleted: false, assignedBeforeResume: false,
    killOnJobClose: false, activeProcessesAfterCleanup: 1, emptyJob: false,
    cleanupError: "query failure", observationError: "ENOSPC", streamCaptureError: "capture failed",
    streamTransportError: "transport failed", stdoutBytes: 2, stderrBytes: 0,
    rootPid: 0, rootCreationDateUtc: "unknown", totalProcesses: 0, exitCode: NaN, stopReason: false,
  };
  for (const [field, value] of Object.entries(changes)) {
    assert.equal(validateParameter60NativeProof({ ...proofFor(observed), [field]: value }, observed).valid, false, field);
  }
  for (const field of Object.keys(proofFor(observed))) {
    const missing = proofFor(observed); delete missing[field];
    assert.equal(validateParameter60NativeProof(missing, observed).valid, false, "missing " + field);
  }
  for (const proof of [null, undefined, true, [], "disk observation"])
    assert.equal(validateParameter60NativeProof(proof, observed).valid, false);
});

test("caller closure, PID, transport and total stream inconsistencies cannot qualify", () => {
  for (const [field, value] of Object.entries({ ownerClosed: false, ownerExitCode: 1, ownerSignal: "SIGKILL",
    stdoutClosed: false, stderrClosed: false, protocolError: "bad frame", ownerError: "owner stderr",
    forced: true, ownerPid: null, bindingBase64: "", stdoutBytes: -1, stderrBytes: 1.5, maxBuffer: LIMIT + 1 }))
    assert.equal(validateParameter60NativeProof(proofFor(observed), { ...observed, [field]: value }).valid, false, field);
  for (const total of [LIMIT, LIMIT + 1]) {
    const counts = { ...observed, stdoutBytes: total - 2, stderrBytes: 2 };
    assert.equal(validateParameter60NativeProof(proofFor(counts), counts).valid, false);
  }
  const counts = { ...observed, stdoutBytes: LIMIT - 3, stderrBytes: 2 };
  assert.equal(validateParameter60NativeProof(proofFor(counts), counts).valid, true);
});

// Fault cases use only memory files, an EventEmitter child and a manual clock.
// No compiler, real process, filesystem fixture or existing guard is touched.
function harness(fault = {}) {
  const cwd = path.resolve("F:/private-parameter60-test"), self = "/private/helper.mjs";
  const guardPath = path.join(cwd, ".runtime/ai-painter/owned-worker-guards/active.json");
  const files = new Map([[process.execPath, Buffer.from("private executable")], [self, Buffer.from(source)]]);
  const handles = new Map(), writes = [], controls = [], timers = new Map(), intervals = new Map();
  let now = 0, serial = 0, spawns = 0, builds = 0, kills = 0, command, callback;
  if (fault.existingGuard) files.set(guardPath, Buffer.from("unfamiliar existing guard bytes"));
  const failure = (code, text) => Object.assign(new Error(text), { code });
  const fileOf = value => typeof value === "number" ? handles.get(value) : String(value);
  const memoryFs = {
    existsSync: file => files.has(String(file)),
    statSync: () => ({ isFile: () => true }),
    lstatSync: () => ({ isFile: () => true, isSymbolicLink: () => !!fault.guardLink }),
    mkdirSync() {},
    readFileSync(file, encoding) {
      if (fault.guardDrift && String(file) === guardPath && spawns) return "other task guard";
      const bytes = files.get(String(file)); assert.ok(bytes, "memory file absent: " + file);
      return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
    },
    openSync(file) {
      if (files.has(file)) throw failure("EEXIST", "memory path exists");
      if (fault.openFailure?.(file)) throw fault.primary;
      files.set(file, Buffer.alloc(0)); const fd = ++serial; handles.set(fd, file); return fd;
    },
    writeFileSync(fd, bytes) {
      const file = fileOf(fd);
      if (fault.writeFailure?.(file)) throw fault.primary;
      files.set(file, Buffer.from(bytes)); writes.push(file);
    },
    fsyncSync(fd) { if (fault.syncFailure?.(fileOf(fd))) throw fault.primary; },
    closeSync(fd) { handles.delete(fd); },
    renameSync(from, to) {
      if (fault.renameFailure) throw fault.primary;
      assert.ok(files.has(from)); assert.equal(files.has(to), false);
      files.set(to, files.get(from)); files.delete(from); writes.push("rename:" + to);
      now += fault.renameMs ?? 0;
    },
    readdirSync() { throw new Error("historical scanning prohibited"); },
    unlinkSync() { throw new Error("guard bytes must be preserved"); },
  };
  class Clock extends Date {
    constructor(...values) { super(...(values.length ? values : [now])); }
    static now() { return now; }
  }
  const stream = () => Object.assign(new EventEmitter(), { destroyed: false,
    destroy() { this.destroyed = true; },
    write(bytes) { controls.push(bytes); if (fault.controlWriteFailure) throw fault.primary; return true; } });
  const child = Object.assign(new EventEmitter(), { pid: 4321, stdin: stream(), stdout: stream(), stderr: stream(),
    kill() { kills++; if (fault.killFailure) throw fault.primary; return fault.killReturns ?? true; }, unref() {} });
  const nativeSource = { path: "fixed-v2.cs", sha256: hash("v2 source") };
  const js = source.replace(/^import .+;\r?$/gmu, "")
    .replace('const SELF = fileURLToPath(import.meta.url);', 'const SELF = "/private/helper.mjs";')
    .replace(/export function /gu, "function ") + ";runParameter60OwnedWorker";
  const run = runInNewContext(js, { assert, Buffer, crypto, fs: memoryFs, path, Date: Clock, Error,
    performance: { now: () => now }, structuredClone,
    process: { platform: "win32", pid: 123, env: {} },
    nativeOwnerSourceIdentity: () => nativeSource,
    createNativeOwnerCommand(executable, args, directory, deadline, cleanup, guard) {
      builds++; now += fault.buildMs ?? 0;
      if (fault.buildFailure) throw fault.primary;
      const binary = path.join(guard.nativeEvidenceRoot, "owner.exe");
      files.set(binary, Buffer.from("private native binary"));
      const nativeBuild = { source: nativeSource, binary, binarySha256: hash(files.get(binary)),
        snapshot: path.join(guard.nativeEvidenceRoot, "owner.cs"), compiler: "private-csc.exe", compilerSha256: hash("compiler") };
      const bindingBase64 = b64(JSON.stringify({ guard, nativeBuild }));
      const observationPath = path.join(guard.nativeEvidenceRoot, "cleanup-observation.json");
      command = { executable: binary, args: [executable, directory, String(deadline), String(cleanup), observationPath, bindingBase64, ...args],
        bindingBase64, nativeBuild, observationPath };
      return command;
    },
    spawn(executable, args, options) {
      spawns++;
      assert.equal(executable, command.executable); assert.deepEqual(args, command.args);
      assert.equal(options.windowsHide, true); assert.equal(options.shell, false);
      if (fault.spawnFailure) throw fault.primary;
      return child;
    },
    setInterval(fn) { const id = ++serial; intervals.set(id, fn); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(fn, delay) { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  let stdoutBytes = 0, stderrBytes = 0;
  return { files, writes, controls, child, guardPath, cwd,
    get command() { return command; }, get callback() { return callback; },
    get stats() { return { spawns, builds, kills, timers: timers.size, intervals: intervals.size }; },
    start(options = {}) {
      return run(process.execPath, [], { cwd, env: {}, timeout: 10000,
        onSpawn: value => { callback = value; assert.equal(timers.size, 2); assert.equal(intervals.size, 1); }, ...options });
    },
    send(name, bytes) {
      bytes = Buffer.from(bytes); if (name === "O") stdoutBytes += bytes.length; else stderrBytes += bytes.length;
      child.stdout.emit("data", Buffer.from(name + ":" + bytes.toString("base64") + "\n"));
    },
    raw(value) { child.stdout.emit("data", Buffer.from(value)); },
    proof(changes = {}) {
      const current = { ...observed, bindingBase64: command.bindingBase64, stdoutBytes, stderrBytes };
      return { ...proofFor(current), ...changes };
    },
    receipt(proof) { child.stdout.emit("data", Buffer.from("R:" + b64(JSON.stringify(proof)) + "\n")); },
    close({ code = 0, signal = null, eof = true } = {}) {
      if (eof) { child.stdout.emit("end"); child.stderr.emit("end"); }
      child.emit("close", code, signal);
    },
    tick(time) {
      now = time;
      for (const fn of intervals.values()) fn();
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at))
        if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.fn(); }
    },
  };
}
function terminal(h) { return [...h.files.keys()].find(file => file.endsWith("-terminal.json") && !file.endsWith("-guard-terminal.json")); }
async function cleanClose(h, pending, changes = {}, close = {}) {
  h.send("O", "算术42"); h.send("E", "fixture"); h.receipt(h.proof(changes)); h.close(close);
  return pending;
}

test("thin call binds synchronous spawn identity and preserves exact guard at final path", async () => {
  const h = harness(), pending = h.start();
  const originalGuard = Buffer.from(h.files.get(h.guardPath));
  assert.equal(h.callback.ownerPid, h.child.pid);
  assert.equal(h.callback.ownerIdentity.identitySource, "retained_child_handle");
  assert.equal(h.callback.program.path, h.command.executable);
  assert.equal(h.callback.program.sha256, h.command.nativeBuild.binarySha256);
  assert.equal(h.callback.bindingBase64, h.command.bindingBase64);
  assert.equal(h.callback.guard.nativeEvidenceRoot, path.dirname(h.command.executable));
  assert.equal(h.callback.nativeBuildDirectory, path.dirname(h.command.executable));
  assert.equal(h.callback.guardPath, h.guardPath);
  assert.equal(h.callback.startedEvidence, h.callback.guardRecord.startedEvidence);
  assert.equal(JSON.stringify(h.callback.guardRecord), originalGuard.toString());
  const result = await cleanClose(h, pending);
  assert.equal(result.stdout, "算术42"); assert.equal(result.stderr, "fixture");
  assert.equal(result.ownedReceipt.cleanupConfirmed, true); assert.equal(result.ownedReceipt.emptyJob, true);
  assert.equal(h.files.has(h.guardPath), false);
  assert.deepEqual(h.files.get(result.guardTerminalPath), originalGuard);
  assert.equal(h.writes.at(-1), "rename:" + result.guardTerminalPath);
  const saved = JSON.parse(h.files.get(result.ownedReceipt.guard.terminalEvidence));
  assert.equal(saved.liveOwnerCleanupConfirmed, true); assert.equal(saved.guardReleaseConfirmed, false);
  assert.deepEqual(result.nativeBuild, h.command.nativeBuild);
  assert.equal(h.stats.timers, 0); assert.equal(h.stats.intervals, 0);
});

test("finish receipt saves actual owner pipe end observations, including missing EOF", async () => {
  for (const [stdout, stderr] of [[true, true], [true, false], [false, true], [false, false]]) {
    const h = harness(), pending = h.start().catch(error => error);
    h.receipt(h.proof()); // Native R claims closed streams; caller EOF is observed separately.
    if (stdout) h.child.stdout.emit("end");
    if (stderr) h.child.stderr.emit("end");
    h.close({ eof: false });
    const result = await pending, receipt = result.ownedReceipt;
    assert.deepEqual({ ...receipt.ownerPipeEOF }, { stdout, stderr });
    const saved = JSON.parse(h.files.get(receipt.guard.terminalEvidence));
    assert.deepEqual(saved.ownerPipeEOF, { stdout, stderr });
    assert.equal(receipt.cleanupConfirmed, stdout && stderr);
    assert.equal(h.files.has(h.guardPath), !(stdout && stderr));
  }
});

test("spawn stream getter reports live bytes as independent copies from each call", async () => {
  const h = harness(), other = harness(), pending = h.start(), otherPending = other.start();
  const getBytes = h.callback.getStreamBytes, otherGetBytes = other.callback.getStreamBytes;
  assert.equal(typeof getBytes, "function");
  const first = getBytes(), second = getBytes(), writesBefore = h.writes.length;
  assert.deepEqual({ ...first }, { stdout: 0, stderr: 0 });
  assert.notEqual(first, second);
  first.stdout = 999; first.stderr = 999;
  assert.deepEqual({ ...getBytes() }, { stdout: 0, stderr: 0 });
  assert.equal(h.writes.length, writesBefore);
  h.send("O", "汉字");
  assert.deepEqual({ ...getBytes() }, { stdout: 6, stderr: 0 });
  assert.deepEqual({ ...otherGetBytes() }, { stdout: 0, stderr: 0 });
  h.send("E", "é"); other.send("E", "other");
  assert.deepEqual({ ...getBytes() }, { stdout: 6, stderr: 2 });
  assert.deepEqual({ ...otherGetBytes() }, { stdout: 0, stderr: 5 });
  for (const call of [h, other]) { call.receipt(call.proof()); call.close(); }
  const result = await pending, otherResult = await otherPending;
  assert.deepEqual({ ...getBytes() }, { ...result.ownedReceipt.streamBytes });
  assert.deepEqual({ ...otherGetBytes() }, { ...otherResult.ownedReceipt.streamBytes });
  assert.equal(result.ownedReceipt.cleanupConfirmed, true); assert.equal(otherResult.ownedReceipt.cleanupConfirmed, true);
  assert.equal(h.controls.length, 0); assert.equal(h.stats.kills, 0);
});

test("existing unfamiliar guard is refused before build/spawn and remains byte-identical", () => {
  const h = harness({ existingGuard: true }), before = Buffer.from(h.files.get(h.guardPath));
  assert.throws(() => h.start(), error => error.code === "OWNED_GUARD_BUSY");
  assert.deepEqual(h.files.get(h.guardPath), before); assert.equal(h.stats.builds, 0); assert.equal(h.stats.spawns, 0);
  assert.equal(h.writes.length, 0);
});

test("timeout/build options are capped and build time consumes the original total budget", () => {
  for (const timeout of [0, 1000, 180001, 1.5, NaN]) assert.throws(() => harness().start({ timeout }));
  assert.throws(() => harness().start({ maxBuffer: LIMIT + 1 }));
  assert.throws(() => harness().start({ onSpawn: true }));
  const h = harness({ buildMs: 9500 });
  assert.throws(() => h.start(), error => !!error.ownedReceipt && !error.ownedReceipt.cleanupConfirmed);
  assert.equal(h.stats.spawns, 0); assert.equal(h.files.has(h.guardPath), true);
});

test("old disk observation never substitutes for a missing live R", async () => {
  const h = harness(), pending = h.start().catch(error => error);
  h.files.set(h.command.observationPath, Buffer.from(JSON.stringify(h.proof())));
  h.close(); const error = await pending;
  assert.equal(error.code, "OWNED_CLEANUP_UNKNOWN"); assert.equal(error.ownedReceipt.cleanupConfirmed, false);
  assert.equal(h.files.has(h.guardPath), true);
});

test("every invalid native proof/actual close retains current guard", async () => {
  for (const changes of [{ bindingBase64: b64("old") }, { ownerPid: 2 }, { killOnJobClose: false },
    { assignedBeforeResume: false }, { stdoutClosed: false }, { stderrClosed: false }, { transportCompleted: false },
    { streamClosureVersion: "v1" }, { activeProcessesAfterCleanup: 1 }, { stdoutBytes: 999 },
    { streamCaptureError: "failed" }, { observationError: "write error" }, { emptyJob: false }]) {
    const h = harness(), pending = h.start().catch(error => error);
    const error = await cleanClose(h, pending, changes);
    assert.equal(error.ownedReceipt.cleanupConfirmed, false); assert.equal(h.files.has(h.guardPath), true);
  }
  for (const close of [{ code: 1 }, { signal: "SIGKILL" }, { eof: false }]) {
    const h = harness(), pending = h.start().catch(error => error);
    const error = await cleanClose(h, pending, {}, close);
    assert.equal(error.ownedReceipt.cleanupConfirmed, false); assert.equal(h.files.has(h.guardPath), true);
  }
});

test("nonzero worker status fails while real cleanup proof may release its own guard", async () => {
  const h = harness(), pending = h.start().catch(error => error);
  const error = await cleanClose(h, pending, { exitCode: 7 });
  assert.equal(error.code, 7); assert.equal(error.stderr, "fixture"); assert.equal(error.ownedReceipt.cleanupConfirmed, true);
});

test("duplicate, malformed, oversized and trailing frames fail closed", async () => {
  for (const kind of ["duplicate", "malformed", "base64", "overflow", "partial", "output_after_R", "null_R"]) {
    const h = harness(), pending = h.start().catch(error => error);
    if (kind === "duplicate") { h.receipt(h.proof()); h.receipt(h.proof()); }
    if (kind === "malformed") h.raw("X:YWJj\n");
    if (kind === "base64") h.raw("O:YQ\n");
    if (kind === "overflow") h.raw("O:" + "A".repeat(65536));
    if (kind === "partial") h.raw("O:YWJj");
    if (kind === "output_after_R") { h.receipt(h.proof()); h.send("O", "late"); }
    if (kind === "null_R") h.receipt(null);
    h.close(); const error = await pending;
    assert.equal(error.ownedReceipt.cleanupConfirmed, false, kind); assert.equal(h.files.has(h.guardPath), true, kind);
  }
});

test("combined stdout/stderr fullness fails even when each stream is below 8 MiB", async () => {
  const h = harness(), pending = h.start().catch(error => error), block = Buffer.alloc(4096, 65);
  for (let i = 0; i < LIMIT / block.length; i++) h.send(i % 2 ? "O" : "E", block);
  h.receipt(h.proof()); h.close(); const error = await pending;
  assert.equal(error.code, "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
  assert.equal(error.ownedReceipt.streamBytes.stdout + error.ownedReceipt.streamBytes.stderr, LIMIT);
  assert.equal(error.ownedReceipt.cleanupConfirmed, false); assert.equal(h.files.has(h.guardPath), true);
});

test("onSpawn exception is primary, requests managed stop, and cannot become success", async () => {
  const main = Object.assign(new Error("registry callback failed"), { code: "REGISTRY_FAILURE" });
  const h = harness(), pending = h.start({ onSpawn() { throw main; } }).catch(error => error);
  assert.equal(h.controls.length, 1); assert.equal(Buffer.from(h.controls[0].trim(), "base64").toString(), main.message);
  const error = await cleanClose(h, pending, { stopReason: main.message, exitCode: 1 });
  assert.equal(error, main); assert.equal(error.code, "REGISTRY_FAILURE");
  assert.equal(error.ownedReceipt.cleanupConfirmed, true); assert.equal(h.stats.spawns, 1);
  const asyncH = harness(), asyncPending = asyncH.start({ onSpawn: () => Promise.reject(new Error("async forbidden")) }).catch(error => error);
  assert.equal(asyncH.controls.length, 1);
  assert.match((await cleanClose(asyncH, asyncPending)).message, /synchronous/u);
});

test("abort exceptions and failed kill never replace the first resource error", async () => {
  const main = Object.assign(new Error("CPU resource exhausted"), { code: "RESOURCE_LIMIT" });
  const h = harness({ killFailure: true, primary: new Error("kill denied") });
  let calls = 0;
  const pending = h.start({ abortReason() { if (++calls > 1) throw main; return null; } }).catch(error => error);
  h.tick(9750); h.tick(10000); const error = await pending;
  assert.equal(error, main); assert.equal(error.ownedReceipt.firstStop.reason, main.message);
  assert.equal(h.stats.kills, 1); assert.equal(error.ownedReceipt.cleanupConfirmed, false);
  assert.equal(h.files.has(h.guardPath), true); assert.equal(h.stats.timers, 0);
});

test("resource abort before acquisition creates no guard or native build", () => {
  const main = new Error("pre-existing resource failure"), h = harness();
  assert.throws(() => h.start({ abortReason() { throw main; } }), error => error === main);
  assert.equal(h.files.has(h.guardPath), false); assert.equal(h.stats.builds, 0); assert.equal(h.stats.spawns, 0);
});

test("wall timeout requests stop at original work cutoff and never grants late cleanup", async () => {
  const h = harness({ buildMs: 500 }), pending = h.start().catch(error => error);
  assert.equal(h.command.args[2], "9000"); assert.equal(h.command.args[3], "1000");
  h.tick(9000); assert.equal(h.controls.length, 1); assert.equal(h.stats.kills, 0);
  h.tick(9750); assert.equal(h.stats.kills, 1);
  h.tick(10000); const error = await pending;
  assert.equal(error.code, "ETIMEDOUT"); assert.equal(error.ownedReceipt.elapsedMs, 10000);
  assert.equal(error.ownedReceipt.cleanupConfirmed, false); assert.equal(h.files.has(h.guardPath), true);
});

test("time spent in the final guard operation still belongs to the total timeout", async () => {
  const h = harness({ renameMs: 10000 }), pending = h.start().catch(error => error);
  const error = await cleanClose(h, pending);
  assert.equal(error.code, "ETIMEDOUT"); assert.equal(error.ownedReceipt.elapsedMs, 10000);
  // Cleanup was proven before archival; exceeding the budget cannot turn the
  // invocation into success or grant another attempt, and exact bytes survive.
  assert.equal(h.files.has(error.guardTerminalPath), true); assert.equal(h.stats.spawns, 1);
});

test("build, spawn, evidence persistence and guard identity failures preserve primary errors and guards", async () => {
  for (const phase of ["build", "spawn", "started", "terminal", "fsync", "rename", "guard_drift", "guard_link"]) {
    const main = Object.assign(new Error(phase + " failure"), { code: "ENOSPC" });
    const fault = { primary: main, buildFailure: phase === "build", spawnFailure: phase === "spawn",
      writeFailure: file => phase === "started" ? file.endsWith("-started.json") : phase === "terminal" && file.endsWith("-terminal.json"),
      syncFailure: file => phase === "fsync" && file.endsWith("-terminal.json"), renameFailure: phase === "rename",
      guardDrift: phase === "guard_drift", guardLink: phase === "guard_link" };
    const h = harness(fault); let error;
    if (phase === "build") { try { h.start(); } catch (caught) { error = caught; } }
    else { const pending = h.start().catch(caught => caught); error = phase === "spawn" ? await pending : await cleanClose(h, pending); }
    assert.equal(error.ownedReceipt.cleanupConfirmed, false, phase); assert.equal(h.files.has(h.guardPath), true, phase);
    if (!["guard_drift", "guard_link"].includes(phase)) assert.equal(error, main, phase);
    assert.ok(terminal(h) || error.ownedReceipt.guard.terminalEvidence, phase);
  }
  const main = Object.assign(new Error("first callback failure"), { code: "PRIMARY" });
  const h = harness({ primary: new Error("secondary ENOSPC"), writeFailure: file => file.endsWith("-terminal.json") });
  const pending = h.start({ onSpawn() { throw main; } }).catch(error => error);
  const error = await cleanClose(h, pending);
  assert.equal(error, main); assert.match(error.ownedReceipt.persistenceError, /secondary ENOSPC/u);
});

const nativeRoot = process.env.AI_PAINTER_PARAMETER60_NATIVE_FIXTURE_ROOT;
test("optional single private CPU arithmetic native fixture, <=20s including build/cleanup", { skip: !nativeRoot }, async () => {
  assert.equal(process.platform, "win32");
  assert.ok(path.isAbsolute(nativeRoot) && !fs.existsSync(nativeRoot), "explicit fresh private fixture cwd required");
  fs.mkdirSync(nativeRoot, { recursive: true });
  let spawnIdentity;
  const result = await runParameter60OwnedWorker(process.execPath,
    ["-e", "process.stdout.write(String(6*7));process.stderr.write('cpu-arithmetic-only');"],
    { cwd: nativeRoot, env: { ...process.env, CUDA_VISIBLE_DEVICES: "-1", NVIDIA_VISIBLE_DEVICES: "none",
      AI_PAINTER_CPU_ONLY: "1", AI_PAINTER_ALLOW_GPU: "0" }, timeout: 20000,
      onSpawn(value) { spawnIdentity = value; } });
  assert.equal(result.stdout, "42"); assert.equal(result.stderr, "cpu-arithmetic-only");
  assert.equal(result.ownedReceipt.cleanupConfirmed, true); assert.equal(result.ownedReceipt.emptyJob, true);
  assert.equal(result.ownedReceipt.proof.ownerPid, spawnIdentity.ownerPid);
  assert.equal(result.ownedReceipt.proof.bindingBase64, spawnIdentity.bindingBase64);
  assert.ok(result.ownedReceipt.elapsedMs < 20000);
  assert.equal(fs.existsSync(result.ownedReceipt.guard.path), false);
  assert.equal(fs.existsSync(result.guardTerminalPath), true);
  assert.equal(hash(fs.readFileSync(result.nativeBuild.binary)), result.nativeBuild.binarySha256);
  assert.equal(JSON.parse(fs.readFileSync(result.ownedReceipt.guard.terminalEvidence)).liveOwnerCleanupConfirmed, true);
  console.log(JSON.stringify({ privateCpuFixture: true, nativeRoot, nativeBuild: result.nativeBuild,
    terminalEvidence: result.ownedReceipt.guard.terminalEvidence, guardTerminalPath: result.guardTerminalPath,
    cleanupConfirmed: result.ownedReceipt.cleanupConfirmed, elapsedMs: result.ownedReceipt.elapsedMs }));
});
