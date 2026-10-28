import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const exports={};new Function('exports',ts.transpileModule(fs.readFileSync('src/app/local-backup/progress/progress-poller.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports)
const {createProgressPoller}=exports,flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
function setup(load){let now=0,id=0;const jobs=new Map(),listeners=new Set(),events=[],requests=[];const surface={hidden:false,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)},timers={set:(fn,delay)=>{jobs.set(++id,{at:now+delay,fn});return id},clear:id=>jobs.delete(id)},poller=createProgressPoller({surface,timers,load:signal=>{requests.push(signal);return load(signal,requests.length)},onData:value=>events.push(['data',value]),onError:e=>events.push(['error',e.message]),onBusy:value=>events.push(['busy',value]),onPause:value=>events.push(['paused',value])});return {poller,requests,events,jobs,listeners,async advance(ms){now+=ms;for(const [key,job]of [...jobs])if(job.at<=now){jobs.delete(key);job.fn()}await flush()},async hidden(value){surface.hidden=value;for(const fn of listeners)fn();await flush()}}}
test('15 second polling re-reads without incrementing unchanged data and manual refresh is single-flight',async()=>{
 let resolve;const q=setup(()=>new Promise(r=>resolve=r));assert.equal(q.requests.length,1);void q.poller.refresh();await q.advance(60000);assert.equal(q.requests.length,1);assert.equal(q.jobs.size,0)
 resolve({percentage:6.3});await flush();await q.advance(14999);assert.equal(q.requests.length,1);await q.advance(1);assert.equal(q.requests.length,2);resolve({percentage:6.3});await flush();assert.deepEqual(q.events.filter(e=>e[0]==='data').map(e=>e[1].percentage),[6.3,6.3]);q.poller.stop();assert.equal(q.jobs.size,0)
})
test('hidden tab aborts and pauses; becoming visible refreshes once; unmount cleans timer/listener and rejects late results',async()=>{
 let resolve;const q=setup(()=>new Promise(r=>resolve=r));await q.hidden(true);assert(q.requests[0].aborted);await q.advance(60000);assert.equal(q.requests.length,1);await q.hidden(false);assert.equal(q.requests.length,1);resolve({percentage:6.3});await flush();assert.equal(q.requests.length,2);q.poller.stop();assert(q.requests[1].aborted);resolve({percentage:100});await flush();assert.equal(q.events.filter(e=>e[0]==='data').length,0);assert.equal(q.jobs.size,0);assert.equal(q.listeners.size,0)
})
test('connection failure is reported; successful data is never replaced with fabricated growth',async()=>{
 const q=setup(async(_,n)=>{if(n===2)throw Error('connection_failed');return {percentage:6.3}});await flush();await q.advance(15000);assert.deepEqual(q.events.filter(e=>e[0]==='error'),[['error','connection_failed']]);assert.equal(q.events.filter(e=>e[0]==='data').at(-1)[1].percentage,6.3);await q.hidden(true);await q.advance(60000);assert.equal(q.requests.length,2);await q.hidden(false);assert.equal(q.requests.length,3);q.poller.stop()
})
