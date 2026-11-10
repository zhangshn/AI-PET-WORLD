import assert from "node:assert/strict"
import childProcess from "node:child_process"
import fs from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import test from "node:test"
import ts from "typescript"
import { processIdentity } from "../lib/windows-process-identity.mjs"
import { processIdentity as legacyIdentity, REQUIRED_PROGRAMS } from "../run-ai-painter-mvp256-dry-v24-training.mjs"

function replaceQuery(t, implementation) {
  const original = childProcess.execFileSync
  childProcess.execFileSync = implementation
  syncBuiltinESMExports()
  t.after(() => {
    childProcess.execFileSync = original
    syncBuiltinESMExports()
  })
}

test("legacy export remains the exact shared function and binds its source", () => {
  assert.equal(legacyIdentity, processIdentity)
  assert.equal(REQUIRED_PROGRAMS.processIdentity, "scripts/lib/windows-process-identity.mjs")
})

test("query preserves command, hidden window, timeout and output format", t => {
  const calls = []
  replaceQuery(t, (...args) => { calls.push(args); return " 42:2026-11-10T00:00:00.0000000Z\r\n" })
  assert.equal(processIdentity(42), "42:2026-11-10T00:00:00.0000000Z")
  assert.equal(calls.length, 1)
  const [command, args, options] = calls[0]
  assert.equal(command, "powershell.exe")
  assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-Command"])
  assert.equal(args[3], "$p=Get-CimInstance Win32_Process -Filter 'ProcessId = 42'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')")
  assert.deepEqual(options, { encoding: "utf8", windowsHide: true, timeout: 10_000 })
})

test("invalid process IDs cannot reach the operating system", t => {
  let calls = 0
  replaceQuery(t, () => { calls += 1; throw new Error("unexpected query") })
  for (const pid of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "42", "42; exit", null, undefined]) {
    assert.throws(() => processIdentity(pid), assert.AssertionError)
  }
  assert.equal(calls, 0)
})

test("query failure propagates without retry or invented identity", t => {
  const failure = Object.assign(new Error("query failed"), { status: 3 })
  let calls = 0
  replaceQuery(t, () => { calls += 1; throw failure })
  assert.throws(() => processIdentity(42), error => error === failure)
  assert.equal(calls, 1)
})

test("shared helper has only built-in imports; library consumers no longer import the training entry", () => {
  const read = name => fs.readFileSync(new URL(`../lib/${name}.mjs`, import.meta.url), "utf8")
  const imports = source => ts.createSourceFile("input.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    .statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text)
  assert.deepEqual(imports(read("windows-process-identity")), ["node:assert/strict", "node:child_process"])
  for (const name of [
    "ai-painter-decode1-entry-weight-quality-owned-native-v1",
    "ai-painter-decode1-entry-weight-quality-review-v1",
    "ai-painter-ecology-decode1-quality-owned-native-v1",
    "ai-painter-ecology-terrain-detail-quality-owned-native-v1",
    "ai-painter-ecology-quality-owned-native-v1",
    "ai-painter-ecology-terrain-detail-review-recovery-v1",
    "ai-painter-object-support-structure-quality-owned-native-v1",
  ]) {
    const dependencies = imports(read(name))
    assert.ok(dependencies.includes("./windows-process-identity.mjs"), name)
    assert.ok(!dependencies.includes("../run-ai-painter-mvp256-dry-v24-training.mjs"), name)
  }
})
