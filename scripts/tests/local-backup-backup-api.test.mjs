import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import ts from 'typescript'
import {backupFixture,fileHashes} from './helpers/local-backup-adapter-fixture.mjs'

const require=createRequire(import.meta.url),cache=new Map()
function load(filename){const file=path.resolve(filename);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',compiled)(name=>{
 if(name.startsWith('@/')){const target=path.join(process.cwd(),'src',name.slice(2));return target.endsWith('.mjs')?require(target):load(target+'.ts')}
 if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);return target.endsWith('.mjs')?require(target):load(target+'.ts')}
 return require(name)
},exports);return exports}
const service=load('src/server/local-backup/service.ts'),context=load('src/server/local-backup/backup-context.ts'),auth=load('src/server/ai-console-control/operator-session.ts')
const runs=load('src/app/api/local-backup/runs/route.ts'),detail=load('src/app/api/local-backup/runs/[backupId]/route.ts'),entries=load('src/app/api/local-backup/runs/[backupId]/entries/route.ts')
const request=(url,options={})=>new Request('http://localhost:3000'+url,{...options,headers:{host:'localhost:3000',...options.headers}})
const session=auth.issueLocalOperatorSession(request('/api/ai-console/control/session'));assert(session.ok)
const headers={'content-type':'application/json',origin:'http://localhost:3000',cookie:session.setCookie.split(';')[0],'x-ai-console-csrf':session.session.csrfToken}
let factoryCalls=0
function connect(fixture){service.store=()=>fixture.store;context.productionBackup=()=>{factoryCalls++;return fixture.service};context.projectBackupRecord=(store,record,id)=>fixture.service.observed(id??record.backup_id).record}
const post=(input,override={},url='/api/local-backup/runs')=>runs.POST(request(url,{method:'POST',headers:{...headers,...override},body:typeof input==='string'?input:JSON.stringify(input)}))
test('backup mutation authenticates before factory work and rejects paths, hostile headers, extra fields, queries and oversized bodies',async()=>{
 const f=backupFixture();connect(f);factoryCalls=0
 assert.equal((await runs.POST(request('/api/local-backup/runs',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status,403)
 for(const hostile of [{host:'example.com'},{origin:'https://example.com'},{'x-forwarded-host':'example.com'},{'x-ai-console-csrf':'wrong'}])assert.equal((await post(f.input(),hostile)).status,403)
 assert.equal(factoryCalls,0)
 assert.equal((await post({...f.input(),sourcePath:'arbitrary'})).status,400);assert.equal((await post({...f.input(),scopeId:'unregistered'})).status,400);assert.equal((await post(f.input(),{},'/api/local-backup/runs?scope=arbitrary')).status,400)
 assert.equal((await post('x'.repeat(65537))).status,413);assert.equal(factoryCalls,0);assert.equal(f.store.runs(new URLSearchParams()).total,0)
})
test('the actual fixed POST/GET routes execute only a private configured scope and return durable separated status with bounded entries',async()=>{
 const f=backupFixture({contents:{'one.txt':'first','two.txt':'second'},entries:[{rootId:'fixture',relativePath:'one.txt',capture:'file'},{rootId:'fixture',relativePath:'two.txt',capture:'file'}]});connect(f)
 const input=f.input(),response=await post(input),value=await response.json();assert.equal(response.status,200);assert.equal(value.terminal.state,'completed');assert.equal(value.terminal.coverage,'partial');assert.equal(value.terminal.restorabilityStatus,'unknown')
 const params={params:Promise.resolve({backupId:value.backupId})},list=await runs.GET(request('/api/local-backup/runs?limit=1'));assert.equal(list.status,200);assert.equal((await list.json()).records[0].backup_id,value.backupId)
 assert.equal((await detail.GET(request('/api/local-backup/runs/'+value.backupId),params)).status,200)
 const page=await entries.GET(request('/api/local-backup/runs/'+value.backupId+'/entries?limit=1'),params),first=await page.json();assert.equal(first.records.length,1);assert(first.nextCursor)
 const next=await entries.GET(request('/api/local-backup/runs/'+value.backupId+'/entries?limit=1&cursor='+first.nextCursor),params);assert.equal((await next.json()).records.length,1)
 const before=fileHashes(f.target);assert.equal((await (await post(input)).json()).replayed,true);assert.deepEqual(fileHashes(f.target),before)
})
test('GET projection of a nonterminal record is unknown and remains read-only, including missing detail queries',async()=>{
 const f=backupFixture();connect(f);const id='backup-11111111-1111-1111-1111-111111111111'
 f.store.write(db=>db.prepare('INSERT INTO backup_runs VALUES (?,?,?,?,?,?,?,?,?)').run(id,'copying',null,null,null,'partial','unknown','unknown',null))
 const before=fileHashes(f.moduleRoot),params={params:Promise.resolve({backupId:id})},response=await detail.GET(request('/api/local-backup/runs/'+id),params),body=await response.json()
 assert.equal(response.status,200);assert.equal(body.record.state,'unknown');assert.equal(body.record.recorded_state,'copying')
 const missing='backup-22222222-2222-2222-2222-222222222222';assert.equal((await detail.GET(request('/api/local-backup/runs/'+missing),{params:Promise.resolve({backupId:missing})})).status,404)
 assert.deepEqual(fileHashes(f.moduleRoot),before);assert.equal(fs.existsSync(path.join(f.moduleRoot,'runs')),false)
})
