// Compare source-fact identities without imposing ordering. Keep the caller
// contract for list length, and never let repeated IDs hide a missing fact.
// This is a pure identity comparison, not authority to publish a world/frame.
export function sameSourceFactIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return leftSet.size === rightSet.size && left.every(value => rightSet.has(value))
}
