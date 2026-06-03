import forbiddenTokens from "./world-runtime-forbidden-tokens.json"

export const WORLD_RUNTIME_FORBIDDEN_TOKENS = forbiddenTokens

export function findWorldRuntimeForbiddenTokenHits(value: string): string[] {
  const normalizedValue = value.toLowerCase()

  return WORLD_RUNTIME_FORBIDDEN_TOKENS.filter((token) =>
    normalizedValue.includes(token.toLowerCase())
  )
}

export function containsWorldRuntimeForbiddenToken(value: string): boolean {
  return findWorldRuntimeForbiddenTokenHits(value).length > 0
}
