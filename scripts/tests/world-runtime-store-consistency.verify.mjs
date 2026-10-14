// Fixed, private CPU verification; run with two inherited logical processors.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const projectRoot = fileURLToPath(new URL("../../", import.meta.url))
const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "world-runtime-store-consistency-evidence-"))
const startedAtUtc = new Date().toISOString()
const deadline = Date.now() + 240000
const outputLimit = 8 * 1024 * 1024
// Reserve 2MiB for the fixed small test fixtures and 64KiB for the receipt.
let remaining = outputLimit - 2 * 1024 * 1024 - 64 * 1024
const files = [
  "src/world/runtime/world-runtime-production-store.ts",
  "src/world/runtime/world-runtime-store.ts",
  "src/world/runtime/world-runtime-record-validation.ts",
  "scripts/tests/world-runtime-store-consistency.test.mjs",
  "scripts/tests/world-runtime-store-consistency.verify.mjs",
]
const bindings = files.map((file) => ({ file, sha256: createHash("sha256").update(fs.readFileSync(path.join(projectRoot, file))).digest("hex") }))
const commands = [
  ["store-tests", ["--test", "--test-isolation=none", "--test-concurrency=1", "--test-timeout=240000", "--test-reporter=tap", files[3]]],
  ["scoped-eslint", ["node_modules/eslint/bin/eslint.js", ...files]],
  ["typecheck", ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false", "--pretty", "false"]],
]
const results = []
for (const [name, args] of commands) {
  const started = Date.now()
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot, windowsHide: true, encoding: "utf8",
    timeout: Math.max(1, deadline - Date.now()), maxBuffer: Math.floor(remaining / 4),
    env: { ...process.env, UV_THREADPOOL_SIZE: "2", OMP_NUM_THREADS: "2" },
  })
  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""
  const bytes = Buffer.byteLength(stdout) + Buffer.byteLength(stderr)
  remaining -= bytes * 2 // Both captured streams and persisted log bytes count.
  const stdoutPath = path.join(evidenceRoot, `${name}.stdout.log`)
  const stderrPath = path.join(evidenceRoot, `${name}.stderr.log`)
  fs.writeFileSync(stdoutPath, stdout, "utf8")
  fs.writeFileSync(stderrPath, stderr, "utf8")
  const entry = { name, command: [process.execPath, ...args], exitCode: result.status, elapsedMs: Date.now() - started, streamBytes: bytes, stdoutPath, stderrPath, error: result.error?.message ?? null }
  results.push(entry)
  process.stdout.write(`${name}: ${entry.exitCode === 0 && !entry.error ? "passed" : "failed"}, ${entry.elapsedMs}ms\n`)
  if (result.error || Date.now() >= deadline || remaining < 64 * 1024) break
}
const changedDuringVerification = bindings.filter(({ file, sha256 }) => createHash("sha256").update(fs.readFileSync(path.join(projectRoot, file))).digest("hex") !== sha256)
const receipt = {
  startedAtUtc, completedAtUtc: new Date().toISOString(), evidenceRoot,
  budget: { cpuLogicalProcessors: 2, inheritedAffinityRequired: true, wallTimeMs: 240000, outputBytes: outputLimit },
  bindings, results, changedDuringVerification,
  limitations: ["Storage tests mock path resolution within a private fixture; actual runtime-path-security integration is not certified.", "Global typecheck is read-only and can include other concurrent changes."],
}
const receiptPath = path.join(evidenceRoot, "verification.json")
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8")
process.stdout.write(`Evidence: ${receiptPath}\n`)
process.exitCode = results.length === commands.length && results.every((r) => r.exitCode === 0 && !r.error) && changedDuringVerification.length === 0 ? 0 : 1
