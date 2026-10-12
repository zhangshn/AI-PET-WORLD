import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
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
    launch = attachExistingBackgroundObservation(root, launchRoot, attempt, launch, attemptProbe === probeExactlyOnceBackgroundSpawn);
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
    ...(launch.backgroundObservation ? { backgroundObservation: launch.backgroundObservation } : {}),
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
      root, attempt, spec, packagePath, packageSha256, runnerPath,
    });
    return Object.freeze(persisted);
  }
  let launch;
  let recoveredAfterInterruptedSpawn = false;
  if (!namespaceCreated) {
    launch = claimExactlyOneBackgroundSpawnMatch(
      await attemptProbe({ projectRoot: root, attempt }), attempt,
    );
    launch = attachExistingBackgroundObservation(root, launchRoot, attempt, launch, attemptProbe === probeExactlyOnceBackgroundSpawn);
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
    ...(launch.backgroundObservation ? { backgroundObservation: launch.backgroundObservation } : {}),
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

function launchWithWindowsWmi({ root, launchRoot, nodeExecutable, absoluteRunner, runnerArgs, attempt }) {
  return launchCommandWithWindowsWmi({ root, launchRoot, executable: nodeExecutable, absoluteRunner, runnerArgs, attempt });
}

function launchCommandWithWindowsWmi({
  root, launchRoot, executable, absoluteRunner, runnerArgs, attempt,
}) {
  const prepared = prepareBoundedBackgroundObservation({ root, launchRoot, absoluteRunner, attempt });
  const commandLine = [executable, '--import', pathToFileURL(prepared.bootstrapPath).href, ...exactSpawnNodeArguments(attempt, absoluteRunner)]
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
  let output;
  try {
    output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
      cwd: projectRoot, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"], timeout: 15000, maxBuffer: 65536,
    }).trim();
  } catch (error) {
    fs.writeFileSync(path.join(launchRoot, 'launch-observation-error.json'), JSON.stringify({
      schemaVersion: 'ai-painter-background-launch-observation-error-v1', status: 'launch_observation_failed_process_state_unknown',
      commandIdentitySha256: attempt.commandIdentitySha256, nonce: attempt.nonce, error: String(error.message).slice(0, 4096),
      backgroundObservation: prepared.observation, repeatedSpawnAllowed: false, cleanupConfirmed: false, recordedAtUtc: new Date().toISOString(),
    }) + '\n', {flag: 'wx'});
    throw error;
  }
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
    stdoutPath: prepared.observation.stdoutPath,
    stderrPath: prepared.observation.stderrPath,
    consoleLogsCaptured: true,
    backgroundObservation: prepared.observation,
  };
}

export const BACKGROUND_LOG_LIMITS = Object.freeze({ stdoutBytes: 262144, stderrBytes: 262144, totalBytes: 524288, metadataBytes: 65536 });

