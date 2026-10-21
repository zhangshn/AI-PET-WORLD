import test from 'node:test'
import assert from 'node:assert/strict'
import { uiHarness, response } from './helpers/local-backup-ui.mjs'
function harness(){
 const pending=[]
 const row=backup_id=>({backup_id,state:'completed',started_at_utc:null,finished_at_utc:null,elapsed_ms:null,coverage:'private_fixture',verification_status:'unknown',restorability_status:'unknown',failure_code:null})
 const ui=uiHarness('src/app/local-backup/local-backup-backups.tsx','LocalBackupTasksPanel',{fetch:async url=>{
  if(url.includes('/entries'))return new Promise((resolve,reject)=>pending.push({url,resolve,reject}))
  if(url.includes('/runs?'))return response({records:[row('run-A'),row('run-B')],nextCursor:null})
  throw Error('unexpected unrelated API '+url)
 }})
 return{...ui,requests:pending,finish(index,owner,label,nextCursor=null){pending[index].resolve(response({records:[{backup_id:owner,relative_path:label}],nextCursor}))},fail(index){pending[index].reject(Error('old_request_failed'))}}
}
test('slow A cannot replace fast B, and switching immediately clears the previous entries',async()=>{
 const ui=harness();await ui.tick()
 const a=ui.button('run-A').props.onClick();ui.render();const b=ui.button('run-B').props.onClick();ui.render()
 ui.finish(1,'run-B','B-only');await b;ui.render();assert(ui.text().includes('B-only'))
 ui.finish(0,'run-A','A-stale');await a;ui.render();assert(ui.text().includes('执行记录 run-B'));assert(ui.text().includes('B-only'));assert(!ui.text().includes('A-stale'))
 const again=ui.button('run-A').props.onClick();ui.render();assert(ui.text().includes('执行记录 run-A'));assert(!ui.text().includes('B-only'))
 ui.finish(2,'run-A','A-current');await again;ui.render();assert(ui.text().includes('A-current'))
})
test('old A pagination response cannot append to selected B, nor can a stale A paging callback start work',async()=>{
 const ui=harness();await ui.tick();const a=ui.button('run-A').props.onClick();ui.finish(0,'run-A','A-first','A-next');await a;ui.render()
 const oldPaging=ui.button('更多清单条目').props.onClick;const page=oldPaging();ui.render()
 const b=ui.button('run-B').props.onClick();ui.finish(2,'run-B','B-current');await b;ui.render()
 ui.finish(1,'run-A','A-old-page');await page;ui.render();assert(ui.text().includes('B-current'));assert(!ui.text().includes('A-old-page'));assert(!ui.text().includes('A-first'))
 const count=ui.requests.length;await oldPaging();ui.render();assert.equal(ui.requests.length,count);assert(ui.text().includes('执行记录 run-B'))
})
test('old A failure cannot erase newer successful B entries or show an unrelated error',async()=>{
 const ui=harness();await ui.tick();const a=ui.button('run-A').props.onClick();const b=ui.button('run-B').props.onClick();ui.finish(1,'run-B','B-safe');await b;ui.render()
 ui.fail(0);await a;ui.render();assert(ui.text().includes('B-safe'));assert(!ui.text().includes('old_request_failed'))
})
test('same Run requests still require the current generation; response entry identity must match',async()=>{
 const ui=harness();await ui.tick();const old=ui.button('run-A').props.onClick(),current=ui.button('run-A').props.onClick()
 ui.finish(1,'run-A','new-generation');await current;ui.render();ui.finish(0,'run-A','old-generation');await old;ui.render();assert(ui.text().includes('new-generation'));assert(!ui.text().includes('old-generation'))
 const mismatch=ui.button('run-B').props.onClick();ui.finish(2,'run-A','wrong-owner');await mismatch;ui.render();assert(ui.text().includes('backup_entry_identity_conflict'));assert(!ui.text().includes('wrong-owner'))
})
test('same Run pagination appends in order and duplicate pending page requests do not mix',async()=>{
 const ui=harness();await ui.tick();const a=ui.button('run-A').props.onClick();ui.finish(0,'run-A','first-page','next');await a;ui.render()
 const paging=ui.button('更多清单条目').props.onClick,page=paging();await paging();assert.equal(ui.requests.length,2)
 ui.finish(1,'run-A','second-page');await page;ui.render();assert(ui.text().includes('first-page'));assert(ui.text().includes('second-page'));assert(ui.text().indexOf('first-page')<ui.text().indexOf('second-page'))
})
