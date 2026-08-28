import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { sha256File, validateClosedLoopPackage } from "./ai-painter-autonomous-closed-loop-v1.mjs";

export const BACKGROUND_LAUNCH_ROOT = ".runtime/ai-painter/autonomous-background-launches";

export function launchProjectCommandBackground({
  root = process.cwd(), launchIdentity, runnerPath, runnerArgs = [],
  receiptRoot = BACKGROUND_LAUNCH_ROOT, recordedAtUtc = new Date().toISOString(),
}) {
  if (!/^[a-z0-9][a-z0-9-]{7,127}$/.test(launchIdentity ?? "")) throw new Error("background launch identity is invalid");
  if (!Array.isArray(runnerArgs) || runnerArgs.some((value) => typeof value !== "string")) throw new Error("background runner arguments are invalid");
  const absoluteRunner = resolveExisting(root, runnerPath);
  const launchRoot = resolveInside(root, `${receiptRoot}/${launchIdentity}`);
  fs.mkdirSync(path.dirname(launchRoot), { recursive: true });
  if (fs.existsSync(launchRoot)) throw new Error("background launch identity already exists");
  fs.mkdirSync(launchRoot, { recursive: false });
  const launch = process.platform === "win32"
    ? launchCommandWithWindowsWmi({ root, executable: process.execPath, absoluteRunner, runnerArgs })
    : launchCommandDetached({ root, launchRoot, executable: process.execPath, absoluteRunner, runnerArgs });
  const receipt = {
    schemaVersion: "ai-painter-local-program-background-command-receipt-v1",
    status: "background_process_started", launchIdentity, runnerPath,
    runnerSha256: sha256File(absoluteRunner), runnerArgs, processId: launch.processId,
    launchMethod: launch.launchMethod, detachedFromCodex: true,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    recordedAtUtc,
  };
  fs.writeFileSync(path.join(launchRoot, "launch-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  return receipt;
}

export async function launchAutonomousClosedLoopBackground({
  root = process.cwd(), packagePath, packageSha256,
  runnerPath = "scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
  nodeExecutable = process.execPath, recordedAtUtc = new Date().toISOString(),
}) {
  const absolutePackage = resolveExisting(root, packagePath);
  if (sha256File(absolutePackage) !== packageSha256) throw new Error("background package SHA-256 mismatch");
  const spec = JSON.parse(fs.readFileSync(absolutePackage, "utf8"));
  validateClosedLoopPackage(spec, { root, packageSha256 });
  const absoluteRunner = resolveExisting(root, runnerPath);
  const launchRoot = resolveInside(root, `${BACKGROUND_LAUNCH_ROOT}/${spec.packageIdentity}`);
  fs.mkdirSync(path.dirname(launchRoot), { recursive: true });
  if (fs.existsSync(launchRoot)) throw new Error("background launch identity already exists");
  fs.mkdirSync(launchRoot, { recursive: false });
  const launch = process.platform === "win32"
    ? launchWithWindowsWmi({ root, nodeExecutable, absoluteRunner, packagePath, packageSha256 })
    : await launchWithDetachedProcess({ root, launchRoot, nodeExecutable, absoluteRunner, packagePath, packageSha256 });
  const receipt = {
    schemaVersion: "ai-painter-autonomous-background-launch-receipt-v1",
    status: "background_process_started",
    packageIdentity: spec.packageIdentity, packagePath, packageSha256,
    runnerPath, runnerSha256: sha256File(absoluteRunner), processId: launch.processId,
    launchMethod: launch.launchMethod, detachedFromCodex: true, windowsHidden: process.platform === "win32",
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    progressPath: `.runtime/ai-painter/autonomous-closed-loop-executions/${spec.packageIdentity}/progress.json`,
    heartbeatPath: `.runtime/ai-painter/autonomous-closed-loop-executions/${spec.packageIdentity}/heartbeat.json`,
    stdoutPath: launch.stdoutPath, stderrPath: launch.stderrPath,
    consoleLogsCaptured: launch.consoleLogsCaptured,
    recordedAtUtc,
  };
  fs.writeFileSync(path.join(launchRoot, "launch-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  return receipt;
}

function launchWithWindowsWmi({ root, nodeExecutable, absoluteRunner, packagePath, packageSha256 }) {
  const commandLine = [nodeExecutable, absoluteRunner, "--package", packagePath, "--package-sha256", packageSha256]
    .map(quoteWindowsCommandLineArgument).join(" ");
  const projectRoot = path.resolve(root);
  const script = [
    `$commandLine = '${escapePowerShellSingleQuoted(commandLine)}'`,
    `$workingDirectory = '${escapePowerShellSingleQuoted(projectRoot)}'`,
    "$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly",
    "$startup.ShowWindow = 0",
    "$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; CurrentDirectory = $workingDirectory; ProcessStartupInformation = $startup }",
    "if ($result.ReturnValue -ne 0) { throw ('Win32_Process.Create failed with code ' + $result.ReturnValue) }",
    "$result.ProcessId",
  ].join("\n");
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    cwd: projectRoot, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const processId = Number(output.split(/\r?\n/).at(-1));
  if (!Number.isInteger(processId) || processId <= 0) throw new Error("WMI background launcher returned an invalid process id");
  return { processId, launchMethod: "windows_wmi_win32_process_create", stdoutPath: null, stderrPath: null, consoleLogsCaptured: false };
}

function launchCommandWithWindowsWmi({ root, executable, absoluteRunner, runnerArgs }) {
  const commandLine = [executable, absoluteRunner, ...runnerArgs].map(quoteWindowsCommandLineArgument).join(" ");
  const projectRoot = path.resolve(root);
  const script = [
    `$commandLine = '${escapePowerShellSingleQuoted(commandLine)}'`,
    `$workingDirectory = '${escapePowerShellSingleQuoted(projectRoot)}'`,
    "$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly",
    "$startup.ShowWindow = 0",
    "$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; CurrentDirectory = $workingDirectory; ProcessStartupInformation = $startup }",
    "if ($result.ReturnValue -ne 0) { throw ('Win32_Process.Create failed with code ' + $result.ReturnValue) }",
    "$result.ProcessId",
  ].join("\n");
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    cwd: projectRoot, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const processId = Number(output.split(/\r?\n/).at(-1));
  if (!Number.isInteger(processId) || processId <= 0) throw new Error("WMI background command returned an invalid process id");
  return { processId, launchMethod: "windows_wmi_win32_process_create" };
}

function launchCommandDetached({ root, launchRoot, executable, absoluteRunner, runnerArgs }) {
  const stdout = fs.openSync(path.join(launchRoot, "stdout.log"), "ax");
  const stderr = fs.openSync(path.join(launchRoot, "stderr.log"), "ax");
  let child;
  try {
    child = spawn(executable, [absoluteRunner, ...runnerArgs], { cwd: path.resolve(root), detached: true, windowsHide: true, stdio: ["ignore", stdout, stderr] });
    child.unref();
  } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  return { processId: child.pid, launchMethod: "detached_process_group" };
}

async function launchWithDetachedProcess({ root, launchRoot, nodeExecutable, absoluteRunner, packagePath, packageSha256 }) {
  const stdoutRelative = path.relative(path.resolve(root), path.join(launchRoot, "stdout.log")).replaceAll("\\", "/");
  const stderrRelative = path.relative(path.resolve(root), path.join(launchRoot, "stderr.log")).replaceAll("\\", "/");
  const stdout = fs.openSync(path.join(launchRoot, "stdout.log"), "ax");
  const stderr = fs.openSync(path.join(launchRoot, "stderr.log"), "ax");
  let child;
  try {
    child = spawn(nodeExecutable, [absoluteRunner, "--package", packagePath, "--package-sha256", packageSha256], {
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
  return { processId: child.pid, launchMethod: "detached_process_group", stdoutPath: stdoutRelative, stderrPath: stderrRelative, consoleLogsCaptured: true };
}

function escapePowerShellSingleQuoted(value) { return String(value).replaceAll("'", "''"); }
function quoteWindowsCommandLineArgument(value) {
  const text = String(value);
  if (!/[\s"]/u.test(text)) return text;
  return `"${text.replace(/(\\*)"/gu, "$1$1\\\"").replace(/(\\*)$/u, "$1$1")}"`;
}

function resolveExisting(root, relativePath) { const absolute = resolveInside(root, relativePath); if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`background file is missing: ${relativePath}`); return absolute; }
function resolveInside(root, relativePath) { if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath) || /^[A-Za-z]:[\\/]/.test(relativePath)) throw new Error("background path must be project-relative"); const projectRoot = path.resolve(root); const absolute = path.resolve(projectRoot, relativePath); if (!absolute.startsWith(`${projectRoot}${path.sep}`)) throw new Error("background path escapes project root"); return absolute; }
