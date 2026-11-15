import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildStage4V2SmokeTicket,
  consumeStage4V2SmokeTicket,
  ensureStage4V2SmokeTicketIssuer,
  initializeStage4V2SmokeTicketLedger,
  registerStage4V2SmokeTicket,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs";
import { sha256File } from "../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

for (const crashPoint of [
  "afterConsumptionPrepareCommit",
  "afterConsumptionEvidencePersisted",
  "afterConsumptionCommit",
]) {
  const fixture = createFixture(crashPoint);
  assert.throws(() => consumeStage4V2SmokeTicket({
    ...fixture.consumeArgs,
    _testHooks: { [crashPoint]: () => { throw new Error(`injected:${crashPoint}`); } },
  }), new RegExp(`injected:${crashPoint}`));
  const recovered = consumeStage4V2SmokeTicket(fixture.consumeArgs);
  assert.equal(recovered.consumption.ticketId, fixture.ticket.ticketId);
  assert.ok([
    "prepared_consumption_committed", "already_committed_verified",
  ].includes(recovered.recoveryStatus));
  assert.equal(fs.existsSync(path.join(fixture.root, fixture.ticket.outputDirectory)), false);
  const repeated = consumeStage4V2SmokeTicket(fixture.consumeArgs);
  assert.equal(repeated.recoveryStatus, "already_committed_verified");
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

process.stdout.write("Stage4 V2 controlled-Smoke ticket recovery: 3/3 crash points passed\n");

function createFixture(suffix, { register = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-smoke-ticket-"));
  const keyProtector = {
    scheme: "test_copy_protector_v1",
    protect: (bytes) => Buffer.from(bytes),
    unprotect: (bytes) => Buffer.from(bytes),
  };
  const issuerResult = ensureStage4V2SmokeTicketIssuer({ projectRoot: root, keyProtector });
  const evidencePath = writeJson(root, `evidence-${suffix}.json`, { status: "passed" });
  const programPath = writeJson(root, `program-${suffix}.mjs`, { implementation: "fixture" });
  const packageId = `stage4-v2-smoke-package-${suffix.toLowerCase()}`;
  const runId = `stage4-v2-smoke-run-${suffix.toLowerCase()}`;
  const outputDirectory = `.runtime/ai-painter/stage4-v2-controlled-smoke-executions/${runId}`;
  const derivedTrainerExecution = {
    ticketId: `stage4-v2-smoke-trainer-${suffix.toLowerCase()}`,
    configContractSha256: "a".repeat(64),
    outputDirectory,
    oneTimeConsumptionInheritedFromParent: true,
    independentAuthorizationAuthority: false,
  };
  const inputEvidence = [binding(root, evidencePath)];
  const programLineage = { nodeAdapter: binding(root, programPath) };
  const payload = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-payload-v1",
    packageId, runId, outputDirectory, derivedTrainerExecution,
    ticketIssuer: issuerResult.issuerBinding,
    inputEvidence, programLineage,
  };
  const payloadPath = writeJson(root, `payload-${suffix}.json`, payload);
  const payloadBinding = binding(root, payloadPath);
  const ticket = buildStage4V2SmokeTicket({
    packageId, runId, packagePayload: payload, packagePayloadBinding: payloadBinding,
    issuer: issuerResult.issuer, privateKey: issuerResult.privateKey,
    inputEvidence, programLineage, outputDirectory,
    issuedAtUtc: "2026-09-01T00:00:00.000Z",
    expiresAtUtc: "2030-09-01T00:00:00.000Z",
    nonce: `nonce-${suffix.toLowerCase()}-12345678`,
  });
  const ticketPath = writeJson(root, `ticket-${suffix}.json`, ticket);
  const ticketBinding = binding(root, ticketPath);
  initializeStage4V2SmokeTicketLedger({ projectRoot: root });
  if (register) registerStage4V2SmokeTicket({
    projectRoot: root, ticket, ticketBinding,
    packagePayloadBinding: payloadBinding,
  });
  return {
    root, ticket,
    consumeArgs: {
      projectRoot: root, ticket, packagePayload: payload,
      ticketBinding, packagePayloadBinding: payloadBinding,
      consumptionPath: `.runtime/ai-painter/smoke-consumptions/${suffix}.json`,
      consumedAtUtc: "2026-09-01T00:01:00.000Z",
    },
  };
}

function writeJson(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  return target;
}

function binding(root, absolute) {
  return {
    path: path.relative(root, absolute).replaceAll("\\", "/"),
    sha256: sha256File(absolute),
    byteSize: fs.statSync(absolute).size,
  };
}


for (const stage of ['initialize','register','prepare-read','prepare-write','finalize']) {
  for (const mode of ['error-and-close','undefined-and-close','null-and-close','false-and-close','operation-only','close-only']) {
    test(`smoke ledger cleanup ${stage}/${mode}`, t => {
      const f=createFixture('errors-'+stage+'-'+mode,{register:stage!=='register'}),a=f.consumeArgs
      const primary=mode.startsWith('undefined')?undefined:mode.startsWith('null')?null:mode.startsWith('false')?false:
        Object.freeze(Object.assign(new Error('fixture_sqlite_io_failure'),{code:'ERR_SQLITE_ERROR',errcode:10}))
      const rollback=Object.freeze(new Error('fixture_rollback_failure')),close=Object.freeze(new Error('fixture_close_failure'))
      const failsOperation=mode!=='close-only',failsClose=mode!=='operation-only',failsRollback=failsOperation&&failsClose&&['register','prepare-write','finalize'].includes(stage)
      const original={exec:DatabaseSync.prototype.exec,prepare:DatabaseSync.prototype.prepare,close:DatabaseSync.prototype.close},selected=new WeakSet()
      let begins=0,closes=0,rollbacks=0,caught,threw=false
      const invoke=()=>stage==='initialize'?initializeStage4V2SmokeTicketLedger({projectRoot:f.root}):stage==='register'?registerStage4V2SmokeTicket(a):consumeStage4V2SmokeTicket(a)
      const mocks=[t.mock.method(DatabaseSync.prototype,'exec',function(sql,...args){
        if(stage==='initialize'&&sql.startsWith('PRAGMA busy_timeout')){selected.add(this);if(failsOperation)throw primary}
        if(sql==='BEGIN IMMEDIATE'&&['register','prepare-write','finalize'].includes(stage)&&++begins===(stage==='finalize'?2:1))selected.add(this)
        const result=original.exec.call(this,sql,...args)
        if(sql==='ROLLBACK'&&selected.has(this)){rollbacks++;if(failsRollback)throw rollback}
        return result
      }),t.mock.method(DatabaseSync.prototype,'prepare',function(sql,...args){
        if(stage==='prepare-read'&&sql.includes('SELECT * FROM consumption_prepares WHERE ticket_id=?'))selected.add(this)
        if(selected.has(this)&&failsOperation&&stage!=='initialize')throw primary
        return original.prepare.call(this,sql,...args)
      }),t.mock.method(DatabaseSync.prototype,'close',function(...args){
        const result=original.close.apply(this,args);if(selected.has(this)){closes++;if(failsClose)throw close}return result
      })]
      try{try{invoke()}catch(error){caught=error;threw=true}}finally{for(const mock of mocks.reverse())mock.mock.restore()}
      const expected=[...(failsOperation?[primary]:[]),...(failsRollback?[rollback]:[]),...(failsClose?[close]:[])]
      assert(threw);assert.equal(closes,1);assert.equal(rollbacks,failsOperation&&['register','prepare-write','finalize'].includes(stage)?1:0)
      if(expected.length===1)assert.equal(caught,expected[0]);else{assert(caught instanceof AggregateError);assert.equal(caught.cause,primary);assert.deepEqual(caught.errors,expected)}
      const db=new DatabaseSync(path.join(f.root,f.ticket.ledgerPath),{readOnly:true})
      let row,prepared;try{row=db.prepare('SELECT status FROM tickets WHERE ticket_id=?').get(f.ticket.ticketId);prepared=db.prepare('SELECT status FROM consumption_prepares WHERE ticket_id=?').get(f.ticket.ticketId)}finally{db.close()}
      assert.equal(row?.status,stage==='register'&&failsOperation?undefined:stage==='finalize'&&!failsOperation?'consumed':'issued_not_consumed')
      assert.equal(prepared?.status,stage==='finalize'?(failsOperation?'prepared':'committed'):stage==='prepare-write'&&!failsOperation?'prepared':undefined)
      if(stage==='register')assert.equal(registerStage4V2SmokeTicket({...a,allowExistingExact:true}).status,'issued_not_consumed_persisted')
      else if(stage==='initialize')initializeStage4V2SmokeTicketLedger({projectRoot:f.root})
      else{
        const recovered=consumeStage4V2SmokeTicket(a);assert.equal(recovered.consumption.ticketId,f.ticket.ticketId)
        assert.equal(consumeStage4V2SmokeTicket(a).recoveryStatus,'already_committed_verified')
      }
      assert.equal(fs.existsSync(path.join(f.root,f.ticket.outputDirectory)),false)
      t.diagnostic('retained private fixture: '+f.root)
    })
  }
}

test('smoke ledger cleanup preserves actual unique conflict as reuse with its SQLite cause',t=>{
  const f=createFixture('unique-conflict'),a=f.consumeArgs,other={...f.ticket,ticketId:f.ticket.ticketId+'-other'}
  assert.throws(()=>registerStage4V2SmokeTicket({...a,ticket:other}),error=>{
    assert.match(error.message,/^Smoke ticket\/output reuse rejected:/);assert.equal(error.cause?.code,'ERR_SQLITE_ERROR');assert([1555,2067].includes(error.cause.errcode));return true
  })
  assert.throws(()=>registerStage4V2SmokeTicket(a),/Smoke ticket\/output reuse rejected: ticket identity already exists/)
  assert.equal(registerStage4V2SmokeTicket({...a,allowExistingExact:true}).recoveredExistingExact,true)
  t.diagnostic('retained private fixture: '+f.root)
})
