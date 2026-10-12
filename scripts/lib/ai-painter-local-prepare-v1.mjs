import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readCurrentExecutionRegistry } from '../../src/server/ai-painter-current-execution-registry.mjs';
import { localOperatorRequest } from './ai-painter-owned-stop-native-control-v1.mjs';
import { readOwnedStopProjectFile, resolveOwnedStopProjectDirectory, validateOwnedStopInput, STOP_REQUEST_LIMITS } from './ai-painter-owned-stop-request-v1.mjs';
import { launchProjectCommandBackground, validateBoundedBackgroundObservation } from './ai-painter-autonomous-background-launcher-v1.mjs';
import { validateExactlyOnceBackgroundSpawnAttempt } from './ai-painter-exactly-once-background-spawn-v1.mjs';
import { CAPABILITY, CANDIDATE, OUTPUT_ROOT } from './ai-painter-ecology-quality-registration-v1.mjs';
import { CURRENT_ENTRYPOINT_REGISTRY_PATH, runAutonomousClosedLoop } from './ai-painter-autonomous-closed-loop-v1.mjs';
import { materializeAutonomousClosedLoopPackage } from './ai-painter-autonomous-package-materializer-v1.mjs';
import { runLocalControl as runV1 } from '../run-ai-painter-local-control-v1.mjs';
import { write as writeBudgeted, withOutputBudget } from './ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';

export const LOCAL_CONTROL_PROTOCOL = 'ai-painter-local-control-v2';
export const LOCAL_CONTROL_ENTRY = 'scripts/run-ai-painter-local-control-v2.mjs';
export const LOCAL_PREPARE_MODULE = 'scripts/lib/ai-painter-local-prepare-v1.mjs';
export const LOCAL_CONTROL_REGISTRATION = Object.freeze({entryId:LOCAL_CONTROL_PROTOCOL,entryFile:LOCAL_CONTROL_ENTRY,
  role:'fixed_local_prepare_start_status_stop_v2',protocol:LOCAL_CONTROL_PROTOCOL,capabilityVersion:CAPABILITY,
  adapterFile:LOCAL_PREPARE_MODULE,runnerFile:LOCAL_CONTROL_ENTRY,candidateSelection:'ecology-quality-v1',
  candidateBinding:CANDIDATE,commands:Object.freeze(['start','status','stop'])});
export const LOCAL_DECODE1_PREPARE_REGISTRATION=Object.freeze({...LOCAL_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v2-ecology-decode1-quality-v1',
 capabilityVersion:'stage4_mvp256_dry_factorized_ecology_decode1_weight_precision_quality_v1',candidateSelection:'ecology-decode1-quality-v1'});
const PREPARATION_ROUTES=Object.freeze([
 Object.freeze({registration:LOCAL_CONTROL_REGISTRATION,capability:CAPABILITY,outputRoot:OUTPUT_ROOT,prefix:'quality-v2-',packagePrefix:'quality-v2-package-',chain:'./ai-painter-ecology-quality-package-chain-v1.mjs',native:'./ai-painter-ecology-quality-owned-native-v1.mjs',adapter:'scripts/run-ai-painter-ecology-quality-v1.mjs'}),
 Object.freeze({registration:LOCAL_DECODE1_PREPARE_REGISTRATION,capability:LOCAL_DECODE1_PREPARE_REGISTRATION.capabilityVersion,outputRoot:'.runtime/ai-painter/ecology-decode1-weight-quality-executions',prefix:'decode1-quality-v2-',packagePrefix:'decode1-quality-v2-package-',chain:'./ai-painter-ecology-decode1-quality-package-chain-v1.mjs',native:'./ai-painter-ecology-decode1-quality-owned-native-v1.mjs',adapter:'scripts/run-ai-painter-ecology-decode1-quality-v1.mjs'})]);
