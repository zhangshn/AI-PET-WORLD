import { NextResponse } from "next/server"

import { readLocalImageModelImplementationHealth } from "../../../../../services/local-image-model/implementation.mjs"

export async function GET() {
  const health = readLocalImageModelImplementationHealth()

  return NextResponse.json(health, { status: 200 })
}
