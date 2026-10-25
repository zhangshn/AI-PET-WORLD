// Private 004 observation only: these checks grant no native cleanup authority.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const sidecarCeilings = Object.freeze({wal: 524288, shm: 32768});
export const SQLITE_SIDECAR_RESERVE = 557056;
const regular = stat => assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);

export function observeAffinity(proof, observation) {
  assert.equal(observation.ownerPid, proof.ownerPid);
  assert.equal(observation.bindingBase64, proof.bindingBase64);
  assert.equal(observation.ownerAffinityMask, '3');
  return observation.ownerAffinityMask;
}

export function readLifecycleTerminal(root, io = fs) {
  return JSON.parse(io.readFileSync(path.join(root, 'phase-terminal.json')));
}

export function measure(root, io = fs) {
  return io.readdirSync(root, {withFileTypes: true}).reduce((total, entry) => {
    const file = path.join(root, entry.name);
    const side = /^(registry|execution)\.sqlite-(wal|shm)$/.exec(entry.name);
    const checkSide = (file, kind) => {
      try {
        const stat = io.lstatSync(file);
        regular(stat);
        assert(stat.size <= sidecarCeilings[kind]);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    };
    if (side) {
      regular(io.lstatSync(path.join(root, side[1] + '.sqlite')));
      checkSide(file, side[2]);
      return total; // Accounted once at the verified core, even if removed.
    }
    const stat = io.lstatSync(file);
    assert(!stat.isSymbolicLink());
    if (/^(registry|execution)\.sqlite$/.test(entry.name)) regular(stat);
    if (stat.isDirectory()) return total + measure(file, io);
    regular(stat);
    if (/^(registry|execution)\.sqlite$/.test(entry.name)) {
      for (const kind of Object.keys(sidecarCeilings)) checkSide(file + '-' + kind, kind);
      return total + stat.size + SQLITE_SIDECAR_RESERVE;
    }
    return total + stat.size;
  }, 0);
}
