/** Compare behavior content independently of legacy event tick tokens. */
export function normalizeRuntimeActionSignature(signature: string): string {
  return signature
    .split("|")
    .filter((token) => !/^tick:\d+$/.test(token))
    .join("|")
}

export function hasRepeatedRecentActionSignatures(signatures: string[]): boolean {
  const recent = signatures.slice(-3).map(normalizeRuntimeActionSignature)

  return recent.length === 3 && recent.every((signature) => signature.length > 0 && signature === recent[0])
}