export function localPreparationRoute(candidateSelection){const route=PREPARATION_ROUTES.find(r=>r.registration.candidateSelection===candidateSelection);need(route,'local_v2_fixed_candidate_required');return route;}
function routeForId(id){const route=PREPARATION_ROUTES.find(r=>typeof id==='string'&&id.startsWith(r.prefix)&&/^[a-f0-9-]{36}$/u.test(id.slice(r.prefix.length)));need(route,'local_prepare_request_id_invalid');return route;}
export function localPreparationSelectionFromRequestPath(relativePath){
 const route=PREPARATION_ROUTES.find(r=>typeof relativePath==='string'&&relativePath.startsWith(r.outputRoot+'/'+r.prefix)&&/^[a-f0-9-]{36}\/local-prepare\/request\.json$/u.test(relativePath.slice((r.outputRoot+'/'+r.prefix).length)));
 need(route,'local_prepare_internal_request_path_invalid');return route.registration.candidateSelection;
}
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const need = (value, code) => { if (!value) throw Error(code); };
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(v=>JSON.parse(canonical(v))) : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])) : value);
const requestIdValid = value => PREPARATION_ROUTES.some(r=>typeof value==='string'&&value.startsWith(r.prefix)&&/^[a-f0-9-]{36}$/u.test(value.slice(r.prefix.length)));
const evidenceRoot = requestId => `${routeForId(requestId).outputRoot}/${requestId}/local-prepare`;
const receiptRoot = requestId => `${evidenceRoot(requestId)}/background-launches`;
const requestPath = requestId => `${evidenceRoot(requestId)}/request.json`;
const readJson = (root, relative) => JSON.parse(readOwnedStopProjectFile(root,relative).toString('utf8'));

