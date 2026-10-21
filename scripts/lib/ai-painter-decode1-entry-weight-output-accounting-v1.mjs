// Candidate-local adoption of the existing three-scan atomic accounting rule.
// Historical IO and its source bytes remain unchanged. No skipped output bytes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {physicalRuntimeRoot,projectRoot} from './ai-pet-world-storage.mjs';
import {registeredTrainingInterfaces} from './ai-painter-decode1-entry-weight-quality-registration-v1.mjs';
import * as historicalIo from './ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';

const budgetContext=new AsyncLocalStorage();
const atomicNamespaces=Object.freeze([
 Object.freeze({namespace:'decode1-entry-weight-quality-executions',
  runPattern:/^decode1-entry-quality-v1-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u}),
 Object.freeze({namespace:'decode1-entry-weight-quality-same-call-v1-executions',
  runPattern:/^decode1-entry-same-call-v1-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u})
]);
const timingName='gpu-qualification-timing.json';
const rootIdentity=stat=>`${stat.dev}:${stat.ino}`;

function timingRootIdentity(directory){
 const resolved=path.resolve(directory);
 let route=atomicNamespaces.find(value=>path.basename(path.dirname(resolved))===value.namespace&&value.runPattern.test(path.basename(resolved)));
 if(!route&&path.basename(path.dirname(resolved)).startsWith('registered-training-')){
  const profile=registeredTrainingInterfaces(projectRoot).find(value=>path.basename(value.OUTPUT_ROOT)===path.basename(path.dirname(resolved))
   &&path.basename(resolved).startsWith(value.runPrefix)&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(path.basename(resolved).slice(value.runPrefix.length)));
  if(profile)route={namespace:path.basename(profile.OUTPUT_ROOT)};
 }
 if(!route)return null;
 const stat=fs.lstatSync(directory);
 assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'output root must be a regular directory');
 const physical=fs.realpathSync(directory);
 if(path.dirname(physical)!==path.join(fs.realpathSync(physicalRuntimeRoot),'ai-painter',route.namespace))return null;
 return {physical,identity:rootIdentity(stat)};
}

class AtomicOutputReplacement extends Error {}
export function directoryBytes(directory){
 const identity=timingRootIdentity(directory);
 if(identity===null)return historicalIo.directoryBytes(directory);
 const stable=()=>{
  const stat=fs.lstatSync(directory);
  assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'output root must be a regular directory');
  assert.equal(rootIdentity(stat),identity.identity,'output root identity changed');
  assert.equal(fs.realpathSync(directory),identity.physical,'output root redirected');
 };
 const walk=base=>fs.readdirSync(base,{withFileTypes:true}).reduce((total,entry)=>{
  const file=path.join(base,entry.name),timing=base===directory&&(entry.name===timingName||entry.name===timingName+'.staged');
  let stat;
  try{stat=fs.lstatSync(file);}catch(error){
   const replacementName=entry.name.match(/^(progress\.json)\.staged-[a-f0-9]{16}$/u)?.[1]
    ??entry.name.match(/^(heartbeat\.json)\.staged-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u)?.[1]
    ??(timing&&entry.name===timingName+'.staged'&&entry.isFile()&&!entry.isSymbolicLink()?timingName:null);
   if(error.code!=='ENOENT'||replacementName===null||replacementName===undefined)throw error;
   const replacement=fs.lstatSync(path.join(base,replacementName));
   assert.ok(replacement.isFile()&&!replacement.isSymbolicLink(),'atomic output replacement must be regular');
   if(timing)assert.ok(replacement.size<=32768,'timing32768 byte ceiling');
   throw new AtomicOutputReplacement('atomic output changed during accounting');
  }
  assert.equal(stat.isSymbolicLink(),false,'output junction prohibited');
  if(timing)assert.ok(stat.isFile()&&stat.size<=32768,'timing output must be regular within32768 bytes');
  return total+(stat.isDirectory()?walk(file):stat.isFile()?stat.size:0);
 },0);
 for(let attempt=0;attempt<3;attempt++){
  stable();
  try{const total=walk(directory);stable();return total;}
  catch(error){if(!(error instanceof AtomicOutputReplacement))throw error;}
 }
 throw new Error('atomic output accounting did not settle within three scans');
}

// Same parent-only budget contract as the historical IO. Local writes must use
// the same adopted measurement as the native keeper, including reserve bytes.
export function withOutputBudget(options,action){
 assert.ok(Array.isArray(options.roots)&&options.roots.length>0&&options.roots.length<=32);
 assert.ok(Number.isSafeInteger(options.maximum)&&options.maximum>0);
 assert.ok(Number.isSafeInteger(options.reserveBytes)&&options.reserveBytes>=0&&options.reserveBytes<options.maximum);
 for(const logical of options.roots)historicalIo.inside(options.projectRoot,logical);
 const files=options.files??[];assert.ok(Array.isArray(files)&&files.length<=2);
 assert.equal(new Set(files).size,files.length);
 for(const logical of files){historicalIo.inside(options.projectRoot,logical);assert.ok(!options.roots.some(root=>logical===root||logical.startsWith(root+'/')),'explicit budget file already counted by root');}
 assert.equal(typeof action,'function');
 return budgetContext.run(Object.freeze({...options,roots:[...options.roots],files:[...files]}),action);
}

export function write(root,logical,value){
 const file=historicalIo.inside(root,logical),data=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)+'\n');
 if(!Buffer.isBuffer(value))assert.ok(data.length<=2097152,'single JSON budget');
 const scope=budgetContext.getStore();
 if(scope){assert.equal(path.resolve(root),path.resolve(scope.projectRoot));assert.ok(scope.roots.some(base=>logical.startsWith(base+'/'))||scope.files.includes(logical),'write outside explicit accounting scope');}
 if(scope||process.env.DETAIL_WEIGHT_OUTPUT_ROOTS){
  const roots=scope?.roots??JSON.parse(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS),maximum=scope?.maximum??Number(process.env.DETAIL_WEIGHT_OUTPUT_MAX),reserve=scope?.reserveBytes??65536,budgetRoot=scope?.projectRoot??process.env.DETAIL_WEIGHT_BUDGET_PROJECT_ROOT??root;
  const fileBytes=(scope?.files??[]).reduce((total,relative)=>{const target=historicalIo.inside(budgetRoot,relative);if(!fs.existsSync(target))return total;const stat=fs.lstatSync(target);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'explicit budget file must be regular');return total+stat.size;},0);
  assert.ok(roots.reduce((total,relative)=>total+directoryBytes(historicalIo.inside(budgetRoot,relative)),0)+fileBytes+data.length<=maximum-reserve,'total output reserve');
 }
 fs.mkdirSync(path.dirname(file),{recursive:true});const fd=fs.openSync(file,'wx');
 try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 return {path:logical,sha256:historicalIo.sha(data)};
}
