// Deployment data paths are evaluated by the Node host at runtime. They are
// not build assets: Next's static path evaluator otherwise expands unknown
// inputs into project-wide filesystem globs. Static imports remain traceable.
// Requires the project's Node 24 runtime; no fallback to a build-time root.
export function runtimeWorkingDirectory() {
  return process.getBuiltinModule('process').cwd()
}

/** @param {...string} segments */
export function resolveRuntimePath(...segments) {
  return process.getBuiltinModule('path').resolve(...segments)
}
