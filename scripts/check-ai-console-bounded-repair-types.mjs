// Use the installed Next generators in memory. Never write shared .next files,
// next-env.d.ts, tsconfig, mounted runtime roots, or a production build.
import ts from 'typescript'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { discoverRoutes } from 'next/dist/build/route-discovery.js'
import { createRouteTypesManifest } from 'next/dist/server/lib/router-utils/route-types-utils.js'
import { generateRouteTypesFile, generateValidatorFile } from 'next/dist/server/lib/router-utils/typegen.js'

const root = process.cwd()
const cachePaths = ['.next/dev/types/routes.d.ts', '.next/dev/types/validator.ts'].map(file => path.join(root, file))
const discovered = await discoverRoutes({ appDir: path.join(root, 'src/app'), pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  isDev: true, baseDir: root, isSrcDir: true })
const manifest = await createRouteTypesManifest({ ...discovered, dir: root, validatorFilePath: cachePaths[1] })
const generated = new Map([[cachePaths[0], generateRouteTypesFile(manifest)], [cachePaths[1], generateValidatorFile(manifest)]])
const digest = content => createHash('sha256').update(content).digest('hex')
const original = new Map(cachePaths.map(file => [file, ts.sys.readFile(file)]))
const diagnosticsFor = (file, content) => {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  return source.parseDiagnostics.map(item => ({ line: source.getLineAndCharacterOfPosition(item.start).line + 1,
    message: ts.flattenDiagnosticMessageText(item.messageText, '\n') }))
}
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const host = ts.createCompilerHost({ ...parsed.options, incremental: false, noEmit: true })
const read = host.readFile.bind(host)
host.readFile = file => generated.get(path.resolve(file)) ?? read(file)
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, incremental: false, noEmit: true }, host)
const diagnostics = ts.getPreEmitDiagnostics(program)
const result = { observedAtUtc: new Date().toISOString(), mode: 'installed_next_generators_in_memory_only',
  sharedCacheUnchanged: cachePaths.every(file => original.get(file) === ts.sys.readFile(file)),
  affectedCaches: cachePaths.map(file => ({ path: file, oldSha256: digest(original.get(file)),
    originalSyntaxErrors: diagnosticsFor(file, original.get(file)), generatedSha256: digest(generated.get(file)),
    generatedSyntaxErrors: diagnosticsFor(file, generated.get(file)) })),
  diagnostics: diagnostics.map(item => ({ path: item.file?.fileName ?? null,
    line: item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start).line + 1 : null,
    message: ts.flattenDiagnosticMessageText(item.messageText, '\n') })) }
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (diagnostics.length || !result.sharedCacheUnchanged) process.exitCode = 1
