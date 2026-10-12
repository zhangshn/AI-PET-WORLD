import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {test} from 'node:test'
import {priorReviewBudget,nativeBudget,nativeAccountingRoots,reviewRecoveryAccounting} from '../run-ai-painter-mvp256-dry-detail-weight-capture-training.mjs'
import {checkReviewDeadline,auditBeforeDeadline} from '../run-ai-painter-detail-weight-review-recovery.mjs'
import {bind} from '../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs'

test('known failed review consumes original wall and stream budget, not training',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'painter-review-budget-'))
 const base='.runtime/ai-painter/detail-weight-capture-managed-executions/synthetic-original'
 const owned=base+'/dry-review-owned',namespace='.runtime/ai-painter/owned-worker-guards/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
 const prior={phase:'review',cleanupConfirmed:true,ownerClosed:true,proof:{activeProcessesAfterCleanup:0,exitCode:1},budget:{outputBytes:16*1024**2,timeoutMs:120000},elapsedMs:2182,streamBytes:{stdout:0,stderr:932},outputAccountingRoots:[owned,base+'/dry-review',namespace]}
 for(const dir of prior.outputAccountingRoots)fs.mkdirSync(path.join(root,dir),{recursive:true})
 const file=owned+'/owned-review-fixture/release-receipt.json';fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify(prior))
 const bound=bind(root,file),output=base+'/review-recovery-v1/dry-review-owned'
 assert.equal(priorReviewBudget(root,output,bound).remainingMs,117818)
 assert.equal(priorReviewBudget(root,output,bound).priorStreamBytes,932)
 assert.equal(nativeBudget('training').timeoutMs,2700000)
 assert.deepEqual(nativeAccountingRoots(root,output,null,null,'review'),[output,base+'/review-recovery-v1/dry-review'])
 const failureFile='.runtime/source-review-failure.json';fs.writeFileSync(path.join(root,failureFile),JSON.stringify({phase:'review',result:{failureCode:'adapter_exception'}}))
 const accounting=reviewRecoveryAccounting(root,output,namespace+'/next',priorReviewBudget(root,output,bound),bind(root,failureFile))
 assert.equal(accounting.externalEvidenceBytes,fs.statSync(path.join(root,failureFile)).size)
 assert.deepEqual(accounting.roots,[base+'/review-recovery-v1',namespace+'/next',...prior.outputAccountingRoots])
 assert.ok(!accounting.roots.includes(output),'recovery metadata and children are counted exactly once')
 for(const changed of [{...prior,cleanupConfirmed:false},{...prior,elapsedMs:120000},{...prior,phase:'training'},{...prior,proof:{activeProcessesAfterCleanup:1,exitCode:1}}]){
  fs.writeFileSync(path.join(root,file),JSON.stringify(changed));assert.throws(()=>priorReviewBudget(root,output,bind(root,file)))
 }
})

test('expired review cannot finalize and a running audit worker is terminated on deadline',async()=>{
 assert.throws(()=>checkReviewDeadline(Date.now()-1),/wall budget/)
 await assert.rejects(auditBeforeDeadline({}, {}, '.runtime/synthetic-never-used',Date.now()+25),/wall timeout/)
})
