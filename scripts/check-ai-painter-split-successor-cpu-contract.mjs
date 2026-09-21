// Explicit successor verification. Never rewrites or grants success to the
// historical parent's checker, whose original program graph remains frozen.
import assert from 'node:assert/strict';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';
import {inspectSplitSmokeComponent} from './lib/ai-painter-stage4-split-smoke-preflight.mjs';
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs';
const {values}=parseArgs({options:{component:{type:'string'},sha256:{type:'string'}}});
const root=process.cwd(),componentContract={path:values.component,sha256:values.sha256};
const inspected=inspectSplitSmokeComponent({root,componentContractBinding:componentContract});
assert.equal(inspected.contract.schemaVersion,'ai-painter-stage4-split-isolated-smoke-contract-v2');
const reader=createReader(root);
for(const receipt of inspected.inputReceipts)reader.bytes(receipt.path,receipt.sha256);
reader.bytes('scripts/check-ai-painter-split-successor-cpu-contract.mjs');
const parent=reader.bound(inspected.contract.parentCapability);
const graph=reader.bound(inspected.contract.compilerLineage);
const allowed={
  condition_contract:['node','scripts/check-ai-painter-contract-semantic-alignment.mjs','conditionContract'],
  dataset_release:['node','scripts/check-ai-painter-stage4-v2-mvp64-dataset-release.mjs','datasetBinding'],
  trainer_loss_support:['python','ml/ai-painter/scripts/check_stage4_semantic_transport_v2_trainer_support_cpu.py','lossContract'],
  machine_review_threshold:['node','scripts/check-ai-painter-stage4-v2-machine-review-threshold-contract.mjs','reviewThresholdContract'],
  foundation_autoencoder_lineage:['node','scripts/check-ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract.mjs','foundationAssetBinding'],
};
assert.deepEqual(Object.keys(parent.prerequisiteBindings).sort(),Object.keys(allowed).sort());
const python=process.platform==='win32'?path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'):(process.env.AI_PAINTER_PYTHON??'python3');
function run(command,args){
  const result=spawnSync(command,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,
    env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',CUDA_VISIBLE_DEVICES:'-1',NVIDIA_VISIBLE_DEVICES:'none',AI_PAINTER_CPU_ONLY:'1',AI_PAINTER_ALLOW_GPU:'0'}});
  if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
  assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,`successor CPU child failed: ${args[0]}`);
  assert.equal(result.signal,null);return {command,args,status:'passed'};
}
const prerequisiteRegressions={};
for(const [id,[kind,checker,field]] of Object.entries(allowed)){
  const b=parent.prerequisiteBindings[id];
  assert.equal(b.id,id);assert.equal(b.required,true);assert.equal(b.executionClass,'cpu_readonly');
  assert.equal(b.path,parent[field].path);assert.equal(b.sha256,parent[field].sha256);
  assert.deepEqual(b.checkerCommand,{command:kind,args:[checker]});reader.bound(b);
  assert.ok(Object.values(graph.effectiveProgramBindings).some(binding=>binding.path===checker),'checker not in verified successor graph');
  prerequisiteRegressions[id]=run(kind==='node'?process.execPath:python,[checker]);
}
const tests=['ml.ai-painter.tests.test_stage4_semantic_transport_v2',
  'ml.ai-painter.tests.test_stage4_semantic_transport_v2_trainer_support',
  'ml.ai-painter.tests.test_stage4_joint_condition_local_transport',
  'ml.ai-painter.tests.test_stage4_full_backbone_spatial_affine_conditioned_denoiser'];
for(const test of tests)reader.bytes(test.replaceAll('.','/')+'.py');
const regression=run(python,['-B','-m','unittest',...tests]);
reader.verifyStable();
console.log(JSON.stringify({status:'passed',componentContract,compilerLineage:inspected.contract.compilerLineage,
  parentCapability:inspected.contract.parentCapability,inheritedParentQualification:false,
  prerequisiteRegressions,regression,inputReceipts:reader.receipts(),
  trainingAllowed:false,gpuStarted:false,trainingStarted:false},null,2));
