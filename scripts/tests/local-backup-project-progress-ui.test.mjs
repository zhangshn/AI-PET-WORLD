import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {uiHarness,response} from './helpers/local-backup-ui.mjs'
import {progressFixture} from './local-backup-project-progress.test.mjs'
const component='src/app/local-backup/progress/project-progress.tsx'
function harness(value){const data=value??progressFixture().read();return uiHarness(component,'ProjectProgressPanel',{fetch:async url=>{assert.equal(url,'/api/local-backup/project-progress');return response(data)}})}
test('all three views share one GET and the flow, selected detail and counts share stage identities',async()=>{
 const ui=harness();await ui.tick();assert.equal(ui.requests.length,1);assert(ui.text().includes('静态说明快照'));assert(ui.text().includes('4 / 5'));assert(ui.text().includes('200 对 G / D'));assert(ui.text().includes('缺少整体适用验收证据'));assert(!ui.text().includes('6.3'));assert(ui.text().includes('48'))
 const nodes=ui.nodes(),flow=nodes.find(n=>n.type==='ol'&&n.props['aria-label']==='自然世界阶段流程与状态');assert.equal(flow.props.children.length,8)
 ui.button('总计划').props.onClick();ui.render();assert(ui.text().includes('正式模块9'));assert(ui.text().includes('原验收9'));assert(ui.text().includes('后置衔接范围'));assert.equal(ui.requests.length,1)
 ui.button('情况说明').props.onClick();ui.render();assert(ui.text().includes('CODEX · 外部综合说明'));assert(ui.text().includes('外部分析'));assert.equal(ui.requests.length,1)
 ui.button('进度').props.onClick();ui.render();const choice=ui.nodes().find(n=>n.type==='button'&&n.props['aria-controls']==='progress-stage-detail'&&n.props.children.some?.(x=>x?.props?.children==='自然世界事实'));assert(choice);choice.props.onClick();ui.render();assert(ui.text().includes('当前选中环节自然世界事实'));ui.unmount()
})
test('tabs support arrow, Home and End with roving focus and matching panel labels',async()=>{
 const ui=harness();await ui.tick();let prevented=false,focused=null
 const tabs=()=>ui.nodes().filter(n=>n.props?.role==='tab'),parentElement={querySelectorAll:()=>[0,1,2].map(i=>({focus:()=>focused=i}))}
 tabs()[1].props.onKeyDown({key:'ArrowRight',preventDefault:()=>prevented=true,currentTarget:{parentElement}});ui.render();assert(prevented);assert.equal(focused,2);assert.equal(tabs()[2].props.tabIndex,0);assert.equal(tabs()[1].props.tabIndex,-1)
 tabs()[2].props.onKeyDown({key:'Home',preventDefault(){},currentTarget:{parentElement}});ui.render();assert.equal(tabs()[0].props['aria-selected'],true)
 tabs()[0].props.onKeyDown({key:'End',preventDefault(){},currentTarget:{parentElement}});ui.render();assert.equal(tabs()[2].props['aria-selected'],true);assert(ui.nodes().some(n=>n.props?.role==='tabpanel'&&n.props['aria-labelledby']==='progress-tab-explanation'));ui.unmount()
})
test('staleness and source failure are visible without fabricated passed states',async()=>{
 const value=progressFixture().read(Date.parse('2026-10-30T08:00:00Z')),ui=harness(value);await ui.tick();assert(ui.text().includes('快照已陈旧'));ui.unmount()
 const failure=uiHarness(component,'ProjectProgressPanel',{fetch:async()=>response({reasonCode:'progress_evidence_sha_conflict'},409)});await failure.tick();assert(failure.text().includes('证据实际字节与快照摘要冲突'));assert(!failure.nodes().some(n=>n.type==='ol'));failure.unmount()
})
test('work route mounts the progress panel once above the unchanged list and legacy journal remains compatible',()=>{
 const page=fs.readFileSync('src/app/local-backup/work/page.tsx','utf8'),overview=fs.readFileSync('src/app/local-backup/local-backup-overview.tsx','utf8'),source=fs.readFileSync(component,'utf8')
 assert(page.indexOf('<ProjectProgressPanel/>')<page.indexOf('<LocalBackupWorkPanel'));assert.equal(page.match(/<ProjectProgressPanel\/>/g).length,1);assert(overview.includes("journal:'/local-backup/work#journal'"));assert(source.includes("window.location.hash==='#journal'"));assert(source.includes("getElementById('project-progress')"))
 assert(!source.includes('setInterval'));assert(!source.includes('dangerouslySetInnerHTML'));assert(fs.readFileSync('src/app/local-backup/progress/progress.module.css','utf8').includes('@media(max-width:600px)'))
})
test('isolated confirmed-count changes never fabricate a whole-project percentage',async()=>{
 const newer=progressFixture().read(),older=structuredClone(newer);older.projection.mvp.completed=2;older.projection.mvp.knownPassed=2
 let calls=0;const ui=uiHarness(component,'ProjectProgressPanel',{fetch:async()=>response(++calls===1?older:newer)})
 try{await ui.tick();assert(ui.text().includes('2 / 48'));assert(!ui.nodes().some(n=>n.props?.role==='progressbar'||n.props?.['aria-valuenow']!==undefined));ui.button('重新读取').props.onClick();await ui.tick();assert(ui.text().includes('3 / 48'));assert(!ui.text().includes('6.3'))}finally{ui.unmount()}
})
test('failed refresh explicitly labels retained value stale; first failure never displays a percentage',async()=>{
 const value=progressFixture().read();let calls=0
 const ui=uiHarness(component,'ProjectProgressPanel',{fetch:async()=>++calls===1?response(value):response({reasonCode:'progress_evidence_sha_conflict'},409)})
 await ui.tick();ui.button('重新读取').props.onClick();await ui.tick();assert(ui.text().includes('上次成功读取的结果'));assert(ui.text().includes('已陈旧'));assert(!ui.nodes().some(n=>n.props?.role==='progressbar'));ui.unmount()
 const failed=uiHarness(component,'ProjectProgressPanel',{fetch:async()=>response({reasonCode:'progress_checklist_binding_conflict'},409)});await failed.tick();assert(!failed.nodes().some(n=>n.props?.role==='progressbar'));failed.unmount()
 const css=fs.readFileSync('src/app/local-backup/progress/mvp-progress.module.css','utf8');assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('transition:none'));assert(css.includes('stroke-dashoffset 1100ms'))
})
test('acceptance provenance, separate watermarks and stale derived index are explicit without granting machine completion',async()=>{
 const value=progressFixture().read(),m=value.projection.mvp;m.legacyCompleted=3;m.productionCompleted=0;m.acceptance={dataStatus:'unknown_or_stale',reasonCode:'mvp_index_or_source_stale',watermarks:{committedFactSequence:4,derivedSequence:3,consumerSequence:3},coverage:{runtimeAdoption:'not_verified',productionAcceptance:'not_verified',historicalCoverageComplete:false}}
 const ui=harness(value);try{await ui.tick();assert(ui.text().includes('外部组件兼容 3 项'));assert(ui.text().includes('机器生产验收 0 项'));assert(ui.text().includes('派生索引或来源陈旧'));assert(ui.text().includes('事实水位 4'));assert(!ui.nodes().some(n=>n.props?.role==='progressbar'))}finally{ui.unmount()}
})

