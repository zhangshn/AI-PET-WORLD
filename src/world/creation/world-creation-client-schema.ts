export type CreateWorldPerspective = "unspecified" | "female" | "male"

export type CreateWorldInput = {
  year: number
  month: number
  day: number
  time: string | null
  hasBirthHour: boolean
  perspective: CreateWorldPerspective
  createdAt: number
}

export const CREATE_WORLD_STORAGE_KEY = "ai-pet-world:create-world-input"

export function serializeCreateWorldInput(input: CreateWorldInput): string {
  return JSON.stringify(input)
}
