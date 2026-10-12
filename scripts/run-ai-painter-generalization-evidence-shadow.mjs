import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeAutonomousClosedLoopPackage } from './lib/ai-painter-autonomous-package-materializer-v1.mjs';
import { runAutonomousClosedLoop, validateClosedLoopPackage, PHASES, CLOSED_LOOP_CONTRACT_PATH } from './lib/ai-painter-autonomous-closed-loop-v1.mjs';
import { launchProjectCommandBackground } from './lib/ai-painter-autonomous-background-launcher-v1.mjs';
import { SHADOW_ROOT, REPORT, inside, hashFile, put, verifyEvidence, commitShadowIndex } from './lib/ai-painter-generalization-evidence-adapter-v1.mjs';

export const ENTRY = 'scripts/run-ai-painter-generalization-evidence-shadow.mjs';
const ADAPTER = 'scripts/lib/ai-painter-generalization-evidence-adapter-v1.mjs';
const SELF = fileURLToPath(import.meta.url);
export function prepareShadow({sourceRoot = process.cwd(), name = 'real-report-' + REPORT.sha256.slice(0,16), report = REPORT, timeoutMs = 170000, workerFixture = null, starterExitGate = false, outputNamespace = SHADOW_ROOT} = {}) {
  assert(/^[a-z0-9][a-z0-9-]{7,100}$/.test(name));
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 170000);
  assert(outputNamespace === SHADOW_ROOT || (name.startsWith('test-') && outputNamespace === SHADOW_ROOT+'/index-recovery-m-d1-03'));
  const projectRoot = inside(sourceRoot, outputNamespace + '/' + name);
  fs.mkdirSync(path.dirname(projectRoot), {recursive:true});
  fs.mkdirSync(projectRoot); // Unknown, incomplete and consumed namespaces are all refused.
  const copied = new Set();
  function copy(relative) {
    if (copied.has(relative)) return; copied.add(relative);
    const from = inside(sourceRoot,relative), to = inside(projectRoot,relative);
    fs.mkdirSync(path.dirname(to),{recursive:true}); fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
    if (relative.endsWith('.mjs')) {
      const text = fs.readFileSync(to,'utf8');
      for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+\.mjs)['"]/g))
        copy(path.posix.normalize(path.posix.join(path.posix.dirname(relative),match[1])));
    }
  }
  copy(ENTRY); copy(CLOSED_LOOP_CONTRACT_PATH);
  copy('data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json');
  copy('scripts/windows/ai-painter-owned-worker-owner.cs');
  let workerPath = ENTRY;
  if (workerFixture) {
    assert(name.startsWith('test-'), 'worker fixtures restricted to test namespaces');
    const fixture = path.resolve(workerFixture);
    assert(fixture.startsWith(path.resolve(sourceRoot,SHADOW_ROOT) + path.sep));
    workerPath = 'worker-fixture.mjs'; fs.copyFileSync(fixture,inside(projectRoot,workerPath),fs.constants.COPYFILE_EXCL);
    copied.add(workerPath);
  }
  if (starterExitGate) assert(name.startsWith('test-'));
  const config = {sourceRoot:path.resolve(sourceRoot),projectRoot,report,timeoutMs,
    worker:{path:workerPath,sha256:hashFile(inside(projectRoot,workerPath))}, starterExitGate};
  put(path.join(projectRoot,'shadow-input.json'),config);
  const dependencies = [...copied].sort();
  put(path.join(projectRoot,'dependency-baseline.json'), dependencies.map(p=>({path:p,sha256:hashFile(inside(projectRoot,p))})));
  const materialized = materializeAutonomousClosedLoopPackage({schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',
    packageIdentity:name,capabilityVersion:'generalization_evidence_shadow_m_d1_01',ownerAuthorizationRequired:false,
    maxInfrastructureRecoveryAttempts:0,outputRoot:'.runtime/ai-painter/evidence',
    programFiles:{adapter:ADAPTER,runner:ENTRY,worker:workerPath},inputEvidencePaths:['shadow-input.json','dependency-baseline.json',...dependencies],
    phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{path:ADAPTER,exportName:phase}]))},{root:projectRoot});
  put(path.join(projectRoot,'materialized.json'),materialized);
  return {projectRoot,...materialized};
}
function scopedRoot(root) {
  const c = JSON.parse(fs.readFileSync(path.join(root,'shadow-input.json')));
  assert.equal(path.resolve(root), c.projectRoot);
  assert(path.resolve(root).startsWith(path.resolve(c.sourceRoot,SHADOW_ROOT) + path.sep));
  return c;
}
export function validateShadowDependencies(projectRoot, spec) {
  const realRoot = fs.realpathSync(projectRoot), bindings = new Map();
  for (const b of spec.inputEvidence) {
    const file = inside(projectRoot,b.path);
    assert(!bindings.has(b.path), 'duplicate input dependency');
    assert(fs.statSync(file).isFile(), 'dependency is not a file');
    assert(fs.realpathSync(file).startsWith(realRoot + path.sep), 'dependency escapes physical shadow root');
    assert.equal(hashFile(file), b.sha256, `shadow dependency SHA mismatch: ${b.path}`);
    bindings.set(b.path,b.sha256);
  }
  assert(bindings.has('dependency-baseline.json') && bindings.has('shadow-input.json'), 'dependency manifest binding missing');
  const baseline = JSON.parse(fs.readFileSync(inside(projectRoot,'dependency-baseline.json'))), seen = new Set();
  assert(Array.isArray(baseline) && baseline.length > 0, 'dependency baseline missing');
  for (const b of baseline) {
    inside(projectRoot,b.path);
    assert(!seen.has(b.path), 'duplicate baseline dependency'); seen.add(b.path);
    assert.equal(bindings.get(b.path),b.sha256,'dependency missing from package or conflicting SHA');
  }
  assert.deepEqual([...bindings.keys()].sort(),['shadow-input.json','dependency-baseline.json',...seen].sort(), 'dependency set mismatch');
}
function verifiedPreparedPackage(projectRoot) {
  const m = JSON.parse(fs.readFileSync(path.join(projectRoot,'materialized.json')));
  const packagePath = inside(projectRoot,m.packagePath); assert.equal(hashFile(packagePath),m.packageSha256);
  const spec = JSON.parse(fs.readFileSync(packagePath));
  validateShadowDependencies(projectRoot,spec);
  validateClosedLoopPackage(spec,{root:projectRoot,packageSha256:m.packageSha256});
  return {m,spec};
}
export function startPrepared(projectRoot) {
  scopedRoot(projectRoot);
  const {m} = verifiedPreparedPackage(projectRoot);
  put(path.join(projectRoot,'start-claim.json'),{pid:process.pid,parentPid:process.ppid,startedAtUtc:new Date().toISOString()});
  return launchProjectCommandBackground({root:projectRoot,launchIdentity:m.packageIdentity,
    runnerPath:ENTRY,runnerArgs:['--consume',projectRoot]});
}
export async function consumePrepared(projectRoot) {
  scopedRoot(projectRoot);
  const {m,spec} = verifiedPreparedPackage(projectRoot);
  put(path.join(projectRoot,'consumption-claim.json'),{pid:process.pid,parentPid:process.ppid,startedAtUtc:new Date().toISOString(),retries:0});
  const result = await runAutonomousClosedLoop({root:projectRoot,spec,packageSha256:m.packageSha256});
  put(path.join(projectRoot,'runner-result.json'),{pid:process.pid,parentPid:process.ppid,finishedAtUtc:new Date().toISOString(),result});
  return result;
}
async function main() {
  const [mode,root,intentSha256] = process.argv.slice(2);
  if (mode === '--start' && !root) {
    const prepared = prepareShadow(); console.log(JSON.stringify({projectRoot:prepared.projectRoot,receipt:startPrepared(prepared.projectRoot)}));
  } else if (mode === '--start-prepared' && root) {
    console.log(JSON.stringify(startPrepared(root)));
  } else if (mode === '--consume' && root) {
    const result = await consumePrepared(root); process.exitCode = result.state === 'completed' ? 0 : 1;
  } else if (mode === '--recover-index' && root && intentSha256) {
    scopedRoot(root);
    const {spec} = verifiedPreparedPackage(root);
    const receipt = await commitShadowIndex({projectRoot:path.resolve(root),packageIdentity:spec.packageIdentity,
      capabilityVersion:spec.capabilityVersion,outputRoot:spec.outputRoot,inputEvidence:spec.inputEvidence,
      executionRoot:path.join(root,'.runtime/ai-painter/autonomous-closed-loop-executions',spec.packageIdentity)},
      {recover:true,expectedIntentSha256:intentSha256});
    console.log(JSON.stringify({status:'index_only_reconciled',receipt,executionReplayed:false,modelForwardCalls:0}));
  } else if (mode === '--verify-worker' && root) {
    const c = scopedRoot(root), out = path.join(root,'.runtime/ai-painter/evidence');
    put(path.join(out,'worker-start.json'),{pid:process.pid,parentPid:process.ppid,startedAtUtc:new Date().toISOString()});
    if (c.starterExitGate) {
      const gate = path.join(root,'starter-exit-observed.json');
      while (!fs.existsSync(gate)) await new Promise(resolve=>setTimeout(resolve,50));
    }
    put(path.join(out,'verified.json'),verifyEvidence(c));
  } else throw new Error('usage: --start | --start-prepared ROOT | --consume ROOT | --verify-worker ROOT | --recover-index ROOT INTENT_SHA256');
}
// Node resolves ESM URLs through the formal .runtime junction; argv retains F:.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(SELF)) main().catch(error=>{
  console.error(String(error.stack ?? error)); process.exitCode=1;
});
