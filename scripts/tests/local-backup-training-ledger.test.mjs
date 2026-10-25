import test from 'node:test'
import assert from 'node:assert/strict'
import {uiHarness,response} from './helpers/local-backup-ui.mjs'
const event=(id,sourceCategory)=>({eventId:id,title:id,moduleId:'ai-painter',taskId:'task-'+id,runId:'RUN-SHARED-001',sourceCategory,producerId:'fixture-only',reporter:{id:sourceCategory==='codex'?'codex-controller':'local-ai-painter',name:sourceCategory==='codex'?'总控独立复核':'本地训练与审核程序',threadId:null},eventKind:'execution_finished',executionResult:'failed',validationStatus:'unknown',acceptanceStatus:'unknown',originalEventAtUtc:'2026-10-22T09:31:57Z',originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,hasWorkReport:true,evidenceReferences:[],planReference:null})
test('work list displays the actual common Run while keeping program and controller records separate without new query parameters',async()=>{
 const ui=uiHarness('src/app/local-backup/local-backup-work.tsx','LocalBackupWorkPanel',{props:{date:'2026-10-22',moduleId:'ai-painter'},fetch:async url=>url.includes('/work-records')?response({records:[event('training-first-error','local_program'),event('controller-review','codex')],nextCursor:null}):url.includes('/journal')?response({record:null}):response({records:[],coverage:{registeredReporters:[]}})})
 await ui.tick();const text=ui.text()
 assert.equal(text.split('RUN-SHARED-001').length-1,2);assert(text.includes('本地程序'));assert(text.includes('Codex · 外部执行'));assert(text.includes('总控独立复核'));assert(text.includes('验证 unknown'));assert(!text.includes('验证 passed'))
 assert(ui.requests.every(r=>!r.options.method||r.options.method==='GET'));assert(ui.requests.every(r=>!r.url.includes('runId=')));ui.unmount()
})
test('independent detail preserves business impact, first and secondary errors, repair gaps and external attribution',async()=>{
 const record={...event('detailed-controller','codex'),attributedClaims:{validationStatus:'passed',acceptanceStatus:'unknown'},workReport:{title:'总控复核（私有夹具）',objective:'业务影响：本轮训练失败关闭',reason:'按Run保留原始事实',actions:['核对显式证据'],changes:[],checks:[{command:null,status:'not_verified',description:'原数值根因尚未独立核验'}],results:['审核程序结论另记'],issues:['首错：parameter 90','次错：contribution','修复状态：未执行','未验证：Stage4与Runtime'],nextSteps:['本建议不启动训练'],planComparison:'唯一模块计划2'}}
 const ui=uiHarness('src/app/local-backup/work/work-detail.tsx','WorkDetail',{props:{eventId:record.eventId,values:{date:'2026-10-22'}},fetch:async()=>response({record})});await ui.tick()
 for(const word of ['RUN-SHARED-001','业务影响','parameter 90','contribution','修复状态','未验证','Codex自报验证','机器验证 unknown','验收 unknown'])assert(ui.text().includes(word),word)
 assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].url,'/api/local-backup/work-events/detailed-controller');ui.unmount()
})
