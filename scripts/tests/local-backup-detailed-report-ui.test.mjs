import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'

const require=createRequire(import.meta.url),exports={}
const source=fs.readFileSync(new URL('../../src/app/local-backup/local-backup-work-report.tsx',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
new Function('require','exports',code)(name=>name.endsWith('.css')?{default:{}}:require(name),exports)
test('all detailed sections and long recorded arrays remain available without truncation or fake qualifications',()=>{
 const report={title:'窗口实际交付',objective:'有界实现',reason:'对应用户当前任务',actions:Array.from({length:45},(_,i)=>`实际做法-${i}`),changes:Array.from({length:22},(_,i)=>({path:`src/file-${i}.ts`,description:`修改说明-${i}`})),checks:[{command:'node private-test.mjs',status:'passed',description:'仅私有夹具通过'},{command:'not executed',status:'not_run',description:'真实推送未执行'},{command:null,status:'not_verified',description:'生产资格未验证'},{command:'first failing check',status:'failed',description:'保留早期失败'}],results:['临时本地结果已核验'],issues:['实际远端未推送','保留原失败记录'],nextSteps:['建议先独立审查，不代表已授权执行'],planComparison:'只推进唯一计划表模块9的相应范围'}
 const html=renderToStaticMarkup(React.createElement(exports.DetailedWorkReport,{report}))
 for(const text of ['目标与原因','实际做法','修改与交付','验证结果','失败及遗留','计划推进和下一步','实际做法-44','修改说明-21','真实推送未执行','生产资格未验证','保留早期失败','不代表已授权执行'])assert(html.includes(text))
 assert(!html.includes('截断'));assert(!html.includes('今日无工作'));assert(!html.includes('已发布生产'))
})
test('detailed report displays unprovided sections as gaps and escapes submitted markup',()=>{
 const report={title:'<script>not executed</script>',objective:'unknown objective',reason:'unknown reason',actions:[],changes:[],checks:[],results:[],issues:[],nextSteps:[],planComparison:'尚未完成'}
 const html=renderToStaticMarkup(React.createElement(exports.DetailedWorkReport,{report}));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('未提供验证记录'));assert(html.includes('未列文件变更'));assert(html.includes('该报告未提供此项说明'))
})
