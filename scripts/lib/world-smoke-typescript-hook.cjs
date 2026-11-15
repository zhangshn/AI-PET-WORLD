// Shared loader for the existing standalone world smoke tools.
// Installation remains process-wide, at each original caller's existing hook point.
function installWorldSmokeTypeScriptRequireHook({ moduleApi, path, repoRoot, localRequire, fs, ts }) {
  const moduleConstructor = moduleApi.default
  const originalResolveFilename = moduleConstructor._resolveFilename

  moduleConstructor._resolveFilename = function resolveFilename(
    request,
    parent,
    isMain,
    options
  ) {
    if (request.startsWith("@/")) {
      return originalResolveFilename.call(
        this,
        path.join(repoRoot, "src", request.slice(2)),
        parent,
        isMain,
        options
      )
    }

    return originalResolveFilename.call(this, request, parent, isMain, options)
  }

  localRequire.extensions[".ts"] = function compileTypescript(module, filename) {
    const source = fs.readFileSync(filename, "utf8")
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    }).outputText

    module._compile(output, filename)
  }
}

module.exports = { installWorldSmokeTypeScriptRequireHook }