export function parseLocalPrepareArguments(argv) {
  need(Array.isArray(argv) && argv.every(v=>typeof v==='string'),'local_v2_arguments_invalid');
  if (argv.length===1 && argv[0]==='--help') return {help:true};
  need(argv[0]==='--protocol' && argv[1]===LOCAL_CONTROL_PROTOCOL,'local_v2_protocol_required');
  const command=argv[2]; need(['start','status','stop'].includes(command),'local_v2_command_invalid');
  if (command==='start') { need(argv.length===5 && argv[3]==='--candidate','local_v2_fixed_candidate_required');localPreparationRoute(argv[4]); return {command,candidateSelection:argv[4]}; }
  if (command==='status' && argv.length===3) return {command};
  need(argv.length===5 && argv[3]==='--request-id' && requestIdValid(argv[4]),'local_v2_exact_request_id_required');
  return {command,requestId:argv[4]};
}
function registered(root,route=PREPARATION_ROUTES[0]) {
  const index=readJson(root,CURRENT_ENTRYPOINT_REGISTRY_PATH);
  need(index.schemaVersion==='ai-painter-current-entrypoint-registry-v1' && index.status==='active' && Array.isArray(index.currentEntrypoints) && Array.isArray(index.localControlEntrypoints),'local_v2_entrypoint_registry_invalid');
  const rows=index.localControlEntrypoints.filter(row=>plain(row)&&row.entryId===route.registration.entryId);
  need(rows.length===1 && canonical(rows[0])===canonical(route.registration),'local_v2_capability_not_registered');
}
export function verifyPreparationSources(root, bindings,candidateSelection=LOCAL_CONTROL_REGISTRATION.candidateSelection) {
  const route=localPreparationRoute(candidateSelection);
  need(plain(bindings) && Object.keys(bindings).length>0 && Object.keys(bindings).length<=STOP_REQUEST_LIMITS.sourceFiles,'local_prepare_source_count_limit');
  const files=new Set();let total=0;
  for(const binding of Object.values(bindings)) {
    need(plain(binding) && Object.keys(binding).sort().join(',')==='path,sha256','local_prepare_source_binding_invalid');
    const bytes=readOwnedStopProjectFile(root,binding.path,STOP_REQUEST_LIMITS.sourceFileBytes);
    need(hash(bytes)===binding.sha256,'local_prepare_source_drift');
    if(!files.has(binding.path)){total+=bytes.length;files.add(binding.path);}
    need(total<=STOP_REQUEST_LIMITS.sourceTotalBytes,'local_prepare_source_total_limit');
  }
  for(const file of [LOCAL_CONTROL_ENTRY,LOCAL_PREPARE_MODULE,'scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',
    'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs',
    'scripts/lib/'+route.chain.slice(2),route.adapter,
    'src/server/ai-console-control/operator-session.ts']) need(files.has(file),'local_prepare_source_not_registered');
  return {roles:Object.keys(bindings).length,uniqueFiles:files.size,bytes:total};
}
function readRequest(root, requestId) {
  need(requestIdValid(requestId),'local_prepare_request_id_invalid');
  const route=routeForId(requestId);
  const request=readJson(root,requestPath(requestId));
  need(request.schema==='ai-painter-local-prepare-request-v1' && request.protocol===LOCAL_CONTROL_PROTOCOL && request.requestId===requestId && request.runId===requestId && request.outputRoot===`${route.outputRoot}/${requestId}` && request.candidateSelection===route.registration.candidateSelection && canonical(request.candidateBinding)===canonical(route.registration.candidateBinding),'local_prepare_request_identity_mismatch');
  need(typeof request.packageId==='string' && request.packageId.startsWith(route.packagePrefix)&&/^[a-f0-9-]{36}$/u.test(request.packageId.slice(route.packagePrefix.length)),'local_prepare_planned_package_id_invalid');
  if(route!==PREPARATION_ROUTES[0])need(request.capabilityVersion===route.capability,'local_prepare_request_capability_mismatch');
  need(request.automaticRetries===0 && request.executionPackage===null,'local_prepare_request_cannot_claim_package');
  return request;
}
async function available(root) {
  const current=await readCurrentExecutionRegistry(root);
  need(current?.ok===true && current.status==='verified' && current.registry.activeExecution===null,'local_prepare_active_or_unknown_registry');
  const guardRoot=resolveOwnedStopProjectDirectory(root,'.runtime/ai-painter/owned-worker-guards');
  need(!fs.existsSync(path.join(guardRoot,'active.json')),'local_prepare_owned_guard_busy');
  return current;
}
function writeState(root, request, stage, extra={}) {
  const directory=resolveOwnedStopProjectDirectory(root,evidenceRoot(request.requestId)),statePath=path.join(directory,'state.json');
  const previous=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):null;
  const value={schema:'ai-painter-local-prepare-state-v1',requestId:request.requestId,runId:request.runId,plannedPackageId:request.packageId,
    stage,sequence:(previous?.sequence??-1)+1,executionPackage:previous?.executionPackage??null,preparationIsTraining:false,
    operatorStopAvailable:false,operatorStopUnavailableReason:'no_final_package_and_current_retained_training_call',automaticRetries:0,
    updatedAtUtc:new Date().toISOString(),...extra};
  const bytes=Buffer.from(JSON.stringify(value)+'\n');need(bytes.length<=16384,'local_prepare_state_limit');
  const events=path.join(directory,'events');if(!fs.existsSync(events))fs.mkdirSync(events);
  need(value.sequence<32,'local_prepare_event_limit');
  writeBudgeted(root,`${evidenceRoot(request.requestId)}/events/${String(value.sequence).padStart(3,'0')}.json`,value);
  const staged=statePath+'.staged';writeBudgeted(root,`${evidenceRoot(request.requestId)}/state.json.staged`,value);fs.renameSync(staged,statePath);
  return value;
}
export async function startLocalPreparation({root,credentials,candidateSelection}) {
  need(typeof root==='string' && path.isAbsolute(root),'local_prepare_absolute_root_required');
  const authenticated=localOperatorRequest(credentials),route=localPreparationRoute(candidateSelection);registered(root,route);
  const before=await available(root),candidateBytes=readOwnedStopProjectFile(root,CANDIDATE.path);
  need(hash(candidateBytes)===CANDIDATE.sha256,'local_prepare_candidate_drift');
  const chain=await import(route.chain);
  const programBindings=chain.finalProgramBindings(root),sourceMeasurement=verifyPreparationSources(root,programBindings,candidateSelection);
  const uuid=crypto.randomUUID(),requestId=route.prefix+uuid,packageId=route.packagePrefix+uuid;
  if(route!==PREPARATION_ROUTES[0]){const fixedParent=resolveOwnedStopProjectDirectory(root,'.runtime/ai-painter'),target=path.join(fixedParent,'ecology-decode1-weight-quality-executions');if(!fs.existsSync(target))fs.mkdirSync(target);}
  const outputRoot=`${route.outputRoot}/${requestId}`,parent=resolveOwnedStopProjectDirectory(root,route.outputRoot);
  need(!fs.existsSync(path.join(parent,requestId)),'local_prepare_namespace_consumed');fs.mkdirSync(path.join(parent,requestId));fs.mkdirSync(path.join(parent,requestId,'local-prepare'));
  const request={schema:'ai-painter-local-prepare-request-v1',protocol:LOCAL_CONTROL_PROTOCOL,requestId,runId:requestId,packageId,outputRoot,
    candidateSelection,candidateBinding:route.registration.candidateBinding,programBindings,sourceMeasurement,runtimeIdentity:chain.runtimeIdentity(root),
    ...(route===PREPARATION_ROUTES[0]?{}:{capabilityVersion:route.capability}),
    initialRegistryRevision:before.registry.registryRevision,initialRegistrySha256:before.registrySha256,executionPackage:null,
    operatorSession:{actorIdentity:authenticated.session.actorIdentity,role:authenticated.session.role,expiresAtUtc:authenticated.session.expiresAtUtc},
    recordedAtUtc:new Date().toISOString(),automaticRetries:0};
  const bytes=Buffer.from(JSON.stringify(request,null,2)+'\n');need(bytes.length<=1048576,'local_prepare_request_limit');
  const requestBinding=withOutputBudget({projectRoot:root,roots:[outputRoot],maximum:8388608,reserveBytes:65536},()=>writeBudgeted(root,requestPath(requestId),request));
  withOutputBudget({projectRoot:root,roots:[outputRoot],maximum:8388608,reserveBytes:65536},()=>writeState(root,request,'prepared_request_not_cpu_qualified'));
  try {
    const launch=launchProjectCommandBackground({root,launchIdentity:requestId,runnerPath:LOCAL_CONTROL_ENTRY,receiptRoot:receiptRoot(requestId),
      runnerArgs:['--internal-prepare-v2','--request',requestPath(requestId),'--request-sha256',requestBinding.sha256]});
    return {protocol:LOCAL_CONTROL_PROTOCOL,command:'start',requestId,runId:requestId,plannedPackageId:packageId,executionPackage:null,
      preparationAccepted:true,trainingQualified:false,launch};
  } catch(error) {
    const currentState=readJson(root,`${evidenceRoot(requestId)}/state.json`);
    if(currentState.stage==='prepared_request_not_cpu_qualified')withOutputBudget({projectRoot:root,roots:[outputRoot],maximum:8388608,reserveBytes:65536},()=>writeState(root,request,'failed_closed',{errorCode:'local_prepare_launch_failed',processState:'unknown'}));
    return {protocol:LOCAL_CONTROL_PROTOCOL,command:'start',status:'launch_observation_failed',requestId,runId:requestId,plannedPackageId:packageId,
      executionPackage:null,preparationAccepted:false,errorCode:'local_prepare_launch_failed',processState:'unknown',trainingQualified:false};
  }
}