// Generated preload runs inside the very same Node runner. It adds observation,
// not another supervisor, daemon, native owner, registry or stop authority.
export function prepareBoundedBackgroundObservation({ root, launchRoot, absoluteRunner, attempt }) {
  validateExactlyOnceBackgroundSpawnAttempt(attempt);
  root = path.resolve(root); launchRoot = path.resolve(launchRoot);
  const relativeRoot = path.relative(root, launchRoot).replaceAll('\\', '/');
  if (!relativeRoot || relativeRoot.startsWith('../') || path.isAbsolute(relativeRoot)) throw new Error('background observation namespace escapes project');
  if (!fs.lstatSync(launchRoot).isDirectory() || fs.lstatSync(launchRoot).isSymbolicLink()) throw new Error('background observation namespace must be ordinary');
  if (path.resolve(absoluteRunner) !== resolveExisting(root, attempt.runnerPath) || sha256File(absoluteRunner) !== attempt.runnerSha256) throw new Error('background observation runner identity mismatch');
  const attemptPath = path.join(launchRoot, 'spawn-attempt.json');
  const persisted = JSON.parse(fs.readFileSync(attemptPath, 'utf8'));
  if (JSON.stringify(persisted) !== JSON.stringify(attempt)) throw new Error('background observation differs from immutable spawn attempt');
  const stat = fs.lstatSync(launchRoot);
  const configuration = { schemaVersion: 'ai-painter-background-observation-binding-v1',
    projectRoot: root, launchRoot, launchRootIdentity: {dev: String(stat.dev), ino: String(stat.ino)},
    attempt, attemptSha256: sha256File(attemptPath), absoluteRunner: path.resolve(absoluteRunner), limits: BACKGROUND_LOG_LIMITS };
  const bootstrapPath = path.join(launchRoot, 'background-observation-preload.mjs');
  configuration.nodeArguments = ['--import', pathToFileURL(bootstrapPath).href, ...exactSpawnNodeArguments(attempt, absoluteRunner)];
  configuration.physicalCommandIdentitySha256 = crypto.createHash('sha256').update(JSON.stringify({executable: attempt.nodeExecutable, args: configuration.nodeArguments})).digest('hex');
  const packageIndex = attempt.runnerArgs.indexOf('--package');
  if (packageIndex >= 0) {
    const shaIndex = attempt.runnerArgs.indexOf('--package-sha256');
    if (shaIndex < 0) throw new Error('background observation exact package SHA required');
    const packagePath = attempt.runnerArgs[packageIndex + 1], packageSha256 = attempt.runnerArgs[shaIndex + 1];
    if (!/^[a-f0-9]{64}$/u.test(packageSha256 ?? '') || sha256File(resolveExisting(root, packagePath)) !== packageSha256) throw new Error('background observation package identity mismatch');
    configuration.executionPackage = {path: packagePath, sha256: packageSha256};
  }
  const source = backgroundObservationPreload(configuration);
  if (Buffer.byteLength(source) > BACKGROUND_LOG_LIMITS.metadataBytes) throw new Error('background observation bootstrap limit');
  fs.writeFileSync(bootstrapPath, source, {flag: 'wx'});
  const manifestPath = path.join(launchRoot, 'background-observation-binding.json');
  fs.writeFileSync(manifestPath, JSON.stringify({...configuration, bootstrapSha256: sha256File(bootstrapPath)}) + '\n', {flag: 'wx'});
  return {bootstrapPath, observation: {schemaVersion: 'ai-painter-bounded-background-observation-v1',
    bindingPath: `${relativeRoot}/background-observation-binding.json`, bindingSha256: sha256File(manifestPath),
    bootstrapSha256: sha256File(bootstrapPath), physicalCommandIdentitySha256: configuration.physicalCommandIdentitySha256,
    stdoutPath: `${relativeRoot}/stdout.log`, stderrPath: `${relativeRoot}/stderr.log`,
    startupPath: `${relativeRoot}/background-started.json`, terminalPath: `${relativeRoot}/background-process-terminal.json`,
    limits: BACKGROUND_LOG_LIMITS, lifecycleCompletionProved: false, cleanupAuthority: false }};
}

