import path from 'node:path'
import ts from 'typescript'

// Shared syntax-only binding recognition. Never imports or evaluates the inspected module.
export function createJavascriptLoaderClassifier(source) {
  const absolute = path.resolve(source.fileName)
  // Resolve lexical bindings without following imports or evaluating source.
  // A local condition checker named require is not Node's module loader.
  const importsNodeModule = source.statements.some(n => ts.isImportDeclaration(n)
    && ts.isStringLiteral(n.moduleSpecifier) && ['node:module', 'module'].includes(n.moduleSpecifier.text))
  let checker
  function declaration(identifier) {
    if (!checker) {
      const options = { allowJs: true, noResolve: true, noLib: true, types: [], target: ts.ScriptTarget.Latest }
      const host = ts.createCompilerHost(options)
      host.getSourceFile = name => path.resolve(name) === absolute ? source : undefined
      checker = ts.createProgram([absolute], options, host).getTypeChecker()
    }
    return checker.getSymbolAtLocation(identifier)?.declarations?.[0]
  }
  function fromNodeModule(node) {
    while (node && !ts.isImportDeclaration(node)) node = node.parent
    return node && ts.isStringLiteral(node.moduleSpecifier)
      && ['node:module', 'module'].includes(node.moduleSpecifier.text)
  }
  function factoryBase(call) {
    if (!importsNodeModule || !ts.isCallExpression(call)) return null
    const callee = call.expression
    let native = false
    if (ts.isIdentifier(callee)) {
      const bound = declaration(callee)
      native = bound && ts.isImportSpecifier(bound)
        && (bound.propertyName ?? bound.name).text === 'createRequire' && fromNodeModule(bound)
    } else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'createRequire'
      && ts.isIdentifier(callee.expression)) {
      const bound = declaration(callee.expression)
      native = bound && (ts.isNamespaceImport(bound) || ts.isImportClause(bound)) && fromNodeModule(bound)
    }
    if (!native) return null
    const base = call.arguments[0]
    return base && ts.isPropertyAccessExpression(base) && base.name.text === 'url'
      && ts.isMetaProperty(base.expression) && base.expression.keywordToken === ts.SyntaxKind.ImportKeyword
      ? 'source' : 'unknown'
  }
  function loaderBase(callee) {
    if (ts.isCallExpression(callee)) return factoryBase(callee)
    if (!ts.isIdentifier(callee) || callee.text !== 'require' && !importsNodeModule) return null
    const bound = declaration(callee)
    if (bound && ts.isVariableDeclaration(bound)) {
      const initial = bound.initializer
      if (callee.text === 'require' && (bound.parent.flags & ts.NodeFlags.Const)
        && initial && (ts.isArrowFunction(initial) || ts.isFunctionExpression(initial))) return 'local-function'
      const base = initial && factoryBase(initial)
      if (base) return base
    }
    // Unknown/mutable bindings named require remain possible loaders.
    return callee.text === 'require' ? 'source' : null
  }
  return loaderBase
}
