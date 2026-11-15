import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {coldRunsRoot} from '../../lib/ai-pet-world-storage.mjs'

// Historical test bytes only: never import, execute, restore, or grant eligibility.
export const canonicalFixtureIdentity = Object.freeze({
  path: 'scripts/lib/real-earth-region-governance.mjs',
  commit: 'f2851528e84816aae6fbb42a88ef4769c7c5a803',
  sha256: 'c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1',
  bytes: 30949,
})
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
export const canonicalFixtureArchiveDirectory = `frozen-qualification-canonical-${canonicalFixtureIdentity.sha256}`

export function readQualificationCanonicalFixture(projectRoot, binding, {coldRoot = coldRunsRoot} = {}) {
  assert.equal(binding.path, canonicalFixtureIdentity.path, 'unknown canonical fixture path')
  assert.equal(binding.sha256, canonicalFixtureIdentity.sha256, 'unknown canonical fixture identity')
  const archiveRoot = path.resolve(coldRoot, canonicalFixtureArchiveDirectory)
  const archived = path.join(archiveRoot, canonicalFixtureIdentity.path)
  const stat = fs.lstatSync(archived, {throwIfNoEntry: false})
  let bytes, origin
  if (stat) {
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.size === canonicalFixtureIdentity.bytes, 'invalid canonical fixture archive')
    const relative = path.relative(fs.realpathSync(coldRoot), fs.realpathSync(archived))
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'canonical fixture escapes cold storage')
    bytes = fs.readFileSync(archived)
    origin = 'cold_archive'
  } else {
    const result = spawnSync('git', ['-C', path.resolve(projectRoot), 'show', `${canonicalFixtureIdentity.commit}:${canonicalFixtureIdentity.path}`], {
      windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024,
      env: {...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0'},
    })
    assert(!result.error && result.status === 0, 'frozen canonical fixture unavailable in local Git; no network recovery')
    bytes = result.stdout
    origin = 'local_git'
  }
  assert.equal(bytes.length, canonicalFixtureIdentity.bytes, 'canonical fixture length mismatch')
  assert.equal(digest(bytes), canonicalFixtureIdentity.sha256, 'canonical fixture SHA mismatch')
  return {bytes, origin, sha256: canonicalFixtureIdentity.sha256}
}