function backgroundObservationPreload(configuration) {
  return `import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {StringDecoder} from 'node:string_decoder';
const c=${JSON.stringify(configuration)};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const counts={stdout:0,stderr:0},written={stdout:0,stderr:0};
let failure=null,identity=null,ready=false,logsTruncated=false;
const descriptors={};
const secrets=new Set();
let trackedSecretBytes=0,redactionBlocked=false;
const redactionFailure=()=>({message:'log redaction limit',code:'LOG_REDACTION_LIMIT'});
function blockRedaction(){redactionBlocked=true;throw Object.assign(Error(redactionFailure().message),{code:redactionFailure().code});}
function refreshSecrets(){if(redactionBlocked)blockRedaction();const value=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;if(typeof value==='string'&&Buffer.byteLength(value.trim(),'utf8')>=32){const additions=[...new Set([value,value.trim()])].filter(key=>!secrets.has(key));const bytes=additions.reduce((n,key)=>n+Buffer.byteLength(key,'utf8'),0);if(secrets.size+additions.length>16||trackedSecretBytes+bytes>c.limits.metadataBytes)blockRedaction();for(const key of additions)secrets.add(key);trackedSecretBytes+=bytes;}}
function redact(value){if(redactionBlocked)return '[redaction unavailable]';try{refreshSecrets();}catch{return '[redaction unavailable]';}return [...secrets].sort((a,b)=>b.length-a.length).reduce((text,key)=>text.split(key).join('[redacted]'),String(value));}
const safeErrorCode=error=>typeof error.code==='string'?redact(error.code).slice(0,256):typeof error.code==='number'&&Number.isFinite(error.code)?error.code:null;
const decoders={stdout:new StringDecoder('utf8'),stderr:new StringDecoder('utf8')},pendingText={stdout:'',stderr:''};
function partialTailLength(text,keys){let length=0;for(const key of keys){let start=Math.max(0,text.length-key.length+1);while(start<text.length-length){const at=text.indexOf(key[0],start);if(at<0||at>=text.length-length)break;if(key.startsWith(text.slice(at))){length=text.length-at;break;}start=at+1;}}return length;}
function flushText(channel,final=false){refreshSecrets();const keys=[...secrets].sort((a,b)=>b.length-a.length),text=pendingText[channel]+(final?decoders[channel].end():'');let end=final?text.length:Math.max(0,text.length-Math.max(0,...keys.map(key=>key.length-1)));if(end>0&&/[\\uD800-\\uDBFF]/u.test(text[end-1])&&/[\\uDC00-\\uDFFF]/u.test(text[end]))end--;let cursor=0,output='';while(cursor<end){let at=end,matched=null;for(const key of keys){const found=text.indexOf(key,cursor);if(found>=0&&found<at){at=found;matched=key;}}if(!matched){output+=text.slice(cursor,end);cursor=end;break;}output+=text.slice(cursor,at)+'[redacted]';cursor=at+matched.length;}pendingText[channel]=text.slice(cursor);if(final){let partial=partialTailLength(output,keys);if(output.endsWith('\\uFFFD')){const beforeReplacement=partialTailLength(output.slice(0,-1),keys);if(beforeReplacement>0)partial=Math.max(partial,beforeReplacement+1);}if(partial>0)output=output.slice(0,-partial)+'[redacted]';}emit(channel,output);}
function stable(){const s=fs.lstatSync(c.launchRoot);if(!s.isDirectory()||s.isSymbolicLink()||String(s.dev)!==c.launchRootIdentity.dev||String(s.ino)!==c.launchRootIdentity.ino)throw Error('background observation root changed');}
function evidence(name,value){stable();const bytes=Buffer.from(JSON.stringify(value)+'\\n');if(bytes.length>c.limits.metadataBytes)throw Error('background observation metadata limit');fs.writeFileSync(path.join(c.launchRoot,name),bytes,{flag:'wx'});}
const exact={nonce:c.attempt.nonce,launchIdentity:c.attempt.launchIdentity,commandIdentitySha256:c.attempt.commandIdentitySha256,physicalCommandIdentitySha256:c.physicalCommandIdentitySha256,runnerPath:c.attempt.runnerPath,runnerSha256:c.attempt.runnerSha256,executionPackage:c.executionPackage??null,spawnAttemptSha256:c.attemptSha256};
function emit(channel,text){const current=fs.lstatSync(path.join(c.launchRoot,channel+'.log')),opened=fs.fstatSync(descriptors[channel]);if(current.isSymbolicLink()||current.dev!==opened.dev||current.ino!==opened.ino||opened.nlink!==1)throw Error('background log identity changed');const bytes=Buffer.from(text);const count=Math.min(bytes.length,c.limits[channel+'Bytes']-written[channel],c.limits.totalBytes-written.stdout-written.stderr);if(count>0){fs.writeSync(descriptors[channel],bytes,0,count);written[channel]+=count;}if(count<bytes.length)logsTruncated=true;}
function capture(channel,chunk,encoding,callback){try{stable();refreshSecrets();const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:'utf8');counts[channel]=Math.min(Number.MAX_SAFE_INTEGER,counts[channel]+bytes.length);for(let offset=0;offset<bytes.length;offset+=16384){pendingText[channel]+=decoders[channel].write(bytes.subarray(offset,offset+16384));if(Buffer.byteLength(pendingText[channel],'utf8')>c.limits[channel+'Bytes']||Buffer.byteLength(pendingText.stdout,'utf8')+Buffer.byteLength(pendingText.stderr,'utf8')>c.limits.totalBytes)blockRedaction();flushText(channel);}const done=typeof encoding==='function'?encoding:callback;if(typeof done==='function')process.nextTick(done);return true;}catch(error){failure??=redactionBlocked?redactionFailure():{message:redact(error.message).slice(0,4096),code:safeErrorCode(error)};throw error;}}
process.once('uncaughtExceptionMonitor',error=>{failure=redactionBlocked?redactionFailure():{message:redact(error.stack??error).slice(0,8192),code:safeErrorCode(error)};if(descriptors.stderr!==undefined&&!redactionBlocked){try{capture('stderr',failure.message+'\\n');}catch{}}});
// The monitor saved bounded redacted failure evidence. Prevent Node's native
// fatal printer from bypassing the patched stderr writer with an unredacted
// exception; keep the existing fail-closed exit, never recover the runner.
process.once('uncaughtException',()=>process.exit(1));
process.once('exit',code=>{try{if(!redactionBlocked){try{for(const channel of ['stdout','stderr'])if(descriptors[channel]!==undefined)flushText(channel,true);}catch(error){failure??=redactionBlocked?redactionFailure():{message:redact(error.message).slice(0,4096),code:safeErrorCode(error)};}}if(redactionBlocked){pendingText.stdout='';pendingText.stderr='';failure=redactionFailure();}else if(failure)failure={message:redact(failure.message),code:typeof failure.code==='string'?redact(failure.code):failure.code};evidence('background-process-terminal.json',{schemaVersion:'ai-painter-background-process-terminal-v1',status:code===0&&!failure?'runner_process_exited':'background_runner_failed_closed',...exact,processId:process.pid,processStartIdentity:identity,exitCode:code,preloadReady:ready,error:failure,attemptedBytes:counts,writtenBytes:written,logsTruncated,lifecycleCompletionProved:false,cleanupConfirmed:false,checkpointSaved:false,recordedAtUtc:new Date().toISOString()});}catch{}for(const fd of Object.values(descriptors)){try{fs.closeSync(fd);}catch{}}});
try{
 stable();for(const channel of ['stdout','stderr'])descriptors[channel]=fs.openSync(path.join(c.launchRoot,channel+'.log'),'wx');
 process.stdout.write=(chunk,encoding,callback)=>capture('stdout',chunk,encoding,callback);process.stderr.write=(chunk,encoding,callback)=>capture('stderr',chunk,encoding,callback);
 refreshSecrets();
 const manifest=JSON.parse(fs.readFileSync(path.join(c.launchRoot,'background-observation-binding.json'),'utf8'));
 if(manifest.bootstrapSha256!==hash(fs.readFileSync(fileURLToPath(import.meta.url)))||hash(fs.readFileSync(path.join(c.launchRoot,'spawn-attempt.json')))!==c.attemptSha256)throw Error('background observation immutable binding changed');
 if(path.resolve(process.cwd())!==c.projectRoot||path.resolve(process.argv[1])!==c.absoluteRunner||JSON.stringify(process.argv.slice(2))!==JSON.stringify(c.attempt.runnerArgs))throw Error('background observation argv or working directory mismatch');
 if(JSON.stringify(process.execArgv)!==JSON.stringify(c.nodeArguments.slice(0,3)))throw Error('background observation Node import or nonce arguments changed');
 if(hash(fs.readFileSync(c.absoluteRunner))!==c.attempt.runnerSha256)throw Error('background observation runner SHA changed');
 if(c.executionPackage&&hash(fs.readFileSync(path.resolve(c.projectRoot,c.executionPackage.path)))!==c.executionPackage.sha256)throw Error('background observation package SHA changed');
 const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+process.pid+"';if($null -eq $p){throw 'own creation identity unavailable'};$p.CreationDate.ToUniversalTime().ToString('o')"],{windowsHide:true,encoding:'utf8',timeout:8000,maxBuffer:4096}).trim();
 if(!Number.isFinite(Date.parse(output)))throw Error('background observation own creation identity invalid');identity=process.pid+':'+output;
 evidence('background-started.json',{schemaVersion:'ai-painter-background-runner-started-v1',...exact,processId:process.pid,processStartIdentity:identity,workingDirectory:process.cwd(),logsBounded:true,lifecycleCompletionProved:false,recordedAtUtc:new Date().toISOString()});ready=true;
}catch(error){failure=redactionBlocked?redactionFailure():{message:redact(error.stack??error).slice(0,8192),code:safeErrorCode(error)};throw error;}
`;
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
  if (receipt.backgroundObservation) validateBoundedBackgroundObservation({root, attempt, observation: receipt.backgroundObservation});
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
  root, attempt, spec, packagePath, packageSha256, runnerPath,
}) {
  validateLegacyAutonomousReceipt(receipt, {
    spec, packagePath, packageSha256, runnerPath,
  });
  if (receipt.runnerSha256 !== attempt.runnerSha256
    || receipt.commandIdentitySha256 !== attempt.commandIdentitySha256
    || receipt.repeatedSpawnAllowed !== false) {
    throw new Error("autonomous background launch receipt exactly-once identity mismatch");
  }
  if (receipt.backgroundObservation) validateBoundedBackgroundObservation({root, attempt, observation: receipt.backgroundObservation});
}

