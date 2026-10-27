import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
export const routingPolicies=['baseline','routed'].map(arm=>`data/ai-painter/system-governance/ai-painter-terrain-routing-${arm}-policy-v1.json`)
export const routingWorker='ml/ai-painter/scripts/painter_terrain_routing_comparison_v1.py'
export const routingTests='test_terrain_routing_comparison_v1.py'
export function routingSucceeded(result,pkg,code,timedOut){
 try{
  assert.equal(code,0);assert.equal(timedOut,false);assert(routingPolicies.includes(pkg.policy.path))
  assert.equal(pkg.schemaVersion,'terrain-routing-comparison-package-v1');assert.equal(pkg.training.pairs,100)
  assert.equal(result.experimentIdentity,pkg.experimentIdentity);assert.equal(result.arm,pkg.arm)
  assert.equal(result.backwardRoutingChanged,pkg.arm==='routed')
  assert.equal(result.status,'experiment_executed_not_visual_qualified');assert.equal(result.checkpointReloadExact,true)
  assert.equal(result.formalQualificationGranted,false);assert.deepEqual(result.optimizerSteps,{generator:100,discriminator:100})
  assert.deepEqual(result.sampleVisits,Object.fromEntries(pkg.selectedSampleIds.map(s=>[s,50])))
  assert.equal(result.artifacts.filter(b=>b.path===pkg.outputRoot+'/checkpoint-final.pt').length,1)
  return true
 }catch{return false}
}
export async function runTerrainRoutingComparison(root=process.cwd()){
 const dir='.runtime/ai-painter/controller-repair-reviews/terrain-routing-comparison-047-20261027'
 const file=n=>path.join(root,dir,n),hash=b=>createHash('sha256').update(b).digest('hex')
 const put=(n,v)=>{fs.mkdirSync(path.dirname(file(n)),{recursive:true});fs.writeFileSync(file(n),JSON.stringify(v,null,2),{flag:'wx'})}
 const cutoff=Date.parse('2026-10-27T00:00:00Z')
 const registry=await readCurrentExecutionRegistry(root);assert(registry.ok&&registry.registry.activeExecution===null,'another execution active')
 assert(Date.now()+1800_000<cutoff,'insufficient time before owner cutoff')
 put('sequence-started.json',{taskId:'TERRAIN-ROUTING-COMPARISON-047',recordedAtUtc:new Date().toISOString(),policies:routingPolicies,cutoffUtc:'2026-10-27T00:00:00Z',failureStopsSequence:true,retries:0,sourceAuthorization:'Owner instruction in current thread: continuously pursue autonomous MVP world until 2026-10-27 08:00 UTC+8',previousRegistryRevision:registry.registry.registryRevision})
 const results=[]
 try{
  for(const policy of routingPolicies){
   assert(Date.now()+900_000<cutoff,'owner cutoff reached')
   const log=fs.createWriteStream(file(path.basename(policy)+'.log'),{flags:'wx'})
   const code=await new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,['scripts/run-ai-painter-learning-capacity-experiment.mjs','run','--policy',policy],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']})
    p.stdout.on('data',b=>{log.write(b);process.stdout.write(b)});p.stderr.on('data',b=>{log.write(b);process.stderr.write(b)})
    p.once('error',e=>{log.end();reject(e)});p.once('close',c=>{log.end();resolve(c)})
   })
   const current=await readCurrentExecutionRegistry(root);assert(current.ok&&current.registry.activeExecution===null,'child did not close registry')
   const terminalBinding=current.registry.latestTrainingTerminal;assert(terminalBinding,'missing terminal')
   const bytes=fs.readFileSync(path.join(root,terminalBinding.path));assert.equal(hash(bytes),terminalBinding.sha256)
   const terminal=JSON.parse(bytes);assert.equal(code,0);assert.equal(terminal.executionState,'completed')
   const pkg=JSON.parse(fs.readFileSync(path.join(root,path.posix.dirname(terminalBinding.path),'package.json'),'utf8'))
   assert.equal(pkg.policy.path,policy);results.push({policy,terminal:terminalBinding,runId:terminal.runId})
   put(`completed-${pkg.arm}.json`,results.at(-1))
  }
  put('sequence-result.json',{taskId:'TERRAIN-ROUTING-COMPARISON-047',recordedAtUtc:new Date().toISOString(),status:'both_arms_completed_quality_not_adjudicated',results,formalQualificationGranted:false})
 }catch(e){put('sequence-failure.json',{taskId:'TERRAIN-ROUTING-COMPARISON-047',recordedAtUtc:new Date().toISOString(),error:String(e),results});throw e}
}
