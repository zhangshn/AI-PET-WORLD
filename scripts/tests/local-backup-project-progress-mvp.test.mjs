import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {progressFixture} from './local-backup-project-progress.test.mjs'
import {MVP_SPEC,readMvpChecklist,summarizeMvp} from '../../src/server/local-backup/project-progress-mvp.mjs'
import {PROGRESS_STAGES} from '../../src/server/local-backup/project-progress-catalog.mjs'

test('official 12x4 checklist and three narrowly matched components produce 3/48 = 6.3, never 3/8',()=>{
 const v=progressFixture().read().projection,m=v.mvp
 assert.equal(m.version,'mvp-acceptance-checklist-v1');assert.equal(m.groups.length,12);assert.equal(m.denominator,48);assert.equal(m.completed,3);assert.equal(m.knownAcceptanceRatio,6.3);assert.notEqual(m.knownAcceptanceRatio,37.5)
 assert.deepEqual(m.groups.flatMap(g=>g.checkpoints.filter(c=>c.status==='passed').map(c=>c.id)),['MVP-VIS-01:1','MVP-VIS-01:2','MVP-VIS-06:1'])
 for(const group of m.groups.filter(g=>g.id!=='MVP-VIS-01'&&g.id!=='MVP-VIS-06'))assert.equal(group.completed,0)
 assert.equal(m.groups.find(g=>g.id==='MVP-VIS-08').checkpoints[0].status,'blocked');assert.equal(m.complete,false)
 assert(m.refreshScope.includes('自动归集尚未接入'))
})
test('checklist labels are verbatim official four-point rows and unknown stays in denominator',()=>{
 const f=progressFixture(),groups=readMvpChecklist(fs.readFileSync(path.join(f.root,MVP_SPEC),'utf8'))
 assert.equal(groups.flatMap(g=>g.checkpoints).length,48)
 assert.equal(groups[0].checkpoints[0].label,'合法首区来源及自然事实组件')
 assert.equal(groups[11].checkpoints[3].label,'非法输出资源故障不污染正式世界')
 f.snapshot.evidence=[];for(const s of f.snapshot.stages){s.evidenceIds=[];s.status='not_verified'}for(const n of f.snapshot.notes)n.evidenceIds=[];f.save()
 const m=f.read().projection.mvp;assert.equal(m.completed,0);assert.equal(m.denominator,48);assert.equal(m.knownAcceptanceRatio,0);assert.equal(m.unverified,48)
})
test('count boundaries round once and full 100 requires every complete group acceptance',()=>{
 const groups=readMvpChecklist(fs.readFileSync(MVP_SPEC,'utf8')).map(g=>({...g,fullAcceptanceVerified:false,checkpoints:g.checkpoints.map(c=>({...c,status:'not_verified'}))}))
 assert.equal(summarizeMvp(groups).percentage,0)
 groups[0].checkpoints[0].status='passed';assert.equal(summarizeMvp(groups).percentage,2.1)
 for(const g of groups)for(const c of g.checkpoints)c.status='passed'
 assert.throws(()=>summarizeMvp(groups),/progress_mvp_full_acceptance_required/)
 // Isolated arithmetic-only complete-evidence boundary, not source admission.
 for(const g of groups)g.fullAcceptanceVerified=true
 const m=summarizeMvp(groups);assert.equal(m.percentage,100);assert.equal(m.completed,48);assert.equal(m.complete,true)
 groups[11].checkpoints[3].status='not_verified';assert.equal(summarizeMvp(groups).percentage,97.9)
})
test('status words alone cannot satisfy the component checkpoints, nor grant roles, animals or world release',()=>{
 const f=progressFixture(),binding=f.snapshot.evidence.find(e=>e.id==='facts098');delete f.values.facts098.independentReadback;binding.sha256=f.put(binding.path,f.values.facts098).sha256;f.save()
 const m=f.read().projection.mvp;assert.equal(m.completed,2);assert.equal(m.denominator,48)
 for(const id of ['MVP-VIS-02','MVP-VIS-03','WORLD-AUTO-002','WORLD-AUTO-003'])assert(m.groups.find(g=>g.id===id).checkpoints.every(c=>c.status==='not_verified'))
 assert.equal(m.groups[7].checkpoints[2].status,'not_verified')
})
for(const [title,modify,code] of [
 ['checklist SHA conflict',f=>{f.snapshot.checklist.sha256='0'.repeat(64);f.save()},'progress_checklist_binding_conflict'],
 ['arbitrary checklist path',f=>{f.snapshot.checklist.path='../../.env';f.save()},'progress_checklist_binding_conflict'],
 ['unknown checklist version',f=>{f.snapshot.checklist.version='future';f.save()},'progress_checklist_binding_conflict'],
 ['client percentage injected',f=>{f.snapshot.percentage=100;f.save()},'progress_snapshot_shape'],
 ['missing role group',f=>{const p=f.put(MVP_SPEC,fs.readFileSync(path.join(f.root,MVP_SPEC),'utf8').replace(/^\| MVP-VIS-02.*$/m,''));f.snapshot.checklist.sha256=p.sha256;f.save()},'progress_checklist_count_invalid'],
 ['three-point denominator tamper',f=>{const p=f.put(MVP_SPEC,fs.readFileSync(path.join(f.root,MVP_SPEC),'utf8').replace('；正式自然首区全链验收',''));f.snapshot.checklist.sha256=p.sha256;f.save()},'progress_checklist_shape_invalid'],
])test(title,()=>{const f=progressFixture();modify(f);assert.throws(()=>f.read(),new RegExp(code))})
test('a new isolated binding removal changes actual projection without modifying production snapshot',()=>{
 const f=progressFixture(),before=f.read().projection.mvp.knownAcceptanceRatio
 f.snapshot.evidence=f.snapshot.evidence.filter(e=>e.id!=='input102')
 for(const s of f.snapshot.stages){s.evidenceIds=s.evidenceIds.filter(id=>id!=='input102');if(PROGRESS_STAGES.find(r=>r.id===s.id).evidence.includes('input102'))s.status='not_verified'}
 f.save();const after=f.read().projection.mvp;assert.equal(before,6.3);assert.equal(after.knownAcceptanceRatio,4.2);assert.equal(after.denominator,48)
})
