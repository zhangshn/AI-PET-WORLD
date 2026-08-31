import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { sha256File, validateClosedLoopPackage } from "./ai-painter-autonomous-closed-loop-v1.mjs";
import {
  claimExactlyOneBackgroundSpawnMatch,
  exactSpawnNodeArguments,
  prepareExactlyOnceBackgroundSpawn,
  probeExactlyOnceBackgroundSpawn,
  validateExactlyOnceBackgroundSpawnAttempt,
} from "./ai-painter-exactly-once-background-spawn-v1.mjs";

export const BACKGROUND_LAUNCH_ROOT = ".runtime/ai-painter/autonomous-background-launches";

export function launchProjectCommandBackground({
  root = process.cwd(), launchIdentity, runnerPath, runnerArgs = [],
  receiptRoot = BACKGROUND_LAUNCH_ROOT, recordedAtUtc = new Date().toISOString(),
  attemptProbe = probeExactlyOnceBackgroundSpawn,
  processLauncher = null,
  _testHooks = null,
}) {
  if (!/^[a-z0-9][a-z0-9-]{7,127}$/.test(launchIdentity ?? "")) throw new Error("background launch identity is invalid");
  if (!Array.isArray(runnerArgs) || runnerArgs.some((value) => typeof value !== "string")) throw new Error("background runner arguments are invalid");
  const absoluteRunner = resolveExisting(root, runnerPath);
  const launchRoot = resolveInside(root, `${receiptRoot}/${launchIdentity}`);
  fs.mkdirSync(path.dirname(launchRoot), { recursive: true });
  const namespaceCreated = !fs.existsSync(launchRoot);
  if (namespaceCreated) fs.mkdirSync(launchRoot, { recursive: false });
  const attemptPath = path.join(launchRoot, "spawn-attempt.json");
  const attempt = prepareExactlyOnceBackgroundSpawn({
    projectRoot: root,
    attemptPath,
    launchIdentity,
    runnerPath,
    runnerSha256: sha256File(absoluteRunner),
    runnerArgs,
    recordedAtUtc,
  });
  invokeHook(_testHooks, "afterSpawnAttemptPersisted", { attempt });
  const receiptPath = path.join(launchRoot, "launch-receipt.json");
  if (fs.existsSync(receiptPath)) {
    const persisted = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    validateCommandReceipt(persisted, {
      root, attempt, attemptPath, runnerPath, runnerArgs,
    });
    return persisted;
  }
  let launch;
  let recoveredAfterInterruptedSpawn = false;
  if (!namespaceCreated) {
    const observation = attemptProbe({ projectRoot: root, attempt });
    launch = claimExactlyOneBackgroundSpawnMatch(observation, attempt);
    recoveredAfterInterruptedSpawn = true;
  } else {
    const launcher = processLauncher ?? (process.platform === "win32"
      ? launchCommandWithWindowsWmi
      : launchCommandDetached);
    launch = launcher({
      root,
      launchRoot,
      executable: process.execPath,
      absoluteRunner,
      runnerArgs,
      attempt,
    });
    invokeHook(_testHooks, "afterProcessSpawnBeforeReceipt", { attempt, launch });
  }
  validateBackgroundProcessIdentity(launch);
  const receipt = {
    schemaVersion: "ai-painter-local-program-background-command-receipt-v1",
    status: "background_process_started", launchIdentity, runnerPath,
    runnerSha256: sha256File(absoluteRunner), runnerArgs, processId: launch.processId,
    processStartIdentity: launch.processStartIdentity,
    processIdentitySource: launch.processIdentitySource,
    processCreationDateUtc: launch.processCreationDateUtc,
    launchMethod: launch.launchMethod, detachedFromCodex: true,
    spawnAttempt: {
      path: path.relative(path.resolve(root), attemptPath).replaceAll("\\", "/"),
      sha256: sha256File(attemptPath),
    },
    commandIdentitySha256: attempt.commandIdentitySha256,
    recoveredAfterInterruptedSpawn,
    repeatedSpawnAllowed: false,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    recordedAtUtc: attempt.recordedAtUtc,
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  validateCommandReceipt(receipt, {
    root, attempt, attemptPath, runnerPath, runnerArgs,
  });
  return receipt;
}

export function validateProjectCommandBackgroundReceipt({
  root = process.cwd(),
  receipt,
  launchIdentity,
  runnerPath,
  runnerArgs = [],
  receiptRoot = BACKGROUND_LAUNCH_ROOT,
} = {}) {
  const launchRoot = resolveInside(root, `${receiptRoot}/${launchIdentity}`);
  const attemptPath = path.join(launchRoot, "spawn-attempt.json");
  const receiptPath = path.join(launchRoot, "launch-receipt.json");
  if (!fs.existsSync(attemptPath) || !fs.existsSync(receiptPath)) {
    throw new Error("background command receipt namespace is incomplete");
  }
  const attempt = JSON.parse(fs.readFileSync(attemptPath, "utf8"));
  const persisted = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  if (JSON.stringify(persisted) !== JSON.stringify(receipt)) {
    throw new Error("background command receipt differs from persisted bytes");
  }
  validateExactlyOnceBackgroundSpawnAttempt(attempt, {
    launchIdentity,
    nodeExecutable: process.execPath,
    runnerPath,
    runnerSha256: sha256File(resolveExisting(root, runnerPath)),
    runnerArgs,
  });
  validateCommandReceipt(receipt, {
    root, attempt, attemptPath, runnerPath, runnerArgs,
  });
  return true;
}

export async function launchAutonomousClosedLoopBackground({
  root = process.cwd(), packagePath, packageSha256,
  runnerPath = "scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
  nodeExecutable = process.execPath, recordedAtUtc = new Date().toISOString(),
  attemptProbe = probeExactlyOnceBackgroundSpawn,
  processLauncher = null,
  _testHooks = null,
}) {
  const absolutePackage = resolveExisting(root, packagePath);
  if (sha256File(absolutePackage) !== packageSha256) throw new Error("background package SHA-256 mismatch");
  const spec = JSON.parse(fs.readFileSync(absolutePackage, "utf8"));
  validateClosedLoopPackage(spec, { root, packageSha256 });
  const absoluteRunner = resolveExisting(root, runnerPath);
  if (path.resolve(nodeExecutable) !== path.resolve(process.execPath)) {
    throw new Error("autonomous background launcher requires the current trusted Node executable");
  }
  const launchRoot = resolveInside(root, `${BACKGROUND_LAUNCH_ROOT}/${spec.packageIdentity}`);
  fs.mkdirSync(path.dirname(launchRoot), { recursive: true });
  const namespaceCreated = !fs.existsSync(launchRoot);
  if (namespaceCreated) fs.mkdirSync(launchRoot, { recursive: false });
  const receiptPath = path.join(launchRoot, "launch-receipt.json");
  const attemptPath = path.join(launchRoot, "spawn-attempt.json");
  if (!namespaceCreated && fs.existsSync(receiptPath) && !fs.existsSync(attemptPath)) {
    const legacy = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    validateLegacyAutonomousReceipt(legacy, { spec, packagePath, packageSha256, runnerPath });
    return Object.freeze({ ...legacy, legacyReceiptReadOnly: true });
  }
  if (!namespaceCreated && !fs.existsSync(attemptPath)) {
    throw new Error("existing autonomous background launch has no immutable spawn attempt");
  }
  const runnerArgs = ["--package", packagePath, "--package-sha256", packageSha256];
  const attempt = prepareExactlyOnceBackgroundSpawn({
    projectRoot: root,
    attemptPath,
    launchIdentity: spec.packageIdentity,
    runnerPath,
    runnerSha256: sha256File(absoluteRunner),
    runnerArgs,
    recordedAtUtc,
  });
  invokeHook(_testHooks, "afterSpawnAttemptPersisted", { attempt });
  if (fs.existsSync(receiptPath)) {
    const persisted = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    validateAutonomousReceipt(persisted, {
      attempt, spec, packagePath, packageSha256, runnerPath,
    });
    return Object.freeze(persisted);
  }
  let launch;
  let recoveredAfterInterruptedSpawn = false;
  if (!namespaceCreated) {
    launch = claimExactlyOneBackgroundSpawnMatch(
      await attemptProbe({ projectRoot: root, attempt }), attempt,
    );
    recoveredAfterInterruptedSpawn = true;
  } else {
    const launcher = processLauncher ?? (process.platform === "win32"
      ? launchWithWindowsWmi
      : launchWithDetachedProcess);
    launch = await launcher({
      root, launchRoot, nodeExecutable, absoluteRunner, runnerArgs, attempt,
    });
    invokeHook(_testHooks, "afterProcessSpawnBeforeReceipt", { attempt, launch });
  }
  validateBackgroundProcessIdentity(launch);
  const receipt = {
    schemaVersion: "ai-painter-autonomous-background-launch-receipt-v1",
    status: "background_process_started",
    packageIdentity: spec.packageIdentity, packagePath, packageSha256,
    runnerPath, runnerSha256: sha256File(absoluteRunner), processId: launch.processId,
    processStartIdentity: launch.processStartIdentity,
    processIdentitySource: launch.processIdentitySource,
    processCreationDateUtc: launch.processCreationDateUtc,
    launchMethod: launch.launchMethod, detachedFromCodex: true, windowsHidden: process.platform === "win32",
    spawnAttempt: {
      path: path.relative(path.resolve(root), attemptPath).replaceAll("\\", "/"),
      sha256: sha256File(attemptPath),
    },
    commandIdentitySha256: attempt.commandIdentitySha256,
    recoveredAfterInterruptedSpawn,
    repeatedSpawnAllowed: false,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    progressPath: `.runtime/ai-painter/autonomous-closed-loop-executions/${spec.packageIdentity}/progress.json`,
    heartbeatPath: `.runtime/ai-painter/autonomous-closed-loop-executions/${spec.packageIdentity}/heartbeat.json`,
    stdoutPath: launch.stdoutPath, stderrPath: launch.stderrPath,
    consoleLogsCaptured: launch.consoleLogsCaptured,
    recordedAtUtc: attempt.recordedAtUtc,
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  return Object.freeze(receipt);
}

function launchWithWindowsWmi({ root, nodeExecutable, absoluteRunner, runnerArgs, attempt }) {
  return {
    ...launchCommandWithWindowsWmi({
      root,
      executable: nodeExecutable,
      absoluteRunner,
      runnerArgs,
      attempt,
    }),
    stdoutPath: null,
    stderrPath: null,
    consoleLogsCaptured: false,
  };
}

function launchCommandWithWindowsWmi({
  root, executable, absoluteRunner, runnerArgs, attempt,
}) {
  const commandLine = [executable, ...exactSpawnNodeArguments(attempt, absoluteRunner)]
    .map(quoteWindowsCommandLineArgument).join(" ");
  const projectRoot = path.resolve(root);
  const script = [
    `$commandLine = '${escapePowerShellSingleQuoted(commandLine)}'`,
    `$workingDirectory = '${escapePowerShellSingleQuoted(projectRoot)}'`,
    "$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly",
    "$startup.ShowWindow = 0",
    "$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; CurrentDirectory = $workingDirectory; ProcessStartupInformation = $startup }",
    "if ($result.ReturnValue -ne 0) { throw ('Win32_Process.Create failed with code ' + $result.ReturnValue) }",
    "$observed=Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$result.ProcessId) -ErrorAction Stop",
    "[ordered]@{ processId=[int]$observed.ProcessId; creationDateUtc=$observed.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress",
  ].join("\n");
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    cwd: projectRoot, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const parsed = JSON.parse(output.replace(/^\uFEFF/u, ""));
  const processId = Number(parsed.processId);
  if (!Number.isInteger(processId) || processId <= 0) throw new Error("WMI background command returned an invalid process id");
  if (!Number.isFinite(Date.parse(parsed.creationDateUtc))) throw new Error("WMI background command returned an invalid process creation time");
  return {
    processId,
    processStartIdentity: `${processId}:${parsed.creationDateUtc}`,
    processIdentitySource: "windows_cim_nonce_commandline_creation_date_v1",
    processCreationDateUtc: parsed.creationDateUtc,
    launchMethod: "windows_wmi_win32_process_create_exactly_once",
  };
}

function launchCommandDetached({
  root, launchRoot, executable, absoluteRunner, runnerArgs, attempt,
}) {
  const stdout = fs.openSync(path.join(launchRoot, "stdout.log"), "ax");
  const stderr = fs.openSync(path.join(launchRoot, "stderr.log"), "ax");
  let child;
  try {
    child = spawn(executable, exactSpawnNodeArguments(attempt, absoluteRunner), { cwd: path.resolve(root), detached: true, windowsHide: true, stdio: ["ignore", stdout, stderr] });
    child.unref();
  } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  const started = execFileSync("ps", ["-o", "lstart=", "-p", String(child.pid)], {
    cwd: path.resolve(root), encoding: "utf8", timeout: 10_000,
  }).trim();
  if (!started) throw new Error("detached background process start identity is unavailable");
  const creationDateUtc = new Date(started).toISOString();
  return {
    processId: child.pid,
    processStartIdentity: `${child.pid}:${creationDateUtc}`,
    processIdentitySource: "posix_ps_nonce_commandline_lstart_v1",
    processCreationDateUtc: creationDateUtc,
    launchMethod: "detached_process_group_exactly_once",
  };
}

function validateCommandReceipt(receipt, {
  root, attempt, attemptPath, runnerPath, runnerArgs,
}) {
  if (receipt?.schemaVersion !== "ai-painter-local-program-background-command-receipt-v1"
    || receipt.status !== "background_process_started") {
    throw new Error("background command receipt schema/status mismatch");
  }
  if (receipt.launchIdentity !== attempt.launchIdentity
    || receipt.runnerPath !== runnerPath
    || receipt.runnerSha256 !== attempt.runnerSha256
    || receipt.commandIdentitySha256 !== attempt.commandIdentitySha256) {
    throw new Error("background command receipt identity mismatch");
  }
  if (JSON.stringify(receipt.runnerArgs) !== JSON.stringify(runnerArgs)
    || receipt.repeatedSpawnAllowed !== false) {
    throw new Error("background command receipt arguments/replay policy mismatch");
  }
  validateBackgroundProcessIdentity(receipt);
  if (receipt.detachedFromCodex !== true
    || receipt.ownerAuthorizationRequired !== false
    || receipt.ownerResponseRequired !== false
    || typeof receipt.recoveredAfterInterruptedSpawn !== "boolean"
    || receipt.recordedAtUtc !== attempt.recordedAtUtc) {
    throw new Error("background command receipt execution policy mismatch");
  }
  const expectedAttemptPath = path.relative(path.resolve(root), attemptPath)
    .replaceAll("\\", "/");
  if (receipt.spawnAttempt?.path !== expectedAttemptPath
    || receipt.spawnAttempt?.sha256 !== sha256File(attemptPath)) {
    throw new Error("background command receipt spawn-attempt binding mismatch");
  }
}

function invokeHook(hooks, name, value) {
  if (typeof hooks?.[name] === "function") hooks[name](value);
}

async function launchWithDetachedProcess({ root, launchRoot, nodeExecutable, absoluteRunner, attempt }) {
  const stdoutRelative = path.relative(path.resolve(root), path.join(launchRoot, "stdout.log")).replaceAll("\\", "/");
  const stderrRelative = path.relative(path.resolve(root), path.join(launchRoot, "stderr.log")).replaceAll("\\", "/");
  const stdout = fs.openSync(path.join(launchRoot, "stdout.log"), "ax");
  const stderr = fs.openSync(path.join(launchRoot, "stderr.log"), "ax");
  let child;
  try {
    child = spawn(nodeExecutable, exactSpawnNodeArguments(attempt, absoluteRunner), {
      cwd: path.resolve(root), detached: true, windowsHide: true, stdio: ["ignore", stdout, stderr],
      env: { ...process.env, AI_PAINTER_AUTONOMOUS_BACKGROUND: "1" },
    });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
  } finally {
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  }
  const started = execFileSync("ps", ["-o", "lstart=", "-p", String(child.pid)], {
    cwd: path.resolve(root), encoding: "utf8", timeout: 10_000,
  }).trim();
  if (!started) throw new Error("autonomous detached process start identity is unavailable");
  const creationDateUtc = new Date(started).toISOString();
  return {
    processId: child.pid,
    processStartIdentity: `${child.pid}:${creationDateUtc}`,
    processIdentitySource: "posix_ps_nonce_commandline_lstart_v1",
    processCreationDateUtc: creationDateUtc,
    launchMethod: "detached_process_group_exactly_once",
    stdoutPath: stdoutRelative,
    stderrPath: stderrRelative,
    consoleLogsCaptured: true,
  };
}

function validateLegacyAutonomousReceipt(receipt, {
  spec, packagePath, packageSha256, runnerPath,
}) {
  if (receipt?.schemaVersion !== "ai-painter-autonomous-background-launch-receipt-v1"
    || receipt.status !== "background_process_started"
    || receipt.packageIdentity !== spec.packageIdentity
    || receipt.packagePath !== packagePath
    || receipt.packageSha256 !== packageSha256
    || receipt.runnerPath !== runnerPath) {
    throw new Error("legacy autonomous background launch receipt identity mismatch");
  }
}

function validateAutonomousReceipt(receipt, {
  attempt, spec, packagePath, packageSha256, runnerPath,
}) {
  validateLegacyAutonomousReceipt(receipt, {
    spec, packagePath, packageSha256, runnerPath,
  });
  if (receipt.runnerSha256 !== attempt.runnerSha256
    || receipt.commandIdentitySha256 !== attempt.commandIdentitySha256
    || receipt.repeatedSpawnAllowed !== false) {
    throw new Error("autonomous background launch receipt exactly-once identity mismatch");
  }
}

function validateBackgroundProcessIdentity(launch) {
  if (!Number.isInteger(launch?.processId) || launch.processId <= 0) {
    throw new Error("background process id is invalid");
  }
  if (typeof launch.processCreationDateUtc !== "string"
    || !Number.isFinite(Date.parse(launch.processCreationDateUtc))
    || launch.processStartIdentity !== `${launch.processId}:${launch.processCreationDateUtc}`) {
    throw new Error("background process PID/start identity is invalid");
  }
  if (typeof launch.processIdentitySource !== "string" || !launch.processIdentitySource) {
    throw new Error("background process identity source is missing");
  }
}

function escapePowerShellSingleQuoted(value) { return String(value).replaceAll("'", "''"); }
function quoteWindowsCommandLineArgument(value) {
  const text = String(value);
  if (!/[\s"]/u.test(text)) return text;
  return `"${text.replace(/(\\*)"/gu, "$1$1\\\"").replace(/(\\*)$/u, "$1$1")}"`;
}

function resolveExisting(root, relativePath) { const absolute = resolveInside(root, relativePath); if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`background file is missing: ${relativePath}`); return absolute; }
function resolveInside(root, relativePath) { if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath) || /^[A-Za-z]:[\\/]/.test(relativePath)) throw new Error("background path must be project-relative"); const projectRoot = path.resolve(root); const absolute = path.resolve(projectRoot, relativePath); if (!absolute.startsWith(`${projectRoot}${path.sep}`)) throw new Error("background path escapes project root"); return absolute; }
