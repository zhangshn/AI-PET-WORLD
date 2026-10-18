import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Run the production scheduler with a virtual clock and abortable fake HTTP
// operations. No server, training, filesystem writes or wall-clock sleeps.
function harness() {
  let now = 0, sequence = 0, active = 0, maximum = 0
  const timers = new Map(), starts = [], finishes = [], errors = [], signals = []
  const schedule = (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id }
  const clear = id => timers.delete(id)
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
  async function advance(milliseconds) {
    const target = now + milliseconds
    await flush()
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
      if (!due) break
      now = due[1].at; timers.delete(due[0]); due[1].callback(); await flush()
    }
    now = target; await flush()
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/app/ai-console/ai-console-history-poll.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, AbortController, setTimeout: schedule, clearTimeout: clear })
  function query(name, duration, failure = null) {
    return {
      run(signal) {
        starts.push({ name, at: now }); signals.push(signal)
        active++; maximum = Math.max(maximum, active)
        return new Promise((resolve, reject) => {
          let settled = false
          const finish = error => {
            if (settled) return
            settled = true; active--; clear(timer); signal.removeEventListener('abort', abort)
            finishes.push({ name, at: now, aborted: signal.aborted })
            if (error) reject(error); else resolve()
          }
          const timer = schedule(() => finish(failure), duration)
          const abort = () => finish(signal.reason)
          signal.addEventListener('abort', abort, { once: true })
          if (signal.aborted) abort()
        })
      },
      failed(error) { errors.push({ name, at: now, message: error.message }) },
    }
  }
  return { start: exports.startHistoryPolling, query, advance, flush, starts, finishes, errors, signals,
    get now() { return now }, get active() { return active }, get maximum() { return maximum }, get pendingTimers() { return timers.size } }
}

test('4.9s list plus 7.7s detail plus content each receive a fresh 10s budget, not one shared deadline', async () => {
  const h = harness()
  const stop = h.start([h.query('list', 4900), h.query('detail', 7700), h.query('content', 2300)])
  await h.advance(14900)
  assert.deepEqual(h.starts, [{ name: 'list', at: 0 }, { name: 'detail', at: 4900 }, { name: 'content', at: 12600 }])
  assert.equal(h.finishes.length, 3)
  assert.equal(h.errors.length, 0)
  assert.ok(h.signals.every(signal => !signal.aborted))
  assert.equal(new Set(h.signals).size, 3)
  assert.equal(h.maximum, 1)
  await h.advance(1999); assert.equal(h.starts.length, 3)
  await h.advance(1); assert.equal(h.starts.at(-1).at, 16900)
  stop(); await h.flush(); assert.equal(h.active, 0); assert.equal(h.pendingTimers, 0)
})

for (const failedIndex of [0, 1, 2]) test(`timeout of request ${failedIndex + 1} is isolated and the other queries still complete`, async () => {
  const h = harness(), names = ['content', 'detail', 'list']
  const stop = h.start(names.map((name, i) => h.query(name, i === failedIndex ? 20000 : 100)))
  await h.advance(10200)
  assert.deepEqual(h.starts.map(item => item.name), names)
  assert.deepEqual(h.errors, [{ name: names[failedIndex], at: 10000 + failedIndex * 100, message: 'history_request_timeout' }])
  assert.equal(h.finishes.filter(item => !item.aborted).length, 2)
  assert.equal(h.maximum, 1)
  stop(); await h.flush(); assert.equal(h.pendingTimers, 0)
})

test('ordinary query rejection does not suppress later requests and the same selected query recovers next cycle', async () => {
  const h = harness()
  let offline = true
  const content = h.query('selected-run/content', 200), detail = h.query('selected-run/detail', 100)
  const list = h.query('list', 100)
  const stop = h.start([content, { ...detail, run: signal => offline ? Promise.reject(new Error('offline')) : detail.run(signal) }, list])
  await h.advance(300)
  assert.equal(h.errors.length, 1)
  assert.deepEqual(h.starts.map(item => item.name), ['selected-run/content', 'list'])
  offline = false; await h.advance(2400)
  assert.deepEqual(h.starts.slice(2).map(item => item.name), ['selected-run/content', 'selected-run/detail', 'list'])
  assert.equal(h.errors.length, 1)
  assert.equal(h.maximum, 1)
  stop(); await h.flush()
})

test('body parsing remains inside its request deadline and cannot starve the next request', async () => {
  const h = harness(), body = h.query('body', 20000)
  const stop = h.start([{ ...body, async run(signal) { const response = { json: () => body.run(signal) }; await response.json() } }, h.query('next', 100)])
  await h.advance(10100)
  assert.equal(h.errors[0].message, 'history_request_timeout')
  assert.equal(h.finishes.at(-1).name, 'next')
  assert.equal(h.maximum, 1)
  stop(); await h.flush(); assert.equal(h.pendingTimers, 0)
})

test('unmount cancels the active request, skips later queries and schedules no retries or failure updates', async () => {
  const h = harness()
  const stop = h.start([h.query('content', 5000), h.query('detail', 100), h.query('list', 100)])
  await h.advance(1000); stop(); await h.advance(60000)
  assert.equal(h.signals[0].aborted, true)
  assert.equal(h.starts.length, 1)
  assert.equal(h.errors.length, 0)
  assert.equal(h.active, 0)
  assert.equal(h.pendingTimers, 0)
})

test('unmount between cycles clears the 2s retry timer', async () => {
  const h = harness(), stop = h.start([h.query('list', 10)])
  await h.advance(10); stop(); await h.advance(60000)
  assert.equal(h.starts.length, 1)
  assert.equal(h.errors.length, 0)
  assert.equal(h.pendingTimers, 0)
})

test('a slow abort acknowledgement never overlaps the next request or starts a retry storm', async () => {
  const h = harness()
  let release
  const stop = h.start([{ run: signal => { h.signals.push(signal); return new Promise(resolve => { release = resolve }) }, failed: error => h.errors.push(error.message) }, h.query('next', 10)])
  await h.advance(20000)
  assert.equal(h.signals[0].aborted, true)
  assert.equal(h.starts.length, 0, 'next query must await the cancelled request settling')
  release(); await h.flush(); await h.advance(10)
  assert.deepEqual(h.errors, ['history_request_timeout'])
  assert.equal(h.starts.length, 1)
  stop(); await h.flush(); assert.equal(h.pendingTimers, 0)
})

test('legacy single-request signature retains timeout, cancellation and recovery semantics', async () => {
  const h = harness(), item = h.query('legacy', 20000)
  const stop = h.start(item.run, item.failed, 2000, 50)
  await h.advance(50)
  assert.equal(h.errors[0].message, 'history_request_timeout')
  await h.advance(2000)
  assert.equal(h.starts.length, 2)
  assert.equal(h.maximum, 1)
  stop(); await h.flush(); assert.equal(h.pendingTimers, 0)
})
