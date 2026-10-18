import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projectRoot } from './lib/ai-pet-world-storage.mjs';
import { LOCAL_CONTROL_PROTOCOL, LOCAL_CONTROL_REGISTRATION, parseLocalPrepareArguments,
  startLocalPreparation, readLocalPreparationStatus, stopLocalPreparation, runLocalPreparationRequest,localPreparationRoute,localPreparationSelectionFromRequestPath } from './lib/ai-painter-local-prepare-v1.mjs';
export { LOCAL_CONTROL_PROTOCOL, LOCAL_CONTROL_REGISTRATION, parseLocalPrepareArguments };

const entryProjectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const operatorKey='AI_PET_WORLD_OPERATOR_SESSION_SECRET';
const officialRequire=createRequire(import.meta.url);
export const LOCAL_OPERATOR_DEPLOYMENT_DEPENDENCIES=Object.freeze([
  Object.freeze({path:'node_modules/@next/env/package.json',package:'@next/env',version:'16.2.4'}),
  Object.freeze({path:'node_modules/@next/env/dist/index.js',package:'@next/env',version:'16.2.4',sha256:'44e84a28e712bca30781e892e3e64d3aecdc46bef9d23b5b7f39bfa1fcef6baa'}),
]);
let adoptedDeployment=null;
const samePath=(a,b)=>path.relative(path.resolve(a),path.resolve(b))==='';
const fileStamp=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
function restoreEnvironment(snapshot) {
  for(const name of Object.keys(process.env))if(!Object.hasOwn(snapshot,name))delete process.env[name];
  for(const [name,value] of Object.entries(snapshot))process.env[name]=value;
}
function readDeploymentFiles(root,mode) {
  // Filesystem allowlist follows installed @next/env16.2.4. Parsing, expansion
  // and precedence are performed only by that official loader below.
  const names=[`.env.${mode}.local`,...(mode==='test'?[]:['.env.local']),`.env.${mode}`,'.env'];
  return names.map(name=>{
    const file=path.join(root,name);let stat;
    try{stat=fs.lstatSync(file,{bigint:true});}catch(error){if(error.code==='ENOENT')return {name,stamp:null};throw error;}
    need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1n&&stat.size<=65536n,'local_v2_deployment_file_invalid');
    const bytes=fs.readFileSync(file);let contents;
    try{contents=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw Error('local_v2_deployment_file_encoding_invalid');}
    need(fileStamp(fs.lstatSync(file,{bigint:true}))===fileStamp(stat),'local_v2_deployment_file_changed');
    return {name,stamp:fileStamp(stat),contents};
  });
}
function loadDeployment(root) {
  let snapshot=null,chosen=null,source=null,mode=null,files=null;
  try {
    need(typeof root==='string'&&path.isAbsolute(root),'local_v2_deployment_root_invalid');
    const rootStat=fs.lstatSync(root);
    need(rootStat.isDirectory()&&!rootStat.isSymbolicLink()&&samePath(fs.realpathSync(root),root),'local_v2_deployment_root_invalid');
    if(adoptedDeployment){
      need(samePath(root,adoptedDeployment.root)&&process.env[operatorKey]===adoptedDeployment.value,'local_v2_deployment_state_changed');
      return {...adoptedDeployment.summary};
    }
    mode=process.env.NODE_ENV??'production';
    need(['production','development','test'].includes(mode),'local_v2_deployment_mode_invalid');
    files=readDeploymentFiles(root,mode);snapshot={...process.env};
    const provided=Object.hasOwn(snapshot,operatorKey);
    if(provided)need(Buffer.byteLength(snapshot[operatorKey].trim(),'utf8')>=32,'local_v2_deployment_key_short');
    const dependencyRoot=path.join(entryProjectRoot,'node_modules/@next/env');
    need(JSON.parse(fs.readFileSync(path.join(dependencyRoot,'package.json'),'utf8')).version==='16.2.4','local_v2_deployment_loader_version_mismatch');
    const loaderBytes=fs.readFileSync(path.join(dependencyRoot,'dist/index.js'));
    need(crypto.createHash('sha256').update(loaderBytes).digest('hex')===LOCAL_OPERATOR_DEPLOYMENT_DEPENDENCIES[1].sha256,'local_v2_deployment_loader_source_mismatch');
    const loader=officialRequire(path.join(dependencyRoot,'dist/index.js'));
    // A standalone v2 process loads once. Refuse an already used loader rather
    // than adopt its cached initial environment from another config context.
    need(loader.initialEnv===undefined,'local_v2_deployment_loader_state_conflict');
    let loadFailed=false;
    const logger={info(){},warn(){loadFailed=true;},error(){loadFailed=true;}};
    const result=loader.loadEnvConfig(root,mode==='development',logger,true);
    need(!loadFailed,'local_v2_deployment_load_failed');
    const loaded=result.loadedEnvFiles??[];
    const expected=files.filter(file=>file.stamp!==null);
    need(loaded.length===expected.length&&loaded.every((file,i)=>file.path===expected[i].name&&file.contents===expected[i].contents),'local_v2_deployment_file_changed');
    const after=readDeploymentFiles(root,mode);
    need(after.every((file,i)=>file.stamp===files[i].stamp&&file.contents===files[i].contents),'local_v2_deployment_file_changed');
    if(provided){chosen=snapshot[operatorKey];source='process';}
    else {
      // dotenv-expand reflects an already adopted higher-priority signing
      // value into lower file.env fields. Detect conflicting definitions by
      // reprocessing each file with official processEnv, retaining effective
      // interpolation variables while removing only that reflected key.
      const effective={...process.env},values=[];
      for(const file of expected){
        restoreEnvironment(effective);delete process.env[operatorKey];
        const parsed={path:file.name,contents:file.contents,env:{}};
        loader.processEnv([parsed],root,logger,true);
        if(Object.hasOwn(parsed.env,operatorKey))values.push(parsed.env[operatorKey]);
      }
      need(!loadFailed,'local_v2_deployment_load_failed');
      need(values.length>0,'local_v2_deployment_key_missing');
      need(values.every(value=>typeof value==='string'&&Buffer.byteLength(value.trim(),'utf8')>=32),'local_v2_deployment_key_short');
      need(new Set(values.map(value=>value.trim())).size===1,'local_v2_deployment_key_conflict');
      chosen=result.parsedEnv?.[operatorKey];source='project_env';
      need(typeof chosen==='string'&&Buffer.byteLength(chosen.trim(),'utf8')>=32,'local_v2_deployment_key_missing');
    }
  } catch(error) {
    const message=String(error.message??'');
    throw Error(/^local_v2_deployment_[a-z0-9_]+$/u.test(message)?message:'local_v2_deployment_load_failed');
  } finally {
    if(snapshot)restoreEnvironment(snapshot);
  }
  // Preserve every other import-time storage/runtime setting. Never return,
  // hash, log or persist key material, loaded contents or loader exceptions.
  process.env[operatorKey]=chosen;
  const summary={configured:true,source,mode,loadedFileCount:files.filter(file=>file.stamp!==null).length};
  adoptedDeployment={root:path.resolve(root),value:chosen,summary};return {...summary};
}
export function loadLocalOperatorDeploymentConfiguration() {
  need(samePath(projectRoot,entryProjectRoot),'local_v2_deployment_root_mismatch');
  return loadDeployment(entryProjectRoot);
}
export function verifyLocalOperatorDeploymentDependencyBindings(bindings) {
  need(bindings!==null&&typeof bindings==='object'&&!Array.isArray(bindings),'local_v2_deployment_dependency_not_frozen');
  for(const dependency of LOCAL_OPERATOR_DEPLOYMENT_DEPENDENCIES){
    const rows=Object.values(bindings).filter(binding=>binding?.path===dependency.path);
    const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(entryProjectRoot,dependency.path))).digest('hex');
    need(rows.length>0&&rows.every(binding=>binding.sha256===sha256),'local_v2_deployment_dependency_not_frozen');
  }
  return {dependenciesVerified:LOCAL_OPERATOR_DEPLOYMENT_DEPENDENCIES.length};
}
async function requireFrozenDeploymentDependencies(candidateSelection='ecology-quality-v1') {
  const route=localPreparationRoute(candidateSelection),chain=await import('./lib/'+route.chain.slice(2));
   verifyLocalOperatorDeploymentDependencyBindings(chain.finalProgramBindings(entryProjectRoot,{capabilityVersion:route.capability}));
}
function prepareInvocation(argv,loadConfiguration) {
  if(argv[0]==='--internal-prepare-v2'){
    need(argv.length===5&&argv[1]==='--request'&&argv[3]==='--request-sha256','local_prepare_internal_arguments_invalid');
    return {internal:true,relativePath:argv[2],sha256:argv[4],deployment:loadConfiguration()};
  }
  const command=parseLocalPrepareArguments(argv);
  return {internal:false,command,...(command.help||command.command==='status'?{}:{deployment:loadConfiguration()})};
}
// Explicit isolated configuration tests have no execution/authentication hook.
export function prepareLocalControlV2InvocationForIsolatedTests(argv,root) {
  const parent=process.env.AI_PAINTER_LOCAL_PREPARE_COMPONENT_ROOT;
  need(typeof parent==='string'&&path.isAbsolute(parent)&&path.relative(parent,root)!==''&&
    !path.relative(parent,root).startsWith('..')&&!path.isAbsolute(path.relative(parent,root)),'local_v2_deployment_test_root_invalid');
  return {...prepareInvocation(argv,()=>loadDeployment(root)),executionNotInvoked:true};
}

