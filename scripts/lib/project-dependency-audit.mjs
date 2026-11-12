import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createJavascriptLoaderClassifier } from './javascript-loader-bindings.mjs'

// This is a source graph, not an execution trace. Computed imports and unresolved
// local specifiers are reported explicitly; imported project code is never run.
export function findDependencyCycles(graph, includeDeferred = false) {
  let next = 0
  const indices = new Map(), low = new Map(), active = new Set(), stack = [], cycles = []
  const edges = file => (graph[file] ?? []).filter(e => includeDeferred || e.kind !== 'deferred')
  function visit(file) {
    indices.set(file, next); low.set(file, next++); stack.push(file); active.add(file)
    for (const { to } of edges(file)) {
      if (!Object.hasOwn(graph, to)) continue
      if (!indices.has(to)) { visit(to); low.set(file, Math.min(low.get(file), low.get(to))) }
      else if (active.has(to)) low.set(file, Math.min(low.get(file), indices.get(to)))
    }
    if (low.get(file) === indices.get(file)) {
      const members = []; let member
      do { member = stack.pop(); active.delete(member); members.push(member) } while (member !== file)
      if (members.length > 1 || edges(file).some(e => e.to === file)) cycles.push(members.sort())
    }
  }
  for (const file of Object.keys(graph).sort()) if (!indices.has(file)) visit(file)
  return cycles.sort((a, b) => a[0].localeCompare(b[0]))
}