// A read-only template from the official reader snapshot, not authentication
// or a retained native descriptor. The stop command rechecks its own reader.
export function projectLocalPreparationStopTarget(root, {request,state,current,processTerminal=null}) {
  const unavailable=errorCode=>({available:false,status:'unavailable_exact_submission_target',input:null,errorCode,
    retainedNativeHookVerified:false});
  try {
    const route=localPreparationRoute(request?.candidateSelection??LOCAL_CONTROL_REGISTRATION.candidateSelection);
    if(route!==PREPARATION_ROUTES[0])need(request.capabilityVersion===route.capability && routeForId(request.requestId)===route,'local_stop_target_identity_mismatch');
    need(current?.ok===true && current.status==='verified','local_stop_target_registry_unverified');
    need(processTerminal===null,'local_stop_target_background_exited');
    const registry=current.registry,active=registry?.activeExecution;
    need(plain(active) && registry.executionState==='executing' && active.executionState==='executing','local_stop_target_not_executing');
    need(plain(request) && plain(state) && state.requestId===request.requestId && state.runId===request.runId &&
      state.plannedPackageId===request.packageId && state.stage==='quality_loop_running' && plain(state.executionPackage),
    'local_stop_target_preparation_incomplete');
    need(registry.capabilityVersion===route.capability && registry.runId===request.runId && registry.packageId===request.packageId &&
      active.runId===request.runId && active.packageId===request.packageId,'local_stop_target_identity_mismatch');
    const input=validateOwnedStopInput({runId:request.runId,packageId:request.packageId,
      executionPackagePath:state.executionPackage.path,executionPackageSha256:state.executionPackage.sha256,
      expectedRegistryRevision:registry.registryRevision,supervisorProcessId:active.processId,
      supervisorProcessStartIdentity:active.processStartIdentity,
      idempotencyKey:'readonly_target_validation',reasonText:'readonly target validation'});
    need(input.executionPackagePath===`.runtime/ai-painter/autonomous-closed-loop-packages/${request.packageId}/package.json`,
      'local_stop_target_package_path_mismatch');
    const bytes=readOwnedStopProjectFile(root,input.executionPackagePath);
    need(hash(bytes)===input.executionPackageSha256,'local_stop_target_package_sha_mismatch');
    const spec=JSON.parse(bytes.toString('utf8'));
    need(spec.packageIdentity===request.packageId && spec.capabilityVersion===route.capability &&
      request.outputRoot===`${route.outputRoot}/${request.runId}` && spec.outputRoot===request.outputRoot,
    'local_stop_target_package_identity_mismatch');
    // Existing v1 submission requires this already initialized local ledger.
    // Its presence does not prove that a live native hook will consume an intent.
    for(const suffix of ['', '/inbox', '/requests'])resolveOwnedStopProjectDirectory(root,`${request.outputRoot}/operator-stop-control${suffix}`);
    const {idempotencyKey,reasonText,...target}=input;
    return {available:true,status:'verified_submission_target_only',input:target,
      requiredOperatorFields:['idempotencyKey','reasonText'],freshAuthenticationRequired:true,
      retainedNativeHookVerified:false};
  } catch(error) {
    const message=String(error.message??error);
    return unavailable(/^(?:local_stop_target_|stop_)[a-z0-9_]+$/u.test(message)?message:'local_stop_target_evidence_unreadable');
  }
}

