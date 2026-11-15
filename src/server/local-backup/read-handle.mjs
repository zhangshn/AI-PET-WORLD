import fs from 'node:fs'
import { ModuleError } from './contracts.mjs'

// Synchronous readers keep the first failure even when closing also fails.
export function withReadHandle(file, read) {
  const fd = fs.openSync(file, 'r'), errors = []
  let result
  try { result = read(fd) } catch (error) { errors.push(error) }
  try { fs.closeSync(fd) } catch (error) { errors.push(error) }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'Read and close failed', { cause: errors[0] })
  return result
}

export function readModuleError(error, missingCode, unavailableCode) {
  if (error instanceof ModuleError) return error
  const first = error instanceof AggregateError ? error.errors[0] : error
  const failure = new ModuleError(
    first instanceof ModuleError ? first.message : first?.code === 'ENOENT' ? missingCode : unavailableCode,
    first instanceof ModuleError ? first.status : 503,
  )
  Object.defineProperty(failure, 'cause', { value: error, configurable: true })
  return failure
}
