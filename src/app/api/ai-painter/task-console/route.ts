import { NextResponse } from "next/server";
import { readLocalTaskConsoleSnapshot } from "@/server/ai-painter-local-task-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readLocalTaskConsoleSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
