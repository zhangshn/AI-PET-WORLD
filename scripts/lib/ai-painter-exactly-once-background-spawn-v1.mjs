import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const EXACTLY_ONCE_SPAWN_ATTEMPT_SCHEMA =
  "ai-painter-exactly-once-background-spawn-attempt-v1";

export function prepareExactlyOnceBackgroundSpawn({
  projectRoot = process.cwd(),
  attemptPath,
  launchIdentity,
  runnerPath,
  runnerSha256,
  runnerArgs,
  recordedAtUtc,
  nonceFactory = () => crypto.randomUUID(),
} = {}) {
  const root = path.resolve(projectRoot);
  const absoluteAttempt = resolveInside(root, attemptPath,
    "background spawn attempt path");
  validateRequest({ launchIdentity, runnerPath, runnerSha256, runnerArgs, recordedAtUtc });
  const request = {
    launchIdentity,
    nodeExecutable: process.execPath,
    runnerPath,
    runnerSha256,
    runnerArgs,
  };
  if (fs.existsSync(absoluteAttempt)) {
    const existing = readJson(absoluteAttempt);
    validateExactlyOnceBackgroundSpawnAttempt(existing, request);
    return Object.freeze(existing);
  }
  const nonce = String(nonceFactory());
  assert.match(nonce, /^[A-Za-z0-9][A-Za-z0-9-]{7,127}$/u,
    "background spawn nonce is invalid");
  const processMarker = `--title=ai-painter-launch-${nonce}`;
  const commandIdentitySha256 = sha256Canonical({ ...request, processMarker });
  const attempt = {
    schemaVersion: EXACTLY_ONCE_SPAWN_ATTEMPT_SCHEMA,
    status: "prepared_before_process_spawn",
    ...request,
    nonce,
    processMarker,
    commandIdentitySha256,
    repeatedSpawnAllowed: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  };
  fs.mkdirSync(path.dirname(absoluteAttempt), { recursive: true });
  fs.writeFileSync(absoluteAttempt, `${JSON.stringify(attempt, null, 2)}\n`, {
    flag: "wx",
  });
  return Object.freeze(attempt);
}

export function validateExactlyOnceBackgroundSpawnAttempt(attempt, expected = null) {
  assert.equal(attempt?.schemaVersion, EXACTLY_ONCE_SPAWN_ATTEMPT_SCHEMA);
  assert.equal(attempt.status, "prepared_before_process_spawn");
  assert.match(attempt.launchIdentity ?? "",
    /^[A-Za-z0-9][A-Za-z0-9._-]{7,255}$/u,
  "background spawn launch identity is invalid");
  assert.equal(attempt.nodeExecutable, process.execPath,
    "background spawn Node executable changed");
  assert.ok(typeof attempt.runnerPath === "string" && attempt.runnerPath.length > 0,
    "background spawn runner path is missing");
  assert.match(attempt.runnerSha256 ?? "", /^[a-f0-9]{64}$/u,
    "background spawn runner SHA-256 is invalid");
  assert.ok(Array.isArray(attempt.runnerArgs)
    && attempt.runnerArgs.every((value) => typeof value === "string"),
  "background spawn runner arguments are invalid");
  assert.match(attempt.nonce ?? "", /^[A-Za-z0-9][A-Za-z0-9-]{7,127}$/u,
    "background spawn nonce is invalid");
  assert.equal(attempt.processMarker, `--title=ai-painter-launch-${attempt.nonce}`,
    "background spawn process marker mismatch");
  assert.equal(attempt.commandIdentitySha256, sha256Canonical({
    launchIdentity: attempt.launchIdentity,
    nodeExecutable: attempt.nodeExecutable,
    runnerPath: attempt.runnerPath,
    runnerSha256: attempt.runnerSha256,
    runnerArgs: attempt.runnerArgs,
    processMarker: attempt.processMarker,
  }), "background spawn command identity SHA-256 mismatch");
  assert.equal(attempt.repeatedSpawnAllowed, false);
  assert.equal(attempt.ownerAuthorizationRequired, false);
  assert.ok(Number.isFinite(Date.parse(attempt.recordedAtUtc)),
    "background spawn timestamp is invalid");
  if (expected) {
    for (const key of [
      "launchIdentity", "nodeExecutable", "runnerPath", "runnerSha256",
    ]) assert.equal(attempt[key], expected[key],
      `background spawn attempt ${key} changed`);
    assert.deepEqual(attempt.runnerArgs, expected.runnerArgs,
      "background spawn attempt runner arguments changed");
  }
  return true;
}

export function exactSpawnNodeArguments(attempt, absoluteRunner) {
  validateExactlyOnceBackgroundSpawnAttempt(attempt);
  return [attempt.processMarker, absoluteRunner, ...attempt.runnerArgs];
}

