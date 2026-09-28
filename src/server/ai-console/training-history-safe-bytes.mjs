import { createHash } from 'node:crypto'
import { open, realpath } from 'node:fs/promises'
import path from 'node:path'

const SHA = /^[a-f0-9]{64}$/
export class HistoryError extends Error {
  constructor(code, status = 409) { super(code); this.status = status }
}
export function requireFact(value, code, status = 409) { if (!value) throw new HistoryError(code, status) }
function inside(root, file) { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)) }

// Only the explicitly registered F: runtime junction is an external read root.
// A different checkout may read its own local data/runtime; it cannot grant a disk.
export async function safePath(root, logical) {
  requireFact(typeof logical === 'string' && !logical.includes('\\') && !logical.split('/').some(p => p === '..' || p === '.' || p === '') && /^(?:\.runtime|data|cold)\//.test(logical), 'history_path_outside_root')
  const base = await realpath(root)
  const namespace = logical.split('/')[0]
  const logicalRoot = path.join(base, namespace)
  const resolvedRoot = await realpath(logicalRoot)
  const registered = process.platform === 'win32' && base.toLowerCase() === path.resolve('F:/ai-pet-world').toLowerCase()
    && namespace === '.runtime' && resolvedRoot.toLowerCase() === path.resolve('D:/AI-PET-WORLD-DATA/hot/runtime').toLowerCase()
  requireFact(inside(base, resolvedRoot) || registered, 'history_unregistered_mount')
  const resolved = await realpath(path.join(base, logical))
  requireFact(inside(resolvedRoot, resolved), 'history_symlink_escape')
  return resolved
}
export async function bytes(root, logical, maximum, expected) {
  const filename = await safePath(root, logical)
  const handle = await open(filename, 'r')
  try {
    const meta = await handle.stat()
    requireFact(meta.isFile(), 'history_not_regular_file')
    requireFact(meta.size <= maximum, 'history_byte_limit', 413)
    const buffer = Buffer.alloc(meta.size + 1)
    let used = 0
    while (used < buffer.length) { const read = await handle.read(buffer, used, buffer.length - used, used); if (!read.bytesRead) break; used += read.bytesRead }
    requireFact(used === meta.size, 'history_file_changed')
    const value = buffer.subarray(0, used)
    const digest = createHash('sha256').update(value).digest('hex')
    if (expected !== undefined) requireFact(SHA.test(expected) && digest === expected, 'history_sha_mismatch')
    return { value, sha256: digest }
  } finally { await handle.close() }
}
