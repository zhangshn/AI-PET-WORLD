import fs from 'node:fs'
import path from 'node:path'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'

const FILES = new Set(['natural-world-bootstrap.ts', 'world-runtime-store-adapter.ts', 'world-runtime-store.ts',
  'world-runtime-production-store.ts', 'world-runtime-record-validation.ts', 'world-runtime-schema.ts', 'runtime-path-security.ts', 'world-evolution-transaction.ts'])
const pendingByRoot = new Map()
/** Node24's fixed native type stripper; no arbitrary transpilation or source selection. */
export async function loadNaturalWorldBaselineRuntime(root = process.cwd()) {
  const key = fs.realpathSync(root)
  if (key !== fs.realpathSync(process.cwd())) throw new Error('baseline_loader_cwd')
  if (pendingByRoot.has(key)) return pendingByRoot.get(key)
  const pending = (async () => {
    const directory = path.join(key, 'src/world/runtime')
    const prefix = pathToFileURL(directory + path.sep).href
    const hook = registerHooks({ resolve(specifier, context, next) {
      if (context.parentURL?.startsWith(prefix) && specifier.startsWith('.') && !path.extname(specifier)) {
        const url = new URL(specifier + '.ts', context.parentURL)
        if (!url.href.startsWith(prefix) || !FILES.has(path.basename(url.pathname))) throw new Error('baseline_loader_dependency')
        return next(url.href, context)
      }
      return next(specifier, context)
    } })
    try {
      return {
        bootstrap: await import(pathToFileURL(path.join(directory, 'natural-world-bootstrap.ts')).href),
        facade: await import(pathToFileURL(path.join(directory, 'world-runtime-store-adapter.ts')).href),
        validation: await import(pathToFileURL(path.join(directory, 'world-runtime-record-validation.ts')).href),
      }
    } finally { hook.deregister() }
  })()
  pendingByRoot.set(key, pending)
  pending.catch(() => { if (pendingByRoot.get(key) === pending) pendingByRoot.delete(key) })
  return pending
}
