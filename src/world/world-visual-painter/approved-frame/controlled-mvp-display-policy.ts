export function isControlledMvpDisplayEnvironmentAllowed(
  runtimeEnvironment = process.env.NODE_ENV
): boolean {
  return runtimeEnvironment !== "production"
}
