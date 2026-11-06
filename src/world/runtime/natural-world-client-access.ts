// ARCH §4.3.1: a local baseline ID cannot establish a player's entitlement.
// The page and both image routes must make this check before reading legacy data.
export function requiresNaturalWorldPlayerGrant(worldId: string): boolean {
  return worldId.toLowerCase() === "mvp-natural-world-001"
}