export async function readLocalPreparationStatus(root, requestId) {
  const current=await readCurrentExecutionRegistry(root);
  if(requestId===undefined) return {protocol:LOCAL_CONTROL_PROTOCOL,command:'status',readOnly:true,current,preparation:null};
  try {
    const request=readRequest(root,requestId),state=readJson(root,`${evidenceRoot(requestId)}/state.json`);
    need(state.requestId===requestId && state.runId===requestId && state.plannedPackageId===request.packageId,'local_prepare_state_identity_mismatch');
    const launchDirectory=`${receiptRoot(requestId)}/${requestId}`;
    const preparationRoot=resolveOwnedStopProjectDirectory(root,evidenceRoot(requestId));
    if(state.stage==='failed_closed' && !fs.existsSync(path.join(preparationRoot,'background-launches',requestId,'launch-receipt.json')))
      return {protocol:LOCAL_CONTROL_PROTOCOL,command:'status',readOnly:true,current,preparation:{requestId,runId:request.runId,plannedPackageId:request.packageId,
        state,status:'failed_closed',launch:null,launchEvidenceUnavailable:true,processState:'unknown',stopSubmission:'unavailable_before_final_package_and_current_training',
        stopTarget:{available:false,status:'unavailable_exact_submission_target',input:null,errorCode:'local_stop_target_preparation_incomplete',retainedNativeHookVerified:false},
        retainedNativeHookVerified:false,trainingQualificationFromPreparation:false}};
    const attempt=readJson(root,`${launchDirectory}/spawn-attempt.json`);validateExactlyOnceBackgroundSpawnAttempt(attempt);
    need(attempt.launchIdentity===requestId && attempt.runnerPath===LOCAL_CONTROL_ENTRY && canonical(attempt.runnerArgs)===canonical(['--internal-prepare-v2','--request',requestPath(requestId),'--request-sha256',hash(readOwnedStopProjectFile(root,requestPath(requestId)))]),'local_prepare_launch_request_mismatch');
    const launch=readJson(root,`${launchDirectory}/launch-receipt.json`);
    need(launch.commandIdentitySha256===attempt.commandIdentitySha256,'local_prepare_launch_receipt_conflict');
    let processTerminal=null;
    if(launch.backgroundObservation) {
      validateBoundedBackgroundObservation({root,attempt,observation:launch.backgroundObservation});
      const directory=resolveOwnedStopProjectDirectory(root,launchDirectory);
      if(fs.existsSync(path.join(directory,'background-process-terminal.json'))) {
        processTerminal=readJson(root,launch.backgroundObservation.terminalPath);
        need(processTerminal.nonce===attempt.nonce && processTerminal.commandIdentitySha256===attempt.commandIdentitySha256 && processTerminal.processId===launch.processId &&
          (processTerminal.processStartIdentity===launch.processStartIdentity || processTerminal.processStartIdentity===null && processTerminal.preloadReady===false),'local_prepare_process_terminal_identity_conflict');
      }
    }
    const stopTarget=projectLocalPreparationStopTarget(root,{request,state,current,processTerminal});
    const failedEarly=processTerminal!==null && state.stage!=='completed' && state.stage!=='failed_closed';
    return {protocol:LOCAL_CONTROL_PROTOCOL,command:'status',readOnly:true,current,
      preparation:{requestId,runId:request.runId,plannedPackageId:request.packageId,state,launch,processTerminal,
        status:failedEarly?'background_exited_without_preparation_terminal':state.stage,preparationIsTraining:false,
        stopSubmission:stopTarget.available?'authenticated_exact_target_submission_only':'unavailable_before_final_package_and_current_training',stopTarget,
        retainedNativeHookVerified:false,trainingQualificationFromPreparation:false}};
  } catch(error) {return {protocol:LOCAL_CONTROL_PROTOCOL,command:'status',readOnly:true,current,preparation:{requestId,status:'unknown_or_evidence_conflict',errorCode:String(error.message).slice(0,256),
    stopSubmission:'unavailable_before_final_package_and_current_training',stopTarget:{available:false,status:'unavailable_exact_submission_target',input:null,errorCode:'local_stop_target_evidence_unreadable',retainedNativeHookVerified:false},
    retainedNativeHookVerified:false,trainingQualificationFromPreparation:false}};}
}
export async function stopLocalPreparation({root,requestId,body}) {
  need(plain(body),'local_v2_authenticated_body_required');localOperatorRequest(body.credentials);
  const request=readRequest(root,requestId),status=await readLocalPreparationStatus(root,requestId);
  need(status.preparation.stopSubmission==='authenticated_exact_target_submission_only','local_prepare_stop_unavailable_before_final_package_and_current_training');
  need(body.input?.runId===request.runId && body.input?.packageId===request.packageId,'local_prepare_stop_request_target_mismatch');
  return {protocol:LOCAL_CONTROL_PROTOCOL,command:'stop',requestId,result:await runV1({command:'stop'},body,root)};
}

