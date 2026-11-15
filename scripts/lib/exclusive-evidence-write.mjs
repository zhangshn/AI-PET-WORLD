import fs from 'node:fs'

// Failed writes stay on disk as evidence. Existing paths are never overwritten.
export function writeExclusiveEvidence(file, bytes, mode) {
  const descriptor = mode === undefined ? fs.openSync(file, 'wx') : fs.openSync(file, 'wx', mode)
  const errors = []
  try {
    fs.writeFileSync(descriptor, bytes)
    fs.fsyncSync(descriptor)
  } catch (error) {
    errors.push(error)
  } finally {
    try { fs.closeSync(descriptor) } catch (error) { errors.push(error) }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) {
    throw new AggregateError(errors, `Exclusive evidence write and close failed: ${errors.map(error => error instanceof Error ? error.message : String(error)).join('; ')}`, { cause: errors[0] })
  }
}
