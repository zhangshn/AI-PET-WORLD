import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { replaceHeartbeatFile, guardedHeartbeat, ownedWorkerIsRunning } from "../run-ai-painter-learning-capacity-experiment.mjs";

test("already exited or signaled workers are never termination targets", () => {
  for (const child of [null, {pid:123,exitCode:0,signalCode:null}, {pid:123,exitCode:null,signalCode:"SIGTERM"},
    {pid:0,exitCode:null,signalCode:null}, {pid:"123",exitCode:null,signalCode:null}]) {
    assert.equal(ownedWorkerIsRunning(child), false);
  }
});

test("only the live spawned child identity can request termination", () => {
  assert.equal(ownedWorkerIsRunning({pid:123,exitCode:null,signalCode:null}), true);
});

test("transient Windows rename failures retry finitely without rewriting data", () => {
  const calls = [], delays = [];
  replaceHeartbeatFile("exact.tmp", "exact.json", { rename: (...args) => {
    calls.push(args);
    if (calls.length < 3) throw Object.assign(new Error("busy"), { code: "EPERM" });
  }, pause: ms => delays.push(ms) });
  assert.deepEqual(calls, Array.from({ length: 3 }, () => ["exact.tmp", "exact.json"]));
  assert.deepEqual(delays, [25, 50]);
});

test("persistent permission failures stop after six attempts", () => {
  const error = Object.assign(new Error("locked"), { code: "EACCES" });
  let attempts = 0;
  const delays = [];
  assert.throws(() => replaceHeartbeatFile("a.tmp", "a.json", {
    rename: () => { attempts += 1; throw error; }, pause: ms => delays.push(ms),
  }), e => e === error);
  assert.equal(attempts, 6);
  assert.deepEqual(delays, [25, 50, 75, 100, 125]);
});

test("unrelated IO errors are not retried or masked", () => {
  let attempts = 0;
  assert.throws(() => replaceHeartbeatFile("a.tmp", "a.json", {
    rename: () => { attempts += 1; throw Object.assign(new Error("missing"), { code: "ENOENT" }); },
    pause: () => assert.fail("must not pause"),
  }), { code: "ENOENT" });
  assert.equal(attempts, 1);
});

test("interval failure is delivered to the controller failure handler", () => {
  const failure = new Error("heartbeat unavailable");
  const events = [];
  const ok = guardedHeartbeat(() => { throw failure; }, error => events.push(error));
  assert.equal(ok, false);
  assert.deepEqual(events, [failure]);
});

test("successful heartbeat never requests worker termination", () => {
  let writes = 0;
  assert.equal(guardedHeartbeat(() => { writes += 1; }, () => assert.fail("no failure expected")), true);
  assert.equal(writes, 1);
});

test("failed replacement preserves both the old heartbeat and new temporary bytes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aip-heartbeat-"));
  const previous = path.join(dir, "heartbeat.json"), temporary = previous + ".tmp";
  try {
    fs.writeFileSync(previous, '{"sequence":1}\n');
    fs.writeFileSync(temporary, '{"sequence":2}\n');
    assert.throws(() => replaceHeartbeatFile(temporary, previous, {
      rename: () => { throw Object.assign(new Error("busy"), { code: "EBUSY" }); }, pause: () => {},
    }), { code: "EBUSY" });
    assert.equal(JSON.parse(fs.readFileSync(previous)).sequence, 1);
    assert.equal(JSON.parse(fs.readFileSync(temporary)).sequence, 2);
    replaceHeartbeatFile(temporary, previous);
    assert.equal(JSON.parse(fs.readFileSync(previous)).sequence, 2);
    assert.equal(fs.existsSync(temporary), false);
  } finally {
    for (const p of [previous, temporary]) if (fs.existsSync(p)) fs.unlinkSync(p);
    fs.rmdirSync(dir);
  }
});

test("actual Windows reader lock recovers without deleting the live heartbeat", { skip: process.platform !== "win32", timeout: 10000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aip-heartbeat-lock-"));
  const target = path.join(dir, "heartbeat.json"), temporary = target + ".tmp";
  let child;
  try {
    fs.writeFileSync(target, '{"sequence":1}\n');
    fs.writeFileSync(temporary, '{"sequence":2}\n');
    const escaped = target.replaceAll("'", "''");
    const script = `$stream=[System.IO.File]::Open('${escaped}',[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read); try { [Console]::WriteLine('locked'); Start-Sleep -Milliseconds 150 } finally { $stream.Dispose() }`;
    child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
    const completed = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => code === 0 ? resolve() : reject(new Error(`reader exit ${code}`))); });
    await new Promise((resolve, reject) => {
      child.stdout.on("data", value => { if (value.toString().includes("locked")) resolve(); });
      child.once("error", reject);
      child.once("close", () => reject(new Error("reader closed before lock confirmation")));
    });
    let attempts = 0;
    replaceHeartbeatFile(temporary, target, { rename: (a, b) => { attempts += 1; fs.renameSync(a, b); } });
    await completed;
    assert(attempts > 1, "test must encounter a real sharing violation");
    assert.equal(JSON.parse(fs.readFileSync(target)).sequence, 2);
  } finally {
    if (child && child.exitCode === null) child.kill();
    for (const p of [target, temporary]) if (fs.existsSync(p)) fs.unlinkSync(p);
    fs.rmdirSync(dir);
  }
});