export function claimExactlyOneBackgroundSpawnMatch(observation, attempt) {
  validateExactlyOnceBackgroundSpawnAttempt(attempt);
  assert.ok(observation && typeof observation === "object",
    "background spawn recovery observation is invalid");
  assert.ok(["matched", "not_found", "indeterminate"].includes(observation.status),
    "background spawn recovery status is invalid");
  if (observation.status !== "matched") {
    throw new Error(observation.status === "not_found"
      ? "prepared background spawn has no uniquely active process; repeat spawn is forbidden"
      : "prepared background spawn process identity is indeterminate");
  }
  assert.ok(Array.isArray(observation.matches),
    "background spawn recovery matches are missing");
  assert.equal(observation.matches.length, 1,
    "background spawn nonce does not identify exactly one active process");
  const match = observation.matches[0];
  assert.equal(match.commandIdentitySha256, attempt.commandIdentitySha256,
    "background spawn recovered command identity mismatch");
  validateProcessIdentity(match);
  return Object.freeze(match);
}

export function probeExactlyOnceBackgroundSpawn({
  projectRoot = process.cwd(), attempt,
} = {}) {
  const root = path.resolve(projectRoot);
  validateExactlyOnceBackgroundSpawnAttempt(attempt);
  try {
    const rows = process.platform === "win32"
      ? queryWindows(attempt, root)
      : queryPosix(attempt, root);
    const matches = rows.filter((row) => commandMatches(row.commandLine, attempt))
      .map((row) => ({
        processId: row.processId,
        processStartIdentity: `${row.processId}:${row.creationDateUtc}`,
        processIdentitySource: row.processIdentitySource,
        processCreationDateUtc: row.creationDateUtc,
        launchMethod: row.launchMethod,
        windowsHidden: process.platform === "win32",
        commandIdentitySha256: attempt.commandIdentitySha256,
      }));
    return matches.length === 0
      ? { status: "not_found", matches: [] }
      : { status: "matched", matches };
  } catch {
    return { status: "indeterminate", matches: [] };
  }
}

function queryWindows(attempt, root) {
  const marker = escapePowerShellSingleQuoted(attempt.processMarker);
  const script = [
    "$ErrorActionPreference='Stop'",
    `$marker='${marker}'`,
    "$rows=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($marker) } | ForEach-Object { [ordered]@{ processId=[int]$_.ProcessId; creationDateUtc=$_.CreationDate.ToUniversalTime().ToString('o'); commandLine=[string]$_.CommandLine } })",
    "$rows | ConvertTo-Json -Compress",
  ].join("\n");
  const output = execFileSync("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script,
  ], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 15_000 });
  const parsed = JSON.parse(String(output).replace(/^\uFEFF/u, "").trim() || "[]");
  return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    processId: Number(row.processId),
    creationDateUtc: row.creationDateUtc,
    commandLine: String(row.commandLine ?? ""),
    processIdentitySource: "windows_cim_nonce_commandline_creation_date_v1",
    launchMethod: "recovered_windows_exact_command_identity",
  }));
}

function queryPosix(attempt, root) {
  const output = execFileSync("ps", ["-eo", "pid=,lstart=,args="], {
    cwd: root, encoding: "utf8", timeout: 15_000,
  });
  return String(output).split(/\r?\n/u).filter((line) => line.includes(attempt.processMarker))
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(.{24})\s+(.+)$/u);
      assert.ok(match, "POSIX process row cannot be parsed");
      return {
        processId: Number(match[1]),
        creationDateUtc: new Date(match[2]).toISOString(),
        commandLine: match[3],
        processIdentitySource: "posix_ps_nonce_commandline_lstart_v1",
        launchMethod: "recovered_posix_exact_command_identity",
      };
    });
}

function commandMatches(commandLine, attempt) {
  const normalized = String(commandLine).replaceAll("\\", "/");
  const required = [
    attempt.processMarker,
    attempt.runnerPath.replaceAll("\\", "/"),
    ...attempt.runnerArgs.map((value) => value.replaceAll("\\", "/")),
  ];
  return required.every((token) => normalized.includes(token));
}

function validateProcessIdentity(value) {
  assert.ok(Number.isInteger(value.processId) && value.processId > 0,
    "background spawn recovered PID is invalid");
  assert.ok(typeof value.processCreationDateUtc === "string"
    && Number.isFinite(Date.parse(value.processCreationDateUtc)),
  "background spawn recovered creation time is invalid");
  assert.equal(value.processStartIdentity,
    `${value.processId}:${value.processCreationDateUtc}`,
  "background spawn recovered PID/start identity mismatch");
}

function validateRequest(value) {
  assert.match(value.launchIdentity ?? "",
    /^[A-Za-z0-9][A-Za-z0-9._-]{7,255}$/u,
  "background spawn launch identity is invalid");
  assert.ok(typeof value.runnerPath === "string" && value.runnerPath.length > 0);
  assert.match(value.runnerSha256 ?? "", /^[a-f0-9]{64}$/u);
  assert.ok(Array.isArray(value.runnerArgs)
    && value.runnerArgs.every((item) => typeof item === "string"));
  assert.ok(Number.isFinite(Date.parse(value.recordedAtUtc)));
}

function resolveInside(root, value, label) {
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
  const relative = path.relative(root, absolute);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    `${label} escapes project root`);
  return absolute;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
}

function sha256Canonical(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
  );
  return value;
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replaceAll("'", "''");
}
