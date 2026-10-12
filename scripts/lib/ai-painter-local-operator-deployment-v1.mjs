import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const OPERATOR_DEPLOYMENT_PROTOCOL='ai-painter-local-operator-deployment-v1';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const keyName='AI_PET_WORLD_OPERATOR_SESSION_SECRET';
const officialRequire=createRequire(import.meta.url);
const trustedErrors=new WeakSet();const windowsDiagnostics=new WeakMap();
const errorFor=code=>{const error=Object.assign(Error(code),{code});trustedErrors.add(error);return error;};
const need=(value,code)=>{if(!value)throw errorFor(code);};
const samePath=(a,b)=>path.relative(path.resolve(a),path.resolve(b))==='';
const stamp=s=>[s.dev,s.ino,s.nlink,s.size,s.mtimeNs].map(String).join(':');
const identity=s=>[s.dev,s.ino].map(String).join(':');
const safeCode=error=>trustedErrors.has(error)?error.code:'operator_deployment_failed';
function rootGuard(root){
 need(typeof root==='string'&&path.isAbsolute(root)&&samePath(fs.realpathSync(root),root),'operator_deployment_root_invalid');
 for(let p=path.resolve(root);;p=path.dirname(p)){need(!fs.lstatSync(p).isSymbolicLink(),'operator_deployment_root_redirected');if(path.dirname(p)===p)break;}
 const before=fs.lstatSync(root,{bigint:true});need(before.isDirectory(),'operator_deployment_root_invalid');
 return ()=>need(identity(fs.lstatSync(root,{bigint:true}))===identity(before)&&samePath(fs.realpathSync(root),root),'operator_deployment_root_changed');
}
function snapshot(file){
 let before;try{before=fs.lstatSync(file,{bigint:true});}catch(error){if(error.code==='ENOENT')return {file,exists:false,bytes:Buffer.alloc(0)};throw error;}
 need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1n&&before.size<=65536n,'operator_deployment_file_invalid');
 const fd=fs.openSync(file,'r');let bytes;
 try{need(stamp(fs.fstatSync(fd,{bigint:true}))===stamp(before),'operator_deployment_file_changed');bytes=fs.readFileSync(fd);need(stamp(fs.fstatSync(fd,{bigint:true}))===stamp(before),'operator_deployment_file_changed');}finally{fs.closeSync(fd);}
 need(stamp(fs.lstatSync(file,{bigint:true}))===stamp(before),'operator_deployment_file_changed');
 try{new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw errorFor('operator_deployment_utf8_invalid');}
 return {file,exists:true,bytes,stamp:stamp(before),identity:identity(before)};
}
function unchanged(before){const after=snapshot(before.file);need(after.exists===before.exists&&(!before.exists||after.identity===before.identity&&after.stamp===before.stamp&&after.bytes.equals(before.bytes)),'operator_deployment_file_changed');}
function ignored(root,names){for(const name of names){const tracked=spawnSync('git',['ls-files','--error-unmatch','--',name],{cwd:root,encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:4096});need(tracked.status===1,'operator_deployment_git_tracked_or_unknown');const r=spawnSync('git',['check-ignore','--no-index','-q','--',name],{cwd:root,encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:4096});need(r.status===0,'operator_deployment_git_not_ignored');}}
function readConfiguration(root,isolated){
 const names=['.env.local','.env.development.local','.env.production.local','.env.test.local','.env.development','.env.production','.env.test','.env'];
 const files=names.map(name=>snapshot(path.join(root,name))),original={...process.env},values=[];
 const processValue=isolated?undefined:original[keyName];
 if(processValue!==undefined){need(Buffer.byteLength(processValue.trim(),'utf8')>=32,'operator_deployment_key_short');values.push(processValue.trim());}
 let targetValue=null;
 try{
  const loaderFile=officialRequire.resolve('@next/env');
  for(const file of files.filter(f=>f.exists)){
   const contents=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(file.bytes);
   // Reject ambiguous repeated operator declarations; official processEnv
   // alone interprets values, quotes and expansion (no handwritten parser).
   const declarationText=contents.startsWith('\ufeff')?contents.slice(1):contents;
   const declarations=declarationText.match(/^[\t ]*(?:export[\t ]+)?AI_PET_WORLD_OPERATOR_SESSION_SECRET[\t ]*(?:=|:[\t ])/gm)??[];
   need(declarations.length<=1,'operator_deployment_definition_ambiguous');
   for(const name of Object.keys(process.env))if(!Object.hasOwn(original,name))delete process.env[name];
   for(const [name,value]of Object.entries(original))process.env[name]=value;
   delete process.env[keyName];delete officialRequire.cache[loaderFile];
   const loader=officialRequire(loaderFile),parsed={path:path.basename(file.file),contents,env:{}};let failed=false;
   loader.processEnv([parsed],root,{info(){},warn(){failed=true;},error(){failed=true;}},true);
   need(!failed,'operator_deployment_configuration_invalid');
   if(Object.hasOwn(parsed.env,keyName)){
    const value=parsed.env[keyName];need(typeof value==='string'&&Buffer.byteLength(value.trim(),'utf8')>=32,'operator_deployment_key_short');
    values.push(value.trim());if(path.basename(file.file)==='.env.local')targetValue=value.trim();
   }else need(declarations.length===0,'operator_deployment_configuration_uncertain');
  }
 }finally{for(const name of Object.keys(process.env))if(!Object.hasOwn(original,name))delete process.env[name];for(const [name,value]of Object.entries(original))process.env[name]=value;}
 need(new Set(values).size<=1,'operator_deployment_configuration_conflict');
 return {files,target:files[0],targetValue,existingValue:values[0]??null};
}

