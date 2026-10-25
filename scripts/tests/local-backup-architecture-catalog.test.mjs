import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import { createDocumentReader } from '../../src/server/local-backup/document-reader.mjs'
import { diagramSources, createDiagramQuery, textDiagramKind, extractDiagrams } from '../../src/server/local-backup/diagram-extract.mjs'
import { architectureLevels, architectureModules } from '../../src/server/local-backup/diagram-catalog.mjs'

const reader=createDocumentReader(),query=createDiagramQuery(reader),reject=(fn,code)=>assert.throws(fn,e=>e.message===code)
test('stable first four sources append current subsystem documents and expose grouped bounded coverage',()=>{
 assert.deepEqual(diagramSources.slice(0,4),['docs/BUSINESS_SPEC.md','docs/ARCHITECTURE.md','docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md','docs/ai-console/AI_CONSOLE_ARCHITECTURE_SPEC.md']);assert.equal(new Set(diagramSources).size,diagramSources.length)
 const p=query.list(new URLSearchParams({limit:'50'}));assert.equal(p.sourceCount,16);assert.equal(p.knownRecordCount,69);assert.equal(p.records.length,50);assert(p.nextCursor);assert.equal(p.levels.reduce((n,g)=>n+g.count,0),p.knownRecordCount);assert.equal(p.modules.reduce((n,g)=>n+g.count,0),p.knownRecordCount);assert(p.coverage.textDefinitionsWithoutDiagram.some(d=>d.module==='storage'));assert(p.coverage.missingDesignDefinitions[0].reason.includes('未来退役'))
})
test('six Ziwei diagrams include txt numbered tree and inheritance chain; undefined version/adoption remain null',()=>{
 const p=query.list(new URLSearchParams({module:'ziwei'}));assert.equal(p.knownRecordCount,6);assert.equal(p.records.filter(d=>d.sourceLanguage==='txt').length,5);assert(p.records.some(d=>d.sourceFormat==='text-tree'));assert(p.records.every(d=>d.documentVersion===null&&d.programAdoptionStatus===null&&d.implementationEvidenceStatus==='not_verified_by_this_view'))
 const row=p.records.find(d=>d.section==='第十步：读取动态盘'),detail=query.detail(row.diagramId),doc=reader.body(row.documentId);assert.equal(detail.source,doc.content.split(/\r?\n/).slice(detail.startLine-1,detail.endLine).join('\n'));assert(detail.source.includes('原盘'));assert(detail.source.includes('流时'));assert.equal(detail.sourceDocumentSha256,doc.sha256)
})
test('text extraction accepts actual flow/tree and refuses fields, schemas, commands and unrelated prose',()=>{
 assert.equal(textDiagramKind('根\n  一、来源\n    原始资料\n  二、输出','总体结构'),'tree');assert.equal(textDiagramKind('根\n  数据层\n    来源\n  输出','系统架构'),'tree');assert.equal(textDiagramKind('原盘\n -> 大限\n -> 流年','动态层级'),'flow')
 for(const [text,section]of [['schemaVersion\n  model\n    version\n  status','字段Schema'],['node script.mjs --input a -> b','流程'],['const a = 1\n -> b','架构'],['plain unrelated text','架构']])assert.equal(textDiagramKind(text,section),null)
 const doc={relativePath:'docs/ziwei/DATA_DICTIONARY_ARCHITECTURE.md',documentId:'test',sha256:'a'.repeat(64),content:'# 系统结构\n```txt\n根\n  资料\n    来源\n  输出\n```\n```json\n{"field":"->"}\n```'};assert.equal(extractDiagrams(doc).length,1)
})
test('level/module/q/documentId/type filters remain composable and cursor cannot cross their scope',()=>{
 const p=query.list(new URLSearchParams({module:'ziwei',limit:'2'})),n=query.list(new URLSearchParams({module:'ziwei',limit:'2',cursor:p.nextCursor}));assert.equal(n.records.length,2);assert(n.previousCursor);assert.deepEqual(query.list(new URLSearchParams({module:'ziwei',limit:'2',cursor:n.previousCursor})).records,p.records)
 reject(()=>query.list(new URLSearchParams({module:'world',limit:'2',cursor:p.nextCursor})),'cursor_revision_conflict');reject(()=>query.list(new URLSearchParams({level:'future'})),'diagram_level_invalid');reject(()=>query.list(new URLSearchParams({module:'unregistered'})),'diagram_module_invalid');reject(()=>query.list(new URLSearchParams({type:'svg'})),'diagram_type_invalid')
 const filtered=query.list(new URLSearchParams({level:'subsystem',module:'ziwei',q:'分析',type:'text'}));assert(filtered.records.length>0);assert(filtered.records.every(d=>d.module==='ziwei'&&d.level==='subsystem'&&d.type==='text'))
})
test('all prior main designs remain precise source-index1 IDs and old hashes/unknown IDs fail closed',()=>{
 const p=query.list(new URLSearchParams({type:'mermaid'}));assert.equal(p.knownRecordCount,6);for(const title of ['2. 业务架构图','3. 技术架构图','3.1 视觉知识、训练数据与推理架构','3.2 大世界空间连接架构','7. `/world` 展示闸门']){const d=p.records.find(d=>d.title===title);assert(d);assert(d.diagramId.startsWith('diagram-1-'));assert.equal(query.detail(d.diagramId).title,title);reject(()=>query.detail(d.diagramId.replace(d.sourceDocumentSha256,'0'.repeat(64))),'diagram_source_revision_conflict')}
 reject(()=>query.detail('diagram-99-'+'a'.repeat(64)+'-1'),'diagram_not_found');reject(()=>query.detail('../.env'),'diagram_id_invalid')
})
test('new registered source listing performs no directory discovery or retired/dictionary-body reads',()=>{const native=fs.readdirSync;fs.readdirSync=()=>{throw Error('unexpected discovery')};try{const p=query.list(new URLSearchParams({module:'ziwei'}));assert(p.records.every(r=>!r.relativePath.includes('ai-painter-progress')&&!r.relativePath.includes('FULL_DICTIONARY')))}finally{fs.readdirSync=native}})

