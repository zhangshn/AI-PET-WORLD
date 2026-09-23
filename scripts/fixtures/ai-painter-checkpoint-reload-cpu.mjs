// Tiny scalar regression fixture. Not an AI Painter model, dataset or checkpoint format.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [mode, root, requestPath, requestSha] = process.argv.slice(2);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = b => {
  assert.ok(!path.isAbsolute(b.path) && !b.path.split(/[\\/]/).includes('..'));
  const bytes=fs.readFileSync(path.join(root,b.path));
  assert.equal(hash(bytes), b.sha256); return JSON.parse(bytes);
};
const put = (file,value) => {
  const bytes=Buffer.from(JSON.stringify(value)+'\n');
  fs.writeFileSync(path.join(root,file),bytes,{flag:'wx'});
  return {path:file,sha256:hash(bytes)};
};
const requestBinding={path:requestPath,sha256:requestSha}, request=read(requestBinding);
assert.equal(request.evidenceScope,'cpu_fixture_only');
assert.ok(request.runId.startsWith('cpu-fixture-'));
const data=read(request.data);
assert.deepEqual(data,[{id:'fixture-train-a',x:1,y:2},{id:'fixture-train-b',x:2,y:4}]);
const common={runId:request.runId,capabilityVersion:request.capabilityVersion,evidenceScope:request.evidenceScope,
  request:requestBinding,sampleIds:request.sampleIds,device:'cpu',pid:process.pid};
if(mode==='train'){
  assert.equal(request.optimizerSteps,1);
  const weight=0-0.1*(data.reduce((sum,r)=>sum+2*(0*r.x-r.y)*r.x,0)/data.length);
  const checkpoint=put('checkpoint.fixture.json',{fixtureOnly:true,weight});
  put('training.json',{...common,schemaVersion:'ai-painter-checkpoint-training-receipt-v1',
    program:request.trainerProgram,optimizerSteps:1,nonTrainOptimizerSteps:0,checkpoint,
    outputs:data.map(r=>r.x*weight)});
}else{
  assert.equal(mode,'reload');
  const t=JSON.parse(fs.readFileSync(path.join(root,'training.json'))), cp=read(t.checkpoint);
  assert.equal(cp.fixtureOnly,true);
  put('reload.json',{...common,schemaVersion:'ai-painter-checkpoint-reload-receipt-v1',program:request.reloadProgram,
    optimizerSteps:0,loadedCheckpoint:t.checkpoint,outputs:data.map(r=>r.x*cp.weight)});
}
