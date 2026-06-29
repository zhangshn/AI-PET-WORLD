export function safeModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function mod12(value: number): number {
  return safeModulo(value, 12)
}

export function mod10(value: number): number {
  return safeModulo(value, 10)
}
