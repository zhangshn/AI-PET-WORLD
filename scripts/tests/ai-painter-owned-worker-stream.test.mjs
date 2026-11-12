import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Writable} from 'node:stream';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {consumeNativeOwnerChunk, deferCompletionParserUntilSpawn,
  createRetainedNativeStopSender, primaryErrorBeforeNativeFinalization} from '../lib/ai-painter-owned-worker-stream.mjs';

test('fragmented frames are delivered once, in order; accounting runs once per completed block', () => {
  const wire = 'O:aGVsbG8=\r\nE:ZXJyb3I=\nR:e30=\n';
  for (let width = 1; width <= wire.length; width++) {
    const frames = [], errors = []; let pending = '', accounting = 0, expectedAccounting = 0;
    const callbacks = {onFrame: line => frames.push(line), onError: e => errors.push(e),
      onOverflow: () => assert.fail('unexpected overflow'), account: () => accounting++};
    for (let offset = 0; offset < wire.length; offset += width) {
      const chunk = wire.slice(offset, offset + width);
      if ((pending + chunk).includes('\n')) expectedAccounting++;
      pending = consumeNativeOwnerChunk(pending, Buffer.from(chunk), callbacks);
    }
    assert.deepEqual(frames, ['O:aGVsbG8=', 'E:ZXJyb3I=', 'R:e30=']);
    assert.equal(pending, ''); assert.deepEqual(errors, []); assert.equal(accounting, expectedAccounting);
  }
});

test('frame rejection does not swallow later frames or accounting failures', () => {
  const frameError = new Error('bad frame'), budgetError = new Error('output budget'), frames = [], errors = [];
  const pending = consumeNativeOwnerChunk('', Buffer.from('bad\ngood\npartial'), {
    onFrame(line) { frames.push(line); if (line === 'bad') throw frameError; },
    onError: error => errors.push(error), onOverflow: () => assert.fail(), account() { throw budgetError; }
  });
  assert.deepEqual(frames, ['bad', 'good']); assert.deepEqual(errors, [frameError, budgetError]);
  assert.equal(pending, 'partial');
});

test('unterminated input retains the existing 65536-byte ceiling and cannot skip overflow reporting', () => {
  let overflow = 0, accounting = 0;
  const callbacks = {onFrame: () => assert.fail(), onError: () => assert.fail(),
    onOverflow: () => overflow++, account: () => accounting++};
  const pending = consumeNativeOwnerChunk('', Buffer.alloc(65536, 65), callbacks);
  assert.equal(pending.length, 65536); assert.equal(overflow, 0);
  assert.equal(consumeNativeOwnerChunk(pending, Buffer.from('B'), callbacks), '');
  assert.equal(overflow, 1); assert.equal(accounting, 0);
});

test('completion parser requires retained listeners and starts only after a real PID is available', () => {
  const child = new EventEmitter(), seen = [], errors = [];
  assert.throws(() => deferCompletionParserUntilSpawn(child, () => {}, () => {}, () => {}), /retained failure/);
  child.on('error', e => errors.push(e)); child.on('close', () => {});
  deferCompletionParserUntilSpawn(child, pid => ({pid}), parser => seen.push(parser), error => errors.push(error));
  assert.deepEqual(seen, []); child.pid = 123; child.emit('spawn'); child.emit('spawn');
  assert.deepEqual(seen, [{pid: 123}]); assert.deepEqual(errors, []);
});

test('spawn failure and invalid PID never create a completion parser', () => {
  for (const pid of [undefined, 0, -1, 1.5]) {
    const child = new EventEmitter(), errors = []; child.pid = pid;
    child.on('error', e => errors.push(e)); child.on('close', () => {});
    deferCompletionParserUntilSpawn(child, () => assert.fail('parser cannot start'), () => assert.fail(), e => errors.push(e));
    child.emit('spawn'); assert.match(errors[0].message, /real spawned owner PID/);
  }
  const child = new EventEmitter(), errors = [], failure = Object.assign(new Error('spawn ENOENT'), {code: 'ENOENT'});
  child.on('error', e => errors.push(e)); child.on('close', () => {});
  deferCompletionParserUntilSpawn(child, () => assert.fail(), () => assert.fail(), e => errors.push(e));
  child.emit('error', failure); child.emit('close'); assert.deepEqual(errors, [failure]);
});

