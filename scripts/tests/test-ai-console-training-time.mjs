import test from 'node:test'
import assert from 'node:assert/strict'
import { trainingTime as time } from './helpers/training-time-cpu.mjs'

const timing = (fields = {}) => ({ availability: 'available', reasonCode: null,
  sourcePath: '.runtime/ai-painter/private-time/worker-execution-timing.json', sourceSha256: 'a'.repeat(64),
  scope: time.WORKER_TIMING_SCOPE, status: 'completed', stopReason: null,
  startedAtUtc: '2026-10-19T13:14:37.756250+00:00', endedAtUtc: '2026-10-19T16:22:37.142644+00:00',
  elapsedSeconds: 11279.391000000003, ...fields })

test('UTC Z, UTC offsets and other explicit offsets display the same Beijing instant', () => {
  for (const value of ['2026-10-19T13:14:37.756250+00:00', '2026-10-19T13:14:37.756250Z',
    '2026-10-19T21:14:37.756250+08:00', '2026-10-19T06:14:37.756250-07:00']) {
    assert.equal(time.formatTrainingTime(value), '2026-10-19 21:14:37.756（北京时间）')
  }
  assert.equal(time.formatTrainingTime('2026-10-19T16:22:37.142644Z'), '2026-10-20 00:22:37.142（北京时间）')
})
test('illegal dates, normalized overflow, unzoned dates and unknown types are never rendered as valid times', () => {
  for (const value of ['bad', '2026-02-30T00:00:00Z', '2026-02-29T00:00:00Z', '2026-13-01T00:00:00Z',
    '2026-10-19', '2026-10-19T13:00:00', '2026-10-19T24:00:00Z', '2026-10-19T13:00:00+08:61',
    0, NaN, Infinity, {}, true]) assert.match(time.formatTrainingTime(value), /未知（时间格式异常）/)
  for (const value of [null, undefined, '']) assert.match(time.formatTrainingTime(value), /未记录／未知/)
  assert.match(time.formatTrainingTime('2024-02-29T00:00:00Z'), /2024-02-29 08:00:00/)
})
test('recorded monotonic duration is used independently of UTC difference with millisecond precision', () => {
  const view = time.mapWorkerTiming(timing())
  assert.equal(view.elapsed, '3小时7分59.391秒（11279.391秒）')
  assert.match(view.startedAt, /21:14:37.756/); assert.match(view.endedAt, /00:22:37.142/)
  assert.match(view.scope, /认证、数据与模型加载、训练、Checkpoint、验证及最终进度/)
  assert.match(view.scope, /不含此前CPU准备、GPU准入/)
  assert.match(view.scope, /不是纯GPU训练耗时/)
  assert.equal(time.mapWorkerTiming(timing({ elapsedSeconds: 1.234 })).elapsed, '1.234秒（1.234秒）')
  assert.equal(time.mapWorkerTiming(timing({ elapsedSeconds: null })).elapsed, '未记录／未知（无单调计时证据）')
})
test('only genuinely recorded zero is zero; negative, nonfinite, strings and unsafe durations stay unknown', () => {
  assert.equal(time.formatTrainingElapsed(0), '0.000秒（0.000秒）')
  assert.equal(time.formatTrainingElapsed(59.9996), '1分0.000秒（60.000秒）')
  assert.equal(time.formatTrainingElapsed(90061.001), '25小时1分1.001秒（90061.001秒）')
  for (const value of [-1, NaN, Infinity, -Infinity, '1', {}, Number.MAX_VALUE]) {
    assert.match(time.mapWorkerTiming(timing({ elapsedSeconds: value })).elapsed, /未知（耗时数据异常）/)
  }
})
test('started-only, interrupted without final clock and corrupt terminal times cannot claim final zero or completion', () => {
  for (const fields of [{ status: 'started', endedAtUtc: null, elapsedSeconds: null },
    { status: 'started', endedAtUtc: timing().endedAtUtc, elapsedSeconds: 0 },
    { status: 'failed_closed', endedAtUtc: null, elapsedSeconds: null },
    { status: 'completed', endedAtUtc: 'bad', elapsedSeconds: 0 },
    { status: 'interrupted', endedAtUtc: null, elapsedSeconds: null },
    { endedAtUtc: '2026-10-19T12:00:00Z', elapsedSeconds: 0 }]) {
    const view = time.mapWorkerTiming(timing(fields))
    assert.match(view.elapsed, /最终耗时未知/); assert.doesNotMatch(view.elapsed, /0\.000/)
  }
  assert.match(time.mapWorkerTiming(timing({ status: 'started', endedAtUtc: null, elapsedSeconds: null })).state, /不代表当前仍在运行/)
})
test('failure preserves recorded start, end and duration without exposing arbitrary stop messages', () => {
  const view = time.mapWorkerTiming(timing({ status: 'failed_closed', stopReason: { message: 'secret=hidden', type: 'RuntimeError' } }))
  assert.match(view.state, /失败关闭/); assert.match(view.elapsed, /11279.391秒/)
  assert.match(view.startedAt, /21:14/); assert.match(view.endedAt, /00:22/)
  assert.doesNotMatch(JSON.stringify(view), /secret=hidden/)
})
test('missing evidence, unavailable timing, conflicting reason, source or scope never supply trusted dates', () => {
  for (const value of [null, undefined, {}, timing({ availability: 'unavailable', reasonCode: 'worker_timing_missing' }),
    timing({ scope: 'other_phase' }), timing({ sourcePath: null }), timing({ sourceSha256: 'bad' }),
    timing({ reasonCode: 'worker_timing_hash_conflict' })]) {
    const view = time.mapWorkerTiming(value)
    assert.match(view.startedAt, /未记录／未知/); assert.match(view.elapsed, /最终耗时未知/)
    assert.doesNotMatch(view.startedAt, /2026/)
  }
})
