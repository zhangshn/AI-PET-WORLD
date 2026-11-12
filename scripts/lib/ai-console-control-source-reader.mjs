import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// Read the facade and its local control components for existing contract checks.
// This is static inspection only: no imported code or control command is executed.
export function readAiConsoleControlSource(entryPath) {
  const root = path.dirname(path.resolve(entryPath)), seen = new Set(), sources = []
  function visit(file) {
    if (seen.has(file)) return
    seen.add(file)
    if (seen.size > 16) throw Error('console_control_source_limit')
    const source = fs.readFileSync(file, 'utf8')
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    if (parsed.parseDiagnostics.length) throw Error('console_control_source_parse_error')
    sources.push(source)
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
      const specifier = statement.moduleSpecifier
      if (!specifier || !ts.isStringLiteral(specifier)) continue
      const value = specifier.text
      if (!value.startsWith('./ai-console-control-')) continue
      if (!/^\.\/ai-console-control-[a-z-]+$/u.test(value)) throw Error('console_control_source_path_invalid')
      const candidates = ['.tsx', '.ts'].map(extension => path.resolve(root, value + extension)).filter(fs.existsSync)
      if (candidates.length !== 1 || path.dirname(candidates[0]) !== root) throw Error('console_control_source_missing_or_ambiguous')
      visit(candidates[0])
    }
  }
  visit(path.resolve(entryPath))
  return sources.join('\n')
}