function senderFixture(change = () => {}) {
  const writes = [], errors = [], child = {exitCode: null, signalCode: null, stdin: new EventEmitter()};
  Object.assign(child.stdin, {destroyed: false, writable: true, writableEnded: false, writableFinished: false,
    write: chunk => writes.push(chunk)});
  const state = {closed: false, settled: false, terminal: false}; change(child, state);
  const send = createRetainedNativeStopSender(child, {isClosed: () => state.closed,
    isSettled: () => state.settled, hasTerminalFrame: () => state.terminal, onError: error => errors.push(error)});
  return {child, state, send, writes, errors};
}

test('stop requests are per-call and at most once; every terminal stream state prevents writing', () => {
  for (const change of [(_c,s) => s.closed = true, (_c,s) => s.settled = true, (_c,s) => s.terminal = true,
    c => c.exitCode = 0, c => c.signalCode = 'SIGTERM', c => c.stdin.destroyed = true,
    c => c.stdin.writable = false, c => c.stdin.writableEnded = true, c => c.stdin.writableFinished = true]) {
    const f = senderFixture(change); assert.equal(f.send('wall_timeout'), false); assert.deepEqual(f.writes, []);
  }
  const first = senderFixture(), second = senderFixture();
  assert.equal(first.send('操作者停止'), true); assert.equal(first.send('again'), false);
  assert.equal(second.send('wall_timeout'), true);
  assert.equal(Buffer.from(first.writes[0].trim(), 'base64').toString('utf8'), '操作者停止');
  first.state.terminal = true;
  const error = Object.assign(new Error('late pipe failure'), {code: 'EPIPE'});
  first.child.stdin.emit('error', error); assert.deepEqual(first.errors, [error]);
});

test('an asynchronous EPIPE after a stop remains observed with no second write', async () => {
  const failure = Object.assign(new Error('write EPIPE'), {code: 'EPIPE'}), errors = [], writes = [];
  const stdin = new Writable({write(chunk, _encoding, done) {
    writes.push(chunk.toString()); setImmediate(() => done(failure));
  }});
  const send = createRetainedNativeStopSender({stdin, exitCode: null, signalCode: null}, {
    isClosed: () => false, isSettled: () => false, hasTerminalFrame: () => false, onError: e => errors.push(e)
  });
  assert.equal(send('wall_timeout'), true); await nextTurn(); await nextTurn();
  assert.deepEqual(errors, [failure]); assert.equal(send('again'), false); assert.equal(writes.length, 1);
  stdin.destroy();
});

test('finalization preserves first-error precedence and does not certify cleanup', () => {
  const first = new Error('original');
  assert.equal(primaryErrorBeforeNativeFinalization({primaryError: first, stopReason: 'wall_timeout', proof: {exitCode: 1}}), first);
  assert.equal(primaryErrorBeforeNativeFinalization({stopReason: 'wall_timeout', protocolError: 'EPIPE', proof: {exitCode: 1}}).message, 'wall_timeout');
  assert.equal(primaryErrorBeforeNativeFinalization({protocolError: 'EPIPE', proof: {stopReason: 'other'}}).message, 'EPIPE');
  assert.equal(primaryErrorBeforeNativeFinalization({proof: {stopReason: 'stop', exitCode: 1}}).message, 'stop');
  const exit = primaryErrorBeforeNativeFinalization({proof: {exitCode: 7}});
  assert.equal(exit.message, 'worker_exit_7'); assert.equal(exit.status, 7);
  assert.equal(primaryErrorBeforeNativeFinalization({proof: {exitCode: 0}}), null);
  assert.equal(primaryErrorBeforeNativeFinalization({}), null);
});
