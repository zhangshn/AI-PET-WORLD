import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn,spawnSync} from 'node:child_process'
import {readCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {rehearsalSucceeded} from './ai-painter-mixed-train-rehearsal-v1.mjs'
import {stemPairPolicies,stemDecoderPolicies} from './ai-painter-mixed-train-rehearsal-v1.mjs'
export {stemPairPolicies}
export const stemPairTemplate='data/ai-painter/system-governance/ai-painter-mixed-train-stem-pair-baseline-template-v1.json'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export const stemDecoderTemplate='data/ai-painter/system-governance/ai-painter-mixed-train-stem-decoder-baseline-template-v1.json'
export const sealStemPairSuccessor=(template,baseline,bindings)=>sealSuccessor(template,baseline,bindings,'stem-pair')
export const sealStemDecoderSuccessor=(template,baseline,bindings)=>sealSuccessor(template,baseline,bindings,'stem-decoder')
function sealSuccessor(template,baseline,bindings,kind){
 assert.equal(template.arm,kind+'-baseline');assert.equal(baseline.arm,kind+'-support1')
 assert.equal(template.equalBudgetComparator,null);assert.equal(template.comparisonBindingStatus,'pending_completed_'+kind.replaceAll('-','_')+'_support1')
 assert.deepEqual(template.parentExperiment,baseline.parentExperiment)
 assert.deepEqual(template.sampleIds,baseline.selectedSampleIds)
 assert.deepEqual({...template.training,supportStructureWeight:1},baseline.training)
 assert.deepEqual(template.resources,baseline.resources);assert.equal(template.modelCapability,baseline.modelCapability)
 assert.equal(template.training.supportStructureWeight,.1)
 assert.deepEqual(Object.keys(bindings).sort(),['package','result','terminal'])
 for(const b of Object.values(bindings)){assert.equal(typeof b.path,'string');assert.match(b.sha256,/^[a-f0-9]{64}$/u)}
 return {...structuredClone(template),equalBudgetComparator:structuredClone(bindings),comparisonBindingStatus:'bound_completed_'+kind.replaceAll('-','_')+'_support1'}
}
export async function runStemPairComparison(){throw new Error('Consumed stem pair sequence is evidence only')}
export async function runStemDecoderComparison(root=process.cwd()){
 root=path.resolve(root)
 const dir='.runtime/ai-painter/controller-repair-reviews/stem-decoder-comparison-073-20261027'
 const absolute=p=>{assert.equal(typeof p,'string');assert.ok(!path.isAbsolute(p)&&!p.includes('..')&&!p.includes('\\')&&!p.includes(':'));return path.join(root,p)}
 const bind=p=>({path:p,sha256:sha(fs.readFileSync(absolute(p)))})
 const read=b=>{const bytes=fs.readFileSync(absolute(b.path));assert.equal(sha(bytes),b.sha256);return JSON.parse(bytes)}
 const put=(p,v)=>{fs.mkdirSync(path.dirname(absolute(p)),{recursive:true});fs.writeFileSync(absolute(p),JSON.stringify(v,null,2)+'\n',{flag:'wx'});return bind(p)}
 const cutoff=Date.parse('2026-10-27T00:00:00Z'),perChildMs=4500_000
 const registry=await readCurrentExecutionRegistry(root);assert.ok(registry.ok&&registry.registry.activeExecution===null)
 assert.ok(Date.now()+2*perChildMs<cutoff,'insufficient bounded time before owner cutoff')
 assert.ok(!fs.existsSync(absolute(stemDecoderPolicies['stem-decoder-baseline'])),'successor already sealed; no replay')
 const templateBinding=bind(stemDecoderTemplate),template=read(templateBinding)
 put(dir+'/sequence-started.json',{taskId:'STEM-DECODER-COMPARISON-073',startedAtUtc:new Date().toISOString(),template:templateBinding,policies:stemDecoderPolicies,perChildMaxSeconds:perChildMs/1000,cutoffUtc:'2026-10-27T00:00:00Z',retries:0,failureStopsSequence:true,formalQualificationGranted:false})
 const results=[]
 try{
  for(const [arm,policy] of Object.entries(stemDecoderPolicies)){
   assert.ok(Date.now()+perChildMs<cutoff,'owner cutoff boundary')
   const log=fs.createWriteStream(absolute(dir+'/'+arm+'.log'),{flags:'wx'})
   let child,timedOut=false
   const code=await new Promise((resolve,reject)=>{
    child=spawn(process.execPath,['scripts/run-ai-painter-learning-capacity-experiment.mjs','run','--policy',policy],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']})
    const timer=setTimeout(()=>{timedOut=true;if(child.exitCode===null){if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:10000});else child.kill()}},perChildMs)
    child.stdout.on('data',b=>{log.write(b);process.stdout.write(b)});child.stderr.on('data',b=>{log.write(b);process.stderr.write(b)})
    child.once('error',e=>{clearTimeout(timer);log.end();reject(e)})
    child.once('close',c=>{clearTimeout(timer);log.end();resolve(c)})
   })
   assert.equal(timedOut,false,'comparison child timeout');assert.equal(code,0,'comparison child failed')
   const current=await readCurrentExecutionRegistry(root);assert.ok(current.ok&&current.registry.activeExecution===null,'child did not close registry')
   const tb=current.registry.latestTrainingTerminal;assert.ok(tb?.path&&tb?.sha256)
   const terminal=read(tb),pkg=read(terminal.executionPackage),result=read(terminal.result)
   assert.equal(pkg.policy.path,policy);assert.equal(pkg.arm,arm);assert.equal(terminal.executionState,'completed')
   assert.ok(rehearsalSucceeded(result,pkg,terminal.exitCode,terminal.timedOut),'incomplete training source')
   for(const b of pkg.programs)assert.deepEqual(bind(b.path),b,'program changed between comparison arms')
   assert.equal(current.registry.taskKind,'readonly_post_training_visual_review','local post-review did not complete')
   assert.ok(current.registry.terminalEvidence?.path&&current.registry.terminalEvidence?.sha256)
   const review=read(current.registry.terminalEvidence)
   assert.equal(review.executionState,'completed');assert.equal(review.sourceRunId,terminal.runId)
   const bindings={package:terminal.executionPackage,terminal:{path:tb.path,sha256:tb.sha256},result:terminal.result}
   results.push({arm,policy,bindings,reviewId:review.runId,visualOutcome:review.visualOutcome})
   put(dir+'/completed-'+arm+'.json',results.at(-1))
   if(arm==='stem-decoder-support1'){
    assert.deepEqual(bind(stemDecoderTemplate),templateBinding)
    const successor=sealStemDecoderSuccessor(template,pkg,bindings)
    put(stemDecoderPolicies['stem-decoder-baseline'],successor)
   }
  }
  put(dir+'/sequence-result.json',{taskId:'STEM-DECODER-COMPARISON-073',finishedAtUtc:new Date().toISOString(),status:'two_arms_and_local_reviews_completed_not_formal_qualified',results,formalQualificationGranted:false})
 }catch(error){put(dir+'/sequence-failure.json',{taskId:'STEM-DECODER-COMPARISON-073',recordedAtUtc:new Date().toISOString(),error:String(error),results,formalQualificationGranted:false});throw error}
}