export function preparationTerminalBudget(root,request,native,maximum) {
  need([8388608,134217728].includes(maximum),'local_prepare_terminal_budget_invalid');
  // Reuse the existing exact native-namespace reader. It inspects only this
  // Run and validates each pointer against its deterministic native namespace.
  const roots=native.nativeAccountingRoots(root,`${request.outputRoot}/local-prepare`,null,request.outputRoot,'cpu');
  const streamCalls=new Map();
  const visit=directory=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name),stat=fs.lstatSync(file);need(!stat.isSymbolicLink(),'local_prepare_budget_output_redirect');
      if(stat.isDirectory())visit(file);
      else if(/[/\\]owned-(?:cpu|qualification|training|review)-[a-f0-9-]{36}[/\\](?:receipt|original-receipt|release-receipt)\.json$/u.test(file)){
        need(stat.size<=1048576,'local_prepare_receipt_size_limit');const value=JSON.parse(fs.readFileSync(file,'utf8'));
        if(value.schema!=='detail-weight-live-native-owner-receipt-v1')continue;
        const streams=value.streamBytes;need(plain(streams)&&Number.isSafeInteger(streams.stdout)&&streams.stdout>=0&&Number.isSafeInteger(streams.stderr)&&streams.stderr>=0,'local_prepare_stream_debit_invalid');
        const call=value.proof?.bindingBase64??value.nativeBuild?.binary;need(typeof call==='string'&&call.length>0,'local_prepare_stream_call_identity_missing');
        streamCalls.set(call,Math.max(streamCalls.get(call)??0,streams.stdout+streams.stderr));
      }
    }
  };
  visit(resolveOwnedStopProjectDirectory(root,request.outputRoot));
  const streamDebit=[...streamCalls.values()].reduce((a,b)=>a+b,0);need(Number.isSafeInteger(streamDebit)&&streamDebit<maximum,'local_prepare_stream_debit_exhausted');
  return {projectRoot:root,roots,maximum:maximum-streamDebit,reserveBytes:16384,originalMaximum:maximum,streamDebit};
}
function persistPreparationTerminal(root,request,native,maximum,terminal,stage,extra) {
  const measured=preparationTerminalBudget(root,request,native,maximum);
  return withOutputBudget(measured,()=>{
    writeBudgeted(root,`${evidenceRoot(request.requestId)}/terminal.json`,{...terminal,outputBudget:{originalMaximum:maximum,streamDebit:measured.streamDebit,roots:measured.roots,stdioAndExitMetadataReserveBytes:measured.reserveBytes}});
    return writeState(root,request,stage,extra);
  });
}
export function preservePreparationFailure(error,persist) {
  try{persist();}
  catch(secondary){
    try{process.stderr.write(JSON.stringify({errorCode:'local_prepare_terminal_evidence_write_failed',originalErrorPreserved:true,detail:String(secondary.message).slice(0,2048)})+'\n');}
    catch{/* A failed diagnostic stream cannot replace the pipeline failure. */}
  }
  throw error;
}

