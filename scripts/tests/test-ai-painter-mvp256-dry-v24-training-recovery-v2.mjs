import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

import { ROOT, RECOVERY_POLICY, preflight, updateHeartbeat,
  verifyRecoveryBoundary } from "../run-ai-painter-mvp256-dry-v24-training-recovery-v2.mjs"

const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

test("recovery binds the real zero-step predecessor and does not reuse its claim", () => {
  const bytes = fs.readFileSync(path.join(ROOT, RECOVERY_POLICY))
  const result = verifyRecoveryBoundary(ROOT,
    { path: RECOVERY_POLICY, sha256: digest(bytes) })
  assert.equal(result.policy.additionalExecutionAttempts, 1)
  assert.equal(result.policy.automaticTrainingRetries, 0)
  assert.equal(result.policy.modelChangesAllowed, false)
  assert.equal(result.policy.reviewThresholdChangesAllowed, false)
})

test("CPU-only preflight requires the last terminal to be the bound failed run", async () => {
  const result = await preflight()
  assert.equal(result.workerPreflight.trainingStarted, false)
  assert.equal(result.workerPreflight.gpuInitialized, false)
  assert.equal(result.workerPreflight.optimizerCreated, false)
  assert.equal(result.predecessorFailure.path,
    result.recoveryPolicy && verifyRecoveryBoundary(ROOT, result.recoveryPolicy).predecessorFailure.path)
})

test("recovery heartbeat retries a real transient Windows read lock without changing the old bytes first",
  { skip: process.platform !== "win32", timeout: 10_000 }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aip-dry-v24-recovery-"))
    const dir = path.join(root, "runs", "candidate")
    fs.mkdirSync(dir, { recursive: true })
    const target = path.join(dir, "heartbeat.json")
    const previous = { runId: "candidate", processId: 123, heartbeatAtUtc: "2026-01-01T00:00:00.000Z" }
    fs.writeFileSync(target, `${JSON.stringify(previous)}\n`)
    const escaped = target.replaceAll("'", "''")
    const script = `$stream=[System.IO.File]::Open('${escaped}',[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read); try { [Console]::WriteLine('locked'); Start-Sleep -Milliseconds 800 } finally { $stream.Dispose() }`
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true })
    try {
      const completed = new Promise((resolve, reject) => {
        child.once("error", reject)
        child.once("close", code => code === 0 ? resolve() : reject(new Error(`reader exited ${code}`)))
      })
      await new Promise((resolve, reject) => {
        child.stdout.on("data", value => { if (value.toString().includes("locked")) resolve() })
        child.once("error", reject)
        child.once("close", () => reject(new Error("reader closed before lock")))
      })
      assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), previous)
      const result = updateHeartbeat(root, "runs/candidate",
        { runId: "candidate", processId: 123 })
      assert.equal(result.recovered, true)
      assert(result.attempts > 1)
      await completed
      const current = JSON.parse(fs.readFileSync(target, "utf8"))
      assert.equal(current.runId, "candidate")
      assert.equal(current.processId, 123)
      assert.notEqual(current.heartbeatAtUtc, previous.heartbeatAtUtc)
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        await new Promise(resolve => child.once("close", resolve))
      for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name))
      fs.rmdirSync(dir)
      fs.rmdirSync(path.join(root, "runs"))
      fs.rmdirSync(root)
    }
  })
