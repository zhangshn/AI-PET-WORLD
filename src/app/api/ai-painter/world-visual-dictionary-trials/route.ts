import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const root = process.cwd()
const trialsRoot = path.join(/* turbopackIgnore: true */ root, ".runtime", "world-visual-dictionary-trials")

export async function GET() {
  const latest = await readJson(path.join(trialsRoot, "latest.json"))
  const records = await readTrialRecords()
  const latestWithImage = latest
    ? {
        ...latest,
        imageUrl: `/api/ai-painter/world-visual-dictionary-trials/image?recordId=${encodeURIComponent(
          latest.latestRecordId,
        )}`,
      }
    : undefined

  return NextResponse.json({
    ok: true,
    latest: latestWithImage,
    records: records.map((record) => ({
      ...record,
      imageUrl: `/api/ai-painter/world-visual-dictionary-trials/image?recordId=${encodeURIComponent(record.recordId)}`,
    })),
  })
}

async function readTrialRecords() {
  try {
    const entries = await readdir(trialsRoot, { withFileTypes: true })
    const records = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const record = await readJson(path.join(trialsRoot, entry.name, "review-record.json"))
      if (record) records.push(summarizeRecord(record))
    }
    return records.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))).slice(0, 24)
  } catch {
    return []
  }
}

function summarizeRecord(record: Record<string, unknown>) {
  return {
    recordId: String(record.recordId ?? ""),
    createdAt: record.createdAt,
    source: record.source,
    sampleId: record.sampleId,
    machineStatus: record.machineStatus,
    agentStatus: record.agentStatus,
    ownerStatus: record.ownerStatus,
    trainingEligibility: record.trainingEligibility,
    failureCodes: Array.isArray(record.failureCodes) ? record.failureCodes : [],
    positiveLabels: Array.isArray(record.positiveLabels) ? record.positiveLabels : [],
    negativeLabels: Array.isArray(record.negativeLabels) ? record.negativeLabels : [],
    storedImagePath: record.storedImagePath,
    sourceScores: record.sourceScores,
  }
}

async function readJson(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch {
    return null
  }
}
