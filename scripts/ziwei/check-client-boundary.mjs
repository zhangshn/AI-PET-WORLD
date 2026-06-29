import { readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const require = createRequire(import.meta.url)
const appZiweiDir = path.join(root, "src", "app", "ziwei")
const coreImportPrefix = "@/ai/destiny-core/ziwei-core"
const allowedClientTypeModule = "@/ai/destiny-core/ziwei-core/contracts"

function fail(message) {
  console.error(`Ziwei client boundary check failed: ${message}`)
  process.exit(1)
}

function collectSourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const absolutePath = path.join(dir, entry)
    const stats = statSync(absolutePath)

    if (stats.isDirectory()) {
      return collectSourceFiles(absolutePath)
    }

    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      return [absolutePath]
    }

    return []
  })
}

function isUseClientSource(sourceFile) {
  const firstStatement = sourceFile.statements[0]

  return Boolean(
    firstStatement &&
      ts.isExpressionStatement(firstStatement) &&
      ts.isStringLiteral(firstStatement.expression) &&
      firstStatement.expression.text === "use client",
  )
}

function isTypeOnlyImport(importClause) {
  if (!importClause) {
    return false
  }

  if (importClause.isTypeOnly) {
    return true
  }

  if (importClause.name) {
    return false
  }

  const namedBindings = importClause.namedBindings

  if (!namedBindings) {
    return false
  }

  if (ts.isNamespaceImport(namedBindings)) {
    return false
  }

  return namedBindings.elements.length > 0 && namedBindings.elements.every((element) => {
    return element.isTypeOnly
  })
}

require.resolve("typescript")

const sourceFiles = collectSourceFiles(appZiweiDir)
const violations = []

sourceFiles.forEach((sourcePath) => {
  const sourceText = readFileSync(sourcePath, "utf8")
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  if (!isUseClientSource(sourceFile)) {
    return
  }

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      return
    }

    const moduleName = statement.moduleSpecifier.text

    if (!moduleName.startsWith(coreImportPrefix)) {
      return
    }

    const typeOnly = isTypeOnlyImport(statement.importClause)

    if (moduleName !== allowedClientTypeModule || !typeOnly) {
      violations.push({
        sourcePath,
        moduleName,
        line: sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1
      })
    }
  })
})

if (violations.length > 0) {
  fail(
    violations
      .map((violation) => {
        return `${path.relative(root, violation.sourcePath)}:${violation.line} imports ${violation.moduleName}`
      })
      .join("\n"),
  )
}

console.log("Ziwei client boundary check passed.")
