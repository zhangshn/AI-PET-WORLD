import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runOwnedWorker } from '../lib/ai-painter-owned-worker-v1.mjs';
const self=fileURLToPath(import.meta.url),mode=process.argv[2],out=process.argv[3];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(mode==='runner') {
  try { const r=await runOwnedWorker(process.execPath,[self,'tree-wait',out],{cwd:process.cwd(),env:process.env,timeout:10000});fs.writeFileSync(path.join(out,'runner-result.json'),JSON.stringify(r)); }
  catch(e){fs.writeFileSync(path.join(out,'runner-result.json'),JSON.stringify({error:e.message,receipt:e.ownedReceipt}));}
} else if(mode==='leaf'||mode==='outsider') {
  fs.writeFileSync(path.join(out,mode+'-pid.json'),JSON.stringify({pid:process.pid,ppid:process.ppid}));
  await wait(mode==='leaf'?3500:1000);
  fs.writeFileSync(path.join(out,mode+'-completed'), 'completed');
} else if(mode.startsWith('tree')) {
  fs.writeFileSync(path.join(out,'root-pid.json'),JSON.stringify({pid:process.pid,ppid:process.ppid}));
  const leaf=spawn(process.execPath,[self,'leaf',out],{windowsHide:true,stdio:'ignore'});leaf.unref();
  await wait(150);process.stdout.write(JSON.stringify({ok:true}));
  if(mode==='tree-wait')await wait(20000);
  process.exit(mode==='tree-nonzero'?7:0);
} else if(mode==='wait') { await wait(20000); }
else if(mode==='json'){process.stderr.write('diagnostic stderr\n');process.stdout.write(JSON.stringify({ok:true,text:'原始JSON'}));}
else if(mode==='nonzero'){process.stderr.write('failure detail');process.exitCode=7;}
else if(mode.startsWith('bytes')) {
  const stream=mode.includes('stderr')?process.stderr:process.stdout;
  const bytes=8*1024*1024+(mode.includes('over')?1:0);
  for(let n=0;n<bytes;n+=65536){const b=Buffer.alloc(Math.min(65536,bytes-n),65);if(!stream.write(b))await new Promise(r=>stream.once('drain',r));}
  if(mode.includes('live'))await wait(20000);
}