const require=createRequire(import.meta.url),cache=new Map()
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>{if(name.endsWith('.css'))return{__esModule:true,default:{}};if(name.startsWith('.')){const p=path.resolve(path.dirname(file),name);return load(p+(fs.existsSync(p+'.tsx')?'.tsx':'.ts'))}return require(name)},out);return out}
const {selectBusinessMap,businessMapSection}=load('src/app/local-backup/business-map/business-map-binding.ts')
test('business panorama selects only the one exact formal section; never first-main/fallback/duplicate',()=>{const p=query.list(new URLSearchParams({documentId:'docs-architecture',type:'mermaid',q:businessMapSection}));assert.equal(p.knownRecordCount,1);const d=selectBusinessMap(p.records,p.knownRecordCount,p.nextCursor);assert(d);assert.equal(d.section,'2.1 全业务线与子系统导航');assert.equal(query.detail(d.diagramId).documentVersion,'AI-PET-WORLD-ARCHITECTURE-1.11');assert.equal(selectBusinessMap([],0,null),null);assert.equal(selectBusinessMap([d,d],2,null),null);assert.equal(selectBusinessMap([{...d,section:'2. 业务架构图'}],1,null),null);assert.equal(selectBusinessMap([{...d,documentId:'foreign'}],1,null),null);assert.equal(selectBusinessMap([d],1,'more'),null)})
test('canvas provides keyboard-focusable bounded view controls and escapes text without executable SVG injection',()=>{const {DiagramCanvas}=load('src/app/local-backup/diagrams/diagram-canvas.tsx');const html=renderToStaticMarkup(React.createElement(DiagramCanvas,{title:'紫微结构'},React.createElement('pre',null,'<script>not executable</script>')));for(const text of ['缩小设计图','放大设计图','当前缩放比例','适配','还原 100%','全屏查看','tabindex="0"','Esc'])assert(html.includes(text));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert.equal(architectureLevels.length,4);assert(architectureModules.some(m=>m.id==='ziwei'))})
