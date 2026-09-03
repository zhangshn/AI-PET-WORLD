export type CreateWorldPerspective = "unspecified" | "female" | "male"

export type CreateWorldInput = {
  year: number
  month: number
  day: number
  time: string | null
  hasBirthHour: boolean
  perspective: CreateWorldPerspective
  /** Stable birth-derived seed; never used as creation time. */
  birthSeed?: string
  /** Legacy client field retained for wire compatibility; server ignores it. */
  createdAt: number
}

export const CREATE_WORLD_STORAGE_KEY = "ai-pet-world:create-world-input"

export function serializeCreateWorldInput(input: CreateWorldInput): string {
  return JSON.stringify(input)
}
