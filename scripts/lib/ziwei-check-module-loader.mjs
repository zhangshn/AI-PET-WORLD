import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

// Used only by standalone Ziwei checks. Anchor relative imports to the check
// entry and preserve its existing TypeScript compiler options.
export function createZiweiCheckRequire(entryUrl) {
  const require = createRequire(entryUrl)
  require.extensions['.ts'] = (loadedModule, filename) => {
    const source = readFileSync(filename, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText
    loadedModule._compile(output, filename)
  }
  return require
}
