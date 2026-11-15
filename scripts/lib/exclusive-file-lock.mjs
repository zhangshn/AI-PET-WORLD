import fs from 'node:fs'

// Failed initialization leaves the lock file as evidence. It never grants a
// release callback; successful callers can release only the file they created.
export function acquireExclusiveFileLock(lockPath, lockBytes) {
  const descriptor = fs.openSync(lockPath, 'wx')
  const errors = []
  let identity
  try {
    fs.writeFileSync(descriptor, lockBytes)
    identity = fs.fstatSync(descriptor, { bigint: true })
  } catch (error) {
    errors.push(error)
  } finally {
    try { fs.closeSync(descriptor) } catch (error) { errors.push(error) }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'Lock initialization and close failed', { cause: errors[0] })

  let released = false
  return () => {
    if (released) return
    let current
    try { current = fs.lstatSync(lockPath, { bigint: true }) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      released = true
      return
    }
    if (!current.isFile() || current.isSymbolicLink() || current.ino !== identity.ino || current.dev !== identity.dev
      || fs.readFileSync(lockPath, 'utf8') !== lockBytes) {
      released = true
      return
    }
    fs.unlinkSync(lockPath)
    released = true
  }
}
