export type WorldEvolutionStep = {
  step: number
  logicalStartUtc: string
  logicalEndUtc: string
  values: {precipitation: number; humidity: number; temperature: number; windSpeed: number}
  historyEvents: number
  committed: boolean
}

export type WorldEvolutionProjection = {
  status: 'verified_record' | 'unavailable' | 'conflict'
  label: string
  reason: string
  readAtUtc: string
  observedAtUtc: string | null
  runId: string | null
  worldId: string | null
  formalWorldId: string | null
  formalTick: number | null
  steps: WorldEvolutionStep[]
  checks: {threeCommits: boolean; historyAffectsOutput: boolean; metadataUnchanged: boolean; independentReadback: boolean} | null
  elapsedSeconds: number | null
  completedAtUtc: string | null
  scope: 'private_integration'
  sources: {path: string; sha256: string}[]
  next: string[]
  workHref: string | null
}