test('matched partial implementations remain visible independently of acceptance; stale rows do not masquerade as current',async()=>{
 const value=progressFixture().read(),ids=value.projection.mvp.groups.flatMap(g=>g.checkpoints.map(c=>c.id));value.projection.mvp.truthAudit={status:'external_audit_as_of',message:'本轮有界实测核查',implementationTotals:{partial:32},rows:ids.map((checkpointId,i)=>({checkpointId,classification:i===0?'blocked':i<32?'partial':'insufficient_evidence',reportedClassification:'partial',implementationStatus:i<32?'partial':'insufficient_evidence',acceptanceStatus:'not_verified',scope:'本次源码和实际CPU测试范围',checkedScope:['本次CPU结果'],unverifiedScope:['正式整链验收未取得'],reason:'有实现但正式发布条件未满足',originalEventAtUtc:null,verifiedAtUtc:'2026-10-28T11:35:00Z',currentSourceState:'matched',references:[]}))};
 const ui=harness(value);try{await ui.tick();assert(ui.text().includes('整体MVP尚未通过验收'));assert(ui.text().includes('部分实现4项'));assert(ui.text().includes('实现：部分实现'));assert(ui.text().includes('正式整链验收未取得'));assert(ui.text().includes('验收：未取得完整适用验收'));assert(!ui.nodes().some(n=>n.props?.role==='progressbar'));assert(!ui.text().includes('整体进度待核实'));value.projection.mvp.truthAudit.rows[0].currentSourceState='changed';ui.render();assert(ui.text().includes('来源已变化，当前实现证据需重新核验'));assert(ui.text().includes('原核查时点结论'));assert(!ui.text().includes('有证据的真实失败'))}finally{ui.unmount()}
})

test('one overall task count and9 module summaries keep product qualification and evidence collapsed',async()=>{
 const v=progressFixture().read(),modules=Array.from({length:9},(_,i)=>({id:String(i+1),title:'建设模块'+(i+1),total:1,completed:i<3?1:0,notCompleted:i<7&&i>=3?1:0,unverified:i>=7?1:0,percentage:i<3?100:0,coverageComplete:i<7,items:[{id:'PLAN-0'+(i+1)+'-001',moduleId:String(i+1),title:'具体交付'+(i+1),deliverable:'实际交付物',doneWhen:'实际产物与对应验证一致',dependsOn:[],status:i<3?'completed':i<7?'not_completed':'unverified',completedParts:i<3?['已接通固定查询']:[],remainingParts:i<3?[]:['正式来源尚未接通'],reason:'当前逐项结果',completedAtUtc:null,verifiedAtUtc:'2026-10-28T12:00:00Z',evidence:[]}]}));v.projection.workPlan={status:'partial',message:'真实逐项核验',version:'v1',method:'一项一票',readAtUtc:'2026-10-28T12:00:00Z',totals:{total:9,completed:3,notCompleted:4,unverified:2,percentage:33.3,coverageComplete:false},modules};const ui=harness(v);try{await ui.tick();assert(ui.text().includes('33.3'));assert(ui.text().includes('3 / 9'));assert(ui.text().includes('已经完成'));assert(ui.text().includes('还未完成'));const moduleCards=ui.nodes().filter(n=>n.type==='details'&&n.props?.id?.startsWith('work-plan-module-'));assert.equal(moduleCards.length,9);assert(moduleCards.every(n=>!n.props.open));const qualification=ui.nodes().find(n=>n.type==='summary'&&String(n.props.children?.[0]).includes('产品功能验收'));assert(qualification);assert(ui.nodes().filter(n=>n.type==='progress').length===1)}finally{ui.unmount()}
})