// Only paths/SIDs/nonsecret operation names occur in the command line.
// Byte buffers, if any, travel through stdin; no exception payload is echoed.
const windowsScript=String.raw`
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';
$taskProcess=Get-Process -Id $PID;$taskProcess.ProcessorAffinity=[IntPtr]3;
$failureCode='operator_deployment_windows_io_failed';$phase='request';
function Check([bool]$value,[string]$code){if(-not $value){$script:failureCode=$code;throw 'deployment refused'}}
function Security([string]$sid){$a=New-Object System.Security.AccessControl.FileSecurity;$a.SetAccessRuleProtection($true,$false);$owner=New-Object System.Security.Principal.SecurityIdentifier($sid);$a.SetOwner($owner);foreach($s in @($sid,'S-1-5-18')|Select-Object -Unique){$id=New-Object System.Security.Principal.SecurityIdentifier($s);$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($id,[System.Security.AccessControl.FileSystemRights]::FullControl,[System.Security.AccessControl.AccessControlType]::Allow);$a.AddAccessRule($rule)};return $a}
function DaclOnly([System.Security.AccessControl.FileSecurity]$a,[string]$sid){$a.SetAccessRuleProtection($true,$false);foreach($r in @($a.GetAccessRules($true,$false,[System.Security.Principal.SecurityIdentifier]))){$a.PurgeAccessRules($r.IdentityReference)};foreach($s in @($sid,'S-1-5-18')|Select-Object -Unique){$id=New-Object System.Security.Principal.SecurityIdentifier($s);$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($id,[System.Security.AccessControl.FileSystemRights]::FullControl,[System.Security.AccessControl.AccessControlType]::Allow);$a.AddAccessRule($rule)};return $a}
function Verify([string]$file,[string]$sid){$attributes=[IO.File]::GetAttributes($file);Check (($attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and ($attributes -band [IO.FileAttributes]::Directory) -eq 0) 'operator_deployment_file_invalid';$a=[IO.File]::GetAccessControl($file);Check ($a.AreAccessRulesProtected) 'operator_deployment_acl_invalid';Check ($a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -eq $sid) 'operator_deployment_acl_invalid';$rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]));$seen=@();foreach($r in $rules){Check (-not $r.IsInherited -and $r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Value -in @($sid,'S-1-5-18') -and $r.FileSystemRights -eq [System.Security.AccessControl.FileSystemRights]::FullControl) 'operator_deployment_acl_invalid';$seen+=$r.IdentityReference.Value};Check (($seen|Select-Object -Unique).Count -eq (@($sid,'S-1-5-18')|Select-Object -Unique).Count) 'operator_deployment_acl_invalid';return $true}
function SingleLink([string]$file){$lines=@(& C:/Windows/System32/fsutil.exe hardlink list $file 2>$null);Check ($LASTEXITCODE -eq 0 -and $lines.Count -eq 1) 'operator_deployment_file_invalid'}
function Empty([string]$file,[string]$sid){Check (-not (Test-Path -LiteralPath $file)) 'operator_deployment_namespace_busy';$script:phase='empty_security';$a=Security $sid;$script:phase='empty_create';$stream=[System.IO.FileStream]::new($file,[IO.FileMode]::CreateNew,[System.Security.AccessControl.FileSystemRights]::FullControl,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$a);$stream.Dispose();$script:phase='empty_verify';$null=Verify $file $sid}
function NextProject([string]$line,[string]$root){$matches=[regex]::Matches($line,'(?i)(?<script>[A-Z]:[\\/][^\s\x22]*?[\\/]next[\\/]dist[\\/]bin[\\/]next(?:[.]js)?)(?=\x22|\s|$)');if($matches.Count -ne 1){return $false};$scriptPath=[IO.Path]::GetFullPath($matches[0].Groups['script'].Value);$expected=[IO.Path]::GetFullPath((Join-Path $root 'node_modules/next/dist/bin/next'));if(-not [StringComparer]::OrdinalIgnoreCase.Equals($scriptPath,$expected)){return $false};$item=Get-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue;return ($null -ne $item -and -not $item.PSIsContainer -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)}
try{
 $p=[Console]::In.ReadToEnd()|ConvertFrom-Json;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$phase=$p.action;
 if($p.action -eq 'classify_next_script'){@{ok=$true;sameProjectNextScript=(NextProject $p.commandLine $p.root)}|ConvertTo-Json -Compress
 }elseif($p.action -eq 'context'){
  $service=$null;$globals=@();
  if(-not $p.isolated){
   $owners=@(Get-NetTCPConnection -State Listen -LocalPort 3000|Select-Object -ExpandProperty OwningProcess -Unique);Check ($owners.Count -eq 1) 'operator_deployment_service_unverified';
   $child=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$owners[0]);$parent=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$child.ParentProcessId);
   $rootNeedle=$p.root.Replace([char]92,[char]47).TrimEnd('/').ToUpperInvariant()+'/NODE_MODULES/NEXT/';
   $classification=@{node=$child.Name -eq 'node.exe';bootstrap=$child.CommandLine -match '(?i)next[\\/]dist[\\/]server[\\/]lib[\\/]start-server';project=$child.CommandLine.Replace([char]92,[char]47).ToUpperInvariant().Contains($rootNeedle);development=$parent.CommandLine -match '(?i)next([.]js)?[^A-Za-z0-9]+dev([^A-Za-z0-9]|$)';webpack=$parent.CommandLine -match '--webpack';parentNode=$parent.Name -eq 'node.exe';parentProject=(NextProject $parent.CommandLine $p.root);parentOlder=$parent.CreationDate -le $child.CreationDate};
   Check ($classification.node -and $classification.bootstrap -and $classification.project -and $classification.development -and $classification.webpack -and $classification.parentNode -and $classification.parentProject -and $classification.parentOlder) 'operator_deployment_service_unverified';
   $owner=Invoke-CimMethod -InputObject $child -MethodName GetOwnerSid;Check ($owner.ReturnValue -eq 0 -and $owner.Sid -eq $sid) 'operator_deployment_service_account_mismatch';
   $service=@{processId=$child.ProcessId;parentProcessId=$parent.ProcessId;processStartIdentity=($child.ProcessId.ToString()+':'+$child.CreationDate.ToUniversalTime().ToString('o'));parentProcessStartIdentity=($parent.ProcessId.ToString()+':'+$parent.CreationDate.ToUniversalTime().ToString('o'));mode='next_dev_webpack';accountSid=$sid};
   if($p.inspectGlobals){foreach($scope in @('User','Machine')){$value=[Environment]::GetEnvironmentVariable('AI_PET_WORLD_OPERATOR_SESSION_SECRET',$scope);$present=$null -ne $value;$valid=$present -and [Text.Encoding]::UTF8.GetByteCount($value.Trim()) -ge 32;$equal=$null;if($null -ne $p.candidate -and $present){$equal=$p.candidate -ceq $value.Trim()};$globals+=@{scope=$scope;present=$present;valid=$valid;equalsExistingCandidate=$equal}}}
  }
  @{ok=$true;accountSid=$sid;systemSid='S-1-5-18';serviceIdentity=$service;globalConfiguration=$globals}|ConvertTo-Json -Depth 5 -Compress
 }else{
  Check ($p.accountSid -eq $sid) 'operator_deployment_account_mismatch';
  foreach($file in @($p.paths)){Check ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($file)) -eq [IO.Path]::GetFullPath($p.root)) 'operator_deployment_path_invalid'}
  if($p.action -eq 'protect'){
   if(Test-Path -LiteralPath $p.target){$attributes=[IO.File]::GetAttributes($p.target);Check (($attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and ($attributes -band [IO.FileAttributes]::Directory) -eq 0) 'operator_deployment_file_invalid';SingleLink $p.target;$old=[IO.File]::GetAccessControl($p.target);Check ($old.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -eq $sid -and @($old.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|Where-Object {$_.AccessControlType -eq 'Deny'}).Count -eq 0) 'operator_deployment_acl_invalid';[IO.File]::SetAccessControl($p.target,(DaclOnly $old $sid));$null=Verify $p.target $sid}
   foreach($file in @($p.paths)){Empty $file $sid};@{ok=$true;aclVerified=$true;accountSid=$sid}|ConvertTo-Json -Compress
  }elseif($p.action -eq 'write'){
   $null=Verify $p.file $sid;SingleLink $p.file;$bytes=[Convert]::FromBase64String($p.bytes);$stream=New-Object IO.FileStream($p.file,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);try{Check ($stream.Length -eq 0) 'operator_deployment_stage_changed';$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()};$null=Verify $p.file $sid;@{ok=$true;aclVerified=$true}|ConvertTo-Json -Compress
  }elseif($p.action -eq 'publish'){
   $failureCode='operator_deployment_atomic_publish_failed';
   $null=Verify $p.stage $sid;$null=Verify $p.backup $sid;SingleLink $p.stage;SingleLink $p.backup;
   if($p.existed){$null=Verify $p.target $sid;$phase='publish_replace';[IO.File]::Replace($p.stage,$p.target,$p.backup,$false)}else{Check (-not (Test-Path -LiteralPath $p.target)) 'operator_deployment_file_changed';$phase='publish_move';[IO.File]::Move($p.stage,$p.target)}
   $null=Verify $p.target $sid;$null=Verify $p.backup $sid;@{ok=$true;aclVerified=$true;published=$true}|ConvertTo-Json -Compress
  }else{Check $false 'operator_deployment_action_invalid'}
 }
}catch{@{ok=$false;errorCode=$failureCode;classification=$classification;phase=$phase;exceptionType=$_.Exception.GetType().FullName}|ConvertTo-Json -Compress;exit 1}
`;
function windows(payload){
 need(process.platform==='win32','operator_deployment_windows_required');
 const executable='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
 const result=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(windowsScript,'utf16le').toString('base64')],{input:JSON.stringify(payload),encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:16384});
 let answer;try{answer=JSON.parse(result.stdout.trim());}catch{throw errorFor('operator_deployment_windows_io_failed');}
 if(result.status!==0||answer.ok!==true){const code=/^operator_deployment_[a-z0-9_]+$/u.test(answer.errorCode??'')?answer.errorCode:'operator_deployment_windows_io_failed';const error=errorFor(code);error.classification=answer.classification??null;windowsDiagnostics.set(error,{action:payload.action,phase:/^[a-z_]{1,48}$/u.test(answer.phase??'')?answer.phase:null,exceptionType:/^System(?:[.][A-Za-z0-9]+)+$/u.test(answer.exceptionType??'')?answer.exceptionType:null});throw error;}return answer;
}
function deploy(root,isolated,hooks={}){
 const guard=rootGuard(root),transactionId=crypto.randomUUID();
 const names={target:'.env.local',lock:'.env.local.operator.lock',stage:'.env.local.operator.stage-'+transactionId,backup:'.env.local.operator.backup-'+transactionId};
 ignored(root,Object.values(names));const paths=Object.fromEntries(Object.entries(names).map(([key,name])=>[key,path.join(root,name)]));
 let evidence={protocol:OPERATOR_DEPLOYMENT_PROTOCOL,operation:'configure',transactionId,targetPath:paths.target,applied:false,serviceReloaded:false,sessionIssued:false,trainingStarted:false,secretFingerprintRecorded:false};
 let lockIdentity=null,recoveryReady=false,originalTarget=null,publishAttempted=false;
 try{
  const configuration=readConfiguration(root,isolated);originalTarget=configuration.target;guard();
  const context=windows({action:'context',root,isolated,inspectGlobals:!isolated,candidate:configuration.existingValue});
  for(const row of context.globalConfiguration??[])if(row.present)need(row.valid&&row.equalsExistingCandidate===true,'operator_deployment_global_configuration_conflict');
  const reuse=configuration.targetValue!==null;
  if(configuration.existingValue!==null&&!reuse)need(/^[A-Za-z0-9_-]{32,4096}$/u.test(configuration.existingValue),'operator_deployment_existing_value_not_materializable');
  for(const file of configuration.files)unchanged(file);
  const securePaths=reuse?[paths.lock]:[paths.lock,paths.stage,paths.backup];
  hooks.beforeProtect?.();guard();for(const file of configuration.files)unchanged(file);
  windows({action:'protect',root,target:paths.target,paths:securePaths,accountSid:context.accountSid});
  lockIdentity=identity(fs.lstatSync(paths.lock,{bigint:true}));
  evidence={...evidence,accountSid:context.accountSid,systemSid:context.systemSid,aclVerified:true,serviceIdentity:context.serviceIdentity,sourceCategory:reuse?'existing_target':configuration.existingValue!==null?'existing_configuration':'initialized_missing'};
  hooks.afterProtect?.();guard();
  // ACL protection may change ctime, but not inode, bytes or write timestamp.
  unchanged(configuration.target);for(const file of configuration.files.slice(1))unchanged(file);
  if(reuse){evidence={...evidence,status:'existing_valid_configuration_reused',configured:true,minimum32Utf8Bytes:true,rotated:false,bytesUnchanged:true,otherBytesPreserved:true};return evidence;}
  const before=configuration.target.bytes;
  const firstLf=before.indexOf(10),eol=firstLf>=1&&before[firstLf-1]===13?'\r\n':firstLf<0&&before.includes(13)?'\r':'\n';
  const separator=before.length>0&&![10,13].includes(before[before.length-1])?eol:'';
  const anticipated=configuration.existingValue??'x'.repeat(43);
  need(before.length+Buffer.byteLength(separator+keyName+'='+anticipated+eol)<=65536,'operator_deployment_result_oversized');
  const value=configuration.existingValue??(isolated&&hooks.createFixtureValue?hooks.createFixtureValue():crypto.randomBytes(32).toString('base64url'));
  need(typeof value==='string'&&/^[A-Za-z0-9_-]{32,4096}$/u.test(value),'operator_deployment_generated_value_invalid');
  const next=Buffer.concat([before,Buffer.from(separator+keyName+'='+value+eol)]);
  evidence={...evidence,stagingPath:paths.stage,recoveryBackupPath:paths.backup};
  for(const [file,bytes]of [[paths.backup,before],[paths.stage,next]]){guard();need(snapshot(file).bytes.length===0,'operator_deployment_stage_changed');windows({action:'write',root,paths:[file],file,bytes:bytes.toString('base64'),accountSid:context.accountSid});if(file===paths.backup)recoveryReady=snapshot(file).bytes.equals(before);}
  hooks.beforePublish?.();guard();for(const file of configuration.files)unchanged(file);
  need(snapshot(paths.stage).bytes.equals(next)&&snapshot(paths.backup).bytes.equals(before),'operator_deployment_stage_changed');
  publishAttempted=true;windows({action:'publish',root,paths:[paths.target,paths.stage,paths.backup],...paths,existed:configuration.target.exists,accountSid:context.accountSid});
  guard();need(snapshot(paths.target).bytes.equals(next)&&snapshot(paths.backup).bytes.equals(before),'operator_deployment_publish_unverified');
  return {...evidence,status:'stable_configuration_materialized',applied:true,configured:true,minimum32Utf8Bytes:true,initialized:configuration.existingValue===null,rotated:false,otherBytesPreserved:next.subarray(0,before.length).equals(before),backupBytesEqualOriginal:true,authenticationAdopted:false};
 }catch(error){
  let originalTargetPreserved=null;
  try{guard();if(originalTarget){const actual=snapshot(paths.target);originalTargetPreserved=actual.exists===originalTarget.exists&&(!actual.exists||actual.bytes.equals(originalTarget.bytes));}if(recoveryReady)recoveryReady=snapshot(paths.backup).exists&&snapshot(paths.backup).bytes.equals(originalTarget.bytes);}catch{recoveryReady=false;}
  const code=safeCode(error);throw Object.assign(errorFor(code),{publicEvidence:{...evidence,applied:publishAttempted&&originalTargetPreserved!==true?null:false,status:'failed_closed',errorCode:code,originalTargetPreserved,recoveryAvailable:recoveryReady,windowsDiagnostic:windowsDiagnostics.get(error)??null}});
 }finally{
  if(lockIdentity!==null){guard();const stat=fs.lstatSync(paths.lock,{bigint:true});need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1n&&stat.size===0n&&identity(stat)===lockIdentity,'operator_deployment_lock_changed');fs.unlinkSync(paths.lock);}
 }
}
export function configureLocalOperatorDeployment(options){
 need(options?.operation==='configure'&&Object.keys(options).join(',')==='operation','operator_deployment_explicit_configure_required');
 need(samePath(process.cwd(),projectRoot),'operator_deployment_project_root_required');return deploy(projectRoot,false);
}
export function inspectLocalOperatorDeploymentServiceContext(){
 need(samePath(process.cwd(),projectRoot),'operator_deployment_project_root_required');
 const guard=rootGuard(projectRoot);const result=windows({action:'context',root:projectRoot,isolated:false,inspectGlobals:false,candidate:null});guard();
 return {...result,configurationRead:false,configurationChanged:false,sessionIssued:false,serviceReloaded:false};
}
export function configureLocalOperatorDeploymentForIsolatedTests(root,{operation,hooks={}}={}){
 need(operation==='configure','operator_deployment_explicit_configure_required');
 const parent=process.env.AI_PAINTER_OPERATOR_DEPLOYMENT_TEST_ROOT;
 need(typeof parent==='string'&&path.isAbsolute(parent)&&samePath(fs.realpathSync(parent),parent)&&path.relative(parent,root)!==''&&!path.relative(parent,root).startsWith('..')&&!path.isAbsolute(path.relative(parent,root))&&!samePath(root,projectRoot),'operator_deployment_fixture_root_required');return deploy(root,true,hooks);
}
export function classifyOperatorDeploymentNextScriptForIsolatedTests(root,scriptPath){
 const parent=process.env.AI_PAINTER_OPERATOR_DEPLOYMENT_TEST_ROOT;
 need(typeof parent==='string'&&path.isAbsolute(parent)&&samePath(fs.realpathSync(parent),parent)&&path.relative(parent,root)!==''&&!path.relative(parent,root).startsWith('..')&&!path.isAbsolute(path.relative(parent,root))&&!samePath(root,projectRoot),'operator_deployment_fixture_root_required');
 rootGuard(root)();return windows({action:'classify_next_script',root,commandLine:'node.exe '+scriptPath+' dev --webpack'}).sameProjectNextScript;
}