async function executePreparation(root, request, chain, native, loop=runAutonomousClosedLoop, materialize=materializeAutonomousClosedLoopPackage) {
  const route=localPreparationRoute(request.candidateSelection);
  const preparingAt=Date.now();let finalPackage=null,phaseMaximum=8388608;
  const progress=(stage,extra={})=>writeState(root,request,stage,extra);
  try {
    await available(root);registered(root,route);
    need(hash(readOwnedStopProjectFile(root,CANDIDATE.path))===CANDIDATE.sha256,'local_prepare_candidate_drift');
    verifyPreparationSources(root,request.programBindings,request.candidateSelection);
    need(canonical(chain.finalProgramBindings(root))===canonical(request.programBindings),'local_prepare_current_source_closure_changed');
    need(canonical(chain.runtimeIdentity(root))===canonical(request.runtimeIdentity),'local_prepare_runtime_changed');
    const cpuRequest=chain.prepareCpuRequest({root,runId:request.runId,packageId:request.packageId,
     ...(route===PREPARATION_ROUTES[0]?{}:{preparationRequestBinding:chain.bind(root,requestPath(request.requestId))})});
    withOutputBudget({projectRoot:root,roots:[request.outputRoot],maximum:8388608,reserveBytes:65536},()=>progress('cpu_request_prepared',{cpuRequest}));
    let cpuDeadlineReason=null;
    const timer=setTimeout(()=>{cpuDeadlineReason='local_prepare_cpu_wall_deadline';},Math.max(1,240000-(Date.now()-preparingAt)));
    let result;
    try {withOutputBudget({projectRoot:root,roots:[request.outputRoot],maximum:8388608,reserveBytes:65536},()=>progress('cpu_running',{cpuRequest}));result=await native.runNative({root,outputRoot:request.outputRoot,phase:'cpu',
      executable:request.runtimeIdentity.python.absolutePath,args:['-B',chain.inside(root,chain.ROLES.cpuHarness),'--cpu-request',cpuRequest.path,'--sha256',cpuRequest.sha256],
      abortReason:()=>cpuDeadlineReason});}finally{clearTimeout(timer);}
    // Keep the real result in this same invocation: the finalizer checks the
    // native runner's private retained receipt and genuine fixture cleanup.
    const cpuAcceptance=await chain.finalizeCpuAcceptance({root,requestBinding:cpuRequest,result});
    await native.withNativeOrdinaryBudget(root,result.ownedReceipt,()=>progress('cpu_accepted',{cpuRequest,cpuAcceptance}));
    const planBinding=await native.withNativeOrdinaryBudget(root,result.ownedReceipt,()=>{
      const binding=chain.preparePlan({root,requestBinding:cpuRequest,finalCpuAcceptance:cpuAcceptance});progress('plan_prepared',{planBinding:binding,cpuAcceptance});return binding;});
    await available(root);verifyPreparationSources(root,request.programBindings,request.candidateSelection);
    const candidate=chain.makeInternalCandidate(root,planBinding);
    const packageResult=materialize(candidate,{root,recoverExistingExact:false});
    finalPackage={path:packageResult.packagePath,sha256:packageResult.packageSha256};
    const spec=JSON.parse(readOwnedStopProjectFile(root,finalPackage.path).toString('utf8'));
    need(hash(readOwnedStopProjectFile(root,finalPackage.path))===finalPackage.sha256,'local_prepare_materialized_package_changed');
    await native.withNativeOrdinaryBudget(root,result.ownedReceipt,()=>progress('quality_loop_running',{executionPackage:finalPackage,operatorStopUnavailableReason:'requires_current_training_identity_and_retained_native_call'}));
    phaseMaximum=134217728; // Existing full quality lifecycle; native phases keep their stricter own ceilings.
    const state=await loop({root,spec,packageSha256:finalPackage.sha256});
    need(state.state==='completed','local_prepare_quality_loop_failed_closed');
    const terminal={schema:'ai-painter-local-prepare-terminal-v1',requestId:request.requestId,runId:request.runId,packageId:request.packageId,
      status:'completed',executionPackage:finalPackage,lifecycleState:state.state,trainingQualified:false,formalStage4Qualification:false,runtimePublication:false,automaticRetries:0,recordedAtUtc:new Date().toISOString()};
    persistPreparationTerminal(root,request,native,phaseMaximum,terminal,'completed',{executionPackage:finalPackage,terminalStatus:'completed'});return terminal;
  }catch(error){
    const terminal={schema:'ai-painter-local-prepare-terminal-v1',requestId:request.requestId,runId:request.runId,plannedPackageId:request.packageId,
      status:'failed_closed',executionPackage:finalPackage,errorCode:'local_prepare_pipeline_failed',detail:String(error.stack??error).slice(0,8192),
      nativeFailureEvidence:error.receiptBinding??null,originalErrorCode:error.code??null,
      gpuNotStartedIfPreparationFailed:finalPackage===null,cleanupConfirmed:false,checkpointSaved:false,automaticRetries:0,recordedAtUtc:new Date().toISOString()};
    return preservePreparationFailure(error,()=>persistPreparationTerminal(root,request,native,phaseMaximum,terminal,'failed_closed',{executionPackage:finalPackage,errorCode:terminal.errorCode,detail:terminal.detail}));
  }
}
export async function runLocalPreparationRequest({root,relativePath,sha256}) {
  localPreparationSelectionFromRequestPath(relativePath);
  need(/^[a-f0-9]{64}$/u.test(sha256??''),'local_prepare_internal_request_sha_invalid');
  const bytes=readOwnedStopProjectFile(root,relativePath);need(hash(bytes)===sha256,'local_prepare_internal_request_changed');
  const request=readRequest(root,JSON.parse(bytes.toString('utf8')).requestId);
  need(relativePath===requestPath(request.requestId),'local_prepare_internal_request_path_mismatch');
  const launchDirectory=`${receiptRoot(request.requestId)}/${request.requestId}`,attempt=readJson(root,`${launchDirectory}/spawn-attempt.json`);
  validateExactlyOnceBackgroundSpawnAttempt(attempt);need(attempt.runnerPath===LOCAL_CONTROL_ENTRY && attempt.launchIdentity===request.requestId && canonical(attempt.runnerArgs)===canonical(['--internal-prepare-v2','--request',relativePath,'--request-sha256',sha256]),'local_prepare_internal_attempt_mismatch');
  need(process.execArgv.includes(attempt.processMarker),'local_prepare_internal_launch_nonce_required');
  const startup=readJson(root,`${launchDirectory}/background-started.json`);
  need(startup.processId===process.pid && startup.nonce===attempt.nonce && startup.commandIdentitySha256===attempt.commandIdentitySha256,'local_prepare_internal_same_process_required');
  const state=readJson(root,`${evidenceRoot(request.requestId)}/state.json`);need(state.stage==='prepared_request_not_cpu_qualified','local_prepare_request_already_consumed');
  withOutputBudget({projectRoot:root,roots:[request.outputRoot],maximum:8388608,reserveBytes:65536},()=>writeBudgeted(root,`${evidenceRoot(request.requestId)}/consumed.json`,{requestSha256:sha256,processId:process.pid,processStartIdentity:startup.processStartIdentity,nonce:attempt.nonce,recordedAtUtc:new Date().toISOString(),automaticRetries:0}));
  const route=localPreparationRoute(request.candidateSelection),chain=await import(route.chain),native=await import(route.native);
  return executePreparation(root,request,chain,native);
}