export function auditProjectDependencies({ root = process.cwd(), roots = ['src', 'scripts'] } = {}) {
  root = path.resolve(root)
  const relative = file => path.relative(root, file).split(path.sep).join('/')
  const files = [], skippedLinks = []
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) { skippedLinks.push(relative(file)); continue }
      if (entry.isDirectory()) collect(file)
      else if (/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(entry.name)) files.push(relative(file))
    }
  }
  for (const directory of roots) {
    const absolute = path.resolve(root, directory), rel = path.relative(root, absolute)
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw Error('dependency root outside project')
    if (fs.lstatSync(absolute).isSymbolicLink()) throw Error('dependency root cannot be a symlink')
    collect(absolute)
  }
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  if (config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  if (parsed.errors.length) throw Error(parsed.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'))
  const graph = Object.fromEntries(files.map(file => [file, []]))
  const foldedFiles = new Map()
  for (const file of files) {
    const folded = file.toLowerCase()
    foldedFiles.set(folded, foldedFiles.has(folded) ? null : file)
  }
  const typeOnly = [], unresolved = [], computedImports = [], parseErrors = [], localRequireCalls = []
  const assetImports = [], outsideSourceImports = [], runtimeEvidenceImports = []
  const assetExtensions = /\.(?:css|scss|sass|less|json|svg|png|jpe?g|gif|webp|woff2?|ttf)$/u
  function samePhysicalSource(left, right) {
    const a = fs.statSync(left, { bigint: true }), b = fs.statSync(right, { bigint: true })
    return a.isFile() && b.isFile() && a.dev === b.dev && a.ino === b.ino
  }
  function aliasTargets(specifier) {
    const mappings = parsed.options.paths ?? {}
    if (Object.hasOwn(mappings, specifier)) return mappings[specifier]
    let best = null
    for (const [pattern, targets] of Object.entries(mappings)) {
      const wildcard = pattern.indexOf('*')
      if (wildcard < 0) continue
      const prefix = pattern.slice(0, wildcard), suffix = pattern.slice(wildcard + 1)
      if (specifier.length < prefix.length + suffix.length || !specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue
      if (best && best.prefixLength >= prefix.length) continue
      const matched = specifier.slice(prefix.length, specifier.length - suffix.length)
      best = { prefixLength: prefix.length, targets: targets.map(target => target.replace('*', matched)) }
    }
    return best?.targets ?? null
  }
  function localCandidates(specifier, file) {
    return specifier.startsWith('.') ? [path.resolve(path.dirname(file), specifier)]
      : (aliasTargets(specifier) ?? []).map(target => path.resolve(parsed.options.baseUrl ?? root, target))
  }
  function existingAsset(specifier, file) {
    return localCandidates(specifier, file).find(candidate => assetExtensions.test(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  }
  for (const file of files) {
    const absolute = path.join(root, file), source = ts.createSourceFile(absolute, fs.readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true)
    const location = node => ({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 })
    for (const d of source.parseDiagnostics) parseErrors.push({ file, line: source.getLineAndCharacterOfPosition(d.start ?? 0).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })
    // TypeScript's syntax-only parser accepts duplicate import declarations,
    // although Node rejects the module before any of its functions can run.
    const runtimeImportBindings = new Set()
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue
      const clause = statement.importClause
      if (!clause) continue
      const names = clause.name ? [clause.name] : []
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) names.push(clause.namedBindings.name)
        else for (const element of clause.namedBindings.elements) if (!element.isTypeOnly) names.push(element.name)
      }
      for (const name of names) {
        if (runtimeImportBindings.has(name.text)) parseErrors.push({ file,
          line: source.getLineAndCharacterOfPosition(name.getStart(source)).line + 1,
          message: `Duplicate runtime import binding: ${name.text}` })
        runtimeImportBindings.add(name.text)
      }
    }
    const loaderBase = createJavascriptLoaderClassifier(source)
    function visit(node) {
      let spec, kind = 'static', type = false, base = 'source'
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        spec = node.moduleSpecifier; type = node.isTypeOnly || node.importClause?.isTypeOnly || false
        const names = node.importClause?.namedBindings ?? node.exportClause
        if (names && (ts.isNamedImports(names) || ts.isNamedExports(names)) && names.elements.length && names.elements.every(e => e.isTypeOnly) && !node.importClause?.name) type = true
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        spec = node.moduleReference.expression; type = node.isTypeOnly
      } else if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          spec = node.arguments[0]; kind = 'deferred'
        } else {
          base = loaderBase(node.expression)
          if (base === 'local-function') localRequireCalls.push({ ...location(node), binding: 'const-local-function' })
          else if (base) spec = node.arguments[0]
        }
      }
      if (spec) {
        if (!ts.isStringLiteralLike(spec)) computedImports.push({ ...location(spec), expression: spec.getText(source).slice(0, 160) })
        else if (base === 'unknown' && (spec.text.startsWith('.') || spec.text.startsWith('@/') || aliasTargets(spec.text) !== null)) {
          computedImports.push({ ...location(spec), expression: spec.getText(source), reason: 'createRequire_base_not_current_source' })
        }
        else if (spec.text.startsWith('.') || spec.text.startsWith('@/') || aliasTargets(spec.text) !== null) {
          const resolved = ts.resolveModuleName(spec.text, absolute, parsed.options, ts.sys).resolvedModule?.resolvedFileName
          let to = resolved && relative(resolved)
          const sameName = to && foldedFiles.get(to.toLowerCase())
          if (to && !Object.hasOwn(graph, to) && sameName
            && samePhysicalSource(resolved, path.join(root, sameName))) to = sameName
          if (to && Object.hasOwn(graph, to)) {
            const edge = { to, kind, line: location(spec).line }
            if (type) typeOnly.push({ file, ...edge })
            else if (!graph[file].some(e => e.to === to && e.kind === kind)) graph[file].push(edge)
          } else {
            const asset = existingAsset(spec.text, absolute)
            const row = { ...location(spec), specifier: spec.text, resolved: to ?? (asset ? relative(asset) : null) }
            const declaredTarget = localCandidates(spec.text, absolute).map(relative).find(p => p.startsWith('.runtime/'))
            if (to?.startsWith('.runtime/') || declaredTarget) runtimeEvidenceImports.push({ ...row, declaredTarget: declaredTarget ?? to })
            if (asset) assetImports.push(row)
            else if (to) {
              outsideSourceImports.push(row)
            } else unresolved.push(row)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { scope: 'JS/TS in declared source roots; local literal imports, exports and require; no module execution',
    files: files.length, edgeCount: Object.values(graph).reduce((sum, edges) => sum + edges.length, 0), graph,
    staticCycles: findDependencyCycles(graph), includingDeferredCycles: findDependencyCycles(graph, true),
    typeOnly, unresolved, computedImports, localRequireCalls, skippedLinks, parseErrors, assetImports, outsideSourceImports, runtimeEvidenceImports }
}
