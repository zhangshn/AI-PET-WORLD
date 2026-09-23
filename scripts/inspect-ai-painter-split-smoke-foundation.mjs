// Explicit read-only candidate inspection. --write persists diagnostic evidence
// only; this command cannot start or qualify training and never scans for a run.
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs';
import {inspectSplitSmokeWithFoundation} from './lib/ai-painter-foundation-cpu-evidence.mjs';
import {persistAudit} from './audit-ai-painter-stage4-split-release.mjs';

try {
  const {values} = parseArgs({options:{request:{type:'string'},sha256:{type:'string'},write:{type:'boolean'}}});
  const root=process.cwd(), reader=createReader(root);
  const requestBinding={path:values.request,sha256:values.sha256};
  const request=reader.bound(requestBinding);
  assert.deepEqual(Object.keys(request).sort(),['schemaVersion','componentContractBinding','cpuEvidenceBinding',
    'dataEvidenceBindings','foundationProbeBinding'].sort());
  assert.equal(request.schemaVersion,'ai-painter-split-smoke-foundation-inspection-request-v1');
  const {schemaVersion,...inputs}=request;
  reader.bytes('scripts/inspect-ai-painter-split-smoke-foundation.mjs');
  const result=inspectSplitSmokeWithFoundation({root,...inputs});
  reader.verifyStable();
  const report={...result,requestBinding,requestReceipts:reader.receipts()};
  const evidence=values.write ? persistAudit(root,report) : null;
  console.log(JSON.stringify({status:report.status,evidence,checks:report.preflight.checks,
    foundationCpuEvidence:report.foundationCpuEvidence?.status ?? null,
    blockers:report.blockers.map(({code,scope,details})=>({code,scope,
      ...(/invalid_or_stale|changed_during_read/u.test(code)?{details}:{})})),
    trainingAllowed:false,gpuAllowed:false,nextMachineAction:null},null,2));
  // Exit 2 is a completed diagnostic with blocked admission, not a crash.
  process.exitCode=report.status==='unknown_or_stale'?1:2;
} catch (error) {
  console.error(JSON.stringify({status:'unknown_or_stale',reason:error.message,trainingAllowed:false}));
  process.exitCode=1;
}