export function validateBoundedBackgroundObservation({root, attempt, observation}) {
  validateExactlyOnceBackgroundSpawnAttempt(attempt);
  const file = resolveExisting(root, observation.bindingPath);
  if (sha256File(file) !== observation.bindingSha256) throw new Error('background observation binding SHA changed');
  const binding = JSON.parse(fs.readFileSync(file, 'utf8'));
  const launchRoot = path.dirname(file), stat = fs.lstatSync(launchRoot);
  if (stat.isSymbolicLink() || String(stat.dev) !== binding.launchRootIdentity.dev || String(stat.ino) !== binding.launchRootIdentity.ino || path.resolve(binding.launchRoot) !== launchRoot || path.resolve(binding.projectRoot) !== path.resolve(root)) throw new Error('background observation namespace identity changed');
  if (JSON.stringify(binding.attempt) !== JSON.stringify(attempt) || binding.attemptSha256 !== sha256File(path.join(launchRoot, 'spawn-attempt.json'))) throw new Error('background observation attempt changed');
  if (binding.bootstrapSha256 !== observation.bootstrapSha256 || sha256File(path.join(launchRoot, 'background-observation-preload.mjs')) !== binding.bootstrapSha256) throw new Error('background observation bootstrap SHA changed');
  const exactArgs = ['--import', pathToFileURL(path.join(launchRoot, 'background-observation-preload.mjs')).href, ...exactSpawnNodeArguments(attempt, resolveExisting(root, attempt.runnerPath))];
  const commandSha = crypto.createHash('sha256').update(JSON.stringify({executable: attempt.nodeExecutable, args: exactArgs})).digest('hex');
  if (JSON.stringify(binding.nodeArguments) !== JSON.stringify(exactArgs) || binding.physicalCommandIdentitySha256 !== commandSha || observation.physicalCommandIdentitySha256 !== commandSha || JSON.stringify(binding.limits) !== JSON.stringify(BACKGROUND_LOG_LIMITS)) throw new Error('background observation physical command or budget changed');
  const prefix = path.relative(path.resolve(root), launchRoot).replaceAll('\\', '/');
  for (const [key, name] of Object.entries({stdoutPath:'stdout.log',stderrPath:'stderr.log',startupPath:'background-started.json',terminalPath:'background-process-terminal.json'})) if (observation[key] !== `${prefix}/${name}`) throw new Error('background observation path changed');
  if (observation.cleanupAuthority !== false || observation.lifecycleCompletionProved !== false) throw new Error('background observation cannot grant lifecycle or cleanup authority');
  return binding;
}

