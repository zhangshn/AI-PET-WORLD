import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createDocumentReader} from '../../src/server/local-backup/document-reader.mjs'
import {extractDiagrams,safeDiagramSource,diagramSources} from '../../src/server/local-backup/diagram-extract.mjs'
import {uiHarness,response} from './helpers/local-backup-ui.mjs'
const require=createRequire(import.meta.url),cache=new Map()
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>{if(name.endsWith('.css'))return {__esModule:true,default:{}};if(name.startsWith('.')){const p=path.resolve(path.dirname(file),name);return load(p+(fs.existsSync(p+'.tsx')?'.tsx':'.ts'))}return require(name)},out);return out}
const helpers=load('src/app/local-backup/project-module-details.ts'),{DocumentContent}=load('src/app/local-backup/documents/document-content.tsx'),doc=createDocumentReader().body('docs-architecture'),diagrams=extractDiagrams(doc),counts=[9,10,10,8,8,10,11,10,12]
for(let id=1;id<=9;id++)test('module '+id+' shows exact formal contracts and links its true original diagram fence',()=>{
 const view=helpers.documentSelection(doc,'module-'+id),prefix='ARCH-DETAIL-'+String(id).padStart(2,'0')+'-'
 assert(view.focused);assert.match(view.target.title,new RegExp('^10\\.'+id+' '));assert.equal(view.headings.filter(h=>h.title.startsWith(prefix)).length,counts[id-1]);assert.equal(view.content,doc.content.split(/\r?\n/).slice(view.offset,view.endLine).join('\n'))
 for(const term of ['输入','输出','处理','验收','恢复','依赖'])assert(view.content.includes(term),term)
 for(let other=1;other<=9;other++)if(other!==id)assert(!view.content.includes('##### ARCH-DETAIL-'+String(other).padStart(2,'0')+'-'))
 const html=renderToStaticMarkup(React.createElement(DocumentContent,{document:doc,links:[],anchor:'module-'+id}));assert(html.includes('返回完整文档'));assert(html.includes('查看计划与真实工作记录'));assert(html.includes('id="'+view.target.id+'"'))
 const own=diagrams.filter(d=>new RegExp('^10\\.'+id+'\\.').test(d.section));assert.equal(own.length,1);assert.equal(own[0].level,'subsystem');safeDiagramSource(own[0].source)
 const url=helpers.architectureDiagramHref(doc,own[0].startLine-1);assert.equal(new URL(url,'http://localhost').searchParams.get('id'),own[0].diagramId);assert(html.includes(own[0].diagramId));assert.equal(own[0].source,doc.content.split(/\r?\n/).slice(own[0].startLine-1,own[0].endLine).join('\n'))
 const full=helpers.documentSelection(doc,new URL(helpers.fullDocumentHref(doc.documentId,view.target.title),'http://localhost').searchParams.get('anchor'));assert.equal(full.content,doc.content);assert.equal(full.target.id,view.target.id)
})
test('unknown, missing, repeated and cross-document module targets never fall back to another module',()=>{
 for(const anchor of ['module-0','module-10','module-1#module-2','unknown-heading'])assert.throws(()=>helpers.documentSelection(doc,anchor))
 assert.throws(()=>helpers.documentSelection({...doc,documentId:'other'},'module-1'))
 assert.throws(()=>helpers.documentSelection({...doc,content:doc.content+'\n### 10.1 duplicate\n'},'module-1'),/ambiguous/)
 assert.throws(()=>helpers.documentSelection({...doc,content:doc.content.replace('### 10.1 文档治理与运行可靠性','### absent')},'module-1'))
 assert.equal(helpers.moduleDetailHref('1/../../secret'),null);assert.equal(helpers.architectureDiagramHref({...doc,sha256:'invalid'},1031),null)
})
test('headings inside fences do not truncate focused formal text or become module definitions',()=>{
 const fixture={...doc,content:Array.from({length:9},(_,i)=>'### 10.'+(i+1)+' module\n\n```text\n### false heading\n```\n\n#### child\ntext').join('\n')};const view=helpers.documentSelection(fixture,'module-1');assert(view.content.includes('### false heading'));assert.equal(view.headings.length,2);assert(!view.content.includes('10.2 module'))
})
test('nine actual module entries use only existing registered document GET and fixed internal links',async()=>{
 const ui=uiHarness('src/app/local-backup/project-module-detail-navigation.tsx','ProjectModuleDetailNavigation',{fetch:async()=>response({document:doc})});try{await ui.tick();assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].url,'/api/local-backup/documents/docs-architecture');const links=ui.nodes().filter(n=>n.type==='a');assert.equal(links.length,9);assert.deepEqual(links.map(n=>n.props.href),Array.from({length:9},(_,i)=>helpers.moduleDetailHref(String(i+1))))}finally{ui.unmount()}
})
test('all source positions and document read limit remain unchanged; new9 diagrams do not add tasks',()=>{assert.equal(diagramSources.indexOf('docs/ARCHITECTURE.md'),1);assert.equal(diagramSources.length,17);assert(doc.bytes<512*1024);assert.equal(diagrams.filter(d=>/^10\.[1-9]\./.test(d.section)).length,9);const guide=fs.readFileSync('docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md','utf8'),plan=JSON.parse([...guide.matchAll(/```json\s*\r?\n([\s\S]*?)\r?\n```/g)].find(m=>m[1].includes('whole-product-work-plan-v1'))[1]);assert.equal(plan.items.length,134)})
