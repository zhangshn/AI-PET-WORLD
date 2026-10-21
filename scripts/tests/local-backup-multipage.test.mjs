import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { uiHarness, response } from './helpers/local-backup-ui.mjs'

const root='src/app/local-backup/'
const inventory={roots:[],categories:[],gaps:['partial-fixture'],observedAtUtc:'2026-10-21T18:00:00Z',sourceReport:{logicalPath:'private-source',sha256:'a'.repeat(64),observedAtUtc:'2026-10-21T18:00:00Z'},networkObservation:{unc:'private-fixture',freeBytes:100,observedAtUtc:'2026-10-21T18:00:00Z'}}
const workEvent=title=>({eventId:title,moduleId:'local-backup',taskId:'fixture-task',runId:null,eventKind:'progress_report',sourceCategory:'codex',reporter:{id:'window-a',name:'窗口A',threadId:null},title,executionResult:'unknown',validationStatus:'unknown',acceptanceStatus:'unknown',originalEventAtUtc:null,originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,evidenceReferences:[],planReference:null})
const summary={dataStatus:'partial',records:[],coverage:{complete:false,registeredReporters:[{id:'window-a',name:'窗口A',threadId:null,coverageStatus:'reported_partial',knownReportCount:1},{id:'window-b',name:'窗口B',threadId:null,coverageStatus:'no_report_recorded',knownReportCount:null}]}}
const normalFetch=async url=>{
 if(url==='/api/local-backup/summary')return response({inventory})
 if(url.startsWith('/api/local-backup/runs?'))return response({records:[],nextCursor:null})
 if(url.includes('/work-summary'))return response(summary)
 if(url.includes('/work-events'))return response({records:[],nextCursor:null})
 if(url.includes('/journal?'))return response({record:null})
 throw Error('Unexpected API '+url)
}
test('five distinct panels query only their responsibility and neither shell nor Git mount starts business work',async()=>{
 for(const [file,name,expected] of [
  ['local-backup-overview.tsx','LocalBackupOverview',['/api/local-backup/summary']],
  ['local-backup-inventory.tsx','LocalBackupInventoryPanel',['/api/local-backup/summary']],
  ['local-backup-backups.tsx','LocalBackupTasksPanel',['/api/local-backup/runs?limit=20']],
  ['local-backup-work.tsx','LocalBackupWorkPanel',['/api/local-backup/work-summary?date=2026-10-22','/api/local-backup/work-events?date=2026-10-22&limit=20','/api/local-backup/journal?date=2026-10-22']],
  ['local-backup-git.tsx','LocalBackupGitPanel',[]],
  ['local-backup-shell.tsx','LocalBackupShell',[]],
 ]){
  const ui=uiHarness(root+file,name,{fetch:normalFetch,props:{date:'2026-10-22',children:'private-child'}});await ui.tick()
  assert.deepEqual(ui.requests.map(request=>request.url),expected,file)
  assert(ui.requests.every(request=>!request.options.method||request.options.method==='GET'))
  ui.unmount()
 }
 assert(!fs.existsSync(root+'local-backup-panel.tsx'),'the giant component must be removed')
})
test('each route has one active main navigation item and the matching page title, with no business queries',async()=>{
 for(const [suffix,title] of [['','工作台总览'],['/inventory','数据资产'],['/backups','备份任务'],['/work','工作记录'],['/git','Git版本提交']]){
  const ui=uiHarness(root+'local-backup-shell.tsx','LocalBackupShell',{fetch:normalFetch,pathname:'/local-backup'+suffix,props:{children:'child'}});await ui.tick()
  const nav=ui.nodes().find(node=>node.type==='nav'&&node.props['aria-label']==='数据管理主导航')
  const links=nav.props.children;assert.equal(links.length,5);assert.equal(links.filter(link=>link.props['aria-current']==='page').length,1)
  assert.equal(links.find(link=>link.props['aria-current']==='page').props.href,'/local-backup'+suffix)
  assert(ui.nodes().some(node=>node.type==='h1'&&node.props.children===title));assert.equal(ui.requests.length,0)
 }
})
test('legacy hash links map only to fixed functional routes, including optional journal, and never accept arbitrary destinations',async()=>{
 for(const [hash,destination] of [['inventory','/local-backup/inventory'],['backups','/local-backup/backups'],['work','/local-backup/work'],['journal','/local-backup/work#journal'],['git','/local-backup/git']]){
  const ui=uiHarness(root+'local-backup-overview.tsx','LocalBackupOverview',{fetch:normalFetch,url:'http://localhost:3000/local-backup#'+hash});await ui.tick();assert.deepEqual(ui.navigation,[{destination,kind:'replace'}]);ui.unmount()
 }
 const ui=uiHarness(root+'local-backup-overview.tsx','LocalBackupOverview',{fetch:normalFetch,url:'http://localhost:3000/local-backup#https://evil.example'});await ui.tick();assert.equal(ui.navigation.length,0)
 ui.hash('journal');assert.equal(ui.navigation.at(-1).destination,'/local-backup/work#journal')
})
test('work filters bind both queries, preserve URL, and late old-window responses cannot overwrite the chosen window',async()=>{
 let finishOld
 const ui=uiHarness(root+'local-backup-work.tsx','LocalBackupWorkPanel',{props:{date:'2026-10-22',moduleId:'local-backup',reporterId:'window-a'},fetch:async url=>{
  if(url.includes('/work-events')){if(new URL('http://localhost'+url).searchParams.get('reporterId')==='window-a')return new Promise(resolve=>{finishOld=resolve});return response({records:[workEvent('new-window-result')],nextCursor:null})}
  return normalFetch(url)
 }});await ui.tick()
 const requests=ui.requests.filter(request=>request.url.includes('/work-'));assert(requests.every(request=>request.url.includes('date=2026-10-22&moduleId=local-backup&reporterId=window-a')))
 const selects=ui.nodes().filter(node=>node.type==='select');selects[1].props.onChange({target:{value:'window-b'}});ui.render();await ui.tick()
 assert.equal(ui.navigation.at(-1).destination,'/local-backup/work?date=2026-10-22&moduleId=local-backup&reporterId=window-b')
 assert(ui.text().includes('new-window-result'));finishOld(response({records:[workEvent('old-window-result')],nextCursor:null}));await ui.tick();assert(!ui.text().includes('old-window-result'))
})
test('browser back date/filter changes reject an outstanding old-filter page and retain the restored URL scope',async()=>{
 let finishPage
 const ui=uiHarness(root+'local-backup-work.tsx','LocalBackupWorkPanel',{props:{date:'2026-10-22',moduleId:'local-backup',reporterId:'window-a'},fetch:async url=>{
  if(url.includes('/work-events')){const query=new URL('http://localhost'+url).searchParams;if(query.has('cursor'))return new Promise(resolve=>{finishPage=resolve});return response({records:[workEvent(query.get('date')==='2026-10-22'?'day-22':'restored-day-21')],nextCursor:query.get('date')==='2026-10-22'?'private-cursor':null})}
  return normalFetch(url)
 }});await ui.tick();const oldPaging=ui.button('加载更多自动记录').props.onClick,pending=oldPaging();await oldPaging();assert.equal(ui.requests.filter(request=>request.url.includes('cursor=')).length,1);ui.render()
 ui.backTo('/local-backup/work?date=2026-10-21&moduleId=ai-console&reporterId=window-b');await ui.tick();assert(ui.text().includes('restored-day-21'))
 finishPage(response({records:[workEvent('stale-paged-result')],nextCursor:null}));await pending;ui.render();assert(!ui.text().includes('stale-paged-result'));assert(!ui.text().includes('day-22'))
 const current=ui.requests.filter(request=>request.url.includes('/work-events')).at(-1).url;assert(current.includes('date=2026-10-21&moduleId=ai-console&reporterId=window-b'))
 const requestCount=ui.requests.length;await oldPaging();assert.equal(ui.requests.length,requestCount)
})