export const LOCAL_CONTROL_HELP = `AI Painter fixed prepare-and-start v2
Usage: node scripts/run-ai-painter-local-control-v2.mjs --protocol ai-painter-local-control-v2 start --candidate ecology-quality-v1
       node scripts/run-ai-painter-local-control-v2.mjs --protocol ai-painter-local-control-v2 status [--request-id <returned ID>]
       node scripts/run-ai-painter-local-control-v2.mjs --protocol ai-painter-local-control-v2 stop --request-id <returned ID>
start reads the existing authenticated credentials object from stdin; preparation JSON, package SHA, runner and training overrides are never caller inputs.
The existing stable operator session secret must already be configured in the process or existing project deployment env files. External and internal v2 adopt the same official configuration loader; status does not load or require authentication configuration. No credentials in argv or logs; no automatic retries.
The local program prepares a fresh CPU request, requires its actual retained CPU proof, materializes its bound package and runs the existing lifecycle in one background process.
status is read-only. A preparation request, planned package ID or process-start receipt is not a current training run or qualification.
stop is unavailable before a final package and exact current active training identity exist. It then reads the existing authenticated exact v1 stop target input and submits only that intent; no external PID kill.
Production authentication, actual network isolation, model qualification and unknown fault diagnosis/code repair require separate evidence.
`;
function need(value, code) { if (!value) throw Error(code); }
function stdinBody() {
  return new Promise((resolve,reject)=>{
    let bytes=0,chunks=[];
    const finish=error=>{clearTimeout(timer);process.stdin.removeListener('data',data);process.stdin.removeListener('end',end);process.stdin.removeListener('error',fail);process.stdin.pause();if(error)reject(error);};
    const fail=error=>finish(error),data=chunk=>{bytes+=chunk.length;if(bytes>8192)finish(Error('local_v2_stdin_oversized'));else chunks.push(chunk);};
    const end=()=>{try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));finish();resolve(body);}catch{finish(Error('local_v2_stdin_invalid_json'));}};
    const timer=setTimeout(()=>finish(Error('local_v2_stdin_timeout')),15000);
    process.stdin.on('data',data);process.stdin.once('end',end);process.stdin.once('error',fail);
  });
}
export async function runLocalControlV2(command, body, root=projectRoot) {
  if(command.command==='status') return readLocalPreparationStatus(root,command.requestId);
  need(samePath(root,projectRoot),'local_v2_execution_root_mismatch');
  need(body!==null && typeof body==='object' && !Array.isArray(body),'local_v2_authenticated_body_required');
  loadLocalOperatorDeploymentConfiguration();
  if(command.command==='start') {
    need(Object.keys(body).join(',')==='credentials','local_v2_start_body_fields');
    await requireFrozenDeploymentDependencies(command.candidateSelection);
    return startLocalPreparation({root,credentials:body.credentials,candidateSelection:command.candidateSelection});
  }
  need(command.command==='stop' && Object.keys(body).sort().join(',')==='credentials,input','local_v2_stop_body_fields');
  return stopLocalPreparation({root,requestId:command.requestId,body});
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  let internalRequestMode=false;
  try {
    const invocation=prepareInvocation(process.argv.slice(2),loadLocalOperatorDeploymentConfiguration);let result;
    if(invocation.internal) {
      internalRequestMode=true;
      // Internal request bytes are checked by the nonce-bound receiver before
      // route-specific preparation. Both routes bind the same official loader.
      await requireFrozenDeploymentDependencies(localPreparationSelectionFromRequestPath(invocation.relativePath));
      result=await runLocalPreparationRequest({root:projectRoot,relativePath:invocation.relativePath,sha256:invocation.sha256});
    }else{
      const command=invocation.command;
      if(command.help)process.stdout.write(LOCAL_CONTROL_HELP);
      else result=await runLocalControlV2(command,command.command==='status'?null:await stdinBody());
    }
    if(result!==undefined){process.stdout.write(JSON.stringify(result)+'\n');if(result.status==='launch_observation_failed')process.exitCode=1;}
  }catch(error){const message=String(error.message??error),errorCode=/^(?:local_|stop_|control_)[a-z0-9_]{1,180}$/u.test(message)?message:'local_v2_internal_error';
    process.stderr.write(JSON.stringify({protocol:LOCAL_CONTROL_PROTOCOL,status:'failed_closed',errorCode,
      ...(internalRequestMode&&process.execArgv.includes('--import')?{detail:String(error.stack??error).slice(0,8192)}:{})})+'\n');process.exitCode=1;}
}