function attachExistingBackgroundObservation(root, launchRoot, attempt, launch, verifyLiveCommand) {
  const bindingPath = path.join(launchRoot, 'background-observation-binding.json');
  if (!fs.existsSync(bindingPath)) return launch; // Older launches keep original semantics.
  const binding = JSON.parse(fs.readFileSync(bindingPath, 'utf8')), prefix = path.relative(path.resolve(root), launchRoot).replaceAll('\\','/');
  const observation = {schemaVersion:'ai-painter-bounded-background-observation-v1',bindingPath:`${prefix}/background-observation-binding.json`,bindingSha256:sha256File(bindingPath),bootstrapSha256:binding.bootstrapSha256,physicalCommandIdentitySha256:binding.physicalCommandIdentitySha256,stdoutPath:`${prefix}/stdout.log`,stderrPath:`${prefix}/stderr.log`,startupPath:`${prefix}/background-started.json`,terminalPath:`${prefix}/background-process-terminal.json`,limits:BACKGROUND_LOG_LIMITS,lifecycleCompletionProved:false,cleanupAuthority:false};
  validateBoundedBackgroundObservation({root, attempt, observation});
  if (verifyLiveCommand && process.platform === 'win32') {
    const output = execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${launch.processId}';if($null -eq $p){throw 'background process disappeared'};[ordered]@{commandLine=$p.CommandLine;creationDate=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});
    const actual = JSON.parse(output.replace(/^\uFEFF/u,''));
    const expectedCommandLine = [attempt.nodeExecutable,...binding.nodeArguments].map(quoteWindowsCommandLineArgument).join(' ');
    if (actual.commandLine !== expectedCommandLine || `${launch.processId}:${actual.creationDate}` !== launch.processStartIdentity) throw new Error('background recovery exact imported command changed');
  }
  return {...launch, backgroundObservation:observation,stdoutPath:observation.stdoutPath,stderrPath:observation.stderrPath,consoleLogsCaptured:true};
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
