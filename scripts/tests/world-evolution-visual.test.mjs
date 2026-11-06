import test from 'node:test'
import assert from 'node:assert/strict'
import {uiHarness} from './helpers/local-backup-ui.mjs'

const component='src/app/local-backup/progress/world-evolution-visual.tsx'
// Synthetic presentation data only. No model, Store or live acceptance claims.
const fixture=()=>({status:'verified_record',label:'测试用已绑定记录',reason:'独立前端交互测试夹具',readAtUtc:'2026-10-30T08:00:00.000Z',observedAtUtc:'2026-10-30T07:59:00.000Z',runId:'fixture-run',worldId:'fixture-world',formalWorldId:'formal-fixture-world',formalTick:0,
 steps:[1,2,3].map(step=>({step,logicalStartUtc:`2020-01-${String(7+step).padStart(2,'0')}T00:00:00.000Z`,logicalEndUtc:`2020-01-${String(8+step).padStart(2,'0')}T00:00:00.000Z`,values:{precipitation:step*0.000002,humidity:50+step,temperature:20+step,windSpeed:1+step/10},historyEvents:step-1,committed:true})),
 checks:{threeCommits:true,historyAffectsOutput:true,metadataUnchanged:true,independentReadback:true},elapsedSeconds:14.0372259,completedAtUtc:'2026-10-30T07:57:22.000Z',scope:'private_integration',sources:[{path:'.runtime/test.json',sha256:'a'.repeat(64)}],next:['正式运行仍需接入与验证'],workHref:'/local-backup/work/codex-fixture'})

test('verified record presents actual values and separates private replay from formal world',()=>{
 const ui=uiHarness(component,'WorldEvolutionVisual',{props:{data:fixture()}})
 try{
  assert.equal(ui.nodes().filter(n=>n.type==='svg').length,4)
  assert(ui.text().includes('历史联调回放 · 隔离世界'))
  assert(ui.text().includes('正式世界当前状态已推进 0 步'))
  assert(ui.text().includes('正在查看第 3 步'))
  assert(ui.text().includes('实际执行耗时14.0372秒'))
  assert(ui.text().includes('不是完整世界记忆、正式服务器持续运行或游戏画面验收'))
  assert(ui.nodes().some(n=>n.type==='a'&&n.props.href==='/local-backup/work/codex-fixture'))
  assert.equal(ui.requests.length,0)
  assert(!ui.nodes().some(n=>n.type==='progress'))
  ui.setProps({data:{...fixture(),formalTick:7}})
  assert(ui.text().includes('正式世界当前状态已推进 7 步'))
 }finally{ui.unmount()}
})

test('step buttons and previous/next change displayed saved history without requests',()=>{
 const ui=uiHarness(component,'WorldEvolutionVisual',{props:{data:fixture()}})
 try{
  ui.button('第 1 步').props.onClick();ui.render()
  assert(ui.text().includes('正在查看第 1 步'))
  assert(ui.text().includes('输入包含 0 条本副本已提交历史'))
  assert.equal(ui.button('第 1 步').props['aria-pressed'],true)
  assert.equal(ui.button('← 上一步记录').props.disabled,true)
  assert.equal(ui.nodes().filter(n=>n.type==='p'&&Array.isArray(n.props.children)).map(n=>n.props.children[0]).includes('21'),true)
  ui.button('下一步记录').props.onClick();ui.render()
  assert(ui.text().includes('正在查看第 2 步'))
  assert(ui.text().includes('输入包含 1 条本副本已提交历史'))
  assert.equal(ui.button('← 上一步记录').props.disabled,false)
  ui.button('第 3 步').props.onClick();ui.render()
  assert.equal(ui.button('下一步记录').props.disabled,true)
  assert.equal(ui.requests.length,0)
 }finally{ui.unmount()}
})

test('missing or conflicting evidence removes graphs and never preserves prior success',()=>{
 const ui=uiHarness(component,'WorldEvolutionVisual',{props:{data:fixture()}})
 try{
  for(const status of ['unavailable','conflict']){
   ui.setProps({data:{...fixture(),status,label:'来源不可核验',reason:'实际摘要不一致',steps:[]}})
   assert.equal(ui.nodes().filter(n=>n.type==='svg').length,0)
   assert(ui.text().includes('实际摘要不一致'))
   assert(!ui.text().includes('对照已通过'))
   assert(!ui.text().includes('本次副本已保存'))
  }
  ui.setProps({})
  assert(ui.text().includes('尚未接入可展示的演化记录'))
  assert.equal(ui.nodes().filter(n=>n.type==='svg').length,0)
 }finally{ui.unmount()}
})

test('unprovided timing or formal tick stays unknown, and failed checks are not shown as passing',()=>{
 const data={...fixture(),elapsedSeconds:null,formalTick:null,checks:{threeCommits:false,historyAffectsOutput:false,metadataUnchanged:false,independentReadback:false}}
 const ui=uiHarness(component,'WorldEvolutionVisual',{props:{data}})
 try{
  assert(ui.text().includes('实际执行耗时未记录'))
  assert(ui.text().includes('正式世界当前状态不可核验'))
  assert(ui.text().includes('独立读回未确认'))
  assert(!ui.text().includes('对照已通过'))
  assert(!ui.text().includes('已推进 0 步'))
 }finally{ui.unmount()}
})

test('constant series and one-step records generate finite chart geometry',()=>{
 const data=fixture();data.steps=data.steps.slice(0,1)
 const ui=uiHarness(component,'WorldEvolutionVisual',{props:{data,compact:true}})
 try{
  for(const node of ui.nodes().filter(n=>n.type==='polyline'))assert(!/NaN|Infinity/.test(node.props.points))
  assert.equal(ui.button('← 上一步记录').props.disabled,true)
  assert.equal(ui.button('下一步记录').props.disabled,true)
  assert(ui.nodes().filter(n=>n.type==='svg').every(n=>n.props.role==='img'&&n.props['aria-label'].includes('单位')))
 }finally{ui.unmount()}
})

test('empty verified input and foreign work link do not produce invented plots or navigation',()=>{
 const ui=uiHarness(component,'WorldEvolutionVisual',{props:{data:{...fixture(),steps:[],workHref:'https://example.com'}}})
 try{
  assert.equal(ui.nodes().filter(n=>n.type==='svg').length,0)
  assert(ui.text().includes('缺少可展示的步骤'))
  assert.equal(ui.nodes().filter(n=>n.type==='a').length,0)
 }finally{ui.unmount()}
})
