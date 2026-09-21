import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const sourcePath=fileURLToPath(new URL('../windows/ai-painter-owned-worker-owner.cs',import.meta.url));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function nativeOwnerSourceIdentity(){return {path:sourcePath,sha256:digest(fs.readFileSync(sourcePath))};}
function put(file,bytes){const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}

// A fresh build per invocation avoids accepting an executable from a writable cache.
// These hashes record actual build inputs/outputs; they are not cleanup authorization.
export function createNativeOwnerCommand(executable,args,cwd,deadline,cleanupMs,guardRecord,guardBytes){
  const directory=path.join(path.dirname(guardRecord.startedEvidence),guardRecord.identity+'-native');
  fs.mkdirSync(directory);
  const source=fs.readFileSync(sourcePath);
  assert.equal(digest(source),guardRecord.nativeOwnerSource.sha256,'native owner source changed before build');
  const framework=path.join(process.env.SystemRoot??'C:/Windows','Microsoft.NET','Framework64','v4.0.30319');
  const compiler=path.join(framework,'csc.exe'),compilerSha256=digest(fs.readFileSync(compiler));
  const snapshot=path.join(directory,'owner.cs'),binary=path.join(directory,'owner.exe');put(snapshot,source);
  const remaining=deadline-Date.now();assert(remaining>0,'native build deadline exhausted');
  const compileArgs=['/nologo','/noconfig','/utf8output','/target:exe','/optimize+',...['System.dll','System.Core.dll','System.Web.Extensions.dll'].map(name=>`/reference:${path.join(framework,name)}`),`/out:${binary}`,snapshot];
  let output;
  try{output=execFileSync(compiler,compileArgs,{cwd,windowsHide:true,shell:false,timeout:remaining,maxBuffer:1024*1024,encoding:'utf8'});}
  catch(error){put(path.join(directory,'build-failure.json'),JSON.stringify({code:error.code??null,status:error.status??null,message:error.message,stdout:String(error.stdout??'').slice(0,8192),stderr:String(error.stderr??'').slice(0,8192)}));throw error;}
  assert.equal(digest(fs.readFileSync(sourcePath)),guardRecord.nativeOwnerSource.sha256,'native owner source changed during build');
  assert.equal(digest(fs.readFileSync(compiler)),compilerSha256,'native compiler changed during build');
  assert(Date.now()<deadline,'native build deadline exhausted');
  const nativeBuild={source:guardRecord.nativeOwnerSource,snapshot,compiler,compilerSha256,binary,binarySha256:digest(fs.readFileSync(binary)),compileArgs,output,recordedAtUtc:new Date().toISOString()};
  put(path.join(directory,'build.json'),JSON.stringify(nativeBuild));
  const observationPath=path.join(directory,'cleanup-observation.json');
  const bindingBase64=Buffer.from(JSON.stringify({guard:guardRecord,guardSha256:digest(Buffer.from(guardBytes)),scope:path.resolve(cwd),nativeBuild})).toString('base64');
  return {executable:binary,args:[executable,cwd,String(deadline),String(cleanupMs),observationPath,bindingBase64,...args],nativeBuild,observationPath,bindingBase64};
}
