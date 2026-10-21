import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require=createRequire(import.meta.url),cache=new Map()
function load(filename){const file=path.resolve(filename);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','exports',code)(name=>{
 if(name.endsWith('.css'))return{}
 if(name.startsWith('@/'))return load(path.join(process.cwd(),'src',name.slice(2))+'.ts')
 if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);return target.endsWith('.mjs')?require(target):load(target+'.ts')}
 return require(name)
},exports);return exports}
const context=load('src/server/local-backup/git-context.ts'),auth=load('src/server/ai-console-control/operator-session.ts')
const preview=load('src/app/api/local-backup/git/preview/route.ts'),publish=load('src/app/api/local-backup/git/publish/route.ts'),operations=load('src/app/api/local-backup/git/operations/[operationId]/route.ts')
let factoryCalls=0,previewCalls=0,publishCalls=0
context.productionGit=()=>{factoryCalls++;return{preview(input){previewCalls++;return{dataStatus:'connected',input,mode:'private_route_fixture'}},publish(){publishCalls++;return{dataStatus:'connected',operation:{status:'private_route_fixture'}}},operation(id){return{operationId:id,status:'private_route_fixture'}}}}
function request(url,options={}){return new Request('http://localhost:3000'+url,{...options,headers:{host:'localhost:3000',...options.headers}})}
const session=auth.issueLocalOperatorSession(request('/api/ai-console/control/session'));assert(session.ok)
const headers={'content-type':'application/json',origin:'http://localhost:3000',cookie:session.setCookie.split(';')[0],'x-ai-console-csrf':session.session.csrfToken}
test('Git preview and publish require existing operator authentication, Host/origin/CSRF before service invocation',async()=>{
 factoryCalls=0
 for(const route of [preview,publish]){
  assert.equal((await route.POST(request('/api/local-backup/git/test',{method:'POST',body:'{}',headers:{'content-type':'application/json'}}))).status,403)
  for(const override of [{host:'example.com'},{origin:'http://example.com'},{'x-forwarded-host':'example.com'},{'x-ai-console-csrf':'wrong'}])assert.equal((await route.POST(request('/api/local-backup/git/test',{method:'POST',headers:{...headers,...override},body:'{}'}))).status,403)
 }
 assert.equal(factoryCalls,0)
})
test('authenticated preview is separate from publish; body and parameter limits remain enforced',async()=>{
 const before=publishCalls
 const r=await preview.POST(request('/api/local-backup/git/preview',{method:'POST',headers,body:JSON.stringify({files:[]})}));assert.equal(r.status,200);assert.equal((await r.json()).mode,'private_route_fixture');assert(previewCalls>0);assert.equal(publishCalls,before)
 assert.equal((await preview.POST(request('/api/local-backup/git/preview',{method:'POST',headers,body:'x'.repeat(65537)}))).status,413)
 assert.equal((await publish.POST(request('/api/local-backup/git/publish?ref=evil',{method:'POST',headers,body:'{}'}))).status,400);assert.equal(publishCalls,before)
})
test('operation queries stay read-only and reject non-loopback hosts and arbitrary query parameters',async()=>{
 const id='a'.repeat(64),params=Promise.resolve({operationId:id}),before=publishCalls
 assert.equal((await operations.GET(request('/api/local-backup/git/operations/'+id),{params})).status,200)
 assert.equal((await operations.GET(request('/api/local-backup/git/operations/'+id,{headers:{host:'example.com'}}),{params})).status,403)
 assert.equal((await operations.GET(request('/api/local-backup/git/operations/'+id+'?path=secret'),{params})).status,400);assert.equal(publishCalls,before)
})
test('actual Git panel initial render has empty selection and no automatic or fake successful upload',()=>{
 const component=load('src/app/local-backup/local-backup-git.tsx'),html=renderToStaticMarkup(React.createElement(component.LocalBackupGitPanel))
 assert(html.includes('Git代码版本提交'));assert(html.includes('查看代码变更'));assert(html.includes('默认不选择文件'));assert(!html.includes('type="checkbox"'));assert(!html.includes('提交并推送所选代码'));assert(!html.includes('已上传'))
})
