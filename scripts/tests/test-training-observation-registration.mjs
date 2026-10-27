import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import path from 'node:path'
import {observationFixture} from './helpers/training-observation-fixture.mjs'
import {listTrainingHistory,readTrainingRun} from '../../src/server/ai-console/training-history-store.mjs'

test('an own committed experiment remains queryable when no latest-training pointer was advanced',async t=>{
  // Private CPU fixture only: materialize its initial transaction without a
  // latest-training pointer, as occurs when an admission/launcher fails first.
  const f=observationFixture(t,{state:'failed_closed'}),reg='.runtime/ai-painter/current-execution-registry'
  f.registry.latestTrainingTerminal=null
  const head=f.put(reg+'/current.json',f.registry)
  f.put(reg+'/transactions/fixture-tx/current.staged.json',f.registry)
  f.put(reg+'/transactions/fixture-tx/transaction.json',{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',
    status:'committed',transactionId:'fixture-tx',registryRevision:1,eventSequence:1,currentSha256:head.sha256,previousCurrentSha256:null})
  f.put(reg+'/events.jsonl',Buffer.from(JSON.stringify({transactionId:'fixture-tx',registryRevision:1,eventSequence:1,
    currentSha256:head.sha256,previousCurrentSha256:null,taskId:f.runId,runId:f.runId})+'\n'))
  const db=new DatabaseSync(path.join(f.root,reg,'registry.sqlite'))
  try {
    db.prepare('UPDATE registry_revisions SET current_sha256=? WHERE registry_revision=1').run(head.sha256)
    db.prepare('UPDATE registry_transactions SET current_sha256=? WHERE transaction_id=?').run(head.sha256,'fixture-tx')
  }finally{db.close()}
  const listing=await listTrainingHistory({root:f.root})
  assert.equal(listing.records.length,1);assert.equal(listing.records[0].runId,f.runId)
  const detail=await readTrainingRun(f.runId,{root:f.root})
  assert.equal(detail.record.terminalStatus,'experiment_failed_closed')
  assert.equal(detail.record.workerExecutionTiming.status,'failed_closed')
  assert.equal(f.registry.latestTrainingTerminal,null)
})
