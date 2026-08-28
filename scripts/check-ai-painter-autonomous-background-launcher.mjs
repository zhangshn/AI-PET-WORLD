import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchAutonomousClosedLoopBackground } from "./lib/ai-painter-autonomous-background-launcher-v1.mjs";
import { materializeAutonomousClosedLoopPackage } from "./lib/ai-painter-autonomous-package-materializer-v1.mjs";

const sourcePath = path.resolve("scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs");
const source = fs.readFileSync(sourcePath, "utf8");
assert.ok(source.includes("detached: true"));
assert.ok(source.includes("windowsHide: true"));
assert.ok(source.includes("child.unref()"));
assert.ok(source.includes("windows_wmi_win32_process_create"));
assert.ok(source.includes("Invoke-CimMethod -ClassName Win32_Process"));
assert.ok(source.includes("New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly"));
assert.ok(source.includes("progressPath"));
assert.ok(source.includes("heartbeatPath"));
assert.ok(source.includes("ownerAuthorizationRequired: false"));
assert.ok(!source.includes("owner-action-request.json"));
assert.ok(!source.includes("waiting_owner_authorization"));

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-background-launcher-"));
try {
  for (const relative of [
    "scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
    "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
    "scripts/lib/ai-painter-local-autonomy-governance-v3.mjs",
    "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json",
    "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json",
  ]) copy(relative);
  write("fixtures/input.json", "{\"fixture\":true}\n");
  write("fixtures/adapters.mjs", ["preflight", "execute", "validate", "review", "adjudicate", "finalize"]
    .map((phase) => `export async function ${phase}(context) { context.reportProgress({ phasePercent: 100, message: \"${phase}\" }); return { status: \"passed\" }; }`).join("\n") + "\n");
  const materialized = materializeAutonomousClosedLoopPackage({
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity: "background-launcher-integration-fixture",
    capabilityVersion: "background-launcher-fixture-v1",
    ownerAuthorizationRequired: false,
    maxInfrastructureRecoveryAttempts: 0,
    outputRoot: ".runtime/ai-painter/fixture-outputs/background-launcher-integration-fixture",
    programFiles: { adapters: "fixtures/adapters.mjs" },
    inputEvidencePaths: ["fixtures/input.json"],
    phaseAdapters: Object.fromEntries(["preflight", "execute", "validate", "review", "adjudicate", "finalize"]
      .map((phase) => [phase, { path: "fixtures/adapters.mjs", exportName: phase }])),
  }, { root: fixtureRoot, recordedAtUtc: "2026-08-24T00:00:00.000Z" });
  const receipt = await launchAutonomousClosedLoopBackground({
    root: fixtureRoot, packagePath: materialized.packagePath, packageSha256: materialized.packageSha256,
  });
  assert.equal(receipt.detachedFromCodex, true);
  assert.equal(receipt.ownerAuthorizationRequired, false);
  const terminalPath = path.join(fixtureRoot, ".runtime", "ai-painter", "autonomous-closed-loop-executions", materialized.packageIdentity, "phase-terminal.json");
  const deadline = Date.now() + 20_000;
  while (!fs.existsSync(terminalPath) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(fs.existsSync(terminalPath), "background integration fixture did not reach a terminal state");
  assert.equal(JSON.parse(fs.readFileSync(terminalPath, "utf8")).status, "completed");
  process.stdout.write(`${JSON.stringify({ status: "passed", windowsLaunchMethod: process.platform === "win32" ? "wmi_win32_process_create" : null, posixDetachedFallback: true, backgroundIntegrationCompleted: true, closesWithCodex: false, progressAndHeartbeatExposed: true, ownerAuthorizationRequired: false }, null, 2)}\n`);
} finally {
  const resolved = path.resolve(fixtureRoot);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function copy(relative) { write(relative, fs.readFileSync(path.resolve(relative))); }
function write(relative, bytes) { const absolute = path.join(fixtureRoot, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, bytes, { flag: "wx" }); }
